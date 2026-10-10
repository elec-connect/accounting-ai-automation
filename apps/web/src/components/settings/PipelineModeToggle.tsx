"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";

export function PipelineModeToggle() {
  const [mode, setMode] = useState<"auto" | "manual">("auto");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        setMode((d.settings?.pipeline_mode as "auto" | "manual") || "auto");
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function toggle() {
    const newMode = mode === "auto" ? "manual" : "auto";
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pipeline_mode: newMode }),
      });

      if (res.ok) {
        setMode(newMode);
        setMessage(
          newMode === "auto"
            ? "✅ Mode automatique activé"
            : "✅ Mode manuel activé"
        );
      } else {
        setMessage("❌ Erreur de sauvegarde");
      }
    } catch {
      setMessage("❌ Erreur réseau");
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 3000);
    }
  }

  if (loading) {
    return (
      <Card className="p-6">
        <p className="text-sm text-gray-500">Chargement…</p>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-2">
        🔄 Mode de traitement
      </h3>
      <p className="text-sm text-gray-500 mb-4">
        Choisissez comment les documents sont traités après l'upload.
      </p>

      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
        <div className="flex-1">
          <p className="font-semibold">
            {mode === "auto"
              ? "🤖 Mode automatique"
              : "👤 Mode manuel"}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {mode === "auto"
              ? "L'IA extrait et analyse automatiquement chaque document après l'upload."
              : "Les documents sont stockés, l'extraction doit être déclenchée manuellement."}
          </p>
        </div>

        <button
          onClick={toggle}
          disabled={saving}
          className={`relative inline-flex h-8 w-16 items-center rounded-full transition-colors flex-shrink-0 ${
            mode === "auto" ? "bg-blue-600" : "bg-gray-300"
          } ${saving ? "opacity-50 cursor-wait" : "cursor-pointer"}`}
          title={mode === "auto" ? "Basculer en manuel" : "Basculer en auto"}
        >
          <span
            className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform shadow ${
              mode === "auto" ? "translate-x-9" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      {message && (
        <p className="mt-3 text-sm font-medium text-green-700">{message}</p>
      )}
    </Card>
  );
}