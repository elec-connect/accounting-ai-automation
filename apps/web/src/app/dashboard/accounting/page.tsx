"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";

type Company = {
  id: string;
  name: string;
  tax_id: string | null;
  email: string | null;
  balance: number | null;
  total_sales: number | null;
  total_purchases: number | null;
  total_tva_collected: number | null;
  total_tva_deductible: number | null;
  last_calculated_at: string | null;
};

export default function AccountingDashboardPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function loadCompanies() {
    setLoading(true);
    const res = await fetch("/api/companies");
    const data = await res.json();
    setCompanies(data.companies ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadCompanies();
  }, []);

  // ⭐ Recalculer TOUTES les entreprises
  async function handleRecalculateAll() {
    if (
      !confirm(
        `🔄 Recalculer TOUTES les ${companies.length} entreprises ?\n\n` +
          "Cela va régénérer la comptabilité pour chaque entreprise."
      )
    )
      return;

    setRecalculating(true);
    setMessage(null);

    try {
      let success = 0;
      let failed = 0;

      for (const company of companies) {
        try {
          const res = await fetch(
            `/api/companies/${company.id}/recalculate`,
            { method: "POST" }
          );
          if (res.ok) {
            success++;
          } else {
            failed++;
          }
        } catch {
          failed++;
        }
      }

      setMessage(
        `✅ ${success} entreprise(s) recalculée(s)` +
          (failed > 0 ? ` — ❌ ${failed} échec(s)` : "")
      );
      await loadCompanies();
    } finally {
      setRecalculating(false);
    }
  }

  if (loading) return <div className="p-8">Chargement…</div>;

  // ⭐ Calculs des totaux globaux
  const totalSales = companies.reduce(
    (sum, c) => sum + Number(c.total_sales ?? 0),
    0
  );
  const totalPurchases = companies.reduce(
    (sum, c) => sum + Number(c.total_purchases ?? 0),
    0
  );
  const totalTvaCollected = companies.reduce(
    (sum, c) => sum + Number(c.total_tva_collected ?? 0),
    0
  );
  const totalTvaDeductible = companies.reduce(
    (sum, c) => sum + Number(c.total_tva_deductible ?? 0),
    0
  );
  const totalBalance = companies.reduce(
    (sum, c) => sum + Number(c.balance ?? 0),
    0
  );
  const totalTva = totalTvaCollected - totalTvaDeductible;

  // ⭐ Tri par solde décroissant
  const sortedCompanies = [...companies].sort(
    (a, b) => Number(b.balance ?? 0) - Number(a.balance ?? 0)
  );

  return (
    <main className="p-8 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">📊 Tableau de bord comptable</h1>
        <button
          onClick={handleRecalculateAll}
          disabled={recalculating || companies.length === 0}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
        >
          {recalculating ? (
            <>
              <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Recalcul…
            </>
          ) : (
            <>🔄 Recalculer tout ({companies.length})</>
          )}
        </button>
      </div>

      {message && (
        <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800">
          {message}
        </div>
      )}

      {/* ⭐ Totaux globaux */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card className="p-4 border-l-4 border-green-500">
          <p className="text-xs text-gray-500 uppercase tracking-wide">
            Ventes totales
          </p>
          <p className="text-2xl font-bold text-green-700 mt-1">
            {totalSales.toFixed(3)} DT
          </p>
        </Card>
        <Card className="p-4 border-l-4 border-orange-500">
          <p className="text-xs text-gray-500 uppercase tracking-wide">
            Achats totaux
          </p>
          <p className="text-2xl font-bold text-orange-700 mt-1">
            {totalPurchases.toFixed(3)} DT
          </p>
        </Card>
        <Card
          className={`p-4 border-l-4 ${
            totalTva >= 0 ? "border-blue-500" : "border-red-500"
          }`}
        >
          <p className="text-xs text-gray-500 uppercase tracking-wide">
            TVA nette
          </p>
          <p
            className={`text-2xl font-bold mt-1 ${
              totalTva >= 0 ? "text-blue-700" : "text-red-700"
            }`}
          >
            {totalTva >= 0 ? "+" : ""}
            {totalTva.toFixed(3)} DT
          </p>
          <p className="text-xs text-gray-400 mt-1">
            +{totalTvaCollected.toFixed(2)} / -{totalTvaDeductible.toFixed(2)}
          </p>
        </Card>
        <Card
          className={`p-4 border-l-4 ${
            totalBalance >= 0 ? "border-green-500" : "border-red-500"
          }`}
        >
          <p className="text-xs text-gray-500 uppercase tracking-wide">
            Solde global
          </p>
          <p
            className={`text-2xl font-bold mt-1 ${
              totalBalance >= 0 ? "text-green-700" : "text-red-700"
            }`}
          >
            {totalBalance >= 0 ? "+" : ""}
            {totalBalance.toFixed(3)} DT
          </p>
        </Card>
      </div>

      {/* ⭐ Entreprises */}
      {companies.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-4xl mb-3">🏢</p>
          <p className="font-semibold mb-2">Aucune entreprise</p>
          <p className="text-sm text-gray-500 mb-4">
            Créez vos entreprises pour commencer la comptabilité.
          </p>
          <Link
            href="/dashboard/companies"
            className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            🏢 Gérer les entreprises
          </Link>
        </Card>
      ) : (
        <>
          <h2 className="text-lg font-semibold mb-4">
            🏢 Entreprises gérées ({companies.length})
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedCompanies.map((c) => {
              const balance = Number(c.balance ?? 0);
              const sales = Number(c.total_sales ?? 0);
              const purchases = Number(c.total_purchases ?? 0);
              const isPositive = balance >= 0;

              return (
                <Link
                  key={c.id}
                  href={`/dashboard/companies/${c.id}`}
                >
                  <Card
                    className={`p-5 hover:shadow-lg transition cursor-pointer border-l-4 ${
                      isPositive ? "border-green-500" : "border-red-500"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-bold text-lg">{c.name}</h3>
                        {c.tax_id && (
                          <p className="text-xs text-gray-500 font-mono">
                            MF: {c.tax_id}
                          </p>
                        )}
                      </div>
                      <span
                        className={`text-xs px-2 py-1 rounded-full font-semibold whitespace-nowrap ${
                          isPositive
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {isPositive ? "+" : ""}
                        {balance.toFixed(3)} DT
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs mt-4 pt-3 border-t">
                      <div>
                        <p className="text-gray-500">Ventes</p>
                        <p className="font-semibold text-green-700">
                          {sales.toFixed(3)} DT
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">Achats</p>
                        <p className="font-semibold text-orange-700">
                          {purchases.toFixed(3)} DT
                        </p>
                      </div>
                    </div>

                    {c.last_calculated_at && (
                      <p className="text-xs text-gray-400 mt-3">
                        Calculé :{" "}
                        {new Date(c.last_calculated_at).toLocaleDateString(
                          "fr-FR"
                        )}
                      </p>
                    )}
                  </Card>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </main>
  );
}