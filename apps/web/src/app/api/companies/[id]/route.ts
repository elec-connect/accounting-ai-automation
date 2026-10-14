import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

// ═══════════════════════════════════════════════════════════════
//  GET — Récupérer une entreprise + ses données comptables
// ═══════════════════════════════════════════════════════════════

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);

    // ⭐ Lire les dates depuis les query params
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');

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

    // ⭐ Filtrer les écritures par date
    let entriesQuery = supabase
      .from('accounting_entries')
      .select('*')
      .eq('company_id', id);

    if (dateFrom) {
      entriesQuery = entriesQuery.gte('entry_date', dateFrom);
    }
    if (dateTo) {
      entriesQuery = entriesQuery.lte('entry_date', dateTo);
    }

    const { data: entries } = await entriesQuery.order('entry_date', {
      ascending: false,
    });

    // Documents liés (avec duplicate_suspect / duplicate_reason)
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
      date_filter: {
        from: dateFrom,
        to: dateTo,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════════════
//  PATCH — Modifier une entreprise (nom, MF, email, etc.)
// ═══════════════════════════════════════════════════════════════

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // 1. Auth
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Vérifier que l'entreprise existe
    const { data: existing } = await supabase
      .from('companies')
      .select('id')
      .eq('id', id)
      .single();

    if (!existing) {
      return NextResponse.json(
        { error: 'Entreprise introuvable' },
        { status: 404 }
      );
    }

    // 3. Lire le body
    const body = await request.json();
    const { name, tax_id, email, phone, address } = body;

    if (!name?.trim()) {
      return NextResponse.json(
        { error: 'Le nom de l\'entreprise est requis' },
        { status: 400 }
      );
    }

    // 4. Mettre à jour
    const { data: company, error } = await supabase
      .from('companies')
      .update({
        name: name.trim(),
        tax_id: tax_id?.trim() || null,
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        address: address?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Update company error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log(`✅ Entreprise mise à jour : ${company.name} (${id})`);

    return NextResponse.json({
      success: true,
      company,
    });
  } catch (error) {
    console.error('PATCH company error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}