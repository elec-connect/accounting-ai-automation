import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

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

    // Générer un HTML propre qui sera imprimé en PDF
    const rows = docs
      .map(
        (d) => `
        <tr>
          <td>${escapeHtml(d.original_filename ?? '—')}</td>
          <td>${escapeHtml(d.type ?? '—')}</td>
          <td>${escapeHtml(d.status)}</td>
          <td>${
            d.confidence_score != null ? d.confidence_score.toFixed(0) + '%' : '—'
          }</td>
          <td>${escapeHtml(d.sender_email ?? '—')}</td>
          <td>${new Date(d.created_at).toLocaleString('fr-FR')}</td>
        </tr>
      `
      )
      .join('');

    const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Export Documents</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      padding: 24px;
      color: #111;
    }
    h1 {
      font-size: 20px;
      margin-bottom: 8px;
    }
    .meta {
      color: #666;
      font-size: 12px;
      margin-bottom: 20px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
    }
    th {
      text-align: left;
      background: #f3f4f6;
      padding: 8px;
      border-bottom: 1px solid #d1d5db;
      font-weight: 600;
    }
    td {
      padding: 6px 8px;
      border-bottom: 1px solid #e5e7eb;
    }
    tr:hover { background: #fafafa; }
    @media print {
      body { padding: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom: 16px;">
    <button onclick="window.print()" style="padding: 8px 16px; background: #2563eb; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;">
      🖨️ Imprimer / Enregistrer en PDF
    </button>
  </div>

  <h1>📄 Export des Documents</h1>
  <p class="meta">
    Généré le ${new Date().toLocaleString('fr-FR')}
    · Total : ${docs.length} document(s)
  </p>

  <table>
    <thead>
      <tr>
        <th>Nom du fichier</th>
        <th>Type</th>
        <th>Statut</th>
        <th>Score IA</th>
        <th>Expéditeur</th>
        <th>Date de réception</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>

  <script>
    // Auto-déclencher l'impression (optionnel)
    setTimeout(() => window.print(), 500);
  </script>
</body>
</html>
    `;

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}