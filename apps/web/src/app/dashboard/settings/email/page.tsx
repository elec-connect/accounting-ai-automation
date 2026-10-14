"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { EnvironmentStatus } from "@/components/settings/EnvironmentStatus";

// ⭐ Type Company
type Company = {
  id: string;
  name: string;
  tax_id: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
};

// ⭐ Helper : est-ce qu'une entreprise est configurée ?
function isCompanyConfigured(c: Company): boolean {
  return !!(c.name?.trim() && c.tax_id?.trim() && c.email?.trim());
}

export default function EmailSettingsPage() {
  const [settings, setSettings] = useState({
    // ─── IA (Groq) — VISIBLE POUR TOUS ────────────
    groq_api_key: "",

    // ─── Email (Resend) — VISIBLE POUR TOUS ──────
    email_from: "",
    email_from_name: "",
    email_to: "",
    resend_api_key: "",
    custom_domain: "",

    // ─── Super Admin uniquement ──────────────────
    cron_enabled: "false",
    cron_frequency: "weekly",
    cron_day: "monday",
    cron_hour: "09",
    cron_email_to: "",
    resend_webhook_secret: "",
    resend_inbound_domain: "",
    reminder_enabled: "false",
    reminder_days: "3",
    reminder_max_count: "3",
    reminder_hour: "8",
    cron_hour_utc: "7",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{ type: string; text: string } | null>(null);

  // ⭐ Companies
  const [companies, setCompanies] = useState<Company[]>([]);
  const [showConfigModal, setShowConfigModal] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        setSettings((prev) => ({ ...prev, ...data.settings }));
        setLoading(false);
      });

    // ⭐ Charger les entreprises
    fetch("/api/companies")
      .then((r) => r.json())
      .then((data) => setCompanies(data.companies ?? []))
      .catch(() => setCompanies([]));
  }, []);

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        setMessage({
          type: "success",
          text: "✅ Configuration sauvegardée",
        });
      } else {
        setMessage({ type: "error", text: "❌ Erreur de sauvegarde" });
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/settings/test", {
        method: "POST",
      });
      const result = await res.json();
      if (res.ok) {
        setMessage({
          type: "success",
          text: "✅ Email de test envoyé à " + settings.email_to,
        });
      } else {
        setMessage({ type: "error", text: "❌ " + result.error });
      }
    } finally {
      setTesting(false);
    }
  }

  if (loading) {
    return <div className="p-8">Chargement...</div>;
  }

  // ⭐ Calcul du nombre d'entreprises configurées
  const configuredCount = companies.filter(isCompanyConfigured).length;
  const incompleteCount = companies.length - configuredCount;

  return (
    <main className="p-8 max-w-2xl">
      <Card className="p-6">
        <h2 className="text-xl font-bold mb-6">⚙️ Paramètres généraux</h2>

        {/* ═══════════════════════════════════════════
            SECTION ENTREPRISE (lien vers /dashboard/companies)
            ═══════════════════════════════════════════ */}
        <h3 className="text-lg font-semibold mb-4 pb-2 border-b">
          🏢 Mes entreprises
          {companies.length > 0 && (
            <span className="ml-2 text-sm font-normal text-gray-500">
              ({companies.length})
            </span>
          )}
        </h3>

        {/* ⭐ État de configuration */}
        {companies.length > 0 && (
          configuredCount === companies.length ? (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded text-sm text-green-800">
              ✅ Toutes les {companies.length} entreprises sont configurées
            </div>
          ) : (
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
              ⚠️ <strong>{configuredCount}</strong> configurée
              {configuredCount > 1 ? "s" : ""} sur <strong>{companies.length}</strong>
              {" — "}
              <strong>{incompleteCount}</strong> incomplète
              {incompleteCount > 1 ? "s" : ""}
              <br />
              <span className="text-xs">
                Complétez les 3 critères (nom, MF, email) pour maximiser la détection automatique.
              </span>
            </div>
          )
        )}

        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg mb-6">
          <p className="text-sm text-blue-900 font-semibold mb-2">
            Gérez plusieurs entreprises
          </p>
          <p className="text-sm text-blue-700 mb-3">
            Renseignez le <strong>nom</strong>, le <strong>matricule fiscal</strong>{" "}
            et l'<strong>email</strong> de chaque entreprise que vous gérez.
            Ces informations servent à calculer automatiquement le{" "}
            <strong>score de détection</strong> (1/3, 2/3, 3/3) pour chaque
            facture uploadée.
          </p>
          <ul className="text-xs text-blue-700 space-y-1 list-disc list-inside mb-4">
            <li>Créer / modifier / supprimer vos entreprises</li>
            <li>Chaque facture est rattachée automatiquement à la bonne entreprise</li>
            <li>La comptabilité est calculée par entreprise</li>
          </ul>
          <div className="flex gap-2 flex-wrap">
            <Link
              href="/dashboard/companies"
              className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-semibold text-sm"
            >
              🏢 Gérer mes entreprises
              {companies.length > 0 ? ` (${companies.length})` : ""} →
            </Link>
            {companies.length > 0 ? (
              <button
                onClick={() => setShowConfigModal(true)}
                className="inline-block px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 font-semibold text-sm"
              >
                {companies.length === 1
                  ? "⚙️ Configurer l'entreprise"
                  : `⚙️ Configurer les ${companies.length} entreprises`}
              </button>
            ) : (
              <span className="inline-block px-4 py-2 bg-gray-200 text-gray-500 rounded font-semibold text-sm cursor-not-allowed">
                ⚙️ Aucune entreprise à configurer
              </span>
            )}
          </div>
        </div>

        <div className="border-b mt-8 mb-8"></div>

        {/* Guide de configuration — VISIBLE POUR TOUS */}
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-blue-900">
              📘 Guide de configuration
            </p>
            <p className="text-xs text-blue-700 mt-1">
              Consultez la documentation pour créer vos variables d'environnement sur Vercel.
            </p>
          </div>
          <a
            href="/docs/environment-variables.html"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 whitespace-nowrap text-sm font-semibold"
          >
            Ouvrir le guide ↗
          </a>
        </div>

        {/* ═══════════════════════════════════════════
            SECTION VARIABLES D'ENVIRONNEMENT
            ═══════════════════════════════════════════ */}
        <h3
          id="env-status"
          className="text-lg font-semibold mb-4 pb-2 border-b scroll-mt-6"
        >
          🔐 Variables d'environnement
        </h3>
        <p className="text-sm text-gray-500 mb-6">
          État des variables d'environnement configurées sur Vercel.
          Les variables critiques doivent être présentes pour que l'application fonctionne.
        </p>

        <EnvironmentStatus />

        <div className="border-b mt-8 mb-8"></div>

        {/* ═══════════════════════════════════════════
            SECTION IA (GROQ) — VISIBLE POUR TOUS
            ═══════════════════════════════════════════ */}
        <h3 className="text-lg font-semibold mb-4 pb-2 border-b">
          🤖 Configuration IA (Groq)
        </h3>
        <p className="text-sm text-gray-500 mb-6">
          Configurez votre clé API Groq pour activer l'assistant IA et l'extraction
          intelligente des documents. Obtenez une clé gratuite sur{" "}
          <a
            href="https://console.groq.com/keys"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 underline"
          >
            console.groq.com/keys
          </a>
        </p>

        <div className="space-y-4 mb-8">
          <div>
            <label className="block text-sm font-semibold mb-1">
              Clé API Groq
            </label>
            <input
              type="password"
              value={settings.groq_api_key}
              onChange={(e) =>
                setSettings({ ...settings, groq_api_key: e.target.value })
              }
              placeholder="gsk_..."
              className="w-full border rounded px-3 py-2 font-mono text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">
              Votre clé est stockée de manière sécurisée dans Supabase.
            </p>
          </div>

          <a
            href="https://console.groq.com/keys"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 text-sm"
          >
            🔗 Obtenir une clé Groq
          </a>
        </div>

        {/* ═══════════════════════════════════════════
            SECTION EMAIL (RESEND) — VISIBLE POUR TOUS
            ═══════════════════════════════════════════ */}
        <h3 className="text-lg font-semibold mb-4 pb-2 border-b">
          📧 Configuration Email (Resend)
        </h3>
        <p className="text-sm text-gray-500 mb-6">
          Configurez votre compte Resend pour envoyer des rapports par email.
          Obtenez une clé API gratuite sur{" "}
          <a
            href="https://resend.com/api-keys"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 underline"
          >
            resend.com/api-keys
          </a>
        </p>

        <div className="space-y-4">
          {/* Champ Domaine Personnalisé */}
          <div>
            <label className="block text-sm font-semibold mb-1">
              Domaine d'envoi personnalisé
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={settings.custom_domain}
                onChange={(e) =>
                  setSettings({ ...settings, custom_domain: e.target.value })
                }
                placeholder="ex: monentreprise.com"
                className="w-full border rounded px-3 py-2"
              />
              <a
                href="https://resend.com/domains"
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-700 whitespace-nowrap"
              >
                Vérifier sur Resend ↗
              </a>
            </div>
          </div>

          {/* Instructions dynamiques */}
          {settings.custom_domain && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="font-bold text-blue-800 mb-2">
                📋 Comment vérifier votre domaine sur Resend
              </h3>
              <ol className="list-decimal list-inside text-sm text-blue-900 space-y-2">
                <li>
                  Créez un compte gratuit sur{" "}
                  <a
                    href="https://resend.com/signup"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    resend.com
                  </a>
                </li>
                <li>
                  Allez dans <strong>Domains</strong> puis cliquez sur{" "}
                  <strong>Add Domain</strong>.
                </li>
                <li>
                  Saisissez <strong>{settings.custom_domain}</strong>{" "}
                  (recommandé : utilisez un sous-domaine comme{" "}
                  <code>notifications.{settings.custom_domain}</code> pour
                  protéger votre réputation d'envoi).
                </li>
                <li>
                  Resend va générer des enregistrements <strong>DNS</strong>{" "}
                  (TXT, MX, CNAME). Copiez-les exactement dans votre
                  fournisseur DNS (Cloudflare, OVH, etc.).
                </li>
                <li>
                  Revenez sur Resend et cliquez sur{" "}
                  <strong>Verify DNS Records</strong>. La vérification prend
                  souvent moins de 15 minutes.
                </li>
                <li>
                  Une fois le statut <strong>Verified</strong> affiché,
                  copiez votre <strong>API Key</strong> dans{" "}
                  <a
                    href="https://resend.com/api-keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    resend.com/api-keys
                  </a>{" "}
                  et collez-la ci-dessous.
                </li>
              </ol>
            </div>
          )}

          {/* Adresse email d'envoi */}
          <div>
            <label className="block text-sm font-semibold mb-1">
              Adresse email d'envoi (from)
            </label>
            <input
              type="email"
              value={settings.email_from}
              onChange={(e) =>
                setSettings({ ...settings, email_from: e.target.value })
              }
              readOnly={!settings.custom_domain}
              placeholder={
                settings.custom_domain
                  ? `contact@${settings.custom_domain}`
                  : "Vérifiez d'abord votre domaine"
              }
              className={`w-full border rounded px-3 py-2 ${
                settings.custom_domain
                  ? "bg-white text-black"
                  : "bg-gray-100 text-gray-500 cursor-not-allowed"
              }`}
            />
            {!settings.custom_domain && (
              <p className="text-xs text-orange-600 mt-1">
                ⚠️ Saisissez et vérifiez un domaine pour activer ce champ.
              </p>
            )}
          </div>

          {/* Nom de l'expéditeur */}
          <div>
            <label className="block text-sm font-semibold mb-1">
              Nom de l'expéditeur
            </label>
            <input
              type="text"
              value={settings.email_from_name}
              onChange={(e) =>
                setSettings({ ...settings, email_from_name: e.target.value })
              }
              placeholder="Accounting System"
              className="w-full border rounded px-3 py-2"
            />
          </div>

          {/* Email de réception */}
          <div>
            <label className="block text-sm font-semibold mb-1">
              Email de réception (to)
            </label>
            <input
              type="email"
              value={settings.email_to}
              onChange={(e) =>
                setSettings({ ...settings, email_to: e.target.value })
              }
              placeholder="admin@example.com"
              className="w-full border rounded px-3 py-2"
            />
          </div>

          {/* Clé API Resend */}
          <div>
            <label className="block text-sm font-semibold mb-1">
              Clé API Resend
            </label>
            <input
              type="password"
              value={settings.resend_api_key}
              onChange={(e) =>
                setSettings({ ...settings, resend_api_key: e.target.value })
              }
              placeholder="re_..."
              className="w-full border rounded px-3 py-2 font-mono text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">
              Votre clé est stockée de manière sécurisée dans Supabase.
            </p>
          </div>

          {/* ═══════════════════════════════════════════
              SECTION WEBHOOK RESEND
              ═══════════════════════════════════════════ */}
          <h3 className="text-lg font-semibold mb-4 pb-2 border-b mt-8">
            📥 Réception d'emails (Webhook Resend)
          </h3>
          <p className="text-sm text-gray-500 mb-6">
            Configurez la réception automatique des factures par email.
            Les documents reçus seront traités automatiquement par l'IA.
          </p>

          <div className="space-y-4">
            {/* Domaine inbound */}
            <div>
              <label className="block text-sm font-semibold mb-1">
                Domaine de réception (Inbound)
              </label>
              <input
                type="text"
                value={settings.resend_inbound_domain}
                onChange={(e) =>
                  setSettings({ ...settings, resend_inbound_domain: e.target.value })
                }
                placeholder="inbound.monentreprise.com"
                className="w-full border rounded px-3 py-2"
              />
              <p className="text-xs text-gray-500 mt-1">
                L'adresse email à laquelle vos clients enverront leurs factures.
              </p>
            </div>

            {/* Secret webhook */}
            <div>
              <label className="block text-sm font-semibold mb-1">
                Secret du Webhook (whsec_...)
              </label>
              <input
                type="password"
                value={settings.resend_webhook_secret}
                onChange={(e) =>
                  setSettings({ ...settings, resend_webhook_secret: e.target.value })
                }
                placeholder="whsec_..."
                className="w-full border rounded px-3 py-2 font-mono text-sm"
              />
            </div>

            {/* URL à copier dans Resend */}
            <div>
              <label className="block text-sm font-semibold mb-1">
                URL du Webhook (à coller dans Resend)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={`${process.env.NEXT_PUBLIC_APP_URL || 'https://votre-app.vercel.app'}/api/inbound-email`}
                  className="w-full border rounded px-3 py-2 bg-gray-50 font-mono text-sm"
                />
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(
                      `${process.env.NEXT_PUBLIC_APP_URL || 'https://votre-app.vercel.app'}/api/inbound-email`
                    );
                    alert('✅ URL copiée !');
                  }}
                  className="px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-700 whitespace-nowrap"
                >
                  📋 Copier
                </button>
              </div>
            </div>

            {/* Instructions */}
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="font-bold text-blue-800 mb-2">
                📋 Comment configurer le webhook sur Resend
              </h3>
              <ol className="list-decimal list-inside text-sm text-blue-900 space-y-2">
                <li>
                  Connectez-vous sur{" "}
                  <a
                    href="https://resend.com/webhooks"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline font-semibold"
                  >
                    resend.com/webhooks
                  </a>
                </li>
                <li>
                  Cliquez sur <strong>Add Webhook</strong>.
                </li>
                <li>
                  Collez l'URL ci-dessus dans le champ <strong>Endpoint URL</strong>.
                </li>
                <li>
                  Sélectionnez l'événement <strong>email.received</strong>.
                </li>
                <li>
                  Copiez le <strong>Signing Secret</strong> (whsec_...) et collez-le
                  dans le champ "Secret du Webhook" ci-dessus.
                </li>
                <li>
                  Cliquez sur <strong>Save</strong>, puis sur <strong>💾 Sauvegarder</strong> ici.
                </li>
              </ol>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════
            SECTION RELANCES AUTOMATIQUES
            ═══════════════════════════════════════════ */}
        <h3 className="text-lg font-semibold mb-4 pb-2 border-b mt-8">
          📧 Relances automatiques
        </h3>
        <p className="text-sm text-gray-500 mb-6">
          Relance automatiquement les documents bloqués en exception
          depuis plusieurs jours. Utile pour ne rien oublier.
        </p>

        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="reminder_enabled"
              checked={settings.reminder_enabled === "true"}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  reminder_enabled: e.target.checked ? "true" : "false",
                })
              }
              className="w-5 h-5"
            />
            <label htmlFor="reminder_enabled" className="font-semibold">
              Activer les relances automatiques
            </label>
          </div>

          {settings.reminder_enabled === "true" && (
            <>
              <div>
                <label className="block text-sm font-semibold mb-1">
                  Heure d'envoi (UTC)
                </label>
                <select
                  value={settings.reminder_hour}
                  onChange={(e) =>
                    setSettings({ ...settings, reminder_hour: e.target.value })
                  }
                  className="w-full border rounded px-3 py-2"
                >
                  {Array.from({ length: 24 }, (_, i) => {
                    const h = String(i).padStart(2, "0");
                    return (
                      <option key={h} value={h}>
                        {h}:00 UTC
                      </option>
                    );
                  })}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Vercel utilise UTC. Tunis = UTC+1 (hiver) ou UTC+2 (été).
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">
                  Relancer après (jours)
                </label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={settings.reminder_days}
                  onChange={(e) =>
                    setSettings({ ...settings, reminder_days: e.target.value })
                  }
                  className="w-full border rounded px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">
                  Nombre maximum de relances
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={settings.reminder_max_count}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      reminder_max_count: e.target.value,
                    })
                  }
                  className="w-full border rounded px-3 py-2"
                />
              </div>
            </>
          )}
        </div>

        {/* ═══════════════════════════════════════════
            SECTION CRON
            ═══════════════════════════════════════════ */}
        <h3 className="text-lg font-semibold mb-4 pb-2 border-b mt-8">
          ⏰ Envoi automatique (Cron)
        </h3>
        <p className="text-sm text-gray-500 mb-6">
          Configurez l'envoi automatique de rapports par email.
        </p>

        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="cron_enabled"
              checked={settings.cron_enabled === "true"}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  cron_enabled: e.target.checked ? "true" : "false",
                })
              }
              className="w-5 h-5"
            />
            <label htmlFor="cron_enabled" className="font-semibold">
              Activer l'envoi automatique
            </label>
          </div>

          {settings.cron_enabled === "true" && (
            <>
              <div>
                <label className="block text-sm font-semibold mb-1">
                  Fréquence
                </label>
                <select
                  value={settings.cron_frequency}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      cron_frequency: e.target.value,
                    })
                  }
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="daily">Quotidien</option>
                  <option value="weekly">Hebdomadaire</option>
                  <option value="monthly">Mensuel</option>
                </select>
              </div>

              {settings.cron_frequency === "weekly" && (
                <div>
                  <label className="block text-sm font-semibold mb-1">
                    Jour
                  </label>
                  <select
                    value={settings.cron_day}
                    onChange={(e) =>
                      setSettings({ ...settings, cron_day: e.target.value })
                    }
                    className="w-full border rounded px-3 py-2"
                  >
                    <option value="monday">Lundi</option>
                    <option value="tuesday">Mardi</option>
                    <option value="wednesday">Mercredi</option>
                    <option value="thursday">Jeudi</option>
                    <option value="friday">Vendredi</option>
                    <option value="saturday">Samedi</option>
                    <option value="sunday">Dimanche</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold mb-1">
                  Heure d'envoi (UTC)
                </label>
                <select
                  value={settings.cron_hour}
                  onChange={(e) =>
                    setSettings({ ...settings, cron_hour: e.target.value })
                  }
                  className="w-full border rounded px-3 py-2"
                >
                  {Array.from({ length: 24 }, (_, i) => {
                    const h = String(i).padStart(2, "0");
                    return (
                      <option key={h} value={h}>
                        {h}:00 UTC
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">
                  Email destinataire
                </label>
                <input
                  type="email"
                  value={settings.cron_email_to}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      cron_email_to: e.target.value,
                    })
                  }
                  placeholder="comptable@example.com"
                  className="w-full border rounded px-3 py-2"
                />
              </div>
            </>
          )}
        </div>

        {/* Message de statut */}
        {message && (
          <div
            className={`mt-6 p-3 rounded ${
              message.type === "success"
                ? "bg-green-50 text-green-800"
                : "bg-red-50 text-red-800"
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Boutons */}
        <div className="flex gap-3 pt-6">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Sauvegarde..." : "💾 Sauvegarder"}
          </button>
          <button
            onClick={handleTest}
            disabled={testing || !settings.email_to}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
          >
            {testing ? "Envoi..." : "📧 Tester l'envoi"}
          </button>
          <a
            href="https://resend.com/api-keys"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
          >
            🔗 Ouvrir Resend
          </a>
        </div>
      </Card>

      {/* ⭐ MODAL DE CONFIGURATION DES ENTREPRISES */}
      {showConfigModal && (
        <CompanyConfigModal
          companies={companies}
          onClose={() => setShowConfigModal(false)}
          onSave={async () => {
            const res = await fetch("/api/companies");
            const data = await res.json();
            setCompanies(data.companies ?? []);
          }}
        />
      )}
    </main>
  );
}

// ═══════════════════════════════════════════════════════════════
//  MODAL DE CONFIGURATION DES ENTREPRISES
// ═══════════════════════════════════════════════════════════════

function CompanyConfigModal({
  companies,
  onClose,
  onSave,
}: {
  companies: Company[];
  onClose: () => void;
  onSave: () => void;
}) {
  const [edits, setEdits] = useState<Record<string, Company>>(() => {
    const initial: Record<string, Company> = {};
    for (const c of companies) {
      initial[c.id] = { ...c };
    }
    return initial;
  });
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSaveOne(companyId: string) {
    setSaving(companyId);
    setMessage(null);

    try {
      const company = edits[companyId];
      const res = await fetch(`/api/companies/${companyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: company.name,
          tax_id: company.tax_id,
          email: company.email,
          phone: company.phone,
          address: company.address,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage(`✅ ${company.name} sauvegardée`);
        setTimeout(() => setMessage(null), 3000);
        onSave();
      } else {
        setMessage(`❌ ${data.error}`);
      }
    } catch (err) {
      setMessage(`❌ ${err instanceof Error ? err.message : "Erreur"}`);
    } finally {
      setSaving(null);
    }
  }

  async function handleSaveAll() {
    setSaving("all");
    setMessage(null);

    try {
      let success = 0;
      let failed = 0;

      for (const company of companies) {
        const edit = edits[company.id];
        try {
          const res = await fetch(`/api/companies/${company.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: edit.name,
              tax_id: edit.tax_id,
              email: edit.email,
              phone: edit.phone,
              address: edit.address,
            }),
          });
          if (res.ok) success++;
          else failed++;
        } catch {
          failed++;
        }
      }

      setMessage(
        `✅ ${success} entreprise(s) sauvegardée(s)` +
          (failed > 0 ? ` — ❌ ${failed} échec(s)` : "")
      );
      setTimeout(() => setMessage(null), 5000);
      onSave();
    } finally {
      setSaving(null);
    }
  }

  const configuredCount = Object.values(edits).filter(isCompanyConfigured).length;
  const incompleteCount = companies.length - configuredCount;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">
              ⚙️ Configuration{" "}
              {companies.length === 1
                ? "de l'entreprise"
                : `des ${companies.length} entreprises`}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Modifiez les 3 critères du score (1/3, 2/3, 3/3)
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ✖
          </button>
        </div>

        {/* Message */}
        {message && (
          <div className="mx-6 mt-4 p-3 bg-blue-50 border border-blue-200 rounded text-sm">
            {message}
          </div>
        )}

        {/* Companies */}
        <div className="p-6 space-y-6">
          {companies.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p className="text-3xl mb-2">🏢</p>
              <p>Aucune entreprise à configurer</p>
              <Link
                href="/dashboard/companies"
                className="inline-block mt-3 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
              >
                ➕ Créer une entreprise
              </Link>
            </div>
          ) : (
            companies.map((c) => {
              const edit = edits[c.id];
              const editIsConfigured = isCompanyConfigured(edit);

              return (
                <div
                  key={c.id}
                  className={`border-2 rounded-lg p-4 ${
                    editIsConfigured
                      ? "border-green-300 bg-green-50"
                      : "border-yellow-300 bg-yellow-50"
                  }`}
                >
                  <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-lg">
                        🏢 {edit.name || "Sans nom"}
                      </h3>
                      {editIsConfigured ? (
                        <span className="text-xs font-semibold px-2 py-1 rounded-full bg-green-200 text-green-800">
                          ✅ Configurée
                        </span>
                      ) : (
                        <span className="text-xs font-semibold px-2 py-1 rounded-full bg-yellow-200 text-yellow-800">
                          ⚠️ Incomplète
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => handleSaveOne(c.id)}
                      disabled={saving === c.id}
                      className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-xs disabled:opacity-50 whitespace-nowrap"
                    >
                      {saving === c.id ? "⏳" : "💾 Sauvegarder"}
                    </button>
                  </div>

                  {!editIsConfigured && (
                    <div className="mb-3 p-2 bg-white rounded border border-yellow-200 text-xs text-yellow-800">
                      <strong>Critères manquants :</strong>
                      <ul className="list-disc list-inside mt-1">
                        {!edit.name?.trim() && <li>🏷️ Nom</li>}
                        {!edit.tax_id?.trim() && <li>🆔 Matricule fiscal</li>}
                        {!edit.email?.trim() && <li>📧 Email</li>}
                      </ul>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold mb-1 text-gray-600">
                        🏷️ Nom (critère 1)
                      </label>
                      <input
                        type="text"
                        value={edit.name}
                        onChange={(e) =>
                          setEdits({
                            ...edits,
                            [c.id]: { ...edit, name: e.target.value },
                          })
                        }
                        className="w-full border rounded px-3 py-2 text-sm bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1 text-gray-600">
                        🆔 Matricule fiscal (critère 2)
                      </label>
                      <input
                        type="text"
                        value={edit.tax_id || ""}
                        onChange={(e) =>
                          setEdits({
                            ...edits,
                            [c.id]: { ...edit, tax_id: e.target.value },
                          })
                        }
                        className="w-full border rounded px-3 py-2 text-sm font-mono bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1 text-gray-600">
                        📧 Email (critère 3)
                      </label>
                      <input
                        type="email"
                        value={edit.email || ""}
                        onChange={(e) =>
                          setEdits({
                            ...edits,
                            [c.id]: { ...edit, email: e.target.value },
                          })
                        }
                        className="w-full border rounded px-3 py-2 text-sm bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1 text-gray-600">
                        📞 Téléphone
                      </label>
                      <input
                        type="tel"
                        value={edit.phone || ""}
                        onChange={(e) =>
                          setEdits({
                            ...edits,
                            [c.id]: { ...edit, phone: e.target.value },
                          })
                        }
                        className="w-full border rounded px-3 py-2 text-sm bg-white"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-semibold mb-1 text-gray-600">
                        📍 Adresse
                      </label>
                      <input
                        type="text"
                        value={edit.address || ""}
                        onChange={(e) =>
                          setEdits({
                            ...edits,
                            [c.id]: { ...edit, address: e.target.value },
                          })
                        }
                        className="w-full border rounded px-3 py-2 text-sm bg-white"
                      />
                    </div>
                  </div>

                  <p className="text-xs text-gray-500 mt-3 italic">
                    💡 {editIsConfigured
                      ? "Tous les critères sont remplis → score 3/3 possible"
                      : "Complétez les 3 critères pour un score 3/3"}
                  </p>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        {companies.length > 0 && (
          <div className="sticky bottom-0 bg-white border-t px-6 py-4">
            <div className="mb-3 flex items-center gap-3 text-sm flex-wrap">
              <span className="font-semibold">État :</span>
              <span className="px-2 py-1 rounded-full bg-green-100 text-green-800 text-xs">
                ✅ {configuredCount} configurée{configuredCount > 1 ? "s" : ""}
              </span>
              {incompleteCount > 0 && (
                <span className="px-2 py-1 rounded-full bg-yellow-100 text-yellow-800 text-xs">
                  ⚠️ {incompleteCount} incomplète{incompleteCount > 1 ? "s" : ""}
                </span>
              )}
            </div>

            <div className="flex justify-between gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
              >
                Fermer
              </button>
              <button
                onClick={handleSaveAll}
                disabled={saving !== null}
                className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 font-semibold"
              >
                {saving === "all" ? "⏳ Sauvegarde…" : "💾 Tout sauvegarder"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}