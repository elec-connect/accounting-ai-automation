import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import {
  isValidLicenseFormat,
  calculateExpiry,
  type LicenseDuration,
} from '@/lib/license/generate';
import { logAudit } from '@/lib/audit/log';

export const runtime = 'nodejs';

const CLOUD_VERIFY_URL =
  process.env.LICENSE_VERIFY_URL ??
  'https://accounting-ai-automation.vercel.app/api/licenses/verify';

export async function POST(request: Request) {
  console.log('🟢 [1] POST reçu');
  try {
    console.log('🟢 [2] Avant request.json()');
    const body = await request.json();
    console.log('🟢 [3] Body =', JSON.stringify(body));
    const { key } = body as { key: string };

    if (!key || typeof key !== 'string') {
      console.log('🔴 [3a] Clé manquante');
      return NextResponse.json({ error: 'Clé requise' }, { status: 400 });
    }

    const normalizedKey = key.trim().toUpperCase();
    console.log('🟢 [4] normalizedKey =', normalizedKey);

    if (!isValidLicenseFormat(normalizedKey)) {
      console.log('🔴 [4a] Format invalide');
      return NextResponse.json(
        { error: 'Format de clé invalide' },
        { status: 400 }
      );
    }

    console.log('🟢 [5] Avant createClient()');
    const supabase = await createClient();
    console.log('🟢 [6] createClient OK');

    const {
      data: { user },
    } = await supabase.auth.getUser();
    console.log('🟢 [7] user =', user?.email);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🟢 [8] Avant createAdminClient()');
    const admin = createAdminClient();
    console.log('🟢 [9] createAdminClient OK');

    console.log('🟢 [10] Recherche locale de', normalizedKey);
    const { data: existingLocal, error: localError } = await admin
      .from('licenses')
      .select('*')
      .eq('license_key', normalizedKey)
      .maybeSingle();

    console.log('🟢 [11] existingLocal =', existingLocal, 'error =', localError);

    let licenseData: {
      duration_type: string;
      expires_at: string | null;
    } | null = null;

    if (existingLocal) {
      console.log('🟢 [12] Licence trouvée en local');
      
      if (existingLocal.status === 'revoked') {
        return NextResponse.json(
          { error: 'Cette licence a été révoquée' },
          { status: 403 }
        );
      }

      if (existingLocal.status === 'suspended') {
        return NextResponse.json(
          { error: 'Cette licence est suspendue' },
          { status: 403 }
        );
      }

      if (existingLocal.activated_at) {
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

      licenseData = {
        duration_type: existingLocal.duration_type,
        expires_at: existingLocal.expires_at,
      };
      console.log('🟢 [13] licenseData (local) =', licenseData);
    } else {
      console.log('🟢 [14] Licence non trouvée en local → appel Cloud');
      
      try {
        const cloudRes = await fetch(CLOUD_VERIFY_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            key: normalizedKey,
            client_email: user.email,
          }),
          signal: AbortSignal.timeout(8000),
        });

        console.log('🟢 [15] Cloud response status =', cloudRes.status);

        if (!cloudRes.ok) {
          throw new Error(`Cloud API returned ${cloudRes.status}`);
        }

        const cloudResponse = (await cloudRes.json()) as any;
        console.log('🟢 [16] Cloud response =', JSON.stringify(cloudResponse));

        if (!cloudResponse.valid) {
          console.log('🔴 [17] Cloud dit invalide');
          return NextResponse.json(
            { error: cloudResponse.message ?? 'Licence invalide' },
            { status: 403 }
          );
        }

        const licenseWrapper = cloudResponse.license;
        const cloudDurationType =
          licenseWrapper?.duration_type ?? cloudResponse.duration_type;
        const cloudExpiresAt =
          licenseWrapper?.expires_at ?? cloudResponse.expires_at;

        console.log('🟢 [18] cloudDurationType =', cloudDurationType);
        console.log('🟢 [19] cloudExpiresAt =', cloudExpiresAt);

        if (!cloudDurationType) {
          return NextResponse.json(
            { error: 'Réponse invalide du serveur Cloud' },
            { status: 502 }
          );
        }

        licenseData = {
          duration_type: cloudDurationType,
          expires_at: cloudExpiresAt ?? null,
        };
        console.log('🟢 [20] licenseData (cloud) =', licenseData);
      } catch (cloudError) {
        console.error('🔴 [21] Cloud error:', cloudError);
        return NextResponse.json(
          { error: 'Clé de licence introuvable (Cloud error)' },
          { status: 404 }
        );
      }
    }

    console.log('🟢 [22] Avant calculateExpiry');
    const durationType = licenseData!.duration_type as LicenseDuration;
    const expiry = calculateExpiry(durationType, new Date());
    console.log('🟢 [23] expiry =', expiry?.toISOString());

    let activated;
    console.log('🟢 [24] existingLocal =', existingLocal ? 'YES' : 'NO');

    if (existingLocal) {
      console.log('🟢 [25] UPDATE local license');
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
        console.error('🔴 [25a] Update error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      activated = data;
    } else {
      console.log('🟢 [26] INSERT local license');
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
        console.error('🔴 [26a] Insert error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      activated = data;
    }

    console.log('🟢 [27] activated =', activated?.id);

    if (!activated) {
      return NextResponse.json(
        { error: "Cette licence vient d'être activée par un autre compte" },
        { status: 409 }
      );
    }

    console.log('🟢 [28] Avant logAudit');
    await logAudit({
      userId: user.id,
      userEmail: user.email,
      action: 'license_activate',
      entityType: 'license',
      entityId: activated.id,
      details: {
        license_key: normalizedKey,
        duration: durationType,
        source: existingLocal ? 'local' : 'cloud',
      },
      request,
    });
    console.log('🟢 [29] logAudit OK');

    return NextResponse.json({
      success: true,
      message: 'Licence activée avec succès',
      license: activated,
    });
  } catch (error) {
    console.error('🔴 [FINAL] ERREUR:', error);
    console.error(
      '🔴 [FINAL] MESSAGE:',
      error instanceof Error ? error.message : 'Unknown'
    );
    console.error(
      '🔴 [FINAL] STACK:',
      error instanceof Error ? error.stack : 'no stack'
    );
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}