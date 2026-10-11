import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit/log";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { action, entityType, entityId, details } = body as {
      action: string;
      entityType?: string;
      entityId?: string;
      details?: Record<string, unknown>;
    };

    if (!action) {
      return NextResponse.json({ error: "action requise" }, { status: 400 });
    }

    await logAudit({
      userId: user.id,
      userEmail: user.email,
      action: action as any,
      entityType,
      entityId,
      details,
      request,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}