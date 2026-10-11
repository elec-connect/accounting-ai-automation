"use client";

import { useParams } from "next/navigation";
import { DocumentDetail } from "@/components/documents/DocumentDetail";

export default function DocumentDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  return (
    <main className="p-8">
      <DocumentDetail documentId={id} />
    </main>
  );
}