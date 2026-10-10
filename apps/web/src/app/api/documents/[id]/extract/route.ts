import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendExceptionEmail } from '@/lib/email/send-exception-email';
import OpenAI from 'openai';

export const runtime = 'nodejs';
export const maxDuration = 60;

// ═══════════════════════════════════════════════════════════════
//  SEUILS PAR DÉFAUT (surchargés par les settings en DB)
// ═══════════════════════════════════════════════════════════════

const DEFAULT_CONFIDENCE_THRESHOLD = 90;
const DEFAULT_SEVERITY_HIGH_THRESHOLD = 70;

// ═══════════════════════════════════════════════════════════════
//  ROUTE PRINCIPALE
// ═══════════════════════════════════════════════════════════════

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  console.log('=== EXTRACT START ===');

  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: 'Identifiant du document manquant.' },
        { status: 400 }
      );
    }

    console.log('=== EXTRACT: ID ===', id);

    const supabase = createAdminClient();

    // ─────────────────────────────────────────────────────────
    //  0. Charger les seuils depuis settings
    // ─────────────────────────────────────────────────────────
    const { data: thresholdSettings } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', ['confidence_threshold', 'confidence_high_severity']);

    const thresholds: Record<string, string> = {};
    for (const row of thresholdSettings ?? []) {
      thresholds[row.key] = row.value ?? '';
    }

    const CONFIDENCE_THRESHOLD = parseInt(
      thresholds.confidence_threshold || String(DEFAULT_CONFIDENCE_THRESHOLD),
      10
    );
    const SEVERITY_HIGH_THRESHOLD = parseInt(
      thresholds.confidence_high_severity || String(DEFAULT_SEVERITY_HIGH_THRESHOLD),
      10
    );

    console.log(
      `Thresholds: confidence=${CONFIDENCE_THRESHOLD}, high=${SEVERITY_HIGH_THRESHOLD}`
    );

    // ─────────────────────────────────────────────────────────
    //  1. Charger le document
    // ─────────────────────────────────────────────────────────
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

    // ─────────────────────────────────────────────────────────
    //  2. Vérifier si une extraction existe déjà
    // ─────────────────────────────────────────────────────────
    const { data: existing } = await supabase
      .from('extractions')
      .select('*')
      .eq('document_id', id)
      .maybeSingle();

    if (existing) {
      console.log('Extraction déjà existante.');

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

    // ─────────────────────────────────────────────────────────
    //  3. Télécharger le fichier
    // ─────────────────────────────────────────────────────────
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('documents')
      .download(doc.storage_path);

    if (downloadError || !fileData) {
      console.error('Erreur de téléchargement:', downloadError?.message);
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

    // ─────────────────────────────────────────────────────────
    //  4. Extraire le texte selon le format
    // ─────────────────────────────────────────────────────────
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
    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      console.log('Parsing Excel file...');
      const XLSX = await import('xlsx');
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      let excelText = '';
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        excelText += `\n=== Feuille : ${sheetName} ===\n`;
        excelText += XLSX.utils.sheet_to_csv(sheet, { FS: ' | ' });
      }
      rawText = excelText;
    } else if (fileName.endsWith('.csv')) {
      console.log('Parsing CSV file...');
      const { parse } = await import('csv-parse/sync');
      const records = parse(buffer.toString('utf-8'), {
        columns: true,
        skip_empty_lines: true,
        bom: true,
      });
      rawText = records
        .map((row) => Object.values(row as Record<string, unknown>).join(' | '))
        .join('\n');
    } else if (fileName.endsWith('.doc')) {
      return NextResponse.json(
        {
          error:
            'Le format .doc n\u2019est pas pris en charge. Convertissez le document en .docx.',
        },
        { status: 400 }
      );
    } else {
      return NextResponse.json(
        {
          error:
            'Format non pris en charge. Formats acceptés : PDF, JPG, JPEG, PNG, DOCX, XLSX, XLS et CSV.',
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
            'Aucun texte n\u2019a pu être extrait. Vérifiez que le document contient du texte lisible.',
        },
        { status: 422 }
      );
    }

    // ─────────────────────────────────────────────────────────
    //  5. Configurer Groq
    // ─────────────────────────────────────────────────────────
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

    // ─────────────────────────────────────────────────────────
    //  6. Prompt avec type + score + suggestions
    // ─────────────────────────────────────────────────────────
    const completion = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content:
            'Tu es un assistant comptable expert. Analyse les documents comptables. Retourne UNIQUEMENT un objet JSON valide. N\u2019invente AUCUNE donnée : utilise null si une information est absente. Évalue honnêtement ta confiance.',
        },
        {
          role: 'user',
          content: `Analyse ce document et retourne un JSON avec cette structure EXACTE :

{
  "type": "invoice" | "quote" | "delivery_note" | "receipt" | "other",
  "extracted": {
    "invoice_number": "...",
    "invoice_date": "YYYY-MM-DD",
    "supplier_name": "...",
    "supplier_tax_id": "...",
    "customer_name": "...",
    "total_amount_ht": 0.00,
    "total_vat": 0.00,
    "total_amount_ttc": 0.00,
    "currency": "TND",
    "line_items": [
      { "description": "...", "quantity": 1, "unit_price": 0.00, "total": 0.00 }
    ]
  },
  "confidence": 0-100,
  "confidence_details": {
    "invoice_number": { "score": 0-100, "reason": "..." },
    "invoice_date": { "score": 0-100, "reason": "..." },
    "supplier_name": { "score": 0-100, "reason": "..." },
    "total_amount_ttc": { "score": 0-100, "reason": "..." }
  },
  "warnings": ["..."],
  "suggestions": [
    {
      "field": "total_amount_ttc",
      "current_value": 599.00,
      "suggested_value": 599.00,
      "reason": "..."
    }
  ]
}

DÉTECTION DU TYPE (champ "type") :
- "invoice" : Facture (mots-clés : "facture", "invoice", "montant total", "TVA")
- "quote" : Devis (mots-clés : "devis", "quote", "proposition", "estimation")
- "delivery_note" : Bon de livraison ("bon de livraison", "delivery note", "BL")
- "receipt" : Reçu ("reçu", "receipt", "ticket")
- "other" : Tout autre document

RÈGLES DE SCORING (confidence global 0-100) :
- 95-100 : tous les champs critiques présents, montants cohérents, document net
- 80-94  : champs présents mais un doute léger sur un montant ou une date
- 60-79  : plusieurs champs manquants ou ambigus
- 0-59   : document non exploitable

SUGGESTIONS : pour chaque champ dont le score est < 90, propose une valeur corrigée si tu détectes une erreur probable. Si aucune suggestion, retourne un tableau vide [].

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

    // ─────────────────────────────────────────────────────────
    //  7. Parser la réponse
    // ─────────────────────────────────────────────────────────
    let parsed: {
      type?: string;
      extracted?: Record<string, unknown>;
      confidence?: number;
      confidence_details?: Record<string, unknown>;
      warnings?: string[];
      suggestions?: unknown[];
    };

    try {
      parsed = JSON.parse(content);
    } catch {
      throw new Error('Le modèle IA a retourné un JSON invalide.');
    }

    const extractedFields = (parsed.extracted ?? parsed) as Record<string, unknown>;

    const confidenceScore =
      typeof parsed.confidence === 'number' &&
      parsed.confidence >= 0 &&
      parsed.confidence <= 100
        ? parsed.confidence
        : 50;

    const confidenceDetails = parsed.confidence_details ?? {};
    const warnings = Array.isArray(parsed.warnings) ? parsed.warnings : [];
    const suggestions = Array.isArray(parsed.suggestions) ? parsed.suggestions : [];
    const detectedType = (parsed.type as string) || 'other';

    console.log('AI response received. Confidence:', confidenceScore);
    console.log('Detected type:', detectedType);
    console.log('Suggestions:', suggestions.length);

    // ─────────────────────────────────────────────────────────
    //  8. Enregistrer l'extraction
    // ─────────────────────────────────────────────────────────
    const { data: extraction, error: insertError } = await supabase
      .from('extractions')
      .insert({
        document_id: id,
        extracted_fields: extractedFields,
        confidence: confidenceScore / 100,
        confidence_details: confidenceDetails,
        warnings: warnings,
        suggestions: suggestions,
        model_used: model,
        prompt_version: 'v3',
      })
      .select()
      .single();

    if (insertError || !extraction) {
      console.error('Erreur d\u2019enregistrement de l\u2019extraction:', insertError?.message);
      return NextResponse.json(
        {
          error:
            'Impossible d\u2019enregistrer l\u2019extraction : ' +
            (insertError?.message || 'erreur inconnue'),
        },
        { status: 500 }
      );
    }

    // ─────────────────────────────────────────────────────────
    //  9. Décision automatique
    // ─────────────────────────────────────────────────────────
    let shouldCreateException = confidenceScore < CONFIDENCE_THRESHOLD;
    let newStatus = shouldCreateException ? 'exception' : 'auto_approved';
    let exceptionReason = `Confiance IA faible (${confidenceScore.toFixed(0)}% < ${CONFIDENCE_THRESHOLD}%)`;

    // ─────────────────────────────────────────────────────────
    //  10. Détection de doublons
    // ─────────────────────────────────────────────────────────
    try {
      const appUrl = (
        process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin
      ).replace(/\/+$/, '');

      const dupRes = await fetch(`${appUrl}/api/documents/check-duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoice_number: extractedFields.invoice_number,
          supplier_name: extractedFields.supplier_name,
          total_amount_ttc: extractedFields.total_amount_ttc,
          invoice_date: extractedFields.invoice_date,
          exclude_id: id,
        }),
      });

      const dupData = await dupRes.json();

      if (dupData.duplicate && dupData.matches?.length > 0) {
        const names = dupData.matches
          .map((m: { original_filename: string }) => m.original_filename)
          .join(', ');

        warnings.push(`⚠️ Doublon potentiel avec : ${names}`);

        shouldCreateException = true;
        newStatus = 'exception';
        exceptionReason = `Doublon potentiel détecté (${dupData.matches.length} correspondance(s))`;

        console.log('⚠️ Doublon détecté:', names);

        await supabase
          .from('extractions')
          .update({ warnings })
          .eq('document_id', id);
      }
    } catch (dupErr) {
      console.error('Duplicate check failed:', dupErr);
    }

    console.log(
      `Decision: score=${confidenceScore}, status=${newStatus}, exception=${shouldCreateException}`
    );

    // ─────────────────────────────────────────────────────────
    //  11. Mettre à jour le document
    // ─────────────────────────────────────────────────────────
    const { error: updateError } = await supabase
      .from('documents')
      .update({
        status: newStatus,
        type: detectedType,
        raw_text: rawText.slice(0, 50000),
        confidence_score: confidenceScore,
      })
      .eq('id', id);

    if (updateError) {
      console.error('Erreur de mise à jour du document:', updateError.message);
    }

    // ─────────────────────────────────────────────────────────
    //  12. Création auto d'exception
    // ─────────────────────────────────────────────────────────
    if (shouldCreateException) {
      const severity =
        confidenceScore < SEVERITY_HIGH_THRESHOLD ? 'high' : 'medium';

      const { error: exceptionError } = await supabase
        .from('exceptions')
        .insert({
          document_id: id,
          reason: exceptionReason,
          severity: severity,
          status: 'open',
        });

      if (exceptionError) {
        console.error('Erreur de création de l\u2019exception:', exceptionError.message);
      } else {
        console.log('✅ Exception créée automatiquement');

        sendExceptionEmail({
          documentId: id,
          filename: doc.original_filename || 'Document',
          reason: exceptionReason,
          score: confidenceScore,
          severity,
        }).catch((err) => console.error('Email send failed:', err));
      }
    }

    // ─────────────────────────────────────────────────────────
    //  13. Générer le résumé
    // ─────────────────────────────────────────────────────────
    const summaryResult = await generateSummary(request, id);

    if (summaryResult.success) {
      console.log('Summary generated successfully.');
    } else {
      console.error('Summary generation failed:', summaryResult.error);
    }

    console.log('=== EXTRACT SUCCESS ===');

    return NextResponse.json({
      success: true,
      extraction,
      confidence: confidenceScore,
      status: newStatus,
      type: detectedType,
      exceptionCreated: shouldCreateException,
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

// ═══════════════════════════════════════════════════════════════
//  GÉNÉRATION DU RÉSUMÉ
// ═══════════════════════════════════════════════════════════════

async function generateSummary(
  request: Request,
  id: string
): Promise<{
  success: boolean;
  summary?: string;
  error?: string;
}> {
  try {
    const appUrl = (
      process.env.NEXT_PUBLIC_APP_URL ||
      new URL(request.url).origin
    ).replace(/\/+$/, '');

    const summaryUrl = `${appUrl}/api/documents/${encodeURIComponent(id)}/summarize`;

    console.log('=== SUMMARY REQUEST ===');
    console.log('Summary URL:', summaryUrl);

    const response = await fetch(summaryUrl, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        'x-vercel-protection-bypass':
          process.env.VERCEL_AUTOMATION_BYPASS_SECRET || '',
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
        `L\u2019API de résumé a répondu avec le statut ${response.status}.`;

      console.error('Summary API failed:', errorMessage);

      return { success: false, error: errorMessage };
    }

    console.log('=== SUMMARY SUCCESS ===');

    return { success: true, summary: result.summary };
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : 'Erreur inconnue lors de la génération du résumé.';

    console.error('Summary request failed:', errorMessage);

    return { success: false, error: errorMessage };
  }
}