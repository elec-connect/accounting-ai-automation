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

    // Récupérer tous les documents avec score de confiance
    const { data: documents } = await supabase
      .from('documents')
      .select('status, confidence_score, created_at')
      .not('confidence_score', 'is', null);

    const docs = documents ?? [];

    // Distribution des scores (buckets de 10)
    const buckets: Record<string, number> = {
      '0-9': 0,
      '10-19': 0,
      '20-29': 0,
      '30-39': 0,
      '40-49': 0,
      '50-59': 0,
      '60-69': 0,
      '70-79': 0,
      '80-89': 0,
      '90-100': 0,
    };

    for (const d of docs) {
      const score = d.confidence_score ?? 0;
      if (score >= 90) buckets['90-100']++;
      else if (score >= 80) buckets['80-89']++;
      else if (score >= 70) buckets['70-79']++;
      else if (score >= 60) buckets['60-69']++;
      else if (score >= 50) buckets['50-59']++;
      else if (score >= 40) buckets['40-49']++;
      else if (score >= 30) buckets['30-39']++;
      else if (score >= 20) buckets['20-29']++;
      else if (score >= 10) buckets['10-19']++;
      else buckets['0-9']++;
    }

    // Compteurs par statut
    const total = docs.length;
    const autoApproved = docs.filter((d) => d.status === 'auto_approved').length;
    const exceptions = docs.filter((d) => d.status === 'exception').length;
    const approved = docs.filter((d) => d.status === 'approved').length;
    const delivered = docs.filter((d) => d.status === 'delivered').length;
    const rejected = docs.filter((d) => d.status === 'rejected').length;

    // Score moyen
    const avgScore =
      total > 0
        ? docs.reduce((sum, d) => sum + (d.confidence_score ?? 0), 0) / total
        : 0;

    // Taux d'automatisation (docs auto-approuvés / total)
    const automationRate = total > 0 ? (autoApproved / total) * 100 : 0;

    // Taux d'exception
    const exceptionRate = total > 0 ? (exceptions / total) * 100 : 0;

    return NextResponse.json({
      distribution: Object.entries(buckets).map(([range, count]) => ({
        range,
        count,
      })),
      summary: {
        total,
        autoApproved,
        exceptions,
        approved,
        delivered,
        rejected,
        avgScore: Math.round(avgScore * 100) / 100,
        automationRate: Math.round(automationRate * 100) / 100,
        exceptionRate: Math.round(exceptionRate * 100) / 100,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}