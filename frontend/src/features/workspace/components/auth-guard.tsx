"use client";

import { useRouter } from "next/navigation";
import * as React from "react";

import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";

/**
 * Route guard for the authenticated shell (Part 3.6). Renders a full-screen
 * loading state while session bootstrap runs, then redirects to /login when
 * unauthenticated.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  React.useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Loading workspace…</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
