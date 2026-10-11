import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

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

  const { data: superAdmin } = await supabase
    .from('super_admins')
    .select('email')
    .eq('email', user.email)
    .maybeSingle();

  if (!superAdmin) {
    redirect('/dashboard?error=forbidden');
  }

  return <>{children}</>;
}