import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Vérifier les permissions
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, is_active')
      .eq('id', user.id)
      .single();

    if (!profile?.is_active || !['admin', 'accountant'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Client admin pour supprimer sans RLS
    const admin = createAdminClient();

    // 1. Supprimer l'extraction existante
    await admin.from('extractions').delete().eq('document_id', id);

    // 2. Supprimer les exceptions existantes
    await admin.from('exceptions').delete().eq('document_id', id);

    // 3. Réinitialiser le document
    await admin
      .from('documents')
      .update({
        status: 'received',
        confidence_score: null,
        summary: null,
        raw_text: null,
        approved_at: null,
        delivered_at: null,
        rejection_reason: null,
      })
      .eq('id', id);

    // 4. Relancer l'extraction
    const appUrl = (
      process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin
    ).replace(/\/+$/, '');

    fetch(`${appUrl}/api/documents/${id}/extract`, {
      method: 'POST',
      headers: {
        'x-vercel-protection-bypass':
          process.env.VERCEL_AUTOMATION_BYPASS_SECRET || '',
      },
    }).catch((err) => console.error('Reprocess trigger failed:', err));

    return NextResponse.json({ success: true, message: 'Reprocessing started' });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}