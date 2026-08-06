import * as React from "react";

import { GuestGuard } from "@/features/auth/components/guest-guard";
import { Brand } from "@/features/workspace/components/brand";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <GuestGuard>
      <div className="flex min-h-dvh flex-col items-center justify-center bg-muted/30 p-4">
        <div className="mb-8">
          <Brand />
        </div>
        <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-sm sm:p-8">
          {children}
        </div>
      </div>
    </GuestGuard>
  );
}
