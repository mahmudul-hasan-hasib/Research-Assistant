"use client";

import { FileText, MessageSquareQuestion, UploadCloud } from "lucide-react";

import { StatCard } from "./stat-card";
import { useDashboardData } from "../hooks/use-dashboard-data";

export function StatCards() {
  const { totalDocuments, documentsLoading, totalUploads, uploadsLoading, queryCount } =
    useDashboardData();

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <StatCard
        label="Total Documents"
        value={totalDocuments}
        icon={FileText}
        loading={documentsLoading}
        hint="Ingested into the RAG index"
        index={0}
      />
      <StatCard
        label="Uploaded Files"
        value={totalUploads}
        icon={UploadCloud}
        loading={uploadsLoading}
        hint="Stored in your workspace"
        index={1}
      />
      <StatCard
        label="AI Queries"
        value={queryCount}
        icon={MessageSquareQuestion}
        hint="Agent runs this session"
        index={2}
      />
    </div>
  );
}
