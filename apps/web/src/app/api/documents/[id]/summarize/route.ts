import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import OpenAI from 'openai';
import { createClient as createAdminClient } from '@supabase/supabase-js';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    console.log('=== SUMMARIZE START ===');
    console.log('Document ID:', id);

    const supabase = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select('id, raw_text, summary')
      .eq('id', id)
      .single();

    if (docError || !doc) {
      console.log('Document not found:', docError);
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    console.log('Document found. Has raw_text:', !!doc.raw_text);
    console.log('Existing summary:', doc.summary);

    if (doc.summary) {
      return NextResponse.json({ success: true, summary: doc.summary, cached: true });
    }

    if (!doc.raw_text) {
      return NextResponse.json({ error: 'No text available' }, { status: 400 });
    }

    const groqKey = process.env.GROQ_API_KEY;

    let openai: OpenAI;
    let model: string;

    if (groqKey) {
      console.log('Using Groq');
      openai = new OpenAI({
        baseURL: 'https://api.groq.com/openai/v1',
        apiKey: groqKey,
      });
      model = 'openai/gpt-oss-120b';
    } else {
      console.log('Using Ollama');
      openai = new OpenAI({
        baseURL: 'http://127.0.0.1:12345/v1',
        apiKey: 'ollama',
      });
      model = 'qwen2.5:3b';
    }

    console.log('Calling AI...');
        const completion = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content:
            'You are a concise assistant. Summarize documents in 1-2 short sentences in French. Include the type, parties, amounts, and key dates.',
        },
        {
          role: 'user',
          content: `Résume ce document en 1 ou 2 phrases courtes (max 200 caractères) :

${doc.raw_text.slice(0, 3000)}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 200,
      // @ts-ignore
      reasoning_effort: 'low',
    });

    console.log('Full response:', JSON.stringify(completion.choices[0].message));

    const summary = completion.choices[0].message.content?.trim() || '';
    console.log('Summary generated:', summary);

    console.log('=== SUMMARY UPDATE START ===');
    console.log('Summary to save:', summary);
    console.log('Document ID to update:', id);

    const { data: updateData, error: updateError } = await supabase
      .from('documents')
      .update({ summary })
      .eq('id', id)
      .select();

    console.log('Update result:', JSON.stringify(updateData));
    console.log('Update error:', JSON.stringify(updateError));
    console.log('=== SUMMARY UPDATE END ===');

    return NextResponse.json({ success: true, summary });
  } catch (error) {
    console.error('SUMMARIZE ERROR:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}