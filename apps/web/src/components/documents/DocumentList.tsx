"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { PipelineModeToggle } from "@/components/settings/PipelineModeToggle";
import { ConfidenceThresholdInput } from "@/components/settings/ConfidenceThresholdInput";

type Document = {
  id: string;
  original_filename: string | null;
  type: string;
  sender_email: string | null;
  summary: string | null;
  status: string;
  confidence_score: number | null;
  created_at: string;
  // ⭐ NOUVEAU : détection doublons
  duplicate_suspect?: boolean;
  duplicate_reason?: string | null;
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  received:      { label: "📥 Reçu",       color: "bg-gray-100 text-gray-800" },
  extracted:     { label: "🤖 Extrait",    color: "bg-blue-100 text-blue-800" },
  auto_approved: { label: "✨ Auto",       color: "bg-green-100 text-green-800" },
  exception:     { label: "⚠️ Exception",  color: "bg-orange-100 text-orange-800" },
  approved:      { label: "✅ Approuvé",   color: "bg-green-100 text-green-800" },
  delivered:     { label: "📤 Livré",      color: "bg-purple-100 text-purple-800" },
  rejected:      { label: "❌ Rejeté",     color: "bg-red-100 text-red-800" },
  unknown:       { label: "❓ Inconnu",    color: "bg-yellow-100 text-yellow-800" },
};

const TYPE_LABELS: Record<string, { label: string; icon: string }> = {
  invoice:       { label: "Facture",          icon: "🧾" },
  quote:         { label: "Devis",            icon: "📝" },
  delivery_note: { label: "Bon de livraison", icon: "📦" },
  receipt:       { label: "Reçu",             icon: "🧾" },
  other:         { label: "Autre",            icon: "📄" },
};

const TWO_MINUTES_MS = 2 * 60 * 1000;
const FIVE_MINUTES_MS = 5 * 60 * 1000;

function getConfidenceBadge(score: number | null) {
  if (score == null) return null;

  const color =
    score >= 90
      ? "bg-green-100 text-green-800"
      : score >= 70
      ? "bg-orange-100 text-orange-800"
      : "bg-red-100 text-red-800";

  return (
    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${color}`}>
      🤖 {score.toFixed(0)}%
    </span>
  );
}

export function DocumentList() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [pipelineMode, setPipelineMode] = useState<string>("auto");
  const [extracting, setExtracting] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: string; text: string } | null>(null);

  // ═══════════════════════════════════════════════════════════
  //  Chargement
  // ═══════════════════════════════════════════════════════════
  async function loadDocuments(options?: { showSpinner?: boolean }) {
    const showSpinner = options?.showSpinner ?? false;

    if (showSpinner) {
      setRefreshing(true);
    }

    const supabase = createClient();

    // ⭐ Charger les documents + leur statut doublon via document_companies
    const { data: docs } = await supabase
      .from("documents")
      .select("*")
      .order("created_at", { ascending: false });

    if (!docs) {
      setDocuments([]);
      setLoading(false);
      if (showSpinner) setRefreshing(false);
      return;
    }

    // ⭐ Récupérer les flags doublon pour ces documents
    const docIds = docs.map((d) => d.id);
    const { data: links } = await supabase
      .from("document_companies")
      .select("document_id, duplicate_suspect, duplicate_reason")
      .in("document_id", docIds);

    // ⭐ Mapper les flags dans les documents
    const linkMap = new Map<
      string,
      { duplicate_suspect: boolean; duplicate_reason: string | null }
    >();
    for (const l of links ?? []) {
      linkMap.set(l.document_id, {
        duplicate_suspect: l.duplicate_suspect ?? false,
        duplicate_reason: l.duplicate_reason ?? null,
      });
    }

    const enriched: Document[] = docs.map((d) => {
      const l = linkMap.get(d.id);
      return {
        ...d,
        duplicate_suspect: l?.duplicate_suspect ?? false,
        duplicate_reason: l?.duplicate_reason ?? null,
      };
    });

    setDocuments(enriched);
    setLoading(false);

    if (showSpinner) {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadDocuments();

    // ⭐ Charger le mode de traitement
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        const mode = data.settings?.pipeline_mode || "auto";
        setPipelineMode(mode);
      })
      .catch(() => setPipelineMode("auto"));
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 30_000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // ⭐ Pas d'auto-refresh en mode manuel
    if (pipelineMode === "manual") return;

    const hasRecentPending = documents.some((d) => {
      if (d.status !== "received") return false;
      const age = now - new Date(d.created_at).getTime();
      return age < TWO_MINUTES_MS;
    });

    if (!hasRecentPending) return;

    const interval = setInterval(() => {
      loadDocuments();
    }, 5000);

    return () => clearInterval(interval);
  }, [documents, now, pipelineMode]);

  // ═══════════════════════════════════════════════════════════
  //  EXTRAIRE UN DOCUMENT
  // ═══════════════════════════════════════════════════════════
  async function handleExtract(documentId: string, filename: string) {
    setExtracting(documentId);
    setMessage(null);

    try {
      const res = await fetch(`/api/documents/${documentId}/extract`, {
        method: "POST",
      });

      const data = await res.json();

      if (res.ok) {
        const entriesCount = data.accounting?.entriesCreated ?? 0;
        const direction = data.accounting?.direction;

        let successText = `✅ ${filename} extrait avec succès`;

        if (entriesCount > 0) {
          successText += ` — ${entriesCount} écriture(s) comptable(s)`;
          if (direction) {
            successText += ` (${direction === "issued" ? "Vente" : "Achat"})`;
          }
        }

        setMessage({ type: "success", text: successText });
        await loadDocuments();
      } else {
        setMessage({
          type: "error",
          text: `❌ ${filename} : ${data.error || "Erreur d'extraction"}`,
        });
      }
    } catch (err) {
      setMessage({
        type: "error",
        text: `❌ Erreur réseau : ${
          err instanceof Error ? err.message : "inconnue"
        }`,
      });
    } finally {
      setExtracting(null);
      setTimeout(() => setMessage(null), 8000);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Supprimer ce document ?")) return;
    const supabase = createClient();
    await supabase.from("documents").delete().eq("id", id);
    await loadDocuments();
  }

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();

      if (!res.ok) {
        if (json.duplicate) {
          alert("⚠️ Ce document existe déjà dans la base.");
        } else {
          alert("❌ " + (json.error || "Erreur lors de l'upload"));
        }
        return;
      }

      await loadDocuments();
    } catch (err) {
      alert(
        "❌ Erreur réseau : " +
          (err instanceof Error ? err.message : "inconnue")
      );
    } finally {
      setUploading(false);
    }
  }

  function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      handleUpload(file);
      event.target.value = "";
    }
  }

  // Filtrage
  const filteredDocuments = documents.filter((d) => {
    const statusOk = statusFilter === "all" || d.status === statusFilter;
    const typeOk = typeFilter === "all" || d.type === typeFilter;
    return statusOk && typeOk;
  });

  const counts = {
    all: documents.length,
    received: documents.filter((d) => d.status === "received").length,
    extracted: documents.filter((d) => d.status === "extracted").length,
    auto_approved: documents.filter((d) => d.status === "auto_approved").length,
    exception: documents.filter((d) => d.status === "exception").length,
    approved: documents.filter((d) => d.status === "approved").length,
    delivered: documents.filter((d) => d.status === "delivered").length,
  };

  const typeCounts = {
    all: documents.length,
    invoice: documents.filter((d) => d.type === "invoice").length,
    quote: documents.filter((d) => d.type === "quote").length,
    delivery_note: documents.filter((d) => d.type === "delivery_note").length,
    receipt: documents.filter((d) => d.type === "receipt").length,
    other: documents.filter((d) => d.type === "other").length,
  };

  const recentPendingCount = documents.filter((d) => {
    if (d.status !== "received") return false;
    const age = now - new Date(d.created_at).getTime();
    return age < TWO_MINUTES_MS;
  }).length;

  const stuckCount = documents.filter((d) => {
    if (d.status !== "received") return false;
    const age = now - new Date(d.created_at).getTime();
    return age >= FIVE_MINUTES_MS;
  }).length;

  // ⭐ Nombre de doublons suspects
  const duplicateCount = documents.filter((d) => d.duplicate_suspect).length;

  if (loading) return <p className="text-gray-500">Chargement…</p>;

  return (
    <div>
      {/* MODE DE TRAITEMENT + SEUIL DE CONFIANCE */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <PipelineModeToggle />
        <ConfidenceThresholdInput />
      </div>

      {/* ⭐ MESSAGE DE STATUT */}
      {message && (
        <div
          className={`mb-4 p-3 rounded-lg border text-sm ${
            message.type === "success"
              ? "bg-green-50 border-green-200 text-green-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* ⭐ BANDEAU DOUBLONS SUSPECTS */}
      {duplicateCount > 0 && (
        <div className="mb-4 p-3 bg-red-50 border-2 border-red-300 rounded-lg flex items-center gap-3">
          <span className="text-2xl">🚩</span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-900">
              {duplicateCount} doublon{duplicateCount > 1 ? "s" : ""} suspect
              {duplicateCount > 1 ? "s" : ""} détecté
              {duplicateCount > 1 ? "s" : ""}
            </p>
            <p className="text-xs text-red-700">
              Ces documents sont <strong>exclus du calcul</strong> tant que vous
              ne les acceptez ou refusez pas.
            </p>
          </div>
        </div>
      )}

      {/* BANDEAU : Documents récents en cours */}
      {pipelineMode === "auto" && recentPendingCount > 0 && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-3">
          <span className="text-2xl">🔄</span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-blue-900">
              {recentPendingCount} document{recentPendingCount > 1 ? "s" : ""}{" "}
              en cours de traitement…
            </p>
            <p className="text-xs text-blue-700">
              L'IA analyse les documents. La liste se met à jour automatiquement.
            </p>
          </div>
        </div>
      )}

      {/* ⭐ Bandeau "En attente" — visible en mode MANUEL */}
      {pipelineMode === "manual" && counts.received > 0 && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center gap-3">
          <span className="text-2xl">👤</span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-yellow-900">
              {counts.received} document{counts.received > 1 ? "s" : ""} en attente d'extraction
            </p>
            <p className="text-xs text-yellow-700">
              Mode manuel actif. Cliquez sur 🤖 Extraire à droite du document pour lancer l'IA.
            </p>
          </div>
        </div>
      )}

      {/* BANDEAU : Documents bloqués */}
      {pipelineMode === "auto" && stuckCount > 0 && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
          <span className="text-2xl">⚠️</span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-900">
              {stuckCount} document{stuckCount > 1 ? "s" : ""} bloqué
              {stuckCount > 1 ? "s" : ""} en traitement
            </p>
            <p className="text-xs text-red-700">
              L'extraction automatique a échoué. Cliquez sur 🤖 Extraire pour réessayer.
            </p>
          </div>
        </div>
      )}

      {/* BARRE D'ACTIONS */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex gap-2 flex-wrap">
          {[
            { value: "all",           label: "Tous",        icon: "📋" },
            { value: "received",      label: "Reçus",       icon: "📥" },
            { value: "extracted",     label: "Extraits",    icon: "🤖" },
            { value: "auto_approved", label: "Auto",        icon: "✨" },
            { value: "exception",     label: "Exceptions",  icon: "⚠️" },
            { value: "approved",      label: "Approuvés",   icon: "✅" },
            { value: "delivered",     label: "Livrés",      icon: "📤" },
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                statusFilter === tab.value
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
              }`}
            >
              {tab.icon} {tab.label}
              <span className="ml-1.5 text-xs opacity-70">
                ({counts[tab.value as keyof typeof counts] ?? 0})
              </span>
            </button>
          ))}
        </div>

        <div className="flex gap-2 flex-wrap">
          <label
            className={`px-3 py-1.5 text-sm rounded cursor-pointer whitespace-nowrap ${
              uploading
                ? "bg-gray-400 text-white cursor-wait"
                : "bg-blue-600 text-white hover:bg-blue-700"
            }`}
          >
            {uploading ? "⏳ Upload…" : "📤 Upload"}
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.docx,.xlsx,.xls,.csv"
              onChange={handleFileSelect}
              disabled={uploading}
              className="hidden"
            />
          </label>

          <button
            onClick={() => window.open("/api/documents/report/excel", "_blank")}
            className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 whitespace-nowrap"
          >
            📊 Excel
          </button>

          <button
            onClick={() => window.open("/api/documents/export-pdf", "_blank")}
            className="px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700 whitespace-nowrap"
          >
            📄 PDF
          </button>

          <button
            onClick={() => loadDocuments({ showSpinner: true })}
            disabled={refreshing}
            className="px-3 py-1.5 text-sm bg-gray-800 text-white rounded hover:bg-gray-700 disabled:opacity-50 whitespace-nowrap"
          >
            {refreshing ? "⏳ …" : "🔄 Rafraîchir"}
          </button>
        </div>
      </div>

      {/* FILTRE PAR TYPE */}
      <div className="flex gap-2 mb-4 flex-wrap items-center">
        <span className="text-sm text-gray-500 font-medium">Type :</span>
        {[
          { value: "all",           label: "Tous",              icon: "📋" },
          { value: "invoice",       label: "Factures",          icon: "🧾" },
          { value: "quote",         label: "Devis",             icon: "📝" },
          { value: "delivery_note", label: "Bons de livraison", icon: "📦" },
          { value: "receipt",       label: "Reçus",             icon: "🧾" },
        ].map((tab) => (
          <button
            key={tab.value}
            onClick={() => setTypeFilter(tab.value)}
            className={`px-3 py-1 text-xs rounded-full border transition-colors ${
              typeFilter === tab.value
                ? "bg-purple-600 text-white border-purple-600"
                : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
            }`}
          >
            {tab.icon} {tab.label}
            <span className="ml-1 opacity-70">
              ({typeCounts[tab.value as keyof typeof typeCounts] ?? 0})
            </span>
          </button>
        ))}
      </div>

      {/* TABLEAU */}
      <Card>
        <table className="w-full">
          <thead className="border-b-2">
            <tr>
              <th className="text-left p-3 text-sm font-medium">Filename</th>
              <th className="text-left p-3 text-sm font-medium">Type</th>
              <th className="text-left p-3 text-sm font-medium">Sender</th>
              <th className="text-left p-3 text-sm font-medium">Résumé</th>
              <th className="text-left p-3 text-sm font-medium">Score IA</th>
              <th className="text-left p-3 text-sm font-medium">Statut</th>
              <th className="text-left p-3 text-sm font-medium">Reçu</th>
              <th className="text-left p-3 text-sm font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredDocuments.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-gray-500">
                  Aucun document pour ce filtre.
                </td>
              </tr>
            ) : (
              filteredDocuments.map((doc) => {
                const typeConfig = TYPE_LABELS[doc.type] || {
                  label: doc.type,
                  icon: "📄",
                };

                // ⭐ Détermine si on peut extraire/ré-extraire
                const canExtract = doc.status === "received";
                const canReExtract = [
                  "extracted",
                  "auto_approved",
                  "exception",
                  "approved",
                  "delivered",
                ].includes(doc.status);
                const isExtracting = extracting === doc.id;

                // ⭐ Flag doublon suspect
                const isDuplicateSuspect = doc.duplicate_suspect === true;

                return (
                  <tr
                    key={doc.id}
                    className={`border-b transition-colors ${
                      isDuplicateSuspect
                        ? "bg-red-100 border-l-4 border-l-red-500 hover:bg-red-150"
                        : "hover:bg-gray-50"
                    }`}
                  >
                    <td className="p-3 text-sm">
                      <div className="flex items-center gap-2">
                        {isDuplicateSuspect && (
                          <span
                            className="text-red-600 text-lg"
                            title={doc.duplicate_reason || "Doublon suspect"}
                          >
                            🚩
                          </span>
                        )}
                        <Link
                          href={`/dashboard/documents/${doc.id}`}
                          className={`hover:underline ${
                            isDuplicateSuspect
                              ? "text-red-700 font-semibold"
                              : "text-blue-600"
                          }`}
                        >
                          {doc.original_filename || "sans nom"}
                        </Link>
                      </div>
                      {isDuplicateSuspect && doc.duplicate_reason && (
                        <p className="text-xs text-red-600 mt-1 italic">
                          {doc.duplicate_reason}
                        </p>
                      )}
                    </td>
                    <td className="p-3">
                      <span className="text-xs font-semibold px-2 py-1 rounded-full bg-blue-50 text-blue-700">
                        {typeConfig.icon} {typeConfig.label}
                      </span>
                    </td>
                    <td className="p-3 text-xs text-gray-500 truncate max-w-[150px]">
                      {doc.sender_email || "—"}
                    </td>
                    <td className="p-3 text-xs text-gray-600 max-w-[300px]">
                      <div className="line-clamp-2">
                        {doc.summary || "Pas de résumé"}
                      </div>
                    </td>
                    <td className="p-3">
                      {getConfidenceBadge(doc.confidence_score) || (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>

                    {/* STATUT */}
                    <td className="p-3">
                      {isDuplicateSuspect ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full bg-red-200 text-red-900 border border-red-400">
                          🚩 Doublon suspect
                        </span>
                      ) : doc.status === "received" ? (
                        (() => {
                          const age = now - new Date(doc.created_at).getTime();
                          const isStuck = age > FIVE_MINUTES_MS;

                          if (pipelineMode === "manual") {
                            return (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full bg-yellow-100 text-yellow-800">
                                <span>👤</span>
                                <span>En attente</span>
                              </span>
                            );
                          }

                          if (isStuck) {
                            return (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full bg-red-100 text-red-800">
                                <span>⚠️</span>
                                <span>Bloqué</span>
                              </span>
                            );
                          }

                          return (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full bg-blue-100 text-blue-800">
                              <span>🔄</span>
                              <span>Traitement…</span>
                            </span>
                          );
                        })()
                      ) : (
                        (() => {
                          const config = STATUS_LABELS[doc.status] || {
                            label: doc.status,
                            color: "bg-gray-100 text-gray-800",
                          };
                          return (
                            <span
                              className={`text-xs font-semibold px-2 py-1 rounded-full ${config.color}`}
                            >
                              {config.label}
                            </span>
                          );
                        })()
                      )}
                    </td>

                    <td className="p-3 text-xs text-gray-500">
                      {new Date(doc.created_at).toLocaleString("fr-FR")}
                    </td>

                    {/* ⭐ ACTIONS */}
                    <td className="p-3">
                      <div className="flex items-center gap-1">
                        {canExtract && (
                          <button
                            onClick={() =>
                              handleExtract(
                                doc.id,
                                doc.original_filename || "document"
                              )
                            }
                            disabled={isExtracting}
                            className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
                            title="Extraire avec l'IA"
                          >
                            {isExtracting ? "⏳" : "🤖 Extraire"}
                          </button>
                        )}

                        {canReExtract && (
                          <button
                            onClick={() =>
                              handleExtract(
                                doc.id,
                                doc.original_filename || "document"
                              )
                            }
                            disabled={isExtracting}
                            className="text-xs px-2 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 disabled:opacity-50"
                            title="Ré-extraire avec l'IA"
                          >
                            {isExtracting ? "⏳" : "🔄"}
                          </button>
                        )}

                        <Link
                          href={`/dashboard/documents/${doc.id}`}
                          className="text-xs px-2 py-1 border border-gray-300 rounded hover:bg-gray-100"
                          title="Voir le document"
                        >
                          👁️
                        </Link>

                        <button
                          onClick={() => handleDelete(doc.id)}
                          className="text-xs px-2 py-1 border border-red-300 text-red-600 rounded hover:bg-red-50"
                          title="Supprimer"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}