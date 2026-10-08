"use client";

import Link from "next/link";
import { useProfile } from "@/lib/auth/use-profile";
import { Badge } from "@/components/ui/badge";
import { ROLE_LABELS } from "@/lib/auth/roles";

type NavItem = {
  href: string;
  label: string;
  adminOnly?: boolean;
};

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/documents", label: "Documents" },
  { href: "/dashboard/search", label: "🔍 Search" },
  { href: "/dashboard/exceptions", label: "Exceptions" },
  { href: "/dashboard/ask", label: "Ask AI" },
  { href: "/dashboard/audit", label: "Audit Log", adminOnly: true },
  { href: "/dashboard/settings/users", label: "Users", adminOnly: true },
  { href: "/dashboard/settings/email", label: "⚙️ Settings", adminOnly: true }
];

export function Sidebar() {
  const { profile } = useProfile();
  const isAdmin = profile?.role === "admin";

  const visibleItems = navItems.filter(
    (item) => !item.adminOnly || isAdmin
  );

  return (
    <aside className="w-64 border-r bg-gray-50 min-h-screen p-6 flex flex-col">
      <h2 className="text-xl font-bold mb-8">AI Automation</h2>

      <nav className="space-y-2 flex-1">
        {visibleItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="block px-3 py-2 rounded hover:bg-gray-200 text-sm"
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {profile && (
        <div className="mt-6 pt-6 border-t">
          <p className="text-xs text-gray-500 mb-1">Signed in as</p>
          <p className="text-sm font-medium truncate">{profile.email}</p>
          <Badge variant={isAdmin ? "error" : "info"}>
            {ROLE_LABELS[profile.role]}
          </Badge>
        </div>
      )}
    </aside>
  );
}