"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
} from "recharts";

// ═══════════════════════════════════════════════════════════════
//  TYPES
// ═══════════════════════════════════════════════════════════════

type Stats = {
  totalDocuments?: number;
  totalTtc?: number;
  totalExtracted?: number;
  totalPending?: number;
  byStatus?: Record<string, number>;
  topSuppliers?: Array<{ supplier: string; total: number; count: number }>;
  monthlyData?: Array<{ month: string; total: number }>;
  recentDocs?: Array<{
    id: string;
    filename: string;
    supplier: string;
    amount: number;
    status: string;
  }>;
};

type ConfidenceStats = {
  distribution?: Array<{ range: string; count: number }>;
  summary?: {
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
};

// ═══════════════════════════════════════════════════════════════
//  CONSTANTES
// ═══════════════════════════════════════════════════════════════

const STATUS_COLORS: Record<string, string> = {
  received: "#94a3b8",
  extracted: "#3b82f6",
  auto_approved: "#10b981",
  approved: "#22c55e",
  exception: "#f59e0b",
  delivered: "#a855f7",
  rejected: "#ef4444",
};

const STATUS_LABELS: Record<string, string> = {
  received: "Reçus",
  extracted: "Extraits",
  auto_approved: "Auto",
  approved: "Approuvés",
  exception: "Exceptions",
  delivered: "Livrés",
  rejected: "Rejetés",
};

// ═══════════════════════════════════════════════════════════════
//  COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════════

export function DashboardStats() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [confidence, setConfidence] = useState<ConfidenceStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/dashboard/stats").then((r) => r.json()),
      fetch("/api/dashboard/confidence-stats").then((r) => r.json()),
    ])
      .then(([s, c]) => {
        setStats(s);
        setConfidence(c);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Chargement…</p>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <Card className="p-8 text-center text-gray-500">
        Aucune donnée disponible.
      </Card>
    );
  }

  const safeNum = (v: unknown): number =>
    typeof v === "number" && !isNaN(v) ? v : 0;
  const safeArr = <T,>(v: unknown): T[] => (Array.isArray(v) ? v : []);

  const totalDocuments = safeNum(stats.totalDocuments);
  const totalTtc = safeNum(stats.totalTtc);
  const totalExtracted = safeNum(stats.totalExtracted);
  const totalPending = safeNum(stats.totalPending);
  const byStatus = stats.byStatus ?? {};
  const monthlyData = safeArr<{ month: string; total: number }>(
    stats.monthlyData
  );
  const topSuppliers = safeArr<{
    supplier: string;
    total: number;
    count: number;
  }>(stats.topSuppliers).filter((s) => s.supplier !== "Inconnu");
  const recentDocs = safeArr<{
    id: string;
    filename: string;
    supplier: string;
    amount: number;
    status: string;
  }>(stats.recentDocs);

  return (
    <div className="space-y-6">
      {/* ═══════════════════════════════════════════════════════
          SECTION 1 : KPI CARDS (4 cards en ligne)
          ═══════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Documents"
          value={totalDocuments.toString()}
          sublabel="au total"
          icon="📄"
          trend="neutral"
        />
        <KpiCard
          label="Montant TTC"
          value={formatAmountShort(totalTtc)}
          sublabel="cumulé"
          icon="💰"
          trend="positive"
        />
        <KpiCard
          label="Traités"
          value={totalExtracted.toString()}
          sublabel={`${percent(totalExtracted, totalDocuments)}% du total`}
          icon="🤖"
          trend="positive"
        />
        <KpiCard
          label="En attente"
          value={totalPending.toString()}
          sublabel="à traiter"
          icon="⏳"
          trend={totalPending > 0 ? "warning" : "neutral"}
        />
      </div>

      {/* ═══════════════════════════════════════════════════════
          SECTION 2 : GRAPHIQUES (2 colonnes)
          ═══════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Évolution mensuelle - 2/3 de largeur */}
        <Card className="p-5 lg:col-span-2 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-gray-900">
                Évolution mensuelle
              </h3>
              <p className="text-xs text-gray-500">Montants TTC par mois</p>
            </div>
          </div>
          {monthlyData.length === 0 ? (
            <EmptyChart message="Aucune donnée mensuelle" />
          ) : (
            <div style={{ width: "100%", height: 260 }}>
              <ResponsiveContainer>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 12, fill: "#64748b" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => formatAmountShort(v)}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 8,
                      border: "1px solid #e2e8f0",
                      fontSize: 12,
                      boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                    }}
                    formatter={(value) => [
                      `${formatAmountShort(Number(value))}`,
                      "Total",
                    ]}
                  />
                  <Bar
                    dataKey="total"
                    fill="#3b82f6"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={60}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        {/* Répartition par statut - 1/3 de largeur */}
        <Card className="p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="mb-4">
            <h3 className="font-semibold text-gray-900">Répartition</h3>
            <p className="text-xs text-gray-500">Par statut</p>
          </div>
          {Object.keys(byStatus).length === 0 ? (
            <EmptyChart message="Aucune donnée" />
          ) : (
            <>
              <div style={{ width: "100%", height: 180 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={Object.entries(byStatus)
                        .filter(([_, count]) => count > 0)
                        .map(([status, count]) => ({
                          name: STATUS_LABELS[status] || status,
                          value: count,
                        }))}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {Object.entries(byStatus)
                        .filter(([_, count]) => count > 0)
                        .map(([status], index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={STATUS_COLORS[status] || "#94a3b8"}
                          />
                        ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        borderRadius: 8,
                        border: "1px solid #e2e8f0",
                        fontSize: 12,
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1.5 mt-3">
                {Object.entries(byStatus)
                  .filter(([_, count]) => count > 0)
                  .sort((a, b) => b[1] - a[1])
                  .map(([status, count]) => (
                    <div
                      key={status}
                      className="flex items-center justify-between text-xs"
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{
                            backgroundColor:
                              STATUS_COLORS[status] || "#94a3b8",
                          }}
                        />
                        <span className="text-gray-600">
                          {STATUS_LABELS[status] || status}
                        </span>
                      </span>
                      <span className="font-semibold text-gray-900">
                        {count}
                      </span>
                    </div>
                  ))}
              </div>
            </>
          )}
        </Card>
      </div>

      {/* ═══════════════════════════════════════════════════════
          SECTION 3 : QUALITÉ IA (pleine largeur)
          ═══════════════════════════════════════════════════════ */}
      {confidence?.summary && confidence.summary.total > 0 && (
        <Card className="p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-semibold text-gray-900">
                🎯 Qualité de l'IA
              </h3>
              <p className="text-xs text-gray-500">
                Sur {confidence.summary.total} document
                {confidence.summary.total > 1 ? "s" : ""} analysé
                {confidence.summary.total > 1 ? "s" : ""}
              </p>
            </div>
          </div>

          {/* Mini KPI en ligne */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            <StatBox
              label="Score moyen"
              value={`${safeNum(confidence.summary.avgScore).toFixed(0)}%`}
              color="blue"
            />
            <StatBox
              label="Auto-approuvés"
              value={`${safeNum(confidence.summary.automationRate).toFixed(0)}%`}
              color="green"
            />
            <StatBox
              label="Exceptions"
              value={`${safeNum(confidence.summary.exceptionRate).toFixed(0)}%`}
              color="orange"
            />
            <StatBox
              label="Analysés"
              value={confidence.summary.total.toString()}
              color="gray"
            />
          </div>

          {/* Graphique distribution */}
          <div style={{ width: "100%", height: 200 }}>
            <ResponsiveContainer>
              <BarChart
                data={safeArr<{ range: string; count: number }>(
                  confidence.distribution
                )}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="range"
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 8,
                    border: "1px solid #e2e8f0",
                    fontSize: 12,
                  }}
                  formatter={(value) => [`${value} documents`, "Nombre"]}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {safeArr<{ range: string; count: number }>(
                    confidence.distribution
                  ).map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={getScoreColor(entry.range)}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Légende */}
          <div className="flex items-center justify-center gap-6 mt-4 text-xs text-gray-500">
            <LegendDot color="#ef4444" label="Faible (< 70%)" />
            <LegendDot color="#f59e0b" label="Moyen (70-89%)" />
            <LegendDot color="#10b981" label="Élevé (≥ 90%)" />
          </div>
        </Card>
      )}

      {/* ═══════════════════════════════════════════════════════
          SECTION 4 : TOP FOURNISSEURS + DERNIERS DOCS (2 colonnes)
          ═══════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top fournisseurs */}
        <Card className="p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="mb-4">
            <h3 className="font-semibold text-gray-900">
              🏢 Top fournisseurs
            </h3>
            <p className="text-xs text-gray-500">
              Classés par montant total
            </p>
          </div>

          {topSuppliers.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">
              Aucun fournisseur identifié
            </p>
          ) : (
            <div className="space-y-4">
              {topSuppliers.slice(0, 5).map((s, i) => {
                const max = topSuppliers[0]?.total || 1;
                const percent = (s.total / max) * 100;

                return (
                  <div key={s.supplier}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-bold text-gray-400 w-5">
                          {i + 1}
                        </span>
                        <span className="font-medium text-sm text-gray-900 truncate">
                          {s.supplier}
                        </span>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-sm font-bold text-gray-900">
                          {formatAmountShort(s.total)}
                        </div>
                        <div className="text-xs text-gray-400">
                          {s.count} doc{s.count > 1 ? "s" : ""}
                        </div>
                      </div>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(percent, 100)}%`,
                          backgroundColor: getSupplierColor(i),
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Derniers documents */}
        <Card className="p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-gray-900">
                📄 Derniers documents
              </h3>
              <p className="text-xs text-gray-500">Les 5 plus récents</p>
            </div>
            <Link
              href="/dashboard/documents"
              className="text-xs text-blue-600 hover:underline"
            >
              Voir tout →
            </Link>
          </div>

          {recentDocs.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">
              Aucun document
            </p>
          ) : (
            <div className="space-y-1 -mx-2">
              {recentDocs.slice(0, 5).map((doc) => (
                <Link
                  key={doc.id}
                  href={`/dashboard/documents/${doc.id}`}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-1 min-w-0 pr-3">
                    <p className="font-medium text-sm text-gray-900 truncate">
                      {doc.filename}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {doc.supplier}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold text-gray-900">
                      {doc.amount > 0 ? formatAmountShort(doc.amount) : "—"}
                    </p>
                    <span
                      className="inline-block text-xs px-1.5 py-0.5 rounded-full mt-0.5"
                      style={{
                        backgroundColor: `${
                          STATUS_COLORS[doc.status] || "#94a3b8"
                        }20`,
                        color: STATUS_COLORS[doc.status] || "#94a3b8",
                      }}
                    >
                      {STATUS_LABELS[doc.status] || doc.status}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  SOUS-COMPOSANTS
// ═══════════════════════════════════════════════════════════════

function KpiCard({
  label,
  value,
  sublabel,
  icon,
  trend,
}: {
  label: string;
  value: string;
  sublabel: string;
  icon: string;
  trend: "positive" | "warning" | "neutral";
}) {
  const trendStyles = {
    positive: "text-green-600",
    warning: "text-orange-600",
    neutral: "text-gray-500",
  };

  return (
    <Card className="p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-2">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
          {label}
        </span>
        <span className="text-xl">{icon}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900 mb-1">{value}</p>
      <p className={`text-xs ${trendStyles[trend]}`}>{sublabel}</p>
    </Card>
  );
}

function StatBox({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: "blue" | "green" | "orange" | "gray";
}) {
  const colors = {
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    green: "border-green-200 bg-green-50 text-green-700",
    orange: "border-orange-200 bg-orange-50 text-orange-700",
    gray: "border-gray-200 bg-gray-50 text-gray-700",
  };

  return (
    <div className={`p-3 rounded-lg border ${colors[color]}`}>
      <p className="text-xs font-medium opacity-70">{label}</p>
      <p className="text-xl font-bold mt-1">{value}</p>
    </div>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-[200px] text-sm text-gray-400">
      {message}
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className="w-2.5 h-2.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════════

function formatAmountShort(amount: number): string {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(2)} M DT`;
  if (amount >= 1000) return `${(amount / 1000).toFixed(1)} K DT`;
  return `${amount.toFixed(0)} DT`;
}

function getScoreColor(range: string): string {
  if (range === "90-100") return "#10b981";
  if (range === "80-89" || range === "70-79") return "#f59e0b";
  return "#ef4444";
}

function getSupplierColor(index: number): string {
  const colors = ["#3b82f6", "#10b981", "#f59e0b", "#a855f7", "#ef4444"];
  return colors[index % colors.length];
}

function percent(value: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((value / total) * 100);
}