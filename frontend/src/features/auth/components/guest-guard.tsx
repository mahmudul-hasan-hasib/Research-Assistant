"use client";

import { useRouter } from "next/navigation";
import * as React from "react";

import { useAuth } from "@/hooks/use-auth";

/** Redirect authenticated users away from the auth screens (Part 3.6). */
export function GuestGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  React.useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace("/dashboard");
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) return null;

  return <>{children}</>;
}
