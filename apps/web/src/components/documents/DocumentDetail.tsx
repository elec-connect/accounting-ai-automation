"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function DocumentDetail({ id }: { id: string }) {
  const [doc, setDoc] = useState<any>(null);
  const [extraction, setExtraction] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [extracting, setExtracting] = useState(false);

  async function loadData() {
    const supabase = createClient();
    const { data: docData } = await supabase
      .from("documents")
      .select("*")
      .eq("id", id)
      .single();
    setDoc(docData);

    const { data: extData } = await supabase
      .from("extractions")
      .select("*")
      .eq("document_id", id)
      .maybeSingle();
    setExtraction(extData);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, [id]);

  async function handleExtract() {
    setExtracting(true);
    try {
      const res = await fetch(`/api/documents/${id}/extract`, {
        method: "POST",
      });
      const result = await res.json();
      if (!res.ok) {
        alert("Extraction failed: " + result.error);
      } else {
        alert("Extraction successful!");
        await loadData();
      }
    } catch (err) {
      alert("Error: " + (err instanceof Error ? err.message : "Unknown"));
    } finally {
      setExtracting(false);
    }
  }

  if (loading) return <p className="text-gray-500">Loading...</p>;
  if (!doc) return <p className="text-red-600">Document not found</p>;

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="text-xl font-bold mb-4">{doc.original_filename}</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <strong>Type:</strong> {doc.type}
          </div>
          <div>
            <strong>Status:</strong> <Badge variant="info">{doc.status}</Badge>
          </div>
          <div>
            <strong>Sender:</strong> {doc.sender_email}
          </div>
          <div>
            <strong>Size:</strong> {doc.file_size} bytes
          </div>
          <div>
            <strong>Received:</strong>{" "}
            {new Date(doc.created_at).toLocaleString()}
          </div>
        </div>

        {!extraction && (
          <button
            onClick={handleExtract}
            disabled={extracting}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {extracting ? "Extracting..." : "🤖 Extract with AI"}
          </button>
        )}
      </Card>

      {extraction && (
        <Card>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold">Extracted Fields</h3>
            <span className="text-sm text-gray-500">
              Confidence: {(extraction.confidence * 100).toFixed(0)}%
            </span>
          </div>
          <pre className="bg-gray-50 p-4 rounded text-sm overflow-auto">
            {JSON.stringify(extraction.extracted_fields, null, 2)}
          </pre>
          <p className="mt-2 text-xs text-gray-500">
            Model: {extraction.model_used}
          </p>
        </Card>
      )}

      {doc.raw_text && (
        <Card>
          <h3 className="text-lg font-bold mb-4">Raw OCR Text</h3>
          <pre className="bg-gray-50 p-4 rounded text-xs overflow-auto max-h-96 whitespace-pre-wrap">
            {doc.raw_text}
          </pre>
        </Card>
      )}
    </div>
  );
}