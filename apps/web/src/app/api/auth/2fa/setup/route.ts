import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateSecret, generateURI } from 'otplib';
import QRCode from 'qrcode';

export const runtime = 'nodejs';

export async function POST() {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = createAdminClient();

    // Générer un secret
    const secret = generateSecret();

    // Créer l'URL otpauth
    const otpauth = generateURI({
      label: user.email || 'user',
      issuer: 'Accounting AI',
      secret,
    });

    // Générer le QR code
    const qrCode = await QRCode.toDataURL(otpauth);

    // Sauvegarder le secret (non activé)
    await admin
      .from('profiles')
      .update({ totp_secret: secret, totp_enabled: false })
      .eq('id', user.id);

    return NextResponse.json({
      secret,
      qrCode,
      otpauth,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}