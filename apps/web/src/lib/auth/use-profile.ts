"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Role } from "./roles";

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
  is_active: boolean;
};

export function useProfile() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        setLoading(false);
        return;
      }

      supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single()
        .then(({ data }) => {
          if (data) {
            setProfile(data as Profile);
          } else {
            // Profil par defaut si absent
            setProfile({
              id: user.id,
              email: user.email || "",
              full_name: null,
              role: "viewer",
              is_active: true,
            });
          }
          setLoading(false);
        });
    });
  }, []);

  return { profile, loading };
}
