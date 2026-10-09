import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  console.log('=== DELETE START ===');

  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: 'Identifiant du document manquant.' },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: 'Configuration Supabase incomplète.' },
        { status: 500 }
      );
    }

    const supabase = createAdminClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // 1. Charger le document
    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select('id, storage_path, original_filename')
      .eq('id', id)
      .single();

    if (docError || !doc) {
      return NextResponse.json(
        { error: 'Document introuvable.' },
        { status: 404 }
      );
    }

    console.log('Deleting document:', doc.original_filename);

    // 2. Supprimer les extractions liées
    await supabase.from('extractions').delete().eq('document_id', id);

    // 3. Supprimer le fichier dans Storage
    if (doc.storage_path) {
      const { error: storageError } = await supabase.storage
        .from('documents')
        .remove([doc.storage_path]);

      if (storageError) {
        console.error('Storage delete error:', storageError.message);
      }
    }

    // 4. Supprimer le document
    const { error: deleteError } = await supabase
      .from('documents')
      .delete()
      .eq('id', id);

    if (deleteError) {
      return NextResponse.json(
        { error: 'Erreur de suppression : ' + deleteError.message },
        { status: 500 }
      );
    }

    console.log('=== DELETE SUCCESS ===');
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('=== DELETE CRASH ===', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}