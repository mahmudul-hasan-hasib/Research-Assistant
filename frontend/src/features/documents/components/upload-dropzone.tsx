"use client";

import { motion } from "framer-motion";
import { UploadCloud } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

import { cn } from "@/utils/cn";

interface UploadDropzoneProps {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
  busy?: boolean;
}

export function UploadDropzone({ onFiles, disabled, busy }: UploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const openPicker = () => inputRef.current?.click();

  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      const list = Array.from(files);
      if (list.length === 0) return;
      if (disabled || busy) return;
      onFiles(list);
    },
    [onFiles, disabled, busy],
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <button
        type="button"
        onClick={openPicker}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled && !busy) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (busy) {
            toast.info("Please wait for current uploads to finish");
            return;
          }
          handleFiles(event.dataTransfer.files);
        }}
        disabled={disabled || busy}
        className={cn(
          "flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors",
          dragging
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/40",
          (disabled || busy) && "cursor-not-allowed opacity-60",
        )}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <UploadCloud className="h-6 w-6" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium">
            {busy ? "Uploading…" : "Drag & drop files here"}
          </p>
          <p className="text-xs text-muted-foreground">
            or click to browse · PDF, DOCX, TXT, MD, CSV, PNG, JPG, MP4 · up to 100 MB
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          accept=".pdf,.docx,.txt,.md,.csv,.png,.jpg,.jpeg,.mp4"
          onChange={(event) => {
            if (event.target.files) handleFiles(event.target.files);
            event.target.value = "";
          }}
        />
      </button>
    </motion.div>
  );
}
