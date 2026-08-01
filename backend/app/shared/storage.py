"""Object storage behind a port (Part 4.2 — S3/MinIO is swappable).

The ``ObjectStorage`` protocol is the narrow interface the rest of the app
depends on (SOLID-D / ISP). Two implementations ship:

- ``S3ObjectStorage``: boto3-backed, production. Presigned PUT/GET URLs keep
  large bytes out of FastAPI (Part 3.8).
- ``LocalObjectStorage``: filesystem-backed, for dev and tests. ``presign_*``
  return ``local://<key>`` pseudo-URLs because there is no HTTP endpoint to
  serve them; callers write via ``put_bytes`` (tests) or a future dev server.

All methods are sync so they run in Starlette's threadpool like the rest of the
SQLAlchemy-based stack.
"""

from __future__ import annotations

import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError

LOCAL_URL_SCHEME = "local://"


@dataclass(frozen=True)
class ObjectMetadata:
    size_bytes: int
    etag: str | None = None
    content_type: str | None = None


class ObjectStorage(Protocol):
    """Narrow port for object read/write/presign/delete operations."""

    def presign_put(self, key: str, *, content_type: str, expires_in: int) -> str: ...

    def presign_get(self, key: str, *, expires_in: int) -> str: ...

    def put_bytes(self, key: str, data: bytes, *, content_type: str) -> None: ...

    def get_bytes(self, key: str, *, limit: int | None = None) -> bytes: ...

    def head(self, key: str) -> ObjectMetadata | None: ...

    def delete(self, key: str) -> None: ...


class LocalObjectStorage:
    """Filesystem implementation. Keys are relative paths under ``root``.

    Path traversal is prevented: keys are joined under the root and the resolved
    target must stay inside it.
    """

    def __init__(self, root: str | Path) -> None:
        self._root = Path(root).resolve()

    def _path(self, key: str) -> Path:
        target = (self._root / key).resolve()
        if not target.is_relative_to(self._root):
            raise ValueError(f"storage key escapes root: {key!r}")
        return target

    def presign_put(self, key: str, *, content_type: str, expires_in: int) -> str:
        self._path(key)
        return f"{LOCAL_URL_SCHEME}{key}"

    def presign_get(self, key: str, *, expires_in: int) -> str:
        self._path(key)
        return f"{LOCAL_URL_SCHEME}{key}"

    def put_bytes(self, key: str, data: bytes, *, content_type: str) -> None:
        target = self._path(key)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)

    def get_bytes(self, key: str, *, limit: int | None = None) -> bytes:
        target = self._path(key)
        if not target.is_file():
            raise FileNotFoundError(key)
        with target.open("rb") as handle:
            return handle.read(limit)

    def head(self, key: str) -> ObjectMetadata | None:
        target = self._path(key)
        if not target.is_file():
            return None
        stat = target.stat()
        return ObjectMetadata(size_bytes=stat.st_size, etag=f"{stat.st_mtime_ns:x}")

    def delete(self, key: str) -> None:
        target = self._path(key)
        if target.is_file():
            target.unlink()
        shutil.rmtree(target, ignore_errors=True)


class S3ObjectStorage:
    """boto3-backed implementation for AWS S3 / MinIO (path-style, v4 sig)."""

    def __init__(
        self,
        *,
        bucket: str,
        endpoint_url: str | None = None,
        region: str = "us-east-1",
        access_key: str | None = None,
        secret_key: str | None = None,
        force_path_style: bool = True,
    ) -> None:
        self._bucket = bucket
        import boto3

        self._client = boto3.client(
            "s3",
            endpoint_url=endpoint_url,
            region_name=region,
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            config=Config(
                s3={"addressing_style": "path" if force_path_style else "auto"},
                signature_version="s3v4",
            ),
        )

    def presign_put(self, key: str, *, content_type: str, expires_in: int) -> str:
        return self._client.generate_presigned_url(
            "put_object",
            Params={
                "Bucket": self._bucket,
                "Key": key,
                "ContentType": content_type,
            },
            ExpiresIn=expires_in,
        )

    def presign_get(self, key: str, *, expires_in: int) -> str:
        return self._client.generate_presigned_url(
            "get_object",
            Params={"Bucket": self._bucket, "Key": key},
            ExpiresIn=expires_in,
        )

    def put_bytes(self, key: str, data: bytes, *, content_type: str) -> None:
        self._client.put_object(
            Bucket=self._bucket, Key=key, Body=data, ContentType=content_type
        )

    def get_bytes(self, key: str, *, limit: int | None = None) -> bytes:
        params: dict = {"Bucket": self._bucket, "Key": key}
        if limit is not None:
            params["Range"] = f"bytes=0-{limit - 1}"
        response = self._client.get_object(**params)
        return response["Body"].read()

    def head(self, key: str) -> ObjectMetadata | None:
        try:
            response = self._client.head_object(Bucket=self._bucket, Key=key)
        except ClientError as exc:
            code = exc.response.get("Error", {}).get("Code", "")
            if code in {"404", "NoSuchKey", "NotFound"}:
                return None
            raise
        return ObjectMetadata(
            size_bytes=response.get("ContentLength", 0),
            etag=response.get("ETag"),
            content_type=response.get("ContentType"),
        )

    def delete(self, key: str) -> None:
        try:
            self._client.delete_object(Bucket=self._bucket, Key=key)
        except (ClientError, BotoCoreError):
            return
