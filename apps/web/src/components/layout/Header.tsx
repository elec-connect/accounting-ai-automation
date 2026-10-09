"use client";

import { useProfile } from "@/lib/auth/use-profile";
import { Badge } from "@/components/ui/badge";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { UserMenu } from "@/components/auth/UserMenu";
import { useHealthCheck } from "@/hooks/useHealthCheck";

export function Header({ title }: { title: string }) {
  const { profile } = useProfile();

  return (
    <header className="border-b bg-white px-8 py-4 flex justify-between items-center">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">{title}</h1>
        {profile && (
          <Badge
            variant={
              profile.role === "admin"
                ? "error"
                : profile.role === "accountant"
                ? "warning"
                : "info"
            }
          >
            {ROLE_LABELS[profile.role]}
          </Badge>
        )}
      </div>
      <div className="flex items-center gap-3">
        <EnvironmentBadge />
        <UserMenu />
      </div>
    </header>
  );
}

function EnvironmentBadge() {
  const { summary, loading } = useHealthCheck(120_000);

  if (loading || !summary) return null;

  if (summary.healthy) {
    return (
      <a
        href="/dashboard/settings/email#env-status"
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-green-50 text-green-800 border border-green-200 rounded-full hover:bg-green-100 transition-colors"
        title="Toutes les variables d'environnement sont configurées"
      >
        <span>✅</span>
        <span className="hidden sm:inline">Config OK</span>
      </a>
    );
  }

  return (
    <a
      href="/dashboard/settings/email#env-status"
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-red-50 text-red-800 border border-red-200 rounded-full hover:bg-red-100 transition-colors animate-pulse"
      title={`${summary.criticalMissing} variable(s) critique(s) manquante(s)`}
    >
      <span>⚠️</span>
      <span className="hidden sm:inline">
        {summary.criticalMissing} manquante{summary.criticalMissing > 1 ? "s" : ""}
      </span>
      <span className="sm:hidden">{summary.criticalMissing}</span>
    </a>
  );
}