import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import OpenAI from 'openai';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  console.log('=== EXTRACT START ===');
  try {
    const { id } = await params;
    console.log('=== EXTRACT: ID ===', id);
    const supabase = await createClient();

    // 1. Récupérer le document
    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', id)
      .single();

    if (docError || !doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // 2. Vérifier si une extraction existe déjà
    const { data: existing } = await supabase
      .from('extractions')
      .select('*')
      .eq('document_id', id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ success: true, extraction: existing, cached: true });
    }

    // 3. Télécharger le fichier depuis Storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('documents')
      .download(doc.storage_path);

    if (downloadError || !fileData) {
      return NextResponse.json(
        { error: 'Failed to download file: ' + downloadError?.message },
        { status: 500 }
      );
    }

    const buffer = Buffer.from(await fileData.arrayBuffer());
    const fileName = doc.original_filename.toLowerCase();
    let rawText = '';

    // 4. Extraire le texte selon le type de fichier
    if (fileName.endsWith('.pdf')) {
      console.log('Parsing PDF...');
      const { PDFParse } = await import('pdf-parse');
      const parser = new PDFParse({ data: buffer });
      const pdfData = await parser.getText();
      rawText = pdfData.text;
      await parser.destroy();
    } else if (
      fileName.endsWith('.jpg') ||
      fileName.endsWith('.jpeg') ||
      fileName.endsWith('.png')
    ) {
      console.log('Running OCR on image...');
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('fra+eng', 1, {
        workerPath: './node_modules/tesseract.js/src/worker-script/node/index.js',
      });
      const { data: ocrData } = await worker.recognize(buffer);
      rawText = ocrData.text;
      await worker.terminate();
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
        excelText += `\n=== Feuille: ${sheetName} ===\n`;
        excelText += XLSX.utils.sheet_to_csv(sheet, { FS: ' | ' });
      }
      rawText = excelText;
    } else if (fileName.endsWith('.doc')) {
      return NextResponse.json(
        { error: 'Format .doc non supporté. Convertissez en .docx.' },
        { status: 400 }
      );
    } else {
      return NextResponse.json(
        {
          error:
            'Unsupported file type. Supported: PDF, JPG, PNG, DOCX, XLSX, XLS.',
        },
        { status: 400 }
      );
    }

    console.log('Text extracted. Length:', rawText.length);

    // 5. Analyser avec l'IA (Groq prioritaire, Ollama en fallback)
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
      console.log('Using Ollama (local fallback)');
      openai = new OpenAI({
        baseURL: 'http://127.0.0.1:12345/v1',
        apiKey: 'ollama',
      });
      model = 'qwen2.5:3b';
    }

    const completion = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content:
            'You are an accounting assistant. Extract structured data from invoices and delivery notes. Return ONLY valid JSON.',
        },
        {
          role: 'user',
          content: `Extract the following fields from this document and return JSON:
- invoice_number
- invoice_date
- supplier_name
- supplier_tax_id
- customer_name
- total_amount_ht
- total_vat
- total_amount_ttc
- currency
- line_items (array of {description, quantity, unit_price, total})

Document text:
${rawText.slice(0, 8000)}`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
      // @ts-ignore
      reasoning_effort: 'low',
    });

    console.log('AI response received');
    const extractedFields = JSON.parse(
      completion.choices[0].message.content || '{}'
    );

    // 6. Sauvegarder dans la table extractions
    console.log('Saving to extractions...');
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

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // 7. Mettre à jour le statut du document
    await supabase
      .from('documents')
      .update({ status: 'extracted', raw_text: rawText.slice(0, 50000) })
      .eq('id', id);

    // 8. Générer l'embedding pour la recherche sémantique
    try {
      const embedUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/documents/${id}/embed`;
      await fetch(embedUrl, { method: 'POST' });
      console.log('Embedding generated');
    } catch (embedError) {
      console.error('Embedding error (non-blocking):', embedError);
    }

    // 9. Générer le résumé
    try {
      const summaryUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/documents/${id}/summarize`;
      await fetch(summaryUrl, { method: 'POST' });
      console.log('Summary generated');
    } catch (summaryError) {
      console.error('Summary error (non-blocking):', summaryError);
    }

    console.log('=== EXTRACT SUCCESS ===');
    return NextResponse.json({ success: true, extraction, rawText });
  } catch (error) {
    console.error('=== EXTRACT CRASH ===', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}