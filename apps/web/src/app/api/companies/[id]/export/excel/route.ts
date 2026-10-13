import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import * as XLSX from 'xlsx';

export const runtime = 'nodejs';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: companyId } = await params;
    const cleanCompanyId = String(companyId).trim();

    // 1. Auth
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = createAdminClient();

    // 2. Charger entreprise
    const { data: company } = await admin
      .from('companies')
      .select('*')
      .eq('id', cleanCompanyId)
      .single();

    if (!company) {
      return NextResponse.json(
        { error: 'Entreprise introuvable' },
        { status: 404 }
      );
    }

    // 3. Charger les écritures
    const { data: entries } = await admin
      .from('accounting_entries')
      .select('*')
      .eq('company_id', cleanCompanyId)
      .order('entry_date', { ascending: true });

    // 4. Calculer la balance par compte
    const balanceMap = new Map<
      string,
      { label: string; debit: number; credit: number }
    >();

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
        Compte: account_number,
        Libellé: data.label,
        Débit: Math.round(data.debit * 1000) / 1000,
        Crédit: Math.round(data.credit * 1000) / 1000,
        Solde: Math.round((data.debit - data.credit) * 1000) / 1000,
      }))
      .sort((a, b) => a.Compte.localeCompare(b.Compte));

    // 5. Partenaires
    const partyMap = new Map<
      string,
      { type: string; debit: number; credit: number }
    >();

    for (const e of entries ?? []) {
      if (!e.party_name) continue;
      const existing = partyMap.get(e.party_name) ?? {
        type: e.party_type,
        debit: 0,
        credit: 0,
      };
      existing.debit += Number(e.debit) || 0;
      existing.credit += Number(e.credit) || 0;
      partyMap.set(e.party_name, existing);
    }

    const parties = Array.from(partyMap.entries())
      .map(([party_name, data]) => ({
        Partie: party_name,
        Type: data.type === 'client' ? 'Client' : 'Fournisseur',
        Débit: Math.round(data.debit * 1000) / 1000,
        Crédit: Math.round(data.credit * 1000) / 1000,
        Solde: Math.round((data.debit - data.credit) * 1000) / 1000,
      }))
      .sort((a, b) => Math.abs(b.Solde) - Math.abs(a.Solde));

    // 6. Créer le fichier Excel
    const wb = XLSX.utils.book_new();

    // ─── Feuille 1 : Infos entreprise ────────────────
    const infoSheet = XLSX.utils.aoa_to_sheet([
      ['BILAN COMPTABLE'],
      [],
      ['Entreprise', company.name],
      ['Matricule fiscal', company.tax_id ?? '—'],
      ['Email', company.email ?? '—'],
      ['Date d\'export', new Date().toLocaleString('fr-FR')],
      [],
      ['RÉSUMÉ'],
      ['Ventes', Number(company.total_sales ?? 0)],
      ['Achats', Number(company.total_purchases ?? 0)],
      ['TVA collectée', Number(company.total_tva_collected ?? 0)],
      ['TVA déductible', Number(company.total_tva_deductible ?? 0)],
      ['Solde', Number(company.balance ?? 0)],
    ]);
    XLSX.utils.book_append_sheet(wb, infoSheet, 'Informations');

    // ─── Feuille 2 : Balance ─────────────────────────
    const balanceSheet = XLSX.utils.json_to_sheet(balance);
    balanceSheet['!cols'] = [
      { wch: 15 },
      { wch: 30 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
    ];
    XLSX.utils.book_append_sheet(wb, balanceSheet, 'Balance');

    // ─── Feuille 3 : Partenaires ─────────────────────
    const partiesSheet = XLSX.utils.json_to_sheet(parties);
    partiesSheet['!cols'] = [
      { wch: 30 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
    ];
    XLSX.utils.book_append_sheet(wb, partiesSheet, 'Partenaires');

    // ─── Feuille 4 : Écritures détaillées ────────────
    const entriesData = (entries ?? []).map((e) => ({
      Date: e.entry_date,
      Description: e.description ?? '',
      Compte: e.account_number,
      Libellé: e.account_label,
      Débit: Number(e.debit) || 0,
      Crédit: Number(e.credit) || 0,
      Partie: e.party_name ?? '',
      Type: e.party_type ?? '',
    }));
    const entriesSheet = XLSX.utils.json_to_sheet(entriesData);
    entriesSheet['!cols'] = [
      { wch: 12 },
      { wch: 40 },
      { wch: 12 },
      { wch: 25 },
      { wch: 12 },
      { wch: 12 },
      { wch: 25 },
      { wch: 12 },
    ];
    XLSX.utils.book_append_sheet(wb, entriesSheet, 'Écritures');

    // 7. Générer le buffer
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    // 8. Nom du fichier
    const safeName = company.name
      .replace(/[^a-zA-Z0-9]/g, '_')
      .substring(0, 50);
    const date = new Date().toISOString().split('T')[0];
    const filename = `bilan_${safeName}_${date}.xlsx`;

    // 9. Retour
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Excel export error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}