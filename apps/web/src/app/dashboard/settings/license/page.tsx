"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { DURATION_LABELS, type LicenseDuration } from "@/lib/license/generate";

type LicenseInfo = {
  valid: boolean;
  reason?: string;
  license?: {
    license_key: string;
    duration_type: LicenseDuration;
    activated_at: string;
    expires_at: string | null;
    activated_by_email: string | null;
  };
  daysLeft?: number | null;
};

export default function LicensePage() {
  const [info, setInfo] = useState<LicenseInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [key, setKey] = useState("");
  const [activating, setActivating] = useState(false);
  const [message, setMessage] = useState<{ type: string; text: string } | null>(null);

  async function loadInfo() {
    const res = await fetch("/api/licenses/check");
    const data = await res.json();
    setInfo(data);
    setLoading(false);
  }

  useEffect(() => {
    loadInfo();
  }, []);

  async function handleActivate() {
    if (!key.trim()) return;

    setActivating(true);
    setMessage(null);

    try {
      const res = await fetch("/api/licenses/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: key.trim() }),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage({ type: "success", text: "✅ " + data.message });
        setKey("");
        await loadInfo();
      } else {
        setMessage({ type: "error", text: "❌ " + data.error });
      }
    } finally {
      setActivating(false);
    }
  }

  function handleFormatKey(e: React.ChangeEvent<HTMLInputElement>) {
    // Auto-format : ACCT-XXXX-XXXX-XXXX-XXXX
    let value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");

    if (value.startsWith("ACCT")) {
      value = value.slice(4);
    }

    const blocks: string[] = [];
    for (let i = 0; i < value.length && i < 16; i += 4) {
      blocks.push(value.slice(i, i + 4));
    }

    const formatted = blocks.length > 0 ? `ACCT-${blocks.join("-")}` : "ACCT-";
    setKey(formatted);
  }

  if (loading) {
    return <div className="p-8">Chargement…</div>;
  }

  return (
    <main className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">🔑 Licence</h1>

      {/* Licence active */}
      {info?.valid && info.license && (
        <Card className="p-6 mb-6 bg-green-50 border-green-200">
          <h2 className="font-semibold text-green-900 mb-4">
            ✅ Licence active
          </h2>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Clé :</span>
              <code className="font-mono text-xs">
                {info.license.license_key}
              </code>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-600">Type :</span>
              <span className="font-semibold">
                {DURATION_LABELS[info.license.duration_type]}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-600">Activée le :</span>
              <span>
                {new Date(info.license.activated_at).toLocaleDateString("fr-FR")}
              </span>
            </div>

            {info.license.expires_at ? (
              <div className="flex justify-between">
                <span className="text-gray-600">Expire le :</span>
                <span className="font-semibold">
                  {new Date(info.license.expires_at).toLocaleDateString("fr-FR")}
                </span>
              </div>
            ) : (
              <div className="flex justify-between">
                <span className="text-gray-600">Expiration :</span>
                <span className="font-semibold">♾️ À vie</span>
              </div>
            )}

            {info.daysLeft !== null && info.daysLeft !== undefined && (
              <div className="flex justify-between">
                <span className="text-gray-600">Jours restants :</span>
                <span
                  className={`font-semibold ${
                    info.daysLeft < 7 ? "text-red-600" : "text-green-700"
                  }`}
                >
                  {info.daysLeft} jours
                </span>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Pas de licence OU expirée */}
      {!info?.valid && (
        <Card className="p-6 mb-6">
          <h2 className="font-semibold mb-4">🎫 Activer une licence</h2>

          {info?.reason === "expired" && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800">
              ⚠️ Votre licence a expiré. Veuillez en activer une nouvelle.
            </div>
          )}

          {info?.reason === "no_license" && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800">
              ℹ️ Saisissez une clé de licence pour activer votre compte.
            </div>
          )}

          <p className="text-sm text-gray-500 mb-4">
            Saisissez la clé de licence fournie par votre administrateur.
          </p>

          <input
            type="text"
            value={key}
            onChange={handleFormatKey}
            placeholder="ACCT-XXXX-XXXX-XXXX-XXXX"
            className="w-full border rounded px-3 py-2 font-mono text-lg mb-4"
            maxLength={24}
          />

          <button
            onClick={handleActivate}
            disabled={activating || key.length < 24}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {activating ? "Activation…" : "🔓 Activer"}
          </button>
        </Card>
      )}

      {message && (
        <div
          className={`p-4 rounded ${
            message.type === "success"
              ? "bg-green-50 text-green-800"
              : "bg-red-50 text-red-800"
          }`}
        >
          {message.text}
        </div>
      )}
    </main>
  );
}