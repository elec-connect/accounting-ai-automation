"use client";

import { useEffect, useState } from "react";

export function ConfidenceThresholdInput() {
  const [threshold, setThreshold] = useState("90");
  const [highSeverity, setHighSeverity] = useState("70");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        setThreshold(d.settings?.confidence_threshold || "90");
        setHighSeverity(d.settings?.confidence_high_severity || "70");
        setLoading(false);
      });
  }, []);

  async function handleSave() {
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confidence_threshold: threshold,
          confidence_high_severity: highSeverity,
        }),
      });

      if (res.ok) {
        setMessage("✅ Seuil sauvegardé");
      } else {
        setMessage("❌ Erreur de sauvegarde");
      }
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 3000);
    }
  }

  if (loading) {
    return (
      <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-500">
        Chargement du seuil…
      </div>
    );
  }

  const thresholdNum = parseInt(threshold, 10);
  const highNum = parseInt(highSeverity, 10);

  return (
    <div className="p-4 bg-white border border-gray-200 rounded-lg">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">
        🎯 Seuil de confiance IA
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-xs font-semibold mb-1 text-gray-700">
            Seuil d'auto-approbation (%)
          </label>
          <input
            type="number"
            min="50"
            max="100"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm"
          />
          <p className="text-xs text-gray-500 mt-1">
            Score ≥ seuil → auto-approuvé
          </p>
        </div>

        <div>
          <label className="block text-xs font-semibold mb-1 text-gray-700">
            Seuil de sévérité haute (%)
          </label>
          <input
            type="number"
            min="0"
            max="100"
            value={highSeverity}
            onChange={(e) => setHighSeverity(e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm"
          />
          <p className="text-xs text-gray-500 mt-1">
            Score &lt; seuil → exception HAUTE
          </p>
        </div>
      </div>

      {/* Aperçu visuel */}
      <div className="p-3 bg-blue-50 border border-blue-200 rounded text-xs text-blue-900 mb-3">
        <p className="font-semibold mb-1">📊 Aperçu :</p>
        <p>
          • Score <strong>≥ {thresholdNum}%</strong> → ✅ Auto-approuvé
        </p>
        <p>
          • Score <strong>
            ≥ {highNum}% et &lt; {thresholdNum}%
          </strong> → ⚠️ Exception (moyenne)
        </p>
        <p>
          • Score <strong>&lt; {highNum}%</strong> → 🔴 Exception (haute)
        </p>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Sauvegarde…" : "💾 Sauvegarder le seuil"}
        </button>

        {message && (
          <span className="text-xs font-medium text-green-700">{message}</span>
        )}
      </div>
    </div>
  );
}