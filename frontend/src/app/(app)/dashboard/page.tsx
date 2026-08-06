import type { Metadata } from "next";

import { RecentActivity } from "@/features/dashboard/components/recent-activity";
import { StatCards } from "@/features/dashboard/components/stat-cards";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default function DashboardPage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Dashboard</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          An overview of your workspace activity.
        </p>
      </div>

      <StatCards />

      <RecentActivity />
    </div>
  );
}
