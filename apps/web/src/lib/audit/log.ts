import { createAdminClient } from '@/lib/supabase/admin';

type AuditAction =
  | 'login'
  | 'logout'
  | 'document_upload'
  | 'document_delete'
  | 'document_approve'
  | 'document_reject'
  | 'document_deliver'
  | 'document_reprocess'
  | 'settings_update'
  | 'user_create'
  | 'user_update'
  | 'user_delete'
  | 'exception_resolve';

export async function logAudit(params: {
  userId?: string | null;
  userEmail?: string | null;
  action: AuditAction;
  entityType?: string;
  entityId?: string;
  details?: Record<string, unknown>;
  request?: Request;
}) {
  try {
    const admin = createAdminClient();

    let ipAddress: string | undefined;
    let userAgent: string | undefined;

    if (params.request) {
      ipAddress =
        params.request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        params.request.headers.get('x-real-ip') ||
        undefined;
      userAgent = params.request.headers.get('user-agent') || undefined;
    }

    await admin.from('audit_log').insert({
      user_id: params.userId ?? null,
      user_email: params.userEmail ?? null,
      action: params.action,
      entity_type: params.entityType ?? null,
      entity_id: params.entityId ?? null,
      details: params.details ?? {},
      ip_address: ipAddress,
      user_agent: userAgent,
    });
  } catch (error) {
    console.error('Audit log failed:', error);
    // Ne pas faire planter l'app si le log échoue
  }
}