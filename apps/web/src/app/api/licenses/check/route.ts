import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { isValidLicenseFormat, calculateExpiry, type LicenseDuration } from '@/lib/license/generate';
import { logAudit } from '@/lib/audit/log';

export const runtime = 'nodejs';

// ⭐ URL de TON API Cloud
const CLOUD_VERIFY_URL =
  process.env.LICENSE_VERIFY_URL ??
  'https://ton-app.vercel.app/api/licenses/verify';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { key } = body as { key: string };

    if (!key || typeof key !== 'string') {
      return NextResponse.json({ error: 'Clé requise' }, { status: 400 });
    }

    const normalizedKey = key.trim().toUpperCase();

    // 1. Format
    if (!isValidLicenseFormat(normalizedKey)) {
      return NextResponse.json(
        { error: 'Format de clé invalide' },
        { status: 400 }
      );
    }

    // 2. Auth locale
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = createAdminClient();

    // 3. ⭐ VÉRIFICATION AUPRÈS DU CLOUD
    let cloudResponse: {
      valid: boolean;
      license?: {
        key: string;
        duration_type: string;
        expires_at: string | null;
        activated_at: string;
      };
      reason?: string;
      message?: string;
    };

    try {
      const cloudRes = await fetch(CLOUD_VERIFY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: normalizedKey,
          client_email: user.email,
        }),
      });

      if (!cloudRes.ok) {
        throw new Error(`Cloud API returned ${cloudRes.status}`);
      }

      cloudResponse = await cloudRes.json();
    } catch (cloudError) {
      console.error('Cloud verify error:', cloudError);
      return NextResponse.json(
        {
          error:
            'Impossible de vérifier la licence. Vérifiez votre connexion internet.',
        },
        { status: 503 }
      );
    }

    // 4. Traiter la réponse du Cloud
    if (!cloudResponse.valid) {
      const reasonMessages: Record<string, string> = {
        not_found: 'Clé de licence introuvable',
        revoked: 'Cette licence a été révoquée',
        suspended: 'Cette licence est suspendue',
        expired: 'Cette licence a expiré',
        already_activated:
          'Cette licence a déjà été activée par un autre compte',
        invalid_format: 'Format de clé invalide',
      };

      return NextResponse.json(
        {
          error:
            cloudResponse.message ??
            reasonMessages[cloudResponse.reason ?? 'not_found'] ??
            'Licence invalide',
        },
        { status: 403 }
      );
    }

    // 5. Vérifier si déjà activée en local
    const { data: existingLocal } = await admin
      .from('licenses')
      .select('*')
      .eq('license_key', normalizedKey)
      .maybeSingle();

    if (existingLocal?.activated_at) {
      if (existingLocal.activated_by === user.id) {
        return NextResponse.json({
          success: true,
          message: 'Licence déjà activée sur votre compte',
          license: existingLocal,
        });
      }

      return NextResponse.json(
        { error: 'Cette licence est déjà activée' },
        { status: 403 }
      );
    }

    // 6. Calculer l'expiration
    const durationType = cloudResponse.license!.duration_type as LicenseDuration;
    const expiry = calculateExpiry(durationType, new Date());

    // 7. Insérer/mettre à jour en local
    let activated;

    if (existingLocal) {
      const { data, error } = await admin
        .from('licenses')
        .update({
          activated_at: new Date().toISOString(),
          activated_by: user.id,
          activated_by_email: user.email,
          expires_at: expiry ? expiry.toISOString() : null,
          status: 'active',
          duration_type: durationType,
        })
        .eq('id', existingLocal.id)
        .is('activated_at', null)
        .select()
        .maybeSingle();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      activated = data;
    } else {
      const { data, error } = await admin
        .from('licenses')
        .insert({
          license_key: normalizedKey,
          duration_type: durationType,
          status: 'active',
          activated_at: new Date().toISOString(),
          activated_by: user.id,
          activated_by_email: user.email,
          expires_at: expiry ? expiry.toISOString() : null,
          notes: 'Synchronisée depuis le Cloud',
        })
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      activated = data;
    }

    if (!activated) {
      return NextResponse.json(
        { error: "Cette licence vient d'être activée par un autre compte" },
        { status: 409 }
      );
    }

    // 8. Log audit
    await logAudit({
      userId: user.id,
      userEmail: user.email,
      action: 'license_activate',
      entityType: 'license',
      entityId: activated.id,
      details: {
        license_key: normalizedKey,
        duration: durationType,
        source: 'cloud',
      },
      request,
    });

    return NextResponse.json({
      success: true,
      message: 'Licence activée avec succès',
      license: activated,
    });
  } catch (error) {
    console.error('Activate license error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}