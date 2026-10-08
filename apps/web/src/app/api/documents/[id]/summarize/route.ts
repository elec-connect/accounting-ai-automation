
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
    // 1. Récupérer l'identifiant du document
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Identifiant du document manquant.',
        },
        { status: 400 }
      );
    }

    console.log('Document ID:', id);

    // 2. Vérifier les variables d'environnement Supabase
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

    // 3. Créer le client administrateur Supabase
    const supabase = createAdminClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // 4. Charger le document
    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select('id, raw_text, summary')
      .eq('id', id)
      .single();

    if (docError || !doc) {
      console.error(
        'Document introuvable:',
        docError?.message
      );

      return NextResponse.json(
        {
          success: false,
          error: 'Document introuvable.',
        },
        { status: 404 }
      );
    }

    // 5. Vérifier si un résumé existe déjà
    if (doc.summary && doc.summary.trim().length > 0) {
      console.log('Résumé déjà disponible.');

      return NextResponse.json({
        success: true,
        summary: doc.summary,
        cached: true,
      });
    }

    // 6. Vérifier le texte extrait
    if (!doc.raw_text || !doc.raw_text.trim()) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Aucun texte disponible. Lancez d’abord l’extraction du document.',
        },
        { status: 400 }
      );
    }

    // 7. Vérifier la clé API Groq
    const groqKey = process.env.GROQ_API_KEY;

    if (!groqKey) {
      console.error('GROQ_API_KEY non configurée.');

      return NextResponse.json(
        {
          success: false,
          error:
            'GROQ_API_KEY est absente. Ajoutez-la dans .env.local ou dans les variables d’environnement de Vercel.',
        },
        { status: 500 }
      );
    }

    // 8. Initialiser Groq via son API compatible OpenAI
    const { default: OpenAI } = await import('openai');

    const openai = new OpenAI({
      baseURL: 'https://api.groq.com/openai/v1',
      apiKey: groqKey,
    });

    const model = 'openai/gpt-oss-120b';

    // 9. Générer un résumé en français
    console.log('Generating summary with Groq...');

    const completion = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content:
            'Tu es un assistant comptable francophone. Résume fidèlement les documents comptables en français. Indique le type de document, les parties concernées, les montants et les dates importantes lorsqu’ils sont présents. N’invente jamais les informations manquantes.',
        },
        {
          role: 'user',
          content:
            'Résume ce document en une ou deux phrases courtes, idéalement en 200 caractères maximum :\n\n' +
            doc.raw_text.slice(0, 6000),
        },
      ],
      temperature: 0.2,
      max_tokens: 200,
    });

    const summary =
      completion.choices[0]?.message?.content?.trim() || '';

    if (!summary) {
      throw new Error(
        'Le modèle IA a retourné un résumé vide.'
      );
    }

    console.log('Summary generated:', summary);

    // 10. Enregistrer le résumé dans Supabase
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