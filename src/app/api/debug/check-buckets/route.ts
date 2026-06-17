import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Missing Supabase environment variables' },
        { status: 500 }
      );
    }

    // Use service role key to bypass RLS for debugging
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // List all buckets
    const { data: buckets, error } = await supabase.storage.listBuckets();

    if (error) {
      return NextResponse.json(
        { error: 'Failed to list buckets', details: error },
        { status: 500 }
      );
    }

    const expectedBuckets = ['screenshots', 'bug-reports', 'trade-images'];
    const bucketStatus = expectedBuckets.map(name => ({
      name,
      exists: buckets?.some(b => b.name === name) || false,
      bucket: buckets?.find(b => b.name === name)
    }));

    return NextResponse.json({
      success: true,
      totalBuckets: buckets?.length || 0,
      buckets: buckets,
      status: bucketStatus
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}