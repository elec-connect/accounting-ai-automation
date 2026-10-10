import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verify } from 'otplib';
import crypto from 'crypto';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const { code } = await request.json();

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = createAdminClient();

    const { data: profile } = await admin
      .from('profiles')
      .select('totp_secret')
      .eq('id', user.id)
      .single();

    if (!profile?.totp_secret) {
      return NextResponse.json({ error: 'Setup non démarré' }, { status: 400 });
    }

    // Vérifier le code
    const isValid = await verify({
      token: code,
      secret: profile.totp_secret,
    });

    if (!isValid) {
      return NextResponse.json({ error: 'Code invalide' }, { status: 400 });
    }

    // Générer des codes de secours
    const backupCodes = Array.from({ length: 8 }, () =>
      crypto.randomBytes(5).toString('hex').toUpperCase()
    );

    // Activer 2FA
    await admin
      .from('profiles')
      .update({
        totp_enabled: true,
        totp_backup_codes: backupCodes,
      })
      .eq('id', user.id);

    return NextResponse.json({
      success: true,
      backupCodes,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}