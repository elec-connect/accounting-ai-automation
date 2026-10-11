import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ valid: false, reason: 'unauthenticated' });
    }

    const { data: license } = await supabase
      .from('licenses')
      .select('*')
      .eq('activated_by', user.id)
      .eq('status', 'active')
      .maybeSingle();

    if (!license) {
      return NextResponse.json({
        valid: false,
        reason: 'no_license',
      });
    }

    // Vérifier l'expiration
    if (license.expires_at) {
      const expiresAt = new Date(license.expires_at);
      if (expiresAt < new Date()) {
        return NextResponse.json({
          valid: false,
          reason: 'expired',
          license,
        });
      }

      const daysLeft = Math.ceil(
        (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );

      return NextResponse.json({
        valid: true,
        license,
        daysLeft,
      });
    }

    // Licence à vie
    return NextResponse.json({
      valid: true,
      license,
      daysLeft: null,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}