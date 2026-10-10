"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useProfile } from "@/lib/auth/use-profile";
import { can } from "@/lib/auth/permissions";

type DocumentRow = {
  id: string;
  original_filename: string | null;
  content_type: string | null;
  storage_path: string;
  status: string;
  summary: string | null;
  raw_text: string | null;
  confidence_score: number | null;
  sender_email: string | null;
  created_at: string;
  approved_at: string | null;
  delivered_at: string | null;
  rejection_reason: string | null;
};

type ExtractionRow = {
  id: string;
  extracted_fields: Record<string, unknown>;
  confidence: number | null;
  warnings: unknown[] | null;
};

export function DocumentDetail({ documentId }: { documentId: string }) {
  const router = useRouter();
  const { profile } = useProfile();
  const canAct = can(profile?.role, "exceptions:resolve");

  const [doc, setDoc] = useState<DocumentRow | null>(null);
  const [extraction, setExtraction] = useState<ExtractionRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();

    const { data: docData } = await supabase
      .from("documents")
      .select("*")
      .eq("id", documentId)
      .single();

    setDoc(docData ?? null);

    const { data: extractData } = await supabase
      .from("extractions")
      .select("*")
      .eq("document_id", documentId)
      .maybeSingle();

    setExtraction(extractData ?? null);

    if (docData?.storage_path) {
      const { data: urlData } = await supabase.storage
        .from("documents")
        .createSignedUrl(docData.storage_path, 3600);
      setSignedUrl(urlData?.signedUrl ?? null);
    }

    setLoading(false);
  }, [documentId]);

  useEffect(() => {
    load();
  }, [load]);

  async function callStatusApi(
    action: "approve" | "reject" | "deliver" | "reset",
    extra?: Record<string, unknown>
  ) {
    setWorking(true);
    setError(null);

    try {
      const res = await fetch(`/api/documents/${documentId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erreur");

      await load();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setWorking(false);
    }
  }

  async function handleProcess() {
    setWorking(true);
    setError(null);

    try {
      const res = await fetch(`/api/documents/${documentId}/process`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erreur");

      // Recharger les données après un délai (le pipeline tourne en async)
      setTimeout(() => load(), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setWorking(false);
    }
  }

  if (loading) return <p className="text-gray-500">Chargement…</p>;
  if (!doc) return <p className="text-red-500">Document introuvable.</p>;

  const confidence = doc.confidence_score;

  return (
    <div className="max-w-5xl space-y-6">
      {/* En-tête */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold mb-2">
            📄 {doc.original_filename || "Document sans nom"}
          </h1>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="info">{doc.status}</Badge>
            {confidence != null && (
              <span
                className={`text-xs font-semibold px-2 py-1 rounded-full ${
                  confidence >= 90
                    ? "bg-green-100 text-green-800"
                    : confidence >= 70
                    ? "bg-orange-100 text-orange-800"
                    : "bg-red-100 text-red-800"
                }`}
              >
                🤖 Confiance : {confidence.toFixed(0)}%
              </span>
            )}
          </div>
        </div>

        {/* Boutons d'action */}
        {canAct && (
          <div className="flex gap-2 flex-wrap">
            {/* Bouton "Traiter maintenant" si en received */}
            {doc.status === "received" && (
              <Button
                onClick={handleProcess}
                disabled={working}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {working ? "…" : "▶️ Traiter maintenant"}
              </Button>
            )}

            {/* Réinitialiser si approuvé/rejeté/livré */}
            {["approved", "rejected", "delivered"].includes(doc.status) && (
              <Button
                onClick={() => callStatusApi("reset")}
                disabled={working}
                className="bg-gray-600 hover:bg-gray-700"
              >
                🔄 Réinitialiser
              </Button>
            )}

            {/* Approuver si exception ou extrait */}
            {["exception", "extracted"].includes(doc.status) && (
              <Button
                onClick={() => callStatusApi("approve")}
                disabled={working}
                className="bg-green-600 hover:bg-green-700"
              >
                {working ? "…" : "✅ Approuver"}
              </Button>
            )}

            {/* Rejeter si exception ou extrait */}
            {["exception", "extracted"].includes(doc.status) && (
              <Button
                onClick={() => {
                  const reason = prompt("Motif du rejet ?");
                  if (reason) callStatusApi("reject", { reason });
                }}
                disabled={working}
                className="bg-red-600 hover:bg-red-700"
              >
                ❌ Rejeter
              </Button>
            )}

            {/* Livrer si approuvé ou auto_approved */}
            {["approved", "auto_approved"].includes(doc.status) && (
              <Button
                onClick={() => callStatusApi("deliver")}
                disabled={working}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {working ? "…" : "📤 Marquer comme livré"}
              </Button>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-red-800 text-sm">
          ❌ {error}
        </div>
      )}

      {/* Info statut */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-sm">
        {doc.approved_at && (
          <Card className="p-3">
            <p className="text-gray-500 text-xs">Approuvé le</p>
            <p className="font-semibold">
              {new Date(doc.approved_at).toLocaleString("fr-FR")}
            </p>
          </Card>
        )}
        {doc.delivered_at && (
          <Card className="p-3">
            <p className="text-gray-500 text-xs">Livré le</p>
            <p className="font-semibold">
              {new Date(doc.delivered_at).toLocaleString("fr-FR")}
            </p>
          </Card>
        )}
        {doc.rejection_reason && (
          <Card className="p-3 border-red-200">
            <p className="text-gray-500 text-xs">Motif de rejet</p>
            <p className="text-red-700">{doc.rejection_reason}</p>
          </Card>
        )}
      </div>

      {/* Grille détail */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          {doc.summary && (
            <Card className="p-4">
              <h2 className="font-semibold mb-2">📝 Résumé IA</h2>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">
                {doc.summary}
              </p>
            </Card>
          )}

          {extraction?.extracted_fields && (
            <Card className="p-4">
              <h2 className="font-semibold mb-3">🤖 Champs extraits</h2>
              <dl className="text-sm space-y-2">
                {Object.entries(extraction.extracted_fields).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4">
                    <dt className="text-gray-500 font-mono text-xs">{k}</dt>
                    <dd className="text-right break-all">
                      {v == null ? (
                        <span className="text-red-500">null</span>
                      ) : (
                        String(v)
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            </Card>
          )}

          {doc.raw_text && (
            <Card className="p-4">
              <details>
                <summary className="font-semibold cursor-pointer">
                  🔍 Texte brut extrait
                </summary>
                <pre className="mt-2 text-xs bg-gray-50 p-2 rounded overflow-auto max-h-64 whitespace-pre-wrap">
                  {doc.raw_text.slice(0, 3000)}
                </pre>
              </details>
            </Card>
          )}
        </div>

        <div>
          <Card className="p-4 sticky top-4">
            <h2 className="font-semibold mb-3">📎 Aperçu</h2>
            {signedUrl ? (
              <>
                {doc.content_type?.startsWith("image/") && (
                  <img
                    src={signedUrl}
                    alt="Document"
                    className="w-full rounded border"
                  />
                )}
                {doc.content_type === "application/pdf" && (
                  <iframe
                    src={signedUrl}
                    className="w-full h-[600px] rounded border"
                    title="PDF"
                  />
                )}
                <a
                  href={signedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-3 text-sm text-blue-600 hover:underline"
                >
                  📥 Ouvrir dans un nouvel onglet
                </a>
              </>
            ) : (
              <p className="text-sm text-gray-500">Aperçu non disponible.</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}