"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";

type Company = {
  id: string;
  name: string;
  tax_id: string | null;
  email: string | null;
  balance: number;
  total_sales: number;
  total_purchases: number;
  last_calculated_at: string | null;
};

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    tax_id: "",
    email: "",
    phone: "",
    address: "",
  });
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

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch("/api/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage("✅ Entreprise créée");
        setForm({ name: "", tax_id: "", email: "", phone: "", address: "" });
        setShowForm(false);
        await loadCompanies();
      } else {
        setMessage(`❌ ${data.error}`);
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-8">Chargement…</div>;

  return (
    <main className="p-8 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">🏢 Entreprises gérées</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          {showForm ? "Annuler" : "➕ Nouvelle entreprise"}
        </button>
      </div>

      {message && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded text-sm">
          {message}
        </div>
      )}

      {showForm && (
        <Card className="p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">
            Créer une nouvelle entreprise
          </h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold mb-1">
                Nom de l'entreprise *
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                placeholder="ex: Elec-Connect"
                className="w-full border rounded px-3 py-2"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-1">
                  Matricule fiscal
                </label>
                <input
                  type="text"
                  value={form.tax_id}
                  onChange={(e) => setForm({ ...form, tax_id: e.target.value })}
                  placeholder="MF-123456789"
                  className="w-full border rounded px-3 py-2 font-mono text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="contact@entreprise.com"
                  className="w-full border rounded px-3 py-2"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1">
                Téléphone
              </label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="29328870"
                className="w-full border rounded px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1">
                Adresse
              </label>
              <input
                type="text"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="01, Rue Manfalouti Jemmel"
                className="w-full border rounded px-3 py-2"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
            >
              {saving ? "Création..." : "💾 Créer"}
            </button>
          </form>
        </Card>
      )}

      {companies.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-4xl mb-3">🏢</p>
          <p className="font-semibold mb-2">Aucune entreprise</p>
          <p className="text-sm text-gray-500 mb-4">
            Créez votre première entreprise pour commencer.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            ➕ Créer une entreprise
          </button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {companies.map((c) => (
            <Link key={c.id} href={`/dashboard/companies/${c.id}`}>
              <Card className="p-6 hover:shadow-lg hover:border-blue-300 transition cursor-pointer">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-xl font-bold">
                    {c.name.charAt(0).toUpperCase()}
                  </div>
                  <span
                    className={`text-xs px-2 py-1 rounded-full font-semibold ${
                      c.balance >= 0
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {c.balance >= 0 ? "+" : ""}
                    {c.balance.toFixed(3)} DT
                  </span>
                </div>

                <h3 className="font-bold text-lg mb-1">{c.name}</h3>
                {c.tax_id && (
                  <p className="text-xs text-gray-500 font-mono mb-2">
                    MF: {c.tax_id}
                  </p>
                )}

                <div className="mt-4 pt-4 border-t space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Ventes</span>
                    <span className="font-semibold text-green-700">
                      {c.total_sales.toFixed(3)} DT
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Achats</span>
                    <span className="font-semibold text-orange-700">
                      {c.total_purchases.toFixed(3)} DT
                    </span>
                  </div>
                </div>

                {c.last_calculated_at && (
                  <p className="text-xs text-gray-400 mt-3">
                    Calculé :{" "}
                    {new Date(c.last_calculated_at).toLocaleDateString("fr-FR")}
                  </p>
                )}
              </Card>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}