import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createHash } from 'crypto';

export async function POST(request: Request) {
  console.log('=== UPLOAD START ===');

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    console.log('File received:', file?.name, file?.size);

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const contentHash = createHash('sha256').update(buffer).digest('hex');
    console.log('Content hash:', contentHash);

    const supabase = await createClient();
    console.log('Supabase client created');

    const timestamp = Date.now();
    const storagePath = timestamp + '_' + file.name;
    console.log('Storage path:', storagePath);

    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(storagePath, buffer, {
        contentType: file.type,
      });

    console.log('Upload error:', uploadError);

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data, error: insertError } = await supabase
      .from('documents')
      .insert({
        type: 'invoice',
        status: 'received',
        original_filename: file.name,
        sender_email: 'manual-upload@system',
        storage_path: storagePath,
        source: 'manual_upload',
        content_hash: contentHash,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    console.log('Insert error:', insertError);

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    console.log('=== UPLOAD SUCCESS ===');
    return NextResponse.json({ success: true, document: data });
  } catch (error) {
    console.error('=== UPLOAD CRASH ===', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}