import type { Metadata } from "next";

import { DocumentLibrary } from "@/features/documents/components/document-library";
import { UploadSection } from "@/features/documents/components/upload-section";
import { UploadsPanel } from "@/features/documents/components/uploads-panel";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const metadata: Metadata = {
  title: "Documents",
};

export default function DocumentsPage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Documents</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload files, build your knowledge base, and manage ingested documents.
        </p>
      </div>

      <Card className="p-6">
        <UploadSection />
      </Card>

      <Tabs defaultValue="library">
        <TabsList>
          <TabsTrigger value="library">Document library</TabsTrigger>
          <TabsTrigger value="uploads">Uploads</TabsTrigger>
        </TabsList>
        <TabsContent value="library">
          <DocumentLibrary />
        </TabsContent>
        <TabsContent value="uploads">
          <UploadsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
