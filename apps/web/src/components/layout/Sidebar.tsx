"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useLicenseGuard } from "@/lib/hooks/useLicenseGuard";
import { createClient } from "@/lib/supabase/client";

type Profile = {
  role: "super_admin" | "admin" | "accountant" | "viewer";
  email?: string;
  full_name?: string | null;
};

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Administrator",
  accountant: "Accountant",
  viewer: "Viewer",
};

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const license = useLicenseGuard();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState<string>("");
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // Charger le profil + le statut super_admin
  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((data) => {
        setProfile(data.profile ?? null);
        setEmail(data.email ?? "");
        setIsSuperAdmin(!!data.is_super_admin);
      })
      .catch(() => {});
  }, []);

  // ⭐ Déconnexion
  async function handleLogout() {
    if (!confirm("Se déconnecter ?")) return;

    setLoggingOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/login");
    } catch (err) {
      console.error("Logout error:", err);
      setLoggingOut(false);
    }
  }

  const disabled = !license.loading && !license.valid;
  const role = profile?.role;
  const isAdmin = role === "admin" || role === "super_admin";

  // ═══════════════════════════════════════════════════════════
  //  GROUPES DE LIENS
  // ═══════════════════════════════════════════════════════════

  const mainLinks = [
    { href: "/dashboard", label: "Dashboard", icon: "📊" },
    { href: "/dashboard/documents", label: "Documents", icon: "📄" },
    { href: "/dashboard/search", label: "Recherche", icon: "🔍" },
    { href: "/dashboard/exceptions", label: "Exceptions", icon: "⚠️" },
    { href: "/dashboard/ask", label: "Ask AI", icon: "🤖" },
  ];

  const analysisLinks = [
    { href: "/dashboard/audit", label: "Audit Log", icon: "🔍" },
    { href: "/dashboard/reports", label: "Rapports", icon: "📊" },
  ];

  const settingsLinks = [
  { href: "/dashboard/settings/license", label: "Ma licence", icon: "🔑" },
  ...(isAdmin
    ? [
        { href: "/dashboard/settings/users", label: "Utilisateurs", icon: "👥" },
        { href: "/dashboard/settings/email", label: "Settings", icon: "⚙️" },  // ⭐
      ]
    : []),
  { href: "/dashboard/settings/security", label: "Sécurité", icon: "🔒" },
];

  const superAdminLinks = [
    { href: "/super-admin/licenses", label: "Licences", icon: "💰" },
  ];

  // ═══════════════════════════════════════════════════════════
  //  RENDU D'UN LIEN
  // ═══════════════════════════════════════════════════════════

  function renderLink(link: { href: string; label: string; icon: string }) {
    const isLicenseLink = link.href === "/dashboard/settings/license";
    const isDisabled = disabled && !isLicenseLink;

    if (isDisabled) {
      return (
        <div
          key={link.href}
          className="flex items-center gap-3 px-3 py-2 rounded text-gray-400 cursor-not-allowed select-none"
          title="Activez votre licence pour accéder"
        >
          <span className="text-base">{link.icon}</span>
          <span className="text-sm">{link.label}</span>
          <span className="ml-auto text-xs">🔒</span>
        </div>
      );
    }

    const isActive =
      pathname === link.href ||
      (link.href !== "/dashboard" && pathname.startsWith(link.href));

    return (
      <Link
        key={link.href}
        href={link.href}
        className={`flex items-center gap-3 px-3 py-2 rounded transition ${
          isActive
            ? "bg-blue-50 text-blue-700 font-semibold"
            : "text-gray-700 hover:bg-gray-100"
        } ${isLicenseLink && disabled ? "text-blue-600 font-semibold" : ""}`}
      >
        <span className="text-base">{link.icon}</span>
        <span className="text-sm">{link.label}</span>
        {isLicenseLink && disabled && (
          <span className="ml-auto text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full animate-pulse">
            ⚡
          </span>
        )}
      </Link>
    );
  }

  // ═══════════════════════════════════════════════════════════
  //  INITIALES POUR L'AVATAR
  // ═══════════════════════════════════════════════════════════

  const initials = email ? email.slice(0, 2).toUpperCase() : "??";
  const roleLabel = role ? ROLE_LABELS[role] ?? role : "—";

  // ═══════════════════════════════════════════════════════════
  //  SIDEBAR
  // ═══════════════════════════════════════════════════════════

  return (
    <aside className="w-64 border-r bg-white flex flex-col h-screen">
      {/* Logo / Brand */}
      <div className="px-4 py-5 border-b">
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="text-2xl">🏢</span>
          <span className="font-bold text-lg">Accounting AI</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-6">
        {/* ── PRINCIPAL ── */}
        <div className="space-y-1">{mainLinks.map(renderLink)}</div>

        {/* ── ANALYSE ── */}
        <div>
          <p className="px-3 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Analyse
          </p>
          <div className="space-y-1">{analysisLinks.map(renderLink)}</div>
        </div>

        {/* ── PARAMÈTRES ── */}
        <div>
          <p className="px-3 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Paramètres
          </p>
          <div className="space-y-1">{settingsLinks.map(renderLink)}</div>
        </div>

        {/* ── SUPER ADMIN ── */}
        {isSuperAdmin && (
          <div>
            <p className="px-3 mb-2 text-xs font-semibold text-purple-500 uppercase tracking-wider">
              Super Admin
            </p>
            <div className="space-y-1">{superAdminLinks.map(renderLink)}</div>
          </div>
        )}
      </nav>

      {/* ═══════════════════════════════════════════════════════════
          PROFIL + DÉCONNEXION EN BAS
          ═══════════════════════════════════════════════════════════ */}
      <div className="border-t p-3">
        <div className="flex items-center gap-2 px-2 py-2 rounded hover:bg-gray-50 group">
          {/* Avatar avec initiales */}
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
            {initials}
          </div>

          {/* Email + Rôle */}
          <div className="flex-1 min-w-0">
            <p
              className="text-xs font-medium text-gray-900 truncate"
              title={email}
            >
              {email || "—"}
            </p>
            <p className="text-[11px] text-gray-500 truncate">
              {roleLabel}
            </p>
          </div>

          {/* Bouton déconnexion */}
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition disabled:opacity-50 flex-shrink-0"
            title="Se déconnecter"
          >
            {loggingOut ? "⏳" : "🚪"}
          </button>
        </div>
      </div>
    </aside>
  );
}