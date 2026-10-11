"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";

type AuditEntry = {
  id: string;
  user_email: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  details: Record<string, unknown>;
  ip_address: string | null;
  created_at: string;
};

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  login: { label: "🔓 Connexion", color: "bg-blue-100 text-blue-800" },
  logout: { label: "🔒 Déconnexion", color: "bg-gray-100 text-gray-800" },
  document_upload: { label: "📤 Upload", color: "bg-green-100 text-green-800" },
  document_delete: { label: "🗑️ Suppression", color: "bg-red-100 text-red-800" },
  document_approve: { label: "✅ Approbation", color: "bg-green-100 text-green-800" },
  document_reject: { label: "❌ Rejet", color: "bg-red-100 text-red-800" },
  document_deliver: { label: "📤 Livraison", color: "bg-purple-100 text-purple-800" },
  document_reprocess: { label: "🔄 Retraitement", color: "bg-orange-100 text-orange-800" },
  settings_update: { label: "⚙️ Settings", color: "bg-gray-100 text-gray-800" },
  exception_resolve: { label: "✅ Exception", color: "bg-green-100 text-green-800" },
};

export default function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState<string>("all");

  useEffect(() => {
    fetch("/api/audit")
      .then((r) => r.json())
      .then((data) => {
        setEntries(data.entries ?? []);
        setLoading(false);
      });
  }, []);

  const filtered =
    actionFilter === "all"
      ? entries
      : entries.filter((e) => e.action === actionFilter);

  if (loading) {
    return <div className="p-8">Chargement…</div>;
  }

  return (
    <main className="p-8 max-w-6xl">
      <h1 className="text-2xl font-bold mb-2">📋 Journal d'audit</h1>
      <p className="text-sm text-gray-500 mb-6">
        Historique complet des actions effectuées sur la plateforme.
      </p>

      {/* Filtre par action */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <button
          onClick={() => setActionFilter("all")}
          className={`px-3 py-1 text-xs rounded-full border ${
            actionFilter === "all"
              ? "bg-blue-600 text-white border-blue-600"
              : "bg-white text-gray-600 border-gray-300"
          }`}
        >
          Toutes ({entries.length})
        </button>
        {Object.entries(ACTION_LABELS).map(([key, cfg]) => {
          const count = entries.filter((e) => e.action === key).length;
          if (count === 0) return null;
          return (
            <button
              key={key}
              onClick={() => setActionFilter(key)}
              className={`px-3 py-1 text-xs rounded-full border ${
                actionFilter === key
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-600 border-gray-300"
              }`}
            >
              {cfg.label} ({count})
            </button>
          );
        })}
      </div>

      <Card>
        <table className="w-full text-sm">
          <thead className="border-b-2">
            <tr>
              <th className="text-left p-3">Date</th>
              <th className="text-left p-3">Utilisateur</th>
              <th className="text-left p-3">Action</th>
              <th className="text-left p-3">Détails</th>
              <th className="text-left p-3">IP</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((e) => {
              const cfg = ACTION_LABELS[e.action] || {
                label: e.action,
                color: "bg-gray-100 text-gray-800",
              };
              return (
                <tr key={e.id} className="border-b hover:bg-gray-50">
                  <td className="p-3 text-xs text-gray-500">
                    {new Date(e.created_at).toLocaleString("fr-FR")}
                  </td>
                  <td className="p-3 text-xs">{e.user_email || "—"}</td>
                  <td className="p-3">
                    <span className={`text-xs px-2 py-1 rounded-full ${cfg.color}`}>
                      {cfg.label}
                    </span>
                  </td>
                  <td className="p-3 text-xs">
                    {e.entity_type && (
                      <span className="text-gray-500">
                        {e.entity_type} #{e.entity_id?.slice(0, 8)}
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-xs text-gray-400 font-mono">
                    {e.ip_address || "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </main>
  );
}