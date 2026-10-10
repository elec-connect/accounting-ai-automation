"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useProfile } from "@/lib/auth/use-profile";
import { can } from "@/lib/auth/permissions";

type ExceptionRow = {
  id: string;
  document_id: string;
  reason: string;
  severity: string;
  status: string;
  created_at: string;
  resolved_at: string | null;
};

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
};

type ExtractionRow = {
  id: string;
  document_id: string;
  extracted_fields: Record<string, unknown>;
  confidence: number | null;
  confidence_details: Record<string, unknown> | null;
  warnings: unknown[] | null;
  model_used: string | null;
  created_at: string;
};

export default function ExceptionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const { profile } = useProfile();
  const canResolve = can(profile?.role, "exceptions:resolve");

  const [exception, setException] = useState<ExceptionRow | null>(null);
  const [document, setDocument] = useState<DocumentRow | null>(null);
  const [extraction, setExtraction] = useState<ExtractionRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const supabase = createClient();

    // 1. Charger l'exception
    const { data: exData, error: exError } = await supabase
      .from("exceptions")
      .select("*")
      .eq("id", id)
      .single();

    if (exError || !exData) {
      setError("Exception introuvable.");
      setLoading(false);
      return;
    }

    setException(exData);

    // 2. Charger le document associé
    const { data: docData } = await supabase
      .from("documents")
      .select(
        "id, original_filename, content_type, storage_path, status, summary, raw_text, confidence_score, sender_email, created_at"
      )
      .eq("id", exData.document_id)
      .single();

    setDocument(docData ?? null);

    // 3. Charger l'extraction IA
    const { data: extractData } = await supabase
      .from("extractions")
      .select("*")
      .eq("document_id", exData.document_id)
      .maybeSingle();

    setExtraction(extractData ?? null);

    // 4. Générer une URL signée pour prévisualiser le fichier
    if (docData?.storage_path) {
      const { data: urlData } = await supabase.storage
        .from("documents")
        .createSignedUrl(docData.storage_path, 3600);

      setSignedUrl(urlData?.signedUrl ?? null);
    }

    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleResolve(action: "approve" | "reject") {
    if (!exception || !document) return;

    setResolving(true);

    try {
      const supabase = createClient();

      // 1. Marquer l'exception comme résolue
      const { error: exError } = await supabase
        .from("exceptions")
        .update({
          status: "resolved",
          resolved_at: new Date().toISOString(),
        })
        .eq("id", exception.id);

      if (exError) throw exError;

      // 2. Mettre à jour le document
      const newStatus = action === "approve" ? "approved" : "rejected";

      const { error: docError } = await supabase
        .from("documents")
        .update({ status: newStatus })
        .eq("id", document.id);

      if (docError) throw docError;

      // 3. Rediriger vers la liste
      router.push("/dashboard/exceptions");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
      setResolving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex-1">
          <Header title="Exception" />
          <main className="p-8">
            <p className="text-gray-500">Chargement…</p>
          </main>
        </div>
      </div>
    );
  }

  if (error || !exception || !document) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex-1">
          <Header title="Exception" />
          <main className="p-8">
            <div className="p-4 bg-red-50 border border-red-200 rounded text-red-800">
              ❌ {error || "Exception introuvable"}
            </div>
            <Link
              href="/dashboard/exceptions"
              className="inline-block mt-4 text-blue-600 hover:underline"
            >
              ← Retour aux exceptions
            </Link>
          </main>
        </div>
      </div>
    );
  }

  const confidence =
    document.confidence_score ?? extraction?.confidence != null
      ? (extraction?.confidence ?? 0) * 100
      : null;

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1">
        <Header title="Exception" />
        <main className="p-8 max-w-5xl">
          {/* Lien retour */}
          <Link
            href="/dashboard/exceptions"
            className="inline-block mb-4 text-sm text-blue-600 hover:underline"
          >
            ← Retour aux exceptions
          </Link>

          {/* En-tête */}
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold mb-2">
                📄 {document.original_filename || "Document sans nom"}
              </h1>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge
                  variant={
                    exception.severity === "high" ? "error" : "warning"
                  }
                >
                  {exception.severity}
                </Badge>
                <Badge
                  variant={exception.status === "open" ? "warning" : "success"}
                >
                  {exception.status}
                </Badge>
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
            {exception.status === "open" && canResolve && (
              <div className="flex gap-2">
                <Button
                  onClick={() => handleResolve("approve")}
                  disabled={resolving}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {resolving ? "…" : "✅ Approuver"}
                </Button>
                <Button
                  onClick={() => handleResolve("reject")}
                  disabled={resolving}
                  className="bg-red-600 hover:bg-red-700"
                >
                  {resolving ? "…" : "❌ Rejeter"}
                </Button>
              </div>
            )}
          </div>

          {!canResolve && exception.status === "open" && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-700">
              Vous avez un accès <strong>lecture seule</strong>. Seuls les
              comptables et admins peuvent résoudre les exceptions.
            </div>
          )}

          {/* Grille : détails + fichier */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Colonne gauche : détails */}
            <div className="space-y-4">
              {/* Carte : raison de l'exception */}
              <Card className="p-4">
                <h2 className="font-semibold mb-2">⚠️ Raison de l'exception</h2>
                <p className="text-sm text-gray-700">{exception.reason}</p>
                <p className="text-xs text-gray-400 mt-2">
                  Créée le{" "}
                  {new Date(exception.created_at).toLocaleString("fr-FR")}
                </p>
              </Card>

              {/* Carte : informations document */}
              <Card className="p-4">
                <h2 className="font-semibold mb-3">📋 Informations</h2>
                <dl className="text-sm space-y-2">
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Type MIME</dt>
                    <dd className="font-mono text-xs">
                      {document.content_type || "—"}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Expéditeur</dt>
                    <dd>{document.sender_email || "—"}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Statut actuel</dt>
                    <dd>
                      <Badge variant="info">{document.status}</Badge>
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Reçu le</dt>
                    <dd>
                      {new Date(document.created_at).toLocaleString("fr-FR")}
                    </dd>
                  </div>
                </dl>
              </Card>

              {/* Carte : champs extraits */}
              {extraction?.extracted_fields && (
                <Card className="p-4">
                  <h2 className="font-semibold mb-3">🤖 Champs extraits par l'IA</h2>
                  <dl className="text-sm space-y-2">
                    {Object.entries(extraction.extracted_fields).map(
                      ([key, value]) => {
                        if (key === "line_items" && Array.isArray(value)) {
                          return (
                            <div key={key} className="pt-2 border-t">
                              <dt className="text-gray-500 mb-1">
                                Lignes ({value.length})
                              </dt>
                              <dd className="space-y-1">
                                {value.map((item, idx) => (
                                  <div
                                    key={idx}
                                    className="text-xs bg-gray-50 p-2 rounded"
                                  >
                                    {JSON.stringify(item)}
                                  </div>
                                ))}
                              </dd>
                            </div>
                          );
                        }

                        return (
                          <div
                            key={key}
                            className="flex justify-between gap-4"
                          >
                            <dt className="text-gray-500 font-mono text-xs">
                              {key}
                            </dt>
                            <dd className="text-right break-all">
                              {value == null ? (
                                <span className="text-red-500">
                                  null (manquant)
                                </span>
                              ) : (
                                String(value)
                              )}
                            </dd>
                          </div>
                        );
                      }
                    )}
                  </dl>

                  {/* Warnings */}
                  {extraction.warnings &&
                    Array.isArray(extraction.warnings) &&
                    extraction.warnings.length > 0 && (
                      <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                        <p className="font-semibold text-yellow-800 text-sm mb-1">
                          ⚠️ Avertissements IA
                        </p>
                        <ul className="text-xs text-yellow-900 list-disc list-inside space-y-1">
                          {extraction.warnings.map((w, i) => (
                            <li key={i}>{String(w)}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                </Card>
              )}

              {/* Carte : résumé */}
              {document.summary && (
                <Card className="p-4">
                  <h2 className="font-semibold mb-2">📝 Résumé IA</h2>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">
                    {document.summary}
                  </p>
                </Card>
              )}

              {/* Carte : texte brut (repliable) */}
              {document.raw_text && (
                <Card className="p-4">
                  <details>
                    <summary className="font-semibold cursor-pointer">
                      🔍 Texte brut extrait
                    </summary>
                    <pre className="mt-2 text-xs bg-gray-50 p-2 rounded overflow-auto max-h-64 whitespace-pre-wrap">
                      {document.raw_text.slice(0, 3000)}
                      {document.raw_text.length > 3000 && "\n\n… (tronqué)"}
                    </pre>
                  </details>
                </Card>
              )}
            </div>

            {/* Colonne droite : aperçu du fichier */}
            <div>
              <Card className="p-4 sticky top-4">
                <h2 className="font-semibold mb-3">📎 Aperçu du document</h2>

                {signedUrl ? (
                  <>
                    {document.content_type?.startsWith("image/") && (
                      <img
                        src={signedUrl}
                        alt={document.original_filename || "Document"}
                        className="w-full rounded border"
                      />
                    )}

                    {document.content_type === "application/pdf" && (
                      <iframe
                        src={signedUrl}
                        className="w-full h-[600px] rounded border"
                        title="Aperçu PDF"
                      />
                    )}

                    {!document.content_type?.startsWith("image/") &&
                      document.content_type !== "application/pdf" && (
                        <p className="text-sm text-gray-500">
                          Aperçu non disponible pour ce type de fichier.
                        </p>
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
                  <p className="text-sm text-gray-500">
                    Aperçu non disponible.
                  </p>
                )}

                <Link
                  href={`/dashboard/documents/${document.id}`}
                  className="inline-block mt-3 text-sm text-blue-600 hover:underline"
                >
                  📄 Voir la fiche complète du document →
                </Link>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}