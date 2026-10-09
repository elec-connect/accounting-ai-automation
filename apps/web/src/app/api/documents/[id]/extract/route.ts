import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import OpenAI from 'openai';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  console.log('=== EXTRACT START ===');

  try {
    // 1. Récupérer l'identifiant
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: 'Identifiant du document manquant.' },
        { status: 400 }
      );
    }

    console.log('=== EXTRACT: ID ===', id);

    const supabase = await createClient();

    // 2. Charger le document depuis Supabase
    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', id)
      .single();

    if (docError || !doc) {
      console.error('Document introuvable:', docError?.message);

      return NextResponse.json(
        { error: 'Document introuvable.' },
        { status: 404 }
      );
    }

    // 3. Vérifier si une extraction existe déjà
    const { data: existing, error: existingError } = await supabase
      .from('extractions')
      .select('*')
      .eq('document_id', id)
      .maybeSingle();

    if (existingError) {
      console.error(
        'Erreur de lecture de l’extraction:',
        existingError.message
      );
    }

    if (existing) {
      console.log('Extraction déjà existante.');

      // Si le résumé manque, essayer de le générer.
      if (!doc.summary && doc.raw_text) {
        const summaryResult = await generateSummary(request, id);

        return NextResponse.json({
          success: true,
          extraction: existing,
          cached: true,
          summary: summaryResult.summary ?? null,
          summaryGenerated: summaryResult.success,
          summaryError: summaryResult.error ?? null,
        });
      }

      return NextResponse.json({
        success: true,
        extraction: existing,
        cached: true,
      });
    }

    // 4. Télécharger le fichier
    const { data: fileData, error: downloadError } =
      await supabase.storage
        .from('documents')
        .download(doc.storage_path);

    if (downloadError || !fileData) {
      console.error(
        'Erreur de téléchargement:',
        downloadError?.message
      );

      return NextResponse.json(
        {
          error:
            'Impossible de télécharger le fichier : ' +
            (downloadError?.message || 'fichier introuvable'),
        },
        { status: 500 }
      );
    }

    const buffer = Buffer.from(await fileData.arrayBuffer());
    const fileName = String(doc.original_filename || '').toLowerCase();
    let rawText = '';

    // 5. Extraire le texte selon le format
    if (fileName.endsWith('.pdf')) {
      console.log('Parsing PDF with unpdf...');

      const { extractText } = await import('unpdf');
      const result = await extractText(new Uint8Array(buffer), {
        mergePages: true,
      });

      rawText = result.text;
    } else if (
      fileName.endsWith('.jpg') ||
      fileName.endsWith('.jpeg') ||
      fileName.endsWith('.png')
    ) {
      console.log('Running OCR on image...');

      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('fra+eng');

      try {
        const { data } = await worker.recognize(buffer);
        rawText = data.text;
      } finally {
        await worker.terminate();
      }
    } else if (fileName.endsWith('.docx')) {
      console.log('Parsing Word document...');

      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ buffer });

      rawText = result.value;
    } else if (
      fileName.endsWith('.xlsx') ||
      fileName.endsWith('.xls')
    ) {
      console.log('Parsing Excel file...');

      const XLSX = await import('xlsx');
      const workbook = XLSX.read(buffer, { type: 'buffer' });

      let excelText = '';

      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];

        excelText += `\n=== Feuille : ${sheetName} ===\n`;
        excelText += XLSX.utils.sheet_to_csv(sheet, {
          FS: ' | ',
        });
      }

      rawText = excelText;
    } else if (fileName.endsWith('.doc')) {
      return NextResponse.json(
        {
          error:
            'Le format .doc n’est pas pris en charge. Convertissez le document en .docx.',
        },
        { status: 400 }
      );
    } else {
      return NextResponse.json(
        {
          error:
            'Format non pris en charge. Formats acceptés : PDF, JPG, JPEG, PNG, DOCX, XLSX et XLS.',
        },
        { status: 400 }
      );
    }

    rawText = rawText.trim();

    console.log('Text extracted. Length:', rawText.length);

    if (!rawText) {
      return NextResponse.json(
        {
          error:
            'Aucun texte n’a pu être extrait. Vérifiez que le document contient du texte lisible.',
        },
        { status: 422 }
      );
    }

    // 6. Configurer le modèle IA
    const groqKey = process.env.GROQ_API_KEY;

    if (!groqKey) {
      console.error('GROQ_API_KEY non configurée.');

      return NextResponse.json(
        {
          error:
            'GROQ_API_KEY est absente. Configurez cette variable dans .env.local ou dans les variables du déploiement.',
        },
        { status: 500 }
      );
    }

    console.log('Using Groq');

    const openai = new OpenAI({
      baseURL: 'https://api.groq.com/openai/v1',
      apiKey: groqKey,
    });

    const model = 'openai/gpt-oss-120b';

    // 7. Extraire les informations comptables
    const completion = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content:
            'Tu es un assistant comptable. Extrais les informations structurées des factures et bons de livraison. Retourne uniquement un objet JSON valide. N’invente aucune donnée manquante : utilise null si une information est absente.',
        },
        {
          role: 'user',
          content: `Extrais les champs suivants et retourne un JSON :

- invoice_number
- invoice_date
- supplier_name
- supplier_tax_id
- customer_name
- total_amount_ht
- total_vat
- total_amount_ttc
- currency
- line_items : tableau avec description, quantity, unit_price et total

Texte du document :
${rawText.slice(0, 8000)}`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    });

    const content = completion.choices[0]?.message?.content;

    if (!content) {
      throw new Error('Le modèle IA a retourné une réponse vide.');
    }

    let extractedFields: Record<string, unknown>;

    try {
      extractedFields = JSON.parse(content);
    } catch {
      throw new Error(
        'Le modèle IA a retourné un JSON invalide.'
      );
    }

    console.log('AI response received');

    // 8. Enregistrer l'extraction
    const { data: extraction, error: insertError } = await supabase
      .from('extractions')
      .insert({
        document_id: id,
        extracted_fields: extractedFields,
        confidence: 0.95,
        model_used: model,
        prompt_version: 'v1',
      })
      .select()
      .single();

    if (insertError || !extraction) {
      console.error(
        'Erreur d’enregistrement de l’extraction:',
        insertError?.message
      );

      return NextResponse.json(
        {
          error:
            'Impossible d’enregistrer l’extraction : ' +
            (insertError?.message || 'erreur inconnue'),
        },
        { status: 500 }
      );
    }

    // 9. Sauvegarder le texte extrait
    const { error: updateError } = await supabase
      .from('documents')
      .update({
        status: 'extracted',
        raw_text: rawText.slice(0, 50000),
      })
      .eq('id', id);

    if (updateError) {
      console.error(
        'Erreur de mise à jour du document:',
        updateError.message
      );
    }

    // 10. Générer le résumé automatiquement
    const summaryResult = await generateSummary(request, id);

    if (summaryResult.success) {
      console.log('Summary generated successfully.');
    } else {
      console.error(
        'Summary generation failed:',
        summaryResult.error
      );
    }

    console.log('=== EXTRACT SUCCESS ===');

    return NextResponse.json({
      success: true,
      extraction,
      summary: summaryResult.summary ?? null,
      summaryGenerated: summaryResult.success,
      summaryError: summaryResult.error ?? null,
      rawText,
    });
  } catch (error) {
    console.error('=== EXTRACT CRASH ===', error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Une erreur inconnue est survenue.',
      },
      { status: 500 }
    );
  }
}

// Fonction de génération du résumé
async function generateSummary(
  request: Request,
  id: string
): Promise<{
  success: boolean;
  summary?: string;
  error?: string;
}> {
  try {
    // Pas besoin de NEXT_PUBLIC_APP_URL pour construire l'URL.
    const appUrl = (
      process.env.NEXT_PUBLIC_APP_URL ||
      new URL(request.url).origin
    ).replace(/\/+$/, '');

    const summaryUrl =
      `${appUrl}/api/documents/${encodeURIComponent(id)}/summarize`;

    console.log('=== SUMMARY REQUEST ===');
    console.log('Summary URL:', summaryUrl);

    const response = await fetch(summaryUrl, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        'x-vercel-protection-bypass': process.env.VERCEL_AUTOMATION_BYPASS_SECRET || '',
      },
    });

    const responseText = await response.text();

    let result: {
      success?: boolean;
      summary?: string;
      error?: string;
    };

    try {
      result = JSON.parse(responseText);
    } catch {
      result = {
        error: responseText || 'Réponse invalide du service de résumé.',
      };
    }

    if (!response.ok || !result.success) {
      const errorMessage =
        result.error ||
        `L’API de résumé a répondu avec le statut ${response.status}.`;

      console.error('Summary API failed:', errorMessage);

      return {
        success: false,
        error: errorMessage,
      };
    }

    console.log('=== SUMMARY SUCCESS ===');

    return {
      success: true,
      summary: result.summary,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : 'Erreur inconnue lors de la génération du résumé.';

    console.error('Summary request failed:', errorMessage);

    return {
      success: false,
      error: errorMessage,
    };
  }
}