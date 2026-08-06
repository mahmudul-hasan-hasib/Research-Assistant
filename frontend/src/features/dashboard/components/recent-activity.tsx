"use client";

import { FileText, Inbox, UploadCloud } from "lucide-react";

import { useDashboardData } from "../hooks/use-dashboard-data";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatRelativeTime } from "@/utils/format";
import { statusLabel, statusTone } from "@/utils/status";

export function RecentActivity() {
  const { recentActivity, activityLoading } = useDashboardData();

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-base">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        {activityLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        ) : recentActivity.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
            <Inbox className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          </div>
        ) : (
          <ul className="space-y-1">
            {recentActivity.map((item) => {
              const Icon = item.kind === "upload" ? UploadCloud : FileText;
              return (
                <li
                  key={item.id}
                  className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted/50"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.kind === "upload" ? "Uploaded" : "Ingested"} ·{" "}
                      {formatRelativeTime(item.createdAt)}
                    </p>
                  </div>
                  <Badge variant={statusTone(item.status)}>{statusLabel(item.status)}</Badge>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
