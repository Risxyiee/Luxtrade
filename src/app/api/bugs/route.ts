import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { supabase } from '@/lib/supabase';

/**
 * POST /api/bugs - Submit a bug report
 */
export async function POST(request: NextRequest) {
  try {
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

    // Get profile to get the correct user ID
    const profile = await db.profile.findUnique({
      where: { id: user.id }
    });

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
    const bugReport = await db.bugReport.create({
      data: {
        userId: profile.id,
        description: description.trim(),
        screenshotUrl: screenshotUrl || null,
        status: 'PENDING'
      }
    });

    return NextResponse.json({
      success: true,
      bugReport: {
        id: bugReport.id,
        description: bugReport.description,
        screenshotUrl: bugReport.screenshotUrl,
        status: bugReport.status,
        createdAt: bugReport.createdAt
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
    const profile = await db.profile.findUnique({
      where: { id: user.id },
      select: { role: true }
    });

    if (!profile || profile.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 });
    }

    // Get all bug reports with user info
    const bugReports = await db.bugReport.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: true
      }
    });

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