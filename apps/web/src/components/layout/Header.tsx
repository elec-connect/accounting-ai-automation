"use client";

import { useProfile } from "@/lib/auth/use-profile";
import { Badge } from "@/components/ui/badge";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { UserMenu } from "@/components/auth/UserMenu";

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
      <UserMenu />
    </header>
  );
}
