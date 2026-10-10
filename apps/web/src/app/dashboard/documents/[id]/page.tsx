"use client";

import { useParams } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { DocumentDetail } from "@/components/documents/DocumentDetail";

export default function DocumentDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1">
        <Header title={`Document ${id.slice(0, 8)}`} />
        <main className="p-8">
          <DocumentDetail documentId={id} />
        </main>
      </div>
    </div>
  );
}