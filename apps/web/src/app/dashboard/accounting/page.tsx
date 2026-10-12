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

  useEffect(() => {
    Promise.all([
      fetch("/api/accounting/balance").then((r) => r.json()),
      fetch("/api/accounting/parties").then((r) => r.json()),
    ]).then(([balanceData, partiesData]) => {
      setBalance(balanceData.balance ?? []);
      setParties(partiesData.parties ?? []);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="p-8">Chargement…</div>;

  return (
    <main className="p-8 max-w-6xl">
      <h1 className="text-2xl font-bold mb-6">📊 Comptabilité</h1>

      {/* Balance générale */}
      <Card className="p-6 mb-8">
        <h2 className="text-lg font-semibold mb-4">📋 Balance générale</h2>
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
      </Card>

      {/* Soldes clients / fournisseurs */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">
          👥 Soldes clients et fournisseurs
        </h2>
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
      </Card>
    </main>
  );
}