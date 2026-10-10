"use client";

import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Card } from "@/components/ui/card";

type Distribution = {
  range: string;
  count: number;
};

type Summary = {
  total: number;
  autoApproved: number;
  exceptions: number;
  approved: number;
  delivered: number;
  rejected: number;
  avgScore: number;
  automationRate: number;
  exceptionRate: number;
};

export function ConfidenceChart() {
  const [distribution, setDistribution] = useState<Distribution[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard/confidence-stats")
      .then((r) => r.json())
      .then((data) => {
        setDistribution(data.distribution ?? []);
        setSummary(data.summary ?? null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return <Card className="p-6">Chargement des statistiques…</Card>;
  }

  if (!summary || summary.total === 0) {
    return (
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-2">
          📊 Distribution des scores de confiance
        </h3>
        <p className="text-sm text-gray-500">
          Aucune donnée disponible. Traitez des documents pour voir les statistiques.
        </p>
      </Card>
    );
  }

  const getBarColor = (range: string) => {
    if (range === "90-100") return "#10b981";
    if (range === "70-79" || range === "80-89") return "#f59e0b";
    return "#ef4444";
  };

  return (
    <div className="space-y-6">
      {/* Cartes KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-xs text-gray-500">Documents traités</p>
          <p className="text-2xl font-bold">{summary.total}</p>
        </Card>

        <Card className="p-4">
          <p className="text-xs text-gray-500">Score moyen</p>
          <p className="text-2xl font-bold">
            {summary.avgScore.toFixed(1)}%
          </p>
        </Card>

        <Card className="p-4">
          <p className="text-xs text-gray-500">Taux d'automatisation</p>
          <p className="text-2xl font-bold text-green-600">
            {summary.automationRate.toFixed(1)}%
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {summary.autoApproved} / {summary.total}
          </p>
        </Card>

        <Card className="p-4">
          <p className="text-xs text-gray-500">Taux d'exceptions</p>
          <p className="text-2xl font-bold text-orange-600">
            {summary.exceptionRate.toFixed(1)}%
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {summary.exceptions} / {summary.total}
          </p>
        </Card>
      </div>

      {/* Graphique — VERSION SANS WARNING */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">
          📊 Distribution des scores de confiance
        </h3>
        <div style={{ width: "100%", height: 300 }}>
          <ResponsiveContainer>
            <BarChart data={distribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="range" />
              <YAxis />
              <Tooltip
                contentStyle={{
                  borderRadius: 8,
                  border: "1px solid #e5e7eb",
                  fontSize: 12,
                }}
                formatter={(value) => [`${value ?? 0} documents`, "Nombre"]}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {distribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getBarColor(entry.range)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="flex items-center gap-4 mt-4 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 bg-red-500 rounded"></span> Faible (&lt; 70%)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 bg-orange-500 rounded"></span> Moyen (70-89%)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 bg-green-500 rounded"></span> Élevé (≥ 90%)
          </span>
        </div>
      </Card>

      {/* Répartition par statut */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">
          🎯 Répartition par statut
        </h3>
        <div className="space-y-2">
          {[
            { label: "✨ Auto-approuvés", count: summary.autoApproved, color: "bg-green-500" },
            { label: "⚠️ Exceptions", count: summary.exceptions, color: "bg-orange-500" },
            { label: "✅ Approuvés manuellement", count: summary.approved, color: "bg-blue-500" },
            { label: "📤 Livrés", count: summary.delivered, color: "bg-purple-500" },
            { label: "❌ Rejetés", count: summary.rejected, color: "bg-red-500" },
          ].map((item) => {
            const percent = summary.total > 0 ? (item.count / summary.total) * 100 : 0;
            return (
              <div key={item.label}>
                <div className="flex justify-between text-sm mb-1">
                  <span>{item.label}</span>
                  <span className="text-gray-500">
                    {item.count} ({percent.toFixed(1)}%)
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className={`${item.color} h-2 rounded-full transition-all`}
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}