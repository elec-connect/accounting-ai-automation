import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Route pour déclencher manuellement l'extraction (mode manuel)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // 1. Authentification
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Vérification du rôle
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, is_active')
      .eq('id', user.id)
      .single();

    if (
      !profile?.is_active ||
      !['admin', 'accountant'].includes(profile.role)
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 3. Vérifier le statut du document
    const { data: doc } = await supabase
      .from('documents')
      .select('status')
      .eq('id', id)
      .single();

    if (!doc) {
      return NextResponse.json(
        { error: 'Document introuvable' },
        { status: 404 }
      );
    }

    if (doc.status !== 'received') {
      return NextResponse.json(
        {
          error: `Ce document ne peut pas être traité (statut actuel : ${doc.status}). Attendu : received.`,
        },
        { status: 400 }
      );
    }

    // 4. Déclencher l'extraction
    const appUrl = (
      process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin
    ).replace(/\/+$/, '');

    console.log(`Manual processing: triggering extraction for ${id}`);

    const res = await fetch(`${appUrl}/api/documents/${id}/extract`, {
      method: 'POST',
      headers: {
        'x-vercel-protection-bypass':
          process.env.VERCEL_AUTOMATION_BYPASS_SECRET || '',
      },
    });

    const json = await res.json();

    return NextResponse.json(
      {
        success: res.ok,
        ...json,
      },
      { status: res.status }
    );
  } catch (error) {
    console.error('=== PROCESS ERROR ===', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}