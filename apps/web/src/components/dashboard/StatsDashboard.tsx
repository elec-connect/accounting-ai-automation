"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

type Stats = {
  totalDocuments: number;
  totalTtc: number;
  totalExtracted: number;
  totalPending: number;
  byStatus: Record<string, number>;
  topSuppliers: { name: string; amount: number }[];
  monthlyData: { month: string; amount: number }[];
  recentDocs: {
    id: string;
    filename: string;
    supplier: string;
    amount: number;
    status: string;
    created_at: string;
  }[];
};

const COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6"];

export function StatsDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard/stats")
      .then((res) => res.json())
      .then((data) => {
        setStats(data);
        setLoading(false);
      });
  }, []);

  if (loading) return <p className="text-gray-500">Chargement des statistiques...</p>;
  if (!stats) return <p className="text-red-600">Erreur de chargement</p>;

  const statusData = Object.entries(stats.byStatus).map(([name, value]) => ({
    name,
    value,
  }));

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-6">
          <p className="text-sm text-gray-500 mb-1">Total documents</p>
          <p className="text-3xl font-bold text-blue-600">{stats.totalDocuments}</p>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-gray-500 mb-1">Montant total TTC</p>
          <p className="text-3xl font-bold text-green-600">
            {stats.totalTtc.toFixed(2)} DT
          </p>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-gray-500 mb-1">Extraits</p>
          <p className="text-3xl font-bold text-purple-600">{stats.totalExtracted}</p>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-gray-500 mb-1">En attente</p>
          <p className="text-3xl font-bold text-orange-600">{stats.totalPending}</p>
        </Card>
      </div>

      {/* Graphiques */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="font-bold mb-4">Évolution mensuelle (DT)</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={stats.monthlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="amount" fill="#3B82F6" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-6">
          <h3 className="font-bold mb-4">Répartition par statut</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={statusData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${value}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {statusData.map((_, index) => (
                  <Cell key={index} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Top fournisseurs + derniers documents */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="font-bold mb-4">Top 5 fournisseurs</h3>
          <div className="space-y-3">
            {stats.topSuppliers.length === 0 && (
              <p className="text-gray-500 text-sm">Aucun fournisseur</p>
            )}
            {stats.topSuppliers.map((s, i) => (
              <div key={i} className="flex justify-between items-center">
                <span className="text-sm">{s.name}</span>
                <span className="font-bold text-green-600">
                  {s.amount.toFixed(2)} DT
                </span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="font-bold mb-4">Derniers documents</h3>
          <div className="space-y-3">
            {stats.recentDocs.map((doc) => (
              <div key={doc.id} className="flex justify-between items-center text-sm">
                <div className="truncate flex-1">
                  <span className="font-medium">{doc.filename}</span>
                  <span className="text-gray-500 ml-2">({doc.supplier})</span>
                </div>
                <span className="text-green-600 font-bold ml-2">
                  {doc.amount > 0 ? doc.amount.toFixed(2) + " DT" : "-"}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}