"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";

type Balance = {
  account_number: string;
  account_label: string;
  total_debit: number;
  total_credit: number;
  balance: number;
};

type PartyBalance = {
  party_name: string;
  party_type: string;
  total_debit: number;
  total_credit: number;
  balance: number;
};

export default function AccountingPage() {
  const [balance, setBalance] = useState<Balance[]>([]);
  const [parties, setParties] = useState<PartyBalance[]>([]);
  const [loading, setLoading] = useState(true);
  // ⭐ Nouveaux states
  const [regenerating, setRegenerating] = useState(false);
  const [regenerateMessage, setRegenerateMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  async function loadData() {
    setLoading(true);
    const [balanceData, partiesData] = await Promise.all([
      fetch("/api/accounting/balance").then((r) => r.json()),
      fetch("/api/accounting/parties").then((r) => r.json()),
    ]);
    setBalance(balanceData.balance ?? []);
    setParties(partiesData.parties ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  // ⭐ Fonction de régénération
  async function handleRegenerate() {
    const confirmed = confirm(
      "Régénérer les écritures comptables pour TOUS les documents ?\n\n" +
        "⚠️ Cela va :\n" +
        "• Supprimer les écritures actuelles\n" +
        "• Les recréer à partir des extractions existantes\n\n" +
        "Continuer ?"
    );

    if (!confirmed) return;

    setRegenerating(true);
    setRegenerateMessage(null);

    try {
      const res = await fetch("/api/accounting/regenerate", {
        method: "POST",
      });

      const data = await res.json();

      if (res.ok) {
        setRegenerateMessage({
          type: "success",
          text: `✅ ${data.message}`,
        });
        await loadData(); // Recharger les données
      } else {
        setRegenerateMessage({
          type: "error",
          text: `❌ ${data.error}`,
        });
      }
    } catch (err) {
      setRegenerateMessage({
        type: "error",
        text: `❌ Erreur réseau : ${err instanceof Error ? err.message : "inconnue"}`,
      });
    } finally {
      setRegenerating(false);
    }
  }

  if (loading) return <div className="p-8">Chargement…</div>;

  return (
    <main className="p-8 max-w-6xl">
      {/* Header avec bouton */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">📊 Comptabilité</h1>

        {/* ⭐ Bouton Régénérer */}
        <button
          onClick={handleRegenerate}
          disabled={regenerating}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
        >
          {regenerating ? (
            <>
              <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Régénération…
            </>
          ) : (
            <>🔄 Régénérer les écritures</>
          )}
        </button>
      </div>

      {/* ⭐ Message de statut */}
      {regenerateMessage && (
        <div
          className={`mb-6 p-4 rounded ${
            regenerateMessage.type === "success"
              ? "bg-green-50 text-green-800 border border-green-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          {regenerateMessage.text}
        </div>
      )}

      {/* Balance générale */}
      <Card className="p-6 mb-8">
        <h2 className="text-lg font-semibold mb-4">📋 Balance générale</h2>

        {balance.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p className="text-3xl mb-2">📊</p>
            <p className="font-semibold mb-1">Aucune écriture comptable</p>
            <p className="text-sm mb-4">
              Uploadez des documents ou cliquez sur "Régénérer les écritures".
            </p>
            <button
              onClick={handleRegenerate}
              disabled={regenerating}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              🔄 Régénérer maintenant
            </button>
          </div>
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
                    {b.total_debit.toFixed(3)} DT
                  </td>
                  <td className="p-2 text-right">
                    {b.total_credit.toFixed(3)} DT
                  </td>
                  <td
                    className={`p-2 text-right font-semibold ${
                      b.balance >= 0 ? "text-green-700" : "text-red-700"
                    }`}
                  >
                    {b.balance.toFixed(3)} DT
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* Soldes clients / fournisseurs */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">
          👥 Soldes clients et fournisseurs
        </h2>

        {parties.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p className="text-3xl mb-2">👥</p>
            <p>Aucun client ou fournisseur enregistré</p>
          </div>
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
                    {p.total_debit.toFixed(3)} DT
                  </td>
                  <td className="p-2 text-right">
                    {p.total_credit.toFixed(3)} DT
                  </td>
                  <td
                    className={`p-2 text-right font-semibold ${
                      p.balance >= 0 ? "text-green-700" : "text-red-700"
                    }`}
                  >
                    {p.balance.toFixed(3)} DT
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