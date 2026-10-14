import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: company } = await supabase
      .from('companies')
      .select('*')
      .eq('id', id)
      .single();

    if (!company) {
      return NextResponse.json(
        { error: 'Entreprise introuvable' },
        { status: 404 }
      );
    }

    const { data: entries } = await supabase
      .from('accounting_entries')
      .select('*')
      .eq('company_id', id)
      .order('entry_date', { ascending: false });

    // ⭐⭐⭐ AJOUT : duplicate_suspect et duplicate_reason
    const { data: documents } = await supabase
      .from('document_companies')
      .select(`
        id,
        role,
        direction,
        match_score,
        confidence,
        needs_review,
        duplicate_suspect,
        duplicate_reason,
        documents (
          id,
          original_filename,
          type,
          direction,
          status,
          created_at,
          confidence_score
        )
      `)
      .eq('company_id', id);

    // Balance par compte
    const balanceMap = new Map<string, { label: string; debit: number; credit: number }>();
    for (const e of entries ?? []) {
      const existing = balanceMap.get(e.account_number) ?? {
        label: e.account_label,
        debit: 0,
        credit: 0,
      };
      existing.debit += Number(e.debit) || 0;
      existing.credit += Number(e.credit) || 0;
      balanceMap.set(e.account_number, existing);
    }

    const balance = Array.from(balanceMap.entries())
      .map(([account_number, data]) => ({
        account_number,
        account_label: data.label,
        total_debit: Math.round(data.debit * 1000) / 1000,
        total_credit: Math.round(data.credit * 1000) / 1000,
        balance: Math.round((data.debit - data.credit) * 1000) / 1000,
      }))
      .sort((a, b) => a.account_number.localeCompare(b.account_number));

    // Partenaires
    const partyMap = new Map<
      string,
      { type: string; debit: number; credit: number }
    >();

    for (const e of entries ?? []) {
      if (!e.party_name) continue;

      const account = String(e.account_number || '').trim();
      const debit = Number(e.debit) || 0;
      const credit = Number(e.credit) || 0;

      // ⭐ Pour un CLIENT : on ne compte QUE le compte 411
      // ⭐ Pour un FOURNISSEUR : on ne compte QUE le compte 401
      const isClientAccount = account === '411';
      const isSupplierAccount = account === '401';

      if (!isClientAccount && !isSupplierAccount) continue;

      const existing = partyMap.get(e.party_name) ?? {
        type: e.party_type,
        debit: 0,
        credit: 0,
      };
      existing.debit += debit;
      existing.credit += credit;
      partyMap.set(e.party_name, existing);
    }

    const parties = Array.from(partyMap.entries())
      .map(([party_name, data]) => ({
        party_name,
        party_type: data.type,
        total_debit: Math.round(data.debit * 1000) / 1000,
        total_credit: Math.round(data.credit * 1000) / 1000,
        balance: Math.round((data.debit - data.credit) * 1000) / 1000,
      }))
      .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance));

    return NextResponse.json({
      company,
      entries: entries ?? [],
      documents: documents ?? [],
      balance,
      parties,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}