"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PipelineModeToggle } from "@/components/settings/PipelineModeToggle";

type Document = {
  id: string;
  original_filename: string | null;
  type: string;
  sender_email: string | null;
  summary: string | null;
  status: string;
  confidence_score: number | null;
  created_at: string;
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
  invoice:       { label: "Facture",         icon: "🧾" },
  quote:         { label: "Devis",           icon: "📝" },
  delivery_note: { label: "Bon de livraison", icon: "📦" },
  receipt:       { label: "Reçu",            icon: "🧾" },
  other:         { label: "Autre",           icon: "📄" },
};

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

  async function loadDocuments() {
    setRefreshing(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("documents")
      .select("*")
      .order("created_at", { ascending: false });
    setDocuments(data || []);
    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => {
    loadDocuments();
  }, []);

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

  // Filtrage combiné (statut + type)
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

  if (loading) return <p className="text-gray-500">Chargement…</p>;

  return (
    <div>
      {/* ═══════════════════════════════════════════════════════
          MODE DE TRAITEMENT (Auto / Manuel)
          ═══════════════════════════════════════════════════════ */}
      <div className="mb-6">
        <PipelineModeToggle />
      </div>

      {/* ═══════════════════════════════════════════════════════
          BARRE D'ACTIONS — Filtres + Boutons
          ═══════════════════════════════════════════════════════ */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        {/* Filtres par statut */}
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

        {/* Boutons à droite */}
        <div className="flex gap-2 flex-wrap">
          <label
            className={`px-3 py-1.5 text-sm rounded cursor-pointer whitespace-nowrap ${
              uploading
                ? "bg-gray-400 text-white cursor-wait"
                : "bg-blue-600 text-white hover:bg-blue-700"
            }`}
            title="Uploader un document manuellement"
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
            title="Exporter en Excel"
          >
            📊 Excel
          </button>

          <button
            onClick={() => window.open("/api/documents/export-pdf", "_blank")}
            className="px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700 whitespace-nowrap"
            title="Exporter en PDF"
          >
            📄 PDF
          </button>

          <button
            onClick={loadDocuments}
            disabled={refreshing}
            className="px-3 py-1.5 text-sm bg-gray-800 text-white rounded hover:bg-gray-700 disabled:opacity-50 whitespace-nowrap"
          >
            {refreshing ? "⏳ …" : "🔄 Rafraîchir"}
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
          FILTRE PAR TYPE
          ═══════════════════════════════════════════════════════ */}
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

      {/* Tableau */}
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

                return (
                  <tr key={doc.id} className="border-b hover:bg-gray-50">
                    <td className="p-3 text-sm">
                      <Link
                        href={`/dashboard/documents/${doc.id}`}
                        className="text-blue-600 hover:underline"
                      >
                        {doc.original_filename || "sans nom"}
                      </Link>
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
                    <td className="p-3">
                      {(() => {
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
                      })()}
                    </td>
                    <td className="p-3 text-xs text-gray-500">
                      {new Date(doc.created_at).toLocaleString("fr-FR")}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/dashboard/documents/${doc.id}`}
                          className="text-xs px-2 py-1 border border-gray-300 rounded hover:bg-gray-100"
                          title="Voir le détail"
                        >
                          👁️
                        </Link>
                        <button
                          onClick={() => handleDelete(doc.id)}
                          className="text-red-600 hover:text-red-800"
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