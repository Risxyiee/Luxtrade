import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin-alt';
import { supabase } from '@/lib/supabase';

/**
 * POST /api/bugs - Submit a bug report
 */
export async function POST(request: NextRequest) {
  try {
    const admin = getSupabaseAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    // Check authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Get profile to verify user exists
    const { data: profile } = await admin.from('profiles')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const body = await request.json();
    const { description, screenshotUrl } = body;

    // Validate required fields
    if (!description || description.trim().length === 0) {
      return NextResponse.json(
        { error: 'Description is required' },
        { status: 400 }
      );
    }

    if (description.length > 5000) {
      return NextResponse.json(
        { error: 'Description is too long (max 5000 characters)' },
        { status: 400 }
      );
    }

    // Create bug report
    const { data: bugReport, error: createError } = await admin.from('bug_reports').insert({
      user_id: profile.id,
      description: description.trim(),
      screenshot_url: screenshotUrl || null,
      status: 'PENDING'
    }).select().single();

    if (createError) {
      console.error('Error creating bug report:', createError);
      return NextResponse.json({ error: 'Failed to submit bug report' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      bugReport: {
        id: bugReport.id,
        description: bugReport.description,
        screenshotUrl: bugReport.screenshot_url,
        status: bugReport.status,
        createdAt: bugReport.created_at
      }
    });

  } catch (error) {
    console.error('Error submitting bug report:', error);
    return NextResponse.json(
      { error: 'Failed to submit bug report' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/bugs - Get all bug reports (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    const admin = getSupabaseAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    // Check authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Check if user is admin
    const { data: profile } = await admin.from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile || (profile.role !== 'ADMIN' && profile.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 });
    }

    // Get all bug reports
    const { data: bugReports, error: fetchError } = await admin.from('bug_reports')
      .select('*')
      .order('created_at', { ascending: false });

    if (fetchError) {
      console.error('Error fetching bug reports:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch bug reports' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      bugReports
    });

  } catch (error) {
    console.error('Error fetching bug reports:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bug reports' },
      { status: 500 }
    );
  }
}