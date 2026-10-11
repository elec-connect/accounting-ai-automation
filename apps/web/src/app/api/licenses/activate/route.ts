import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { isValidLicenseFormat, calculateExpiry, type LicenseDuration } from '@/lib/license/generate';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { key } = body as { key: string };

    if (!key || typeof key !== 'string') {
      return NextResponse.json({ error: 'Clé requise' }, { status: 400 });
    }

    const normalizedKey = key.trim().toUpperCase();

    // 1. Vérifier le format
    if (!isValidLicenseFormat(normalizedKey)) {
      return NextResponse.json(
        { error: 'Format de clé invalide' },
        { status: 400 }
      );
    }

    // 2. Vérifier l'authentification
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = createAdminClient();

    // 3. Chercher la licence
    const { data: license, error: findError } = await admin
      .from('licenses')
      .select('*')
      .eq('license_key', normalizedKey)
      .single();

    if (findError || !license) {
      return NextResponse.json(
        { error: 'Clé de licence introuvable' },
        { status: 404 }
      );
    }

    // 4. Vérifier le statut
    if (license.status === 'revoked') {
      return NextResponse.json(
        { error: 'Cette licence a été révoquée' },
        { status: 403 }
      );
    }

    if (license.status === 'suspended') {
      return NextResponse.json(
        { error: 'Cette licence est suspendue' },
        { status: 403 }
      );
    }

    // 5. Vérifier si déjà activée
    if (license.activated_at) {
      // Déjà activée par le même utilisateur → idempotent
      if (license.activated_by === user.id) {
        return NextResponse.json({
          success: true,
          message: 'Licence déjà activée sur votre compte',
          license,
        });
      }

      // Déjà activée par un autre utilisateur
      return NextResponse.json(
        { error: 'Cette licence est déjà activée' },
        { status: 403 }
      );
    }

    // 6. Calculer l'expiration (à partir de maintenant)
    const durationType = license.duration_type as LicenseDuration;
    const expiry = calculateExpiry(durationType, new Date());

    // 7. Activation ATOMIQUE
    //    .is('activated_at', null) empêche 2 users d'activer en même temps
    const { data: activated, error: updateError } = await admin
      .from('licenses')
      .update({
        activated_at: new Date().toISOString(),
        activated_by: user.id,
        activated_by_email: user.email,
        expires_at: expiry ? expiry.toISOString() : null,
        status: 'active',
      })
      .eq('id', license.id)
      .is('activated_at', null) // ⭐ garde-fou anti race-condition
      .select()
      .maybeSingle();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // ⭐ Si aucune ligne mise à jour → quelqu'un a activé entre-temps
    if (!activated) {
      return NextResponse.json(
        { error: 'Cette licence vient d\'être activée par un autre compte' },
        { status: 409 }
      );
    }

    console.log(`✅ License activée : ${normalizedKey} par ${user.email}`);

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