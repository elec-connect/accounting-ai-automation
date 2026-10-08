import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateEmbedding } from '@/lib/embeddings/generate';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select('id, raw_text')
      .eq('id', id)
      .single();

    if (docError || !doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    if (!doc.raw_text) {
      return NextResponse.json({ error: 'No text to embed' }, { status: 400 });
    }

    const { data: existing } = await supabase
      .from('document_embeddings')
      .select('id')
      .eq('document_id', id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ success: true, cached: true });
    }

    console.log('Generating embedding...');
    const embedding = await generateEmbedding(doc.raw_text);
    console.log('Embedding generated, length:', embedding.length);

    const { error: insertError } = await supabase
      .from('document_embeddings')
      .insert({
        document_id: id,
        content: doc.raw_text.slice(0, 10000),
        embedding,
      });

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, embeddingLength: embedding.length });
  } catch (error) {
    console.error('EMBED ERROR:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}