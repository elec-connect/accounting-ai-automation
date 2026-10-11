"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

// ═══════════════════════════════════════════════════════════════
//  TYPES
// ═══════════════════════════════════════════════════════════════

type License = {
  id: string;
  license_key: string;
  duration_type: string;
  duration_days: number | null;
  status: string;
  created_at: string;
  activated_at: string | null;
  expires_at: string | null;
  activated_by_email: string | null;
  notes: string | null;
};

// ═══════════════════════════════════════════════════════════════
//  CONSTANTES
// ═══════════════════════════════════════════════════════════════

const DURATIONS = [
  { value: "10_days", label: "10 jours", icon: "⚡" },
  { value: "1_month", label: "1 mois", icon: "📅" },
  { value: "1_year", label: "1 an", icon: "🎯" },
  { value: "10_years", label: "10 ans", icon: "🏆" },
  { value: "lifetime", label: "À vie", icon: "♾️" },
];

// ═══════════════════════════════════════════════════════════════
//  COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════════

export default function SuperAdminLicensesPage() {
  const [licenses, setLicenses] = useState<License[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [selectedDuration, setSelectedDuration] = useState("1_year");
  const [clientEmail, setClientEmail] = useState("");
  const [clientName, setClientName] = useState("");
  const [newKey, setNewKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [sendEmail, setSendEmail] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // ─────────────────────────────────────────────────────────────
  //  CHARGEMENT
  // ─────────────────────────────────────────────────────────────

  async function load() {
    try {
      const res = await fetch("/api/super-admin/licenses");
      const data = await res.json();
      setLicenses(data.licenses ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // ─────────────────────────────────────────────────────────────
  //  CRÉER UNE LICENCE
  // ─────────────────────────────────────────────────────────────

  async function handleCreate() {
    setCreating(true);
    setMessage(null);
    setNewKey(null);

    try {
      const res = await fetch("/api/super-admin/licenses/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          duration: selectedDuration,
          client_email: clientEmail || undefined,
          client_name: clientName || undefined,
          send_email: sendEmail,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setNewKey(data.license.license_key);
        setMessage(
          sendEmail && clientEmail
            ? `✅ Licence créée et envoyée à ${clientEmail}`
            : "✅ Licence créée"
        );
        setClientEmail("");
        setClientName("");
        await load();
      } else {
        setMessage("❌ " + data.error);
      }
    } catch (err) {
      setMessage(
        "❌ " + (err instanceof Error ? err.message : "Erreur inconnue")
      );
    } finally {
      setCreating(false);
    }
  }

  // ─────────────────────────────────────────────────────────────
  //  RÉVOQUER UNE LICENCE
  // ─────────────────────────────────────────────────────────────

  async function handleRevoke(id: string) {
    if (!confirm("Révoquer cette licence ? Cette action est irréversible.")) {
      return;
    }

    try {
      await fetch(`/api/super-admin/licenses/${id}/revoke`, {
        method: "POST",
      });
      await load();
    } catch (err) {
      alert("Erreur lors de la révocation");
    }
  }

  // ─────────────────────────────────────────────────────────────
  //  COPIER
  // ─────────────────────────────────────────────────────────────

  function copyKey(key: string) {
    navigator.clipboard.writeText(key);
    setMessage("📋 Clé copiée !");
    setTimeout(() => setMessage(null), 2000);
  }

  // ─────────────────────────────────────────────────────────────
  //  FORMAT
  // ─────────────────────────────────────────────────────────────

  function formatExpiry(license: License): string {
    if (license.duration_type === "lifetime") return "♾️ À vie";
    if (!license.expires_at) return "⏸️ Non activée";

    const expires = new Date(license.expires_at);
    const daysLeft = Math.ceil(
      (expires.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );

    if (daysLeft < 0) return "❌ Expirée";
    return `${daysLeft}j (${expires.toLocaleDateString("fr-FR")})`;
  }

  // ─────────────────────────────────────────────────────────────
  //  FILTRAGE
  // ─────────────────────────────────────────────────────────────

  const filteredLicenses =
    filterStatus === "all"
      ? licenses
      : licenses.filter((l) => l.status === filterStatus);

  // ─────────────────────────────────────────────────────────────
  //  LOADING
  // ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-3 border-green-500 border-t-transparent rounded-full animate-spin" />
          <p className="mt-4 text-gray-400">Chargement…</p>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  //  RENDU
  // ─────────────────────────────────────────────────────────────

  const stats = {
    total: licenses.length,
    active: licenses.filter((l) => l.status === "active").length,
    activated: licenses.filter((l) => l.activated_at).length,
    revoked: licenses.filter((l) => l.status === "revoked").length,
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* ═══════════════════════════════════════════════════════
          HEADER
          ═══════════════════════════════════════════════════════ */}
      <header className="border-b border-gray-700 bg-gray-800 px-8 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🏢</span>
            <div>
              <h1 className="text-xl font-bold">Super Admin</h1>
              <p className="text-xs text-gray-400">
                Plateforme de vente de licences
              </p>
            </div>
          </div>
          <Link
            href="/dashboard"
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            ← Retour à l'app
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-8">
        {/* ═══════════════════════════════════════════════════════
            STATISTIQUES
            ═══════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Total"
            value={stats.total}
            icon="📊"
            color="blue"
          />
          <StatCard
            label="Actives"
            value={stats.active}
            icon="✅"
            color="green"
          />
          <StatCard
            label="Activées"
            value={stats.activated}
            icon="🔓"
            color="purple"
          />
          <StatCard
            label="Révoquées"
            value={stats.revoked}
            icon="❌"
            color="red"
          />
        </div>

        {/* ═══════════════════════════════════════════════════════
            VENDRE UNE LICENCE
            ═══════════════════════════════════════════════════════ */}
        <div className="bg-gray-800 rounded-lg p-6 mb-8 border border-gray-700">
          <h2 className="text-lg font-bold mb-1">
            💰 Vendre une nouvelle licence
          </h2>
          <p className="text-sm text-gray-400 mb-6">
            Générez une clé de licence et envoyez-la automatiquement au client.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {/* Durée */}
            <div>
              <label className="block text-sm font-semibold mb-1 text-gray-300">
                Durée de la licence
              </label>
              <select
                value={selectedDuration}
                onChange={(e) => setSelectedDuration(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:border-green-500 focus:outline-none"
              >
                {DURATIONS.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.icon} {d.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Email client */}
            <div>
              <label className="block text-sm font-semibold mb-1 text-gray-300">
                Email du client
              </label>
              <input
                type="email"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                placeholder="client@example.com"
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:border-green-500 focus:outline-none"
              />
            </div>

            {/* Nom client */}
            <div>
              <label className="block text-sm font-semibold mb-1 text-gray-300">
                Nom du client (optionnel)
              </label>
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="ABC Corp"
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:border-green-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Envoyer email */}
          <div className="flex items-center gap-2 mb-6">
            <input
              type="checkbox"
              id="send_email"
              checked={sendEmail}
              onChange={(e) => setSendEmail(e.target.checked)}
              className="w-4 h-4 accent-green-500"
            />
            <label htmlFor="send_email" className="text-sm text-gray-300">
              Envoyer la clé par email automatiquement au client
            </label>
          </div>

          {/* Bouton */}
          <button
            onClick={handleCreate}
            disabled={creating || (sendEmail && !clientEmail)}
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition-colors"
          >
            {creating ? "⏳ Génération…" : "💰 Générer et vendre la licence"}
          </button>

          {sendEmail && !clientEmail && (
            <p className="mt-2 text-xs text-yellow-500">
              ⚠️ Remplis l'email du client ou décoche "Envoyer par email"
            </p>
          )}

          {/* Nouvelle clé */}
          {newKey && (
            <div className="mt-6 p-4 bg-green-900/30 border border-green-600 rounded-lg">
              <p className="text-sm font-semibold text-green-300 mb-3">
                ✅ Licence générée avec succès :
              </p>
              <div className="flex items-center gap-3">
                <code className="flex-1 bg-gray-900 px-4 py-3 rounded font-mono text-lg text-green-400 tracking-wider">
                  {newKey}
                </code>
                <button
                  onClick={() => copyKey(newKey)}
                  className="px-4 py-3 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                >
                  📋 Copier
                </button>
              </div>
              {clientEmail && sendEmail && (
                <p className="mt-3 text-xs text-green-400">
                  📧 Email envoyé à <strong>{clientEmail}</strong>
                </p>
              )}
            </div>
          )}

          {message && !newKey && (
            <p className="mt-4 text-sm text-green-400">{message}</p>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════
            LISTE DES LICENCES
            ═══════════════════════════════════════════════════════ */}
        <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
          <div className="p-4 border-b border-gray-700 flex items-center justify-between flex-wrap gap-3">
            <h2 className="font-bold">
              📋 Toutes les licences ({filteredLicenses.length})
            </h2>

            {/* Filtres */}
            <div className="flex gap-2 flex-wrap">
              {[
                { value: "all", label: "Toutes", icon: "📋" },
                { value: "active", label: "Actives", icon: "✅" },
                { value: "revoked", label: "Révoquées", icon: "❌" },
              ].map((f) => (
                <button
                  key={f.value}
                  onClick={() => setFilterStatus(f.value)}
                  className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                    filterStatus === f.value
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-gray-700 text-gray-300 border-gray-600 hover:bg-gray-600"
                  }`}
                >
                  {f.icon} {f.label}
                </button>
              ))}
            </div>
          </div>

          {filteredLicenses.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <p className="text-3xl mb-3">🎫</p>
              <p className="font-semibold">Aucune licence</p>
              <p className="text-xs mt-2">
                Vends ta première licence ci-dessus ☝️
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-900">
                <tr>
                  <th className="text-left p-3 font-semibold text-gray-400">
                    Clé
                  </th>
                  <th className="text-left p-3 font-semibold text-gray-400">
                    Durée
                  </th>
                  <th className="text-left p-3 font-semibold text-gray-400">
                    Client
                  </th>
                  <th className="text-left p-3 font-semibold text-gray-400">
                    Statut
                  </th>
                  <th className="text-left p-3 font-semibold text-gray-400">
                    Expire
                  </th>
                  <th className="text-left p-3 font-semibold text-gray-400">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredLicenses.map((license) => (
                  <tr
                    key={license.id}
                    className="border-b border-gray-700 hover:bg-gray-700/30 transition-colors"
                  >
                    <td className="p-3 font-mono text-xs text-green-400">
                      {license.license_key}
                    </td>
                    <td className="p-3 text-xs text-gray-300">
                      {DURATIONS.find((d) => d.value === license.duration_type)
                        ?.label || license.duration_type}
                    </td>
                    <td className="p-3 text-xs text-gray-300">
                      {license.activated_by_email ||
                        license.notes ||
                        "—"}
                    </td>
                    <td className="p-3">
                      <span
                        className={`text-xs px-2 py-1 rounded-full font-semibold ${
                          license.status === "active"
                            ? "bg-green-900/40 text-green-300"
                            : license.status === "revoked"
                            ? "bg-red-900/40 text-red-300"
                            : "bg-gray-700 text-gray-300"
                        }`}
                      >
                        {license.status}
                      </span>
                    </td>
                    <td className="p-3 text-xs text-gray-400">
                      {formatExpiry(license)}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => copyKey(license.license_key)}
                          className="text-xs px-2 py-1 border border-gray-600 rounded hover:bg-gray-700 transition-colors"
                          title="Copier la clé"
                        >
                          📋
                        </button>
                        {license.status !== "revoked" && (
                          <button
                            onClick={() => handleRevoke(license.id)}
                            className="text-xs px-2 py-1 border border-red-700 text-red-400 rounded hover:bg-red-900/30 transition-colors"
                            title="Révoquer"
                          >
                            ❌
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  SOUS-COMPOSANTS
// ═══════════════════════════════════════════════════════════════

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon: string;
  color: "blue" | "green" | "purple" | "red";
}) {
  const colors = {
    blue: "border-blue-500 text-blue-400",
    green: "border-green-500 text-green-400",
    purple: "border-purple-500 text-purple-400",
    red: "border-red-500 text-red-400",
  };

  return (
    <div
      className={`bg-gray-800 border-l-4 ${colors[color]} rounded-lg p-4 transition-transform hover:scale-105`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide">
            {label}
          </p>
          <p className="text-3xl font-bold mt-1">{value}</p>
        </div>
        <span className="text-4xl opacity-70">{icon}</span>
      </div>
    </div>
  );
}