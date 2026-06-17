import { NextRequest, NextResponse } from 'next/server';

/**
 * Generate signed URL for private storage images
 * This allows accessing private bucket images temporarily
 */

export async function POST(request: NextRequest) {
  try {
    const { bucket, path, expiresIn = 3600 } = await request.json();

    if (!bucket || !path) {
      return NextResponse.json(
        { error: 'bucket and path are required' },
        { status: 400 }
      );
    }

    // Import Supabase admin client
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const supabase = createAdminClient();

    // Generate signed URL
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, expiresIn);

    if (error) {
      console.error('Error generating signed URL:', error);
      return NextResponse.json(
        { error: 'Failed to generate signed URL' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      signedUrl: data.signedUrl,
      expiresIn
    });

  } catch (error: any) {
    console.error('Error in signed URL API:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}