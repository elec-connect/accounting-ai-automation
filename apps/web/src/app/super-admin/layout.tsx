import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user?.email) {
    redirect('/login');
  }

  // ⭐ Utilise le client ADMIN (bypass RLS)
  const admin = createAdminClient();

  const { data: superAdmin } = await admin
    .from('super_admins')
    .select('email')
    .eq('email', user.email)
    .maybeSingle();

  if (!superAdmin) {
    redirect('/dashboard?error=forbidden');
  }

  return <>{children}</>;
}