"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";

const TYPE_LABELS: Record<string, { label: string; icon: string }> = {
  invoice: { label: "Factures", icon: "🧾" },
  quote: { label: "Devis", icon: "📝" },
  delivery_note: { label: "Bons de livraison", icon: "📦" },
  receipt: { label: "Reçus", icon: "🧾" },
  other: { label: "Autres", icon: "📄" },
};

type TypeStat = {
  type: string;
  total: number;
  auto_approved: number;
  exceptions: number;
  approved: number;
  delivered: number;
  rejected: number;
  avgScore: number;
};

export function TypeStats() {
  const [stats, setStats] = useState<TypeStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard/type-stats")
      .then((r) => r.json())
      .then((data) => {
        setStats(data.stats ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <Card className="p-6">Chargement…</Card>;

  if (stats.length === 0) {
    return (
      <Card className="p-6">
        <h3 className="font-semibold mb-2">📋 Statistiques par type</h3>
        <p className="text-sm text-gray-500">Aucune donnée disponible.</p>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h3 className="font-semibold mb-4">📋 Statistiques par type de document</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.map((s) => {
          const config = TYPE_LABELS[s.type] || { label: s.type, icon: "📄" };
          const autoRate = s.total > 0 ? (s.auto_approved / s.total) * 100 : 0;
          const exceptionRate = s.total > 0 ? (s.exceptions / s.total) * 100 : 0;

          return (
            <div key={s.type} className="p-4 border rounded-lg bg-gray-50">
              <div className="flex items-center justify-between mb-3">
                <span className="font-semibold">
                  {config.icon} {config.label}
                </span>
                <span className="text-xs text-gray-500">{s.total} docs</span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">Score moyen</span>
                  <span className="font-semibold">
                    {s.avgScore.toFixed(0)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">✨ Auto-approuvés</span>
                  <span className="font-semibold text-green-600">
                    {s.auto_approved} ({autoRate.toFixed(0)}%)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">⚠️ Exceptions</span>
                  <span className="font-semibold text-orange-600">
                    {s.exceptions} ({exceptionRate.toFixed(0)}%)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">✅ Approuvés</span>
                  <span className="font-semibold">{s.approved}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">📤 Livrés</span>
                  <span className="font-semibold">{s.delivered}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}