"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLicenseGuard } from "@/lib/hooks/useLicenseGuard";

// ═══════════════════════════════════════════════════════════════
//  ROUTES QUI RESTENT ACCESSIBLES SANS LICENCE
// ═══════════════════════════════════════════════════════════════

const LICENSE_FREE_ROUTES = [
  "/dashboard/settings/license", // page d'activation
  "/dashboard/settings/security", // 2FA (sécurité du compte)
];

export function LicenseGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const license = useLicenseGuard();

  // ⭐ Exception : ne pas bloquer les pages listées
  const isExempt = LICENSE_FREE_ROUTES.some((route) =>
    pathname.startsWith(route)
  );

  // Pendant le chargement : on affiche normalement (évite un flash)
  if (license.loading) {
    return <>{children}</>;
  }

  // ✅ Licence valide → tout fonctionne normalement
  if (license.valid) {
    return <>{children}</>;
  }

  // ⭐ Page exemptée → accès libre (pour activer la licence, gérer la sécurité)
  if (isExempt) {
    return <>{children}</>;
  }

  // ❌ Pas de licence ET pas sur une page exemptée → mode lecture seule
  return (
    <div className="relative">
      {/* 🟥 Bandeau d'avertissement */}
      <LicenseBanner reason={license.reason} />

      {/* 🎨 Contenu grisé + overlay */}
      <div className="relative">
        <div
          className="pointer-events-none opacity-40 select-none"
          style={{ filter: "grayscale(100%)" }}
        >
          {children}
        </div>

        {/* 🖱️ Overlay qui bloque tous les clics */}
        <div className="absolute inset-0 z-10 bg-transparent" />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  BANDEAU D'AVERTISSEMENT
// ═══════════════════════════════════════════════════════════════

function LicenseBanner({ reason }: { reason?: string }) {
  const messages: Record<string, string> = {
    no_license:
      "🔒 Aucune licence active. Activez une licence pour utiliser toutes les fonctionnalités.",
    expired:
      "⏰ Votre licence a expiré. Renouvelez-la pour continuer.",
    revoked: "❌ Votre licence a été révoquée.",
    suspended: "⏸️ Votre licence est suspendue.",
  };

  const message = messages[reason ?? "no_license"] ?? messages.no_license;

  return (
    <div className="sticky top-0 z-30 bg-gradient-to-r from-red-600 to-red-500 text-white px-6 py-3 flex items-center justify-between shadow-lg">
      <span className="text-sm font-medium">{message}</span>
      <Link
        href="/dashboard/settings/license"
        className="px-4 py-1.5 bg-white text-red-600 rounded-lg font-semibold hover:bg-red-50 transition text-sm whitespace-nowrap"
      >
        🔑 Activer ma licence
      </Link>
    </div>
  );
}