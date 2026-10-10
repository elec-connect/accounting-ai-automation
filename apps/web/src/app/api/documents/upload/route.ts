import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createHash } from 'crypto';

export async function POST(request: Request) {
  console.log('=== UPLOAD START ===');

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    console.log('File received:', file?.name, file?.size);

    if (!file) {
      return NextResponse.json(
        { error: 'Aucun fichier fourni.' },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const contentHash = createHash('sha256').update(buffer).digest('hex');
    console.log('Content hash:', contentHash);

    const supabase = await createClient();
    console.log('Supabase client created');

    // 🔍 Vérifier si le document existe déjà (doublon)
    const { data: existingDoc, error: checkError } = await supabase
      .from('documents')
      .select('id, original_filename, created_at')
      .eq('content_hash', contentHash)
      .maybeSingle();

    if (checkError) {
      console.error('Check error:', checkError);
    }

    if (existingDoc) {
      console.log('Duplicate detected:', existingDoc.id);
      return NextResponse.json(
        {
          error: 'Ce document existe déjà dans la base.',
          duplicate: true,
          existingDocument: {
            id: existingDoc.id,
            filename: existingDoc.original_filename,
            uploadedAt: existingDoc.created_at,
          },
        },
        { status: 409 }
      );
    }

    // 📤 Upload du fichier dans Storage
    const timestamp = Date.now();
    const storagePath = timestamp + '_' + file.name;
    console.log('Storage path:', storagePath);

    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(storagePath, buffer, {
        contentType: file.type,
      });

    console.log('Upload error:', uploadError);

    if (uploadError) {
      return NextResponse.json(
        {
          error:
            'Erreur lors de l\u2019upload du fichier : ' + uploadError.message,
        },
        { status: 500 }
      );
    }

    // 💾 Insertion dans la base
    const { data, error: insertError } = await supabase
      .from('documents')
      .insert({
        type: 'invoice',
        status: 'received',
        original_filename: file.name,
        sender_email: 'manual-upload@system',
        storage_path: storagePath,
        source: 'manual_upload',
        content_hash: contentHash,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    console.log('Insert error:', insertError);

    if (insertError) {
      if (insertError.code === '23505') {
        await supabase.storage.from('documents').remove([storagePath]);
        return NextResponse.json(
          {
            error: 'Ce document existe déjà dans la base.',
            duplicate: true,
          },
          { status: 409 }
        );
      }

      return NextResponse.json(
        {
          error:
            'Erreur lors de l\u2019enregistrement : ' + insertError.message,
        },
        { status: 500 }
      );
    }

    console.log('=== UPLOAD SUCCESS ===');

    // ═══════════════════════════════════════════════════════════
    //  ✨ DÉCLENCHEMENT DE L'EXTRACTION SELON LE MODE
    // ═══════════════════════════════════════════════════════════

    let extractionTriggered = false;
    let pipelineMode = 'auto';

    try {
      // Lire le mode depuis settings
      const { data: modeSetting } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'pipeline_mode')
        .maybeSingle();

      pipelineMode = modeSetting?.value || 'auto';
      console.log(`Pipeline mode: ${pipelineMode}`);

      if (pipelineMode === 'auto') {
        console.log('Auto mode: triggering extraction...');

        const appUrl = (
          process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin
        ).replace(/\/+$/, '');

        // Déclencher l'extraction (sans attendre la fin pour ne pas bloquer l'upload)
        fetch(`${appUrl}/api/documents/${data.id}/extract`, {
          method: 'POST',
          headers: {
            'x-vercel-protection-bypass':
              process.env.VERCEL_AUTOMATION_BYPASS_SECRET || '',
          },
        }).catch((err) => {
          console.error('Extraction trigger failed:', err);
        });

        extractionTriggered = true;
        console.log('Extraction triggered asynchronously');
      } else {
        console.log('Manual mode: extraction must be triggered manually');
      }
    } catch (modeError) {
      console.error('Error reading pipeline_mode:', modeError);
      // En cas d'erreur, on reste en mode manuel par défaut
    }

    return NextResponse.json({
      success: true,
      document: data,
      message: 'Document uploadé avec succès.',
      pipelineMode,
      extractionTriggered,
    });
  } catch (error) {
    console.error('=== UPLOAD CRASH ===', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? 'Erreur serveur : ' + error.message
            : 'Erreur inconnue',
      },
      { status: 500 }
    );
  }
}