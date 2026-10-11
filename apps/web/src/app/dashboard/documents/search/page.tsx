"use client";

import { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type SearchResult = {
  id: string;
  original_filename: string | null;
  type: string;
  status: string;
  confidence_score: number | null;
  created_at: string;
  extractions?: Array<{ extracted_fields: Record<string, unknown> }>;
};

export default function AdvancedSearchPage() {
  const [supplier, setSupplier] = useState("");
  const [amountMin, setAmountMin] = useState("");
  const [amountMax, setAmountMax] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [type, setType] = useState("all");
  const [status, setStatus] = useState("all");

  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  async function search() {
    setLoading(true);
    setSearched(true);

    try {
      const res = await fetch("/api/documents/advanced-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplier: supplier || undefined,
          amountMin: amountMin ? Number(amountMin) : undefined,
          amountMax: amountMax ? Number(amountMax) : undefined,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          type,
          status,
        }),
      });

      const data = await res.json();
      setResults(data.results ?? []);
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setSupplier("");
    setAmountMin("");
    setAmountMax("");
    setDateFrom("");
    setDateTo("");
    setType("all");
    setStatus("all");
    setResults([]);
    setSearched(false);
  }

  return (
    <main className="p-8 max-w-6xl">
      <h1 className="text-2xl font-bold mb-6">🔍 Recherche avancée</h1>

      {/* Formulaire */}
      <Card className="p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-semibold mb-1">
              Fournisseur
            </label>
            <input
              type="text"
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              placeholder="Elec-Connect, Huilerie..."
              className="w-full border rounded px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">
              Type
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full border rounded px-3 py-2"
            >
              <option value="all">Tous</option>
              <option value="invoice">Factures</option>
              <option value="quote">Devis</option>
              <option value="delivery_note">Bons de livraison</option>
              <option value="receipt">Reçus</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">
              Montant min (DT)
            </label>
            <input
              type="number"
              value={amountMin}
              onChange={(e) => setAmountMin(e.target.value)}
              placeholder="0"
              className="w-full border rounded px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">
              Montant max (DT)
            </label>
            <input
              type="number"
              value={amountMax}
              onChange={(e) => setAmountMax(e.target.value)}
              placeholder="10000"
              className="w-full border rounded px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">
              Date facture (à partir de)
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full border rounded px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">
              Date facture (jusqu'à)
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full border rounded px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">
              Statut
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full border rounded px-3 py-2"
            >
              <option value="all">Tous</option>
              <option value="exception">Exceptions</option>
              <option value="auto_approved">Auto-approuvés</option>
              <option value="approved">Approuvés</option>
              <option value="delivered">Livrés</option>
              <option value="rejected">Rejetés</option>
            </select>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={search}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Recherche…" : "🔍 Rechercher"}
          </button>
          <button
            onClick={reset}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
          >
            Réinitialiser
          </button>
        </div>
      </Card>

      {/* Résultats */}
      {searched && (
        <Card className="p-6">
          <h2 className="font-semibold mb-4">
            {results.length} résultat{results.length > 1 ? "s" : ""}
          </h2>

          {results.length === 0 ? (
            <p className="text-sm text-gray-500">Aucun document ne correspond.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b-2">
                <tr>
                  <th className="text-left py-2">Fichier</th>
                  <th className="text-left py-2">Fournisseur</th>
                  <th className="text-right py-2">Montant</th>
                  <th className="text-left py-2">Date</th>
                  <th className="text-left py-2">Score</th>
                  <th className="text-left py-2">Statut</th>
                </tr>
              </thead>
              <tbody>
                {results.map((doc) => {
                  const f = doc.extractions?.[0]?.extracted_fields as Record<string, unknown> | undefined;
                  return (
                    <tr key={doc.id} className="border-b hover:bg-gray-50">
                      <td className="py-2">
                        <Link
                          href={`/dashboard/documents/${doc.id}`}
                          className="text-blue-600 hover:underline"
                        >
                          {doc.original_filename}
                        </Link>
                      </td>
                      <td className="py-2 text-xs">
                        {String(f?.supplier_name ?? "—")}
                      </td>
                      <td className="text-right py-2">
                        {f?.total_amount_ttc != null
                          ? `${Number(f.total_amount_ttc).toFixed(2)} DT`
                          : "—"}
                      </td>
                      <td className="py-2 text-xs">
                        {String(f?.invoice_date ?? "—")}
                      </td>
                      <td className="py-2">
                        {doc.confidence_score != null && (
                          <span className="text-xs">
                            {doc.confidence_score.toFixed(0)}%
                          </span>
                        )}
                      </td>
                      <td className="py-2">
                        <Badge variant="info">{doc.status}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>
      )}
    </main>
  );
}