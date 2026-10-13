"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/card";

type Balance = {
  account_number: string;
  account_label: string;
  total_debit: number;
  total_credit: number;
  balance: number;
};

type Party = {
  party_name: string;
  party_type: string;
  total_debit: number;
  total_credit: number;
  balance: number;
};

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

type DocLink = {
  id: string;
  role: string;
  direction: string;
  match_score: number | null;
  confidence: string | null;
  needs_review: boolean;
  documents: {
    id: string;
    original_filename: string;
    type: string;
    status: string;
    created_at: string;
  } | null;
};

export default function CompanyDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const [company, setCompany] = useState<Company | null>(null);
  const [balance, setBalance] = useState<Balance[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [documents, setDocuments] = useState<DocLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // ⭐ Flag anti-boucle infinie
  const hasCalculated = useRef(false);

  async function loadData() {
    setLoading(true);
    const res = await fetch(`/api/companies/${id}`);
    const data = await res.json();
    setCompany(data.company);
    setBalance(data.balance ?? []);
    setParties(data.parties ?? []);
    setDocuments(data.documents ?? []);
    setLoading(false);
  }

  async function handleRecalculate() {
    setCalculating(true);
    setMessage(null);

    try {
      const res = await fetch(`/api/companies/${id}/recalculate`, {
        method: "POST",
      });

      const data = await res.json();

      if (res.ok) {
        setMessage(
          `✅ Calculé : ${data.stats.documents_processed} documents, ${data.stats.entries_created} écritures` +
            (data.stats.documents_needs_review > 0
              ? ` — ⚠️ ${data.stats.documents_needs_review} à vérifier`
              : "")
        );
        await loadData();
      } else {
        setMessage(`❌ ${data.error}`);
      }
    } catch (err) {
      setMessage(
        `❌ Erreur : ${err instanceof Error ? err.message : "inconnue"}`
      );
    } finally {
      setCalculating(false);
    }
  }

  // ⭐ UN SEUL useEffect qui gère tout (pas de boucle)
  useEffect(() => {
    if (!id) return;

    // Réinitialiser le flag quand l'id change
    hasCalculated.current = false;

    async function init() {
      // 1. Charger les données
      await loadData();

      // 2. Calculer UNE SEULE FOIS (si pas déjà fait)
      if (!hasCalculated.current) {
        hasCalculated.current = true;
        await handleRecalculate();
      }
    }

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) return <div className="p-8">Chargement…</div>;
  if (!company) return <div className="p-8">Entreprise introuvable</div>;

  // ⭐ Fallbacks pour éviter les erreurs toFixed
  const balanceTotal = Number(company.balance ?? 0);
  const totalSales = Number(company.total_sales ?? 0);
  const totalPurchases = Number(company.total_purchases ?? 0);
  const totalTvaCollected = Number(company.total_tva_collected ?? 0);
  const totalTvaDeductible = Number(company.total_tva_deductible ?? 0);

  const needsReview = documents.filter((d) => d.needs_review).length;

  return (
    <main className="p-8 max-w-6xl">
      <Link
        href="/dashboard/companies"
        className="inline-block mb-4 text-sm text-blue-600 hover:underline"
      >
        ← Retour aux entreprises
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">🏢 {company.name}</h1>
          <div className="flex items-center gap-3 text-sm text-gray-500">
            {company.tax_id && (
              <span className="font-mono">MF: {company.tax_id}</span>
            )}
            {company.email && <span>{company.email}</span>}
          </div>
        </div>

        <button
          onClick={handleRecalculate}
          disabled={calculating}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
        >
          {calculating ? (
            <>
              <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Calcul en cours…
            </>
          ) : (
            <>🔄 Recalculer</>
          )}
        </button>
      </div>

      {message && (
        <div className="mb-6 p-3 bg-green-50 border border-green-200 rounded text-sm text-green-800">
          {message}
        </div>
      )}

      {needsReview > 0 && (
        <Card className="p-4 mb-6 bg-orange-50 border-orange-200">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <p className="font-semibold text-orange-900">
                {needsReview} document(s) à vérifier
              </p>
              <p className="text-sm text-orange-700">
                La détection automatique a une confiance faible pour ces
                documents.
              </p>
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <p className="text-xs text-gray-500 uppercase mb-1">Ventes</p>
          <p className="text-2xl font-bold text-green-700">
            {totalSales.toFixed(3)} DT
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-gray-500 uppercase mb-1">Achats</p>
          <p className="text-2xl font-bold text-orange-700">
            {totalPurchases.toFixed(3)} DT
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-gray-500 uppercase mb-1">TVA</p>
          <p className="text-sm font-bold text-gray-700">
            +{totalTvaCollected.toFixed(3)}
            <br />
            -{totalTvaDeductible.toFixed(3)}
          </p>
        </Card>
        <Card
          className={`p-4 ${
            balanceTotal >= 0
              ? "bg-green-50 border-green-200"
              : "bg-red-50 border-red-200"
          }`}
        >
          <p className="text-xs text-gray-500 uppercase mb-1">Solde</p>
          <p
            className={`text-2xl font-bold ${
              balanceTotal >= 0 ? "text-green-700" : "text-red-700"
            }`}
          >
            {balanceTotal.toFixed(3)} DT
          </p>
        </Card>
      </div>

      <Card className="p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">📋 Balance</h2>

        {balance.length === 0 ? (
          <p className="text-sm text-gray-500">Aucune écriture.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b-2">
              <tr>
                <th className="text-left p-2">Compte</th>
                <th className="text-left p-2">Libellé</th>
                <th className="text-right p-2">Débit</th>
                <th className="text-right p-2">Crédit</th>
                <th className="text-right p-2">Solde</th>
              </tr>
            </thead>
            <tbody>
              {balance.map((b) => (
                <tr key={b.account_number} className="border-b">
                  <td className="p-2 font-mono">{b.account_number}</td>
                  <td className="p-2">{b.account_label}</td>
                  <td className="p-2 text-right">
                    {Number(b.total_debit ?? 0).toFixed(3)} DT
                  </td>
                  <td className="p-2 text-right">
                    {Number(b.total_credit ?? 0).toFixed(3)} DT
                  </td>
                  <td className="p-2 text-right font-semibold">
  {b.balance >= 0 ? (
    <span className="text-green-700">
      {Number(b.balance).toFixed(3)} DT (Débit)
    </span>
  ) : (
    <span className="text-blue-700">
      {Math.abs(Number(b.balance)).toFixed(3)} DT (Crédit)
    </span>
  )}
</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card className="p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">
          👥 Clients et fournisseurs
        </h2>

        {parties.length === 0 ? (
          <p className="text-sm text-gray-500">Aucun partenaire.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b-2">
              <tr>
                <th className="text-left p-2">Partie</th>
                <th className="text-left p-2">Type</th>
                <th className="text-right p-2">Débit</th>
                <th className="text-right p-2">Crédit</th>
                <th className="text-right p-2">Solde</th>
              </tr>
            </thead>
            <tbody>
              {parties.map((p) => (
                <tr key={p.party_name} className="border-b">
                  <td className="p-2 font-medium">{p.party_name}</td>
                  <td className="p-2">
                    {p.party_type === "client" ? "👤 Client" : "🏢 Fournisseur"}
                  </td>
                  <td className="p-2 text-right">
                    {Number(p.total_debit ?? 0).toFixed(3)} DT
                  </td>
                  <td className="p-2 text-right">
                    {Number(p.total_credit ?? 0).toFixed(3)} DT
                  </td>
                  <td
                    className={`p-2 text-right font-semibold ${
                      p.balance >= 0 ? "text-green-700" : "text-red-700"
                    }`}
                  >
                    {Number(p.balance ?? 0).toFixed(3)} DT
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">
          📄 Documents liés ({documents.length})
        </h2>

        {documents.length === 0 ? (
          <p className="text-sm text-gray-500">Aucun document.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b-2">
              <tr>
                <th className="text-left p-2">Fichier</th>
                <th className="text-left p-2">Rôle</th>
                <th className="text-left p-2">Sens</th>
                <th className="text-left p-2">Score</th>
                <th className="text-left p-2">Statut</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((d) => (
                <tr key={d.id} className="border-b">
                  <td className="p-2">
                    {d.documents ? (
                      <Link
                        href={`/dashboard/documents/${d.documents.id}`}
                        className="text-blue-600 hover:underline"
                      >
                        {d.documents.original_filename}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="p-2">
                    {d.role === "issuer" ? "📤 Émetteur" : "📥 Destinataire"}
                  </td>
                  <td className="p-2">
                    {d.direction === "issued" ? "Vente" : "Achat"}
                  </td>
                  <td className="p-2">
                    <span
                      className={`text-xs px-2 py-1 rounded-full font-semibold ${
                        d.confidence === "high"
                          ? "bg-green-100 text-green-800"
                          : d.confidence === "medium"
                          ? "bg-yellow-100 text-yellow-800"
                          : d.confidence === "low"
                          ? "bg-orange-100 text-orange-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {d.match_score ?? 0}/3
                    </span>
                  </td>
                  <td className="p-2">
                    {d.needs_review ? (
                      <span className="text-xs text-orange-700 font-semibold">
                        ⚠️ À vérifier
                      </span>
                    ) : (
                      <span className="text-xs text-green-700">✅ OK</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </main>
  );
}