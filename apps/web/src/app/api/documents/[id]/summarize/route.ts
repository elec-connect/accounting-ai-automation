import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  console.log('=== SUMMARIZE START ===');

  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Identifiant du document manquant.' },
        { status: 400 }
      );
    }

    console.log('Document ID:', id);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('Configuration Supabase incomplète.');
      return NextResponse.json(
        {
          success: false,
          error:
            'Variables manquantes : NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY.',
        },
        { status: 500 }
      );
    }

    const supabase = createAdminClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select('id, raw_text, summary')
      .eq('id', id)
      .single();

    if (docError || !doc) {
      console.error('Document introuvable:', docError?.message);
      return NextResponse.json(
        { success: false, error: 'Document introuvable.' },
        { status: 404 }
      );
    }

    if (doc.summary && doc.summary.trim().length > 0) {
      console.log('Résumé déjà disponible.');
      return NextResponse.json({
        success: true,
        summary: doc.summary,
        cached: true,
      });
    }

    if (!doc.raw_text || !doc.raw_text.trim()) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Aucun texte disponible. Lancez d\u2019abord l\u2019extraction du document.',
        },
        { status: 400 }
      );
    }

    const groqKey = process.env.GROQ_API_KEY;

    if (!groqKey) {
      console.error('GROQ_API_KEY non configurée.');
      return NextResponse.json(
        {
          success: false,
          error:
            'GROQ_API_KEY est absente. Ajoutez-la dans .env.local ou dans les variables d\u2019environnement de Vercel.',
        },
        { status: 500 }
      );
    }

    const { default: OpenAI } = await import('openai');

    const openai = new OpenAI({
      baseURL: 'https://api.groq.com/openai/v1',
      apiKey: groqKey,
    });

    const model = 'openai/gpt-oss-120b';

    // ✨ Troncature intelligente
    const truncatedText =
      doc.raw_text.length > 6000
        ? doc.raw_text.slice(0, 6000) + '\n\n[…document tronqué…]'
        : doc.raw_text;

    console.log(
      'Generating summary with Groq... (text length:',
      truncatedText.length,
      ')'
    );

    // ✨ Retry : 2 tentatives
    let summary = '';
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(`Attempt ${attempt}/2`);

        const completion = await openai.chat.completions.create({
          model,
          messages: [
            {
              role: 'system',
              content:
                'Tu es un assistant comptable francophone. Résume fidèlement les documents comptables en français. Indique le type de document, les parties concernées, les montants et les dates importantes lorsqu\u2019ils sont présents. N\u2019invente jamais les informations manquantes. Réponds UNIQUEMENT par le résumé, sans introduction ni conclusion.',
            },
            {
              role: 'user',
              content: `Résume ce document en 1-2 phrases courtes (200 caractères maximum) :\n\n${truncatedText}`,
            },
          ],
          temperature: 0.2,
          max_tokens: 300,
        });

        const content =
          completion.choices?.[0]?.message?.content?.trim() || '';

        // ✨ Debug complet si vide
        if (!content) {
          console.warn(
            'Empty response. Full Groq response:',
            JSON.stringify(completion, null, 2)
          );
          lastError = new Error('Réponse vide');
          continue;
        }

        summary = content;
        break;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error('Erreur inconnue');
        console.error(`Attempt ${attempt} failed:`, lastError.message);
      }
    }

    if (!summary) {
      console.error('All attempts failed. Last error:', lastError?.message);
      return NextResponse.json(
        {
          success: false,
          error:
            'Le modèle IA n\u2019a pas pu générer de résumé. ' +
            (lastError?.message || 'Réponse vide'),
        },
        { status: 500 }
      );
    }

    console.log('Summary generated:', summary);

    const { error: updateError } = await supabase
      .from('documents')
      .update({ summary })
      .eq('id', id);

    if (updateError) {
      console.error(
        'Erreur lors de la sauvegarde du résumé:',
        updateError.message
      );
      return NextResponse.json(
        {
          success: false,
          error:
            'Résumé généré, mais impossible de le sauvegarder : ' +
            updateError.message,
        },
        { status: 500 }
      );
    }

    console.log('=== SUMMARIZE SUCCESS ===');

    return NextResponse.json({
      success: true,
      summary,
      model,
    });
  } catch (error) {
    console.error('=== SUMMARIZE ERROR ===', error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Une erreur inconnue est survenue.',
      },
      { status: 500 }
    );
  }
}