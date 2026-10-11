"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";

export default function SecurityPage() {
  const [enabled, setEnabled] = useState(false);
  const [setupMode, setSetupMode] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase
        .from("profiles")
        .select("totp_enabled")
        .eq("id", user.id)
        .single()
        .then(({ data }) => {
          setEnabled(data?.totp_enabled ?? false);
          setLoading(false);
        });
    });
  }, []);

  async function startSetup() {
    const res = await fetch("/api/auth/2fa/setup", { method: "POST" });
    const data = await res.json();
    if (res.ok) {
      setQrCode(data.qrCode);
      setSecret(data.secret);
      setSetupMode(true);
    }
  }

  async function verify() {
    const res = await fetch("/api/auth/2fa/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: verifyCode }),
    });
    const data = await res.json();
    if (res.ok) {
      setEnabled(true);
      setSetupMode(false);
      setBackupCodes(data.backupCodes);
      setMessage("✅ 2FA activé avec succès");
    } else {
      setMessage("❌ " + data.error);
    }
  }

  async function disable() {
    if (!confirm("Désactiver la 2FA ?")) return;
    const res = await fetch("/api/auth/2fa/disable", { method: "POST" });
    if (res.ok) {
      setEnabled(false);
      setMessage("2FA désactivé");
    }
  }

  if (loading) {
    return <div className="p-8">Chargement…</div>;
  }

  return (
    <main className="p-8 max-w-2xl">
      <Card className="p-6">
        <h2 className="text-xl font-bold mb-4">🔒 Authentification à deux facteurs</h2>
        <p className="text-sm text-gray-500 mb-6">
          Ajoutez une couche de sécurité supplémentaire à votre compte.
        </p>

        {message && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800">
            {message}
          </div>
        )}

        {!enabled && !setupMode && (
          <button
            onClick={startSetup}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            🔐 Activer la 2FA
          </button>
        )}

        {setupMode && qrCode && (
          <div className="space-y-4">
            <p className="text-sm">
              1. Scannez ce QR code avec Google Authenticator, Authy ou 1Password :
            </p>
            <img src={qrCode} alt="QR Code 2FA" className="border p-2 rounded" />
            <p className="text-xs text-gray-500">
              Ou saisissez ce code manuellement : <code className="bg-gray-100 px-2 py-1 rounded">{secret}</code>
            </p>

            <p className="text-sm">2. Entrez le code à 6 chiffres généré :</p>
            <input
              type="text"
              maxLength={6}
              value={verifyCode}
              onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ""))}
              placeholder="123456"
              className="border rounded px-3 py-2 font-mono text-lg w-40"
            />

            <div className="flex gap-2">
              <button
                onClick={verify}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                ✅ Vérifier
              </button>
              <button
                onClick={() => setSetupMode(false)}
                className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
              >
                Annuler
              </button>
            </div>
          </div>
        )}

        {enabled && !setupMode && (
          <div>
            <p className="text-sm text-green-700 mb-4">
              ✅ La 2FA est activée sur votre compte.
            </p>
            <button
              onClick={disable}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Désactiver la 2FA
            </button>
          </div>
        )}

        {backupCodes && (
          <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded">
            <h3 className="font-bold mb-2">🔑 Codes de secours</h3>
            <p className="text-sm mb-2">
              Conservez ces codes en lieu sûr. Ils permettent de vous connecter
              si vous perdez votre téléphone.
            </p>
            <div className="grid grid-cols-2 gap-2 font-mono text-sm">
              {backupCodes.map((code, i) => (
                <div key={i} className="bg-white p-2 rounded border">
                  {code}
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>
    </main>
  );
}