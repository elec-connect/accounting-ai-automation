import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: documents } = await supabase
      .from('documents')
      .select('*')
      .order('created_at', { ascending: false });

    const docs = documents ?? [];

    // En-têtes CSV
    const headers = [
      'ID',
      'Nom du fichier',
      'Type',
      'Statut',
      'Score de confiance (%)',
      'Expéditeur',
      'Résumé',
      'Date de réception',
      'Date d\'approbation',
      'Date de livraison',
      'Motif de rejet',
    ];

    // Échapper les valeurs CSV
    const escapeCsv = (value: unknown): string => {
      if (value == null) return '';
      const str = String(value);
      if (str.includes(';') || str.includes('"') || str.includes('\n')) {
        return '"' + str.replace(/"/g, '""') + '"';
      }
      return str;
    };

    const formatDate = (iso: string | null | undefined): string => {
      if (!iso) return '';
      try {
        return new Date(iso).toLocaleString('fr-FR');
      } catch {
        return '';
      }
    };

    // Construire les lignes
    const lines: string[] = [headers.join(';')];

    for (const d of docs) {
      lines.push(
        [
          escapeCsv(d.id),
          escapeCsv(d.original_filename),
          escapeCsv(d.type),
          escapeCsv(d.status),
          escapeCsv(d.confidence_score),
          escapeCsv(d.sender_email),
          escapeCsv(d.summary),
          escapeCsv(formatDate(d.created_at)),
          escapeCsv(formatDate(d.approved_at)),
          escapeCsv(formatDate(d.delivered_at)),
          escapeCsv(d.rejection_reason),
        ].join(';')
      );
    }

    const csv = '\uFEFF' + lines.join('\n'); // BOM UTF-8 pour Excel

    const filename = `documents-export-${new Date().toISOString().slice(0, 10)}.csv`;

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}