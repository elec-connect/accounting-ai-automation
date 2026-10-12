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

    // Récupérer toutes les écritures
    const { data: entries, error } = await supabase
      .from("accounting_entries")
      .select("account_number, account_label, debit, credit");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Grouper par compte
    const map = new Map<
      string,
      { label: string; debit: number; credit: number }
    >();

    for (const e of entries ?? []) {
      const existing = map.get(e.account_number) ?? {
        label: e.account_label,
        debit: 0,
        credit: 0,
      };
      existing.debit += Number(e.debit) || 0;
      existing.credit += Number(e.credit) || 0;
      map.set(e.account_number, existing);
    }

    const balance = Array.from(map.entries())
      .map(([account_number, data]) => ({
        account_number,
        account_label: data.label,
        total_debit: Math.round(data.debit * 1000) / 1000,
        total_credit: Math.round(data.credit * 1000) / 1000,
        balance: Math.round((data.debit - data.credit) * 1000) / 1000,
      }))
      .sort((a, b) => a.account_number.localeCompare(b.account_number));

    return NextResponse.json({ balance });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}