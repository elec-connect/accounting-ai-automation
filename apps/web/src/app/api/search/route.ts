import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');

    if (!query) {
      return NextResponse.json({ error: 'Query required' }, { status: 400 });
    }

    const supabase = await createClient();

    const { data: documents, error } = await supabase
      .from('documents')
      .select('id, original_filename, type, status, raw_text, created_at')
      .ilike('raw_text', `%${query}%`)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const results = (documents || []).map((doc) => {
      const text = doc.raw_text || '';
      const index = text.toLowerCase().indexOf(query.toLowerCase());
      const start = Math.max(0, index - 100);
      const end = Math.min(text.length, index + query.length + 100);
      const excerpt = text.slice(start, end);

      return {
        id: doc.id,
        filename: doc.original_filename,
        type: doc.type,
        status: doc.status,
        created_at: doc.created_at,
        excerpt: index >= 0 ? `...${excerpt}...` : '',
      };
    });

    return NextResponse.json({ results, count: results.length });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}