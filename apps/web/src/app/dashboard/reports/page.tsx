"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/card";

type SupplierStats = {
  supplier: string;
  count: number;
  total: number;
  avgConfidence: number;
};

type MonthStats = {
  month: string;
  count: number;
  total: number;
};

export default function ReportsPage() {
  const [suppliers, setSuppliers] = useState<SupplierStats[]>([]);
  const [months, setMonths] = useState<MonthStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/reports/stats")
      .then((r) => r.json())
      .then((data) => {
        setSuppliers(data.suppliers ?? []);
        setMonths(data.months ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex-1">
          <Header title="Rapports" />
          <main className="p-8">Chargement…</main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1">
        <Header title="Rapports" />
        <main className="p-8 max-w-6xl">
          <h1 className="text-2xl font-bold mb-2">📊 Rapports avancés</h1>
          <p className="text-sm text-gray-500 mb-6">
            Statistiques agrégées sur les documents traités.
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top fournisseurs */}
            <Card className="p-6">
              <h2 className="font-semibold mb-4">🏢 Top fournisseurs</h2>
              {suppliers.length === 0 ? (
                <p className="text-sm text-gray-500">Aucune donnée.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2">Fournisseur</th>
                      <th className="text-right py-2">Factures</th>
                      <th className="text-right py-2">Total</th>
                      <th className="text-right py-2">Conf.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {suppliers.slice(0, 10).map((s) => (
                      <tr key={s.supplier} className="border-b">
                        <td className="py-2 font-medium">{s.supplier}</td>
                        <td className="text-right py-2">{s.count ?? 0}</td>
                        <td className="text-right py-2">
                          {(s.total ?? 0).toFixed(2)} DT
                        </td>
                        <td className="text-right py-2 text-xs text-gray-500">
                          {(s.avgConfidence ?? 0).toFixed(0)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>

            {/* Évolution mensuelle */}
            <Card className="p-6">
              <h2 className="font-semibold mb-4">📅 Évolution mensuelle</h2>
              {months.length === 0 ? (
                <p className="text-sm text-gray-500">Aucune donnée.</p>
              ) : (
                <div className="space-y-2">
                  {months.map((m) => (
                    <div
                      key={m.month}
                      className="flex justify-between text-sm border-b pb-1"
                    >
                      <span className="font-medium">{m.month}</span>
                      <span className="text-gray-600">
                        {m.count ?? 0} docs · {(m.total ?? 0).toFixed(2)} DT
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}