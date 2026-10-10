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
      .select('type, status, confidence_score');

    const docs = documents ?? [];

    const types = ['invoice', 'quote', 'delivery_note', 'receipt', 'other'];

    const stats = types.map((type) => {
      const typeDocs = docs.filter((d) => d.type === type);
      const withScore = typeDocs.filter((d) => d.confidence_score != null);
      const avgScore = withScore.length > 0
        ? withScore.reduce((s, d) => s + (d.confidence_score ?? 0), 0) / withScore.length
        : 0;

      return {
        type,
        total: typeDocs.length,
        auto_approved: typeDocs.filter((d) => d.status === 'auto_approved').length,
        exceptions: typeDocs.filter((d) => d.status === 'exception').length,
        approved: typeDocs.filter((d) => d.status === 'approved').length,
        delivered: typeDocs.filter((d) => d.status === 'delivered').length,
        rejected: typeDocs.filter((d) => d.status === 'rejected').length,
        avgScore: Math.round(avgScore * 100) / 100,
      };
    }).filter((s) => s.total > 0);

    return NextResponse.json({ stats });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}