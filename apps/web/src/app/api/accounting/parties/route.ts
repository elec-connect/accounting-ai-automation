import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: entries, error } = await supabase
      .from("accounting_entries")
      .select("party_name, party_type, debit, credit");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const map = new Map<
      string,
      { type: string; debit: number; credit: number }
    >();

    for (const e of entries ?? []) {
      if (!e.party_name) continue;
      const key = e.party_name;
      const existing = map.get(key) ?? { type: e.party_type, debit: 0, credit: 0 };
      existing.debit += Number(e.debit) || 0;
      existing.credit += Number(e.credit) || 0;
      map.set(key, existing);
    }

    const parties = Array.from(map.entries())
      .map(([party_name, data]) => ({
        party_name,
        party_type: data.type,
        total_debit: Math.round(data.debit * 1000) / 1000,
        total_credit: Math.round(data.credit * 1000) / 1000,
        balance: Math.round((data.debit - data.credit) * 1000) / 1000,
      }))
      .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance));

    return NextResponse.json({ parties });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}