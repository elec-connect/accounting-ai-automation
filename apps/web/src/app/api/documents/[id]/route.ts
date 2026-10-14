import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cleanId = String(id).trim();

    if (!cleanId) {
      return NextResponse.json({ error: 'ID manquant' }, { status: 400 });
    }

    // 1. Auth
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = createAdminClient();

    // 2. Récupérer le document (pour storage_path)
    const { data: doc, error: fetchError } = await admin
      .from('documents')
      .select('id, storage_path, original_filename')
      .eq('id', cleanId)
      .single();

    if (fetchError || !doc) {
      return NextResponse.json(
        { error: 'Document introuvable' },
        { status: 404 }
      );
    }

    // 3. Supprimer le fichier du storage
    if (doc.storage_path) {
      const { error: storageError } = await admin.storage
        .from('documents')
        .remove([doc.storage_path]);

      if (storageError) {
        console.warn('Storage delete failed (non bloquant):', storageError);
      }
    }

    // 4. Supprimer le document (les FK CASCADE s'occupent du reste)
    const { error: deleteError } = await admin
      .from('documents')
      .delete()
      .eq('id', cleanId);

    if (deleteError) {
      console.error('Delete error:', deleteError);
      return NextResponse.json(
        { error: deleteError.message },
        { status: 500 }
      );
    }

    console.log(`✅ Document supprimé : ${doc.original_filename} (${cleanId})`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete crash:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}