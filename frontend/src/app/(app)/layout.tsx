import * as React from "react";

import { AuthGuard } from "@/features/workspace/components/auth-guard";
import { Header } from "@/features/workspace/components/header";
import { Sidebar } from "@/features/workspace/components/sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="flex h-dvh w-full">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Header />
          <main className="flex-1 overflow-y-auto scrollbar-thin">{children}</main>
        </div>
      </div>
    </AuthGuard>
  );
}
