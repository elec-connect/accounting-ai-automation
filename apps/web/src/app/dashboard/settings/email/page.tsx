"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/card";

export default function EmailSettingsPage() {
  const [settings, setSettings] = useState({
  email_from: "",
  email_from_name: "",
  email_to: "",
  resend_api_key: "",
  custom_domain: "",
  cron_enabled: "false",
  cron_frequency: "weekly",
  cron_day: "monday",
  cron_hour: "09",
  cron_email_to: "",
});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{ type: string; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        setSettings((prev) => ({ ...prev, ...data.settings }));
        setLoading(false);
      });
  }, []);

  async function handleSaveEmail() {
  setSaving(true);
  setMessage(null);
  try {
    const emailSettings = {
      email_from: settings.email_from,
      email_from_name: settings.email_from_name,
      email_to: settings.email_to,
      resend_api_key: settings.resend_api_key,
      custom_domain: settings.custom_domain,
    };
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(emailSettings),
    });
    if (res.ok) {
      setMessage({ type: "success", text: "✅ Configuration email sauvegardée" });
    }
  } finally {
    setSaving(false);
  }
}

async function handleSaveCron() {
  setSaving(true);
  setMessage(null);
  try {
    const cronSettings = {
      cron_enabled: settings.cron_enabled,
      cron_frequency: settings.cron_frequency,
      cron_day: settings.cron_day,
      cron_hour: settings.cron_hour,
      cron_email_to: settings.cron_email_to,
    };
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cronSettings),
    });
    if (res.ok) {
      setMessage({ type: "success", text: "✅ Configuration cron sauvegardée" });
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
        setMessage({ type: "success", text: "✅ Email de test envoyé à " + settings.email_to });
      } else {
        setMessage({ type: "error", text: "❌ " + result.error });
      }
    } finally {
      setTesting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex-1">
          <Header title="Email Settings" />
          <main className="p-8">Chargement...</main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1">
        <Header title="Email Settings" />
        <main className="p-8 max-w-2xl">
          <Card className="p-6">
            <h2 className="text-xl font-bold mb-4">Configuration Email (Resend)</h2>
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

              {message && (
                <div
                  className={`p-3 rounded ${
                    message.type === "success"
                      ? "bg-green-50 text-green-800"
                      : "bg-red-50 text-red-800"
                  }`}
                >
                  {message.text}
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleSaveEmail}
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
            </div>
          </Card>
          <Card className="p-6 mt-6">
  <h2 className="text-xl font-bold mb-4">⏰ Envoi automatique (Cron)</h2>
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
          <label className="block text-sm font-semibold mb-1">Fréquence</label>
          <select
            value={settings.cron_frequency}
            onChange={(e) =>
              setSettings({ ...settings, cron_frequency: e.target.value })
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
            <label className="block text-sm font-semibold mb-1">Jour</label>
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
            Heure d'envoi
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
                  {h}:00
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
              setSettings({ ...settings, cron_email_to: e.target.value })
            }
            placeholder="comptable@example.com"
            className="w-full border rounded px-3 py-2"
          />
        </div>
      </>
    )}
  </div>
  <div className="flex gap-3 pt-4">
  <button
    onClick={handleSaveCron}
    disabled={saving}
    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
  >
    {saving ? "Sauvegarde..." : "💾 Sauvegarder le cron"}
  </button>
</div>
</Card>
        </main>
      </div>
    </div>
  );
}