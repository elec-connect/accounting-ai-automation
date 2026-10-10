"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function ExceptionsBadge() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { count: c } = await supabase
        .from("exceptions")
        .select("*", { count: "exact", head: true })
        .eq("status", "open");
      setCount(c ?? 0);
    }

    load();

    // Polling toutes les 30s
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, []);

  if (count === 0) return null;

  return (
    <span className="ml-auto text-xs font-bold bg-red-500 text-white px-2 py-0.5 rounded-full">
      {count}
    </span>
  );
}