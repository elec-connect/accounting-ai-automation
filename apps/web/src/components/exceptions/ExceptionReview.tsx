"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/auth/use-profile";
import { can } from "@/lib/auth/permissions";
import { ExceptionCard } from "./ExceptionCard";

type ExceptionRow = {
  id: string;
  document_id: string;
  reason: string;
  severity: string;
  status: string;
  created_at: string;
};

type DocumentRow = {
  id: string;
  original_filename: string | null;
  confidence_score: number | null;
  summary: string | null;
  sender_email: string | null;
};

export function ExceptionReview() {
  const { profile } = useProfile();
  const [exceptions, setExceptions] = useState<ExceptionRow[]>([]);
  const [documents, setDocuments] = useState<Record<string, DocumentRow>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"open" | "resolved" | "all">("open");

  const canResolve = can(profile?.role, "exceptions:resolve");

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();

    let query = supabase
      .from("exceptions")
      .select("*")
      .order("created_at", { ascending: false });

    if (filter !== "all") {
      query = query.eq("status", filter);
    }

    const { data: exceptionsData } = await query;
    const rows = exceptionsData ?? [];
    setExceptions(rows);

    // Charger les documents associés
    if (rows.length > 0) {
      const docIds = [...new Set(rows.map((e) => e.document_id))];
      const { data: docsData } = await supabase
        .from("documents")
        .select("id, original_filename, confidence_score, summary, sender_email")
        .in("id", docIds);

      const map: Record<string, DocumentRow> = {};
      for (const d of docsData ?? []) {
        map[d.id] = d;
      }
      setDocuments(map);
    }

    setLoading(false);
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  async function resolve(id: string, documentId: string) {
    const supabase = createClient();

    await supabase
      .from("exceptions")
      .update({
        status: "resolved",
        resolved_at: new Date().toISOString(),
      })
      .eq("id", id);

    await supabase
      .from("documents")
      .update({ status: "approved" })
      .eq("id", documentId);

    await load();
  }

  if (loading) {
    return <p className="text-gray-500">Chargement des exceptions…</p>;
  }

  const counts = {
    open: filter === "open" ? exceptions.length : undefined,
  };

  return (
    <div>
      {/* Filtres */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {(["open", "resolved", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
              filter === f
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
            }`}
          >
            {f === "open"
              ? "⚠️ Ouvertes"
              : f === "resolved"
              ? "✅ Résolues"
              : "📋 Toutes"}
            {f === "open" && counts.open != null && (
              <span className="ml-2 text-xs opacity-70">({counts.open})</span>
            )}
          </button>
        ))}
      </div>

      {/* Avertissement read-only */}
      {!canResolve && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-700">
          Vous avez un accès <strong>lecture seule</strong>. Seuls les
          comptables et admins peuvent résoudre les exceptions.
        </div>
      )}

      {/* Liste */}
      {exceptions.length === 0 ? (
        <div className="p-8 text-center text-gray-500 bg-gray-50 rounded-lg">
          <p className="text-3xl mb-3">🎉</p>
          <p className="font-semibold text-lg">
            {filter === "open"
              ? "Aucune exception en attente"
              : filter === "resolved"
              ? "Aucune exception résolue"
              : "Aucune exception"}
          </p>
          <p className="text-xs mt-2">
            {filter === "open"
              ? "Tous les documents traités par l'IA ont une confiance suffisante (≥ 90%)."
              : "Rien à afficher pour ce filtre."}
          </p>
        </div>
      ) : (
        <div>
          {exceptions.map((e) => (
            <ExceptionCard
              key={e.id}
              exception={e}
              document={documents[e.document_id] ?? null}
              canResolve={canResolve}
              onResolve={resolve}
            />
          ))}
        </div>
      )}
    </div>
  );
}