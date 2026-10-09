"use client";

import { useHealthCheck } from "@/hooks/useHealthCheck";

export function EnvironmentStatus() {
  const { checks, summary, loading, error, reload } = useHealthCheck();

  if (loading) {
    return (
      <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-500">
        🔄 Vérification des variables d'environnement...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
        ❌ Erreur de vérification : {error}
        <button
          onClick={reload}
          className="ml-2 underline hover:no-underline"
        >
          Réessayer
        </button>
      </div>
    );
  }

  const criticalChecks = checks.filter((c) => c.critical);
  const optionalChecks = checks.filter((c) => !c.critical);

  return (
    <div className="space-y-4">
      {/* Résumé */}
      {summary && (
        <div
          className={`p-4 rounded-lg border ${
            summary.healthy
              ? "bg-green-50 border-green-200"
              : "bg-red-50 border-red-200"
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p
                className={`font-semibold ${
                  summary.healthy ? "text-green-900" : "text-red-900"
                }`}
              >
                {summary.healthy
                  ? "✅ Toutes les variables critiques sont configurées"
                  : `❌ ${summary.criticalMissing} variable(s) critique(s) manquante(s)`}
              </p>
              <p
                className={`text-xs mt-1 ${
                  summary.healthy ? "text-green-700" : "text-red-700"
                }`}
              >
                {summary.ok} / {summary.total} variables configurées
              </p>
            </div>
            <button
              onClick={reload}
              className="px-3 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-50"
            >
              🔄 Rafraîchir
            </button>
          </div>
        </div>
      )}

      {/* Variables critiques */}
      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-2">
          🔴 Variables critiques
        </h4>
        <ul className="space-y-1">
          {criticalChecks.map((check) => (
            <li
              key={check.key}
              className="flex items-center justify-between text-sm py-1.5 px-3 rounded border border-gray-200 bg-white"
            >
              <span className="font-mono text-xs text-gray-600">
                {check.key}
              </span>
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded ${
                  check.ok
                    ? "bg-green-100 text-green-800"
                    : "bg-red-100 text-red-800"
                }`}
              >
                {check.ok ? "✓ Configurée" : "✗ Manquante"}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Variables optionnelles */}
      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-2">
          ⚪ Variables optionnelles
        </h4>
        <ul className="space-y-1">
          {optionalChecks.map((check) => (
            <li
              key={check.key}
              className="flex items-center justify-between text-sm py-1.5 px-3 rounded border border-gray-200 bg-white"
            >
              <span className="font-mono text-xs text-gray-600">
                {check.key}
              </span>
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded ${
                  check.ok
                    ? "bg-green-100 text-green-800"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {check.ok ? "✓ Configurée" : "— Non configurée"}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Lien vers le guide */}
      <a
        href="/docs/environment-variables.html"
        target="_blank"
        rel="noopener noreferrer"
        className="block text-center text-sm text-blue-600 hover:underline"
      >
        📘 Consulter le guide de configuration →
      </a>
    </div>
  );
}