"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type User = {
  email: string;
};

export function UserMenu() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUser({ email: user.email || "" });
    });
  }, []);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  if (!user) return null;

  const initials = user.email.slice(0, 2).toUpperCase();

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 rounded hover:bg-gray-100"
      >
        <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-medium">
          {initials}
        </div>
        <span className="text-sm hidden md:inline">{user.email}</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-48 bg-white border rounded-lg shadow-lg z-20 py-1">
            <button
              onClick={handleSignOut}
              className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 text-red-600"
            >
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}
