"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type GuardState = "loading" | "authorized" | "forbidden";

export function SuperAdminGuard({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<GuardState>("loading");
  const router = useRouter();

  useEffect(() => {
    // ⭐ Vérification 1 : variable d'environnement
    const isSuperAdminEnabled =
      process.env.NEXT_PUBLIC_ENABLE_SUPER_ADMIN === "true";

    if (!isSuperAdminEnabled) {
      setState("forbidden");
      return;
    }

    // ⭐ Vérification 2 : session utilisateur
    const supabase = createClient();

    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        router.push("/login");
        return;
      }

      // ⭐ Vérification 3 : rôle super_admin
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, is_active")
        .eq("id", user.id)
        .single();

      if (
        !profile?.is_active ||
        profile.role !== "super_admin"
      ) {
        setState("forbidden");
        return;
      }

      setState("authorized");
    });
  }, [router]);

  if (state === "loading") {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-3 border-green-500 border-t-transparent rounded-full animate-spin" />
          <p className="mt-4 text-gray-400">Vérification des droits…</p>
        </div>
      </div>
    );
  }

  if (state === "forbidden") {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center max-w-md p-8">
          <p className="text-6xl mb-4">🚫</p>
          <h1 className="text-2xl font-bold mb-2">Accès refusé</h1>
          <p className="text-gray-400 mb-6">
            Cette page est réservée au propriétaire de la plateforme.
          </p>
          <button
            onClick={() => router.push("/dashboard")}
            className="px-6 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
          >
            ← Retour au tableau de bord
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}