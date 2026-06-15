import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { supabase } from '@/lib/supabase';

/**
 * POST /api/admin/reward-bug - Reward a bug reporter with 30 days PRO access
 * Request body: { reportId: string }
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

    // Check if user is admin
    const adminProfile = await db.profile.findUnique({
      where: { id: user.id },
      select: { role: true }
    });

    if (!adminProfile || adminProfile.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 });
    }

    const body = await request.json();
    const { reportId } = body;

    if (!reportId) {
      return NextResponse.json(
        { error: 'reportId is required' },
        { status: 400 }
      );
    }

    // Get the bug report
    const bugReport = await db.bugReport.findUnique({
      where: { id: reportId }
    });

    if (!bugReport) {
      return NextResponse.json(
        { error: 'Bug report not found' },
        { status: 404 }
      );
    }

    if (bugReport.status === 'REWARDED') {
      return NextResponse.json(
        { error: 'This bug report has already been rewarded' },
        { status: 400 }
      );
    }

    // Calculate new subscription date (add 30 days from now)
    const now = new Date();
    let newSubscriptionUntil: Date;

    const userProfile = await db.profile.findUnique({
      where: { id: bugReport.userId },
      select: { subscription_until: true }
    });

    if (userProfile?.subscription_until && userProfile.subscription_until > now) {
      // User has active subscription, add 30 days from current expiry
      newSubscriptionUntil = new Date(userProfile.subscription_until);
      newSubscriptionUntil.setDate(newSubscriptionUntil.getDate() + 30);
    } else {
      // No active subscription, add 30 days from now
      newSubscriptionUntil = new Date(now);
      newSubscriptionUntil.setDate(newSubscriptionUntil.getDate() + 30);
    }

    // Update user profile with new subscription date and set is_pro = true
    await db.profile.update({
      where: { id: bugReport.userId },
      data: {
        subscription_until: newSubscriptionUntil,
        is_pro: true,
        plan: 'PRO'
      }
    });

    // Update bug report status to REWARDED
    const updatedBugReport = await db.bugReport.update({
      where: { id: reportId },
      data: { status: 'REWARDED' }
    });

    return NextResponse.json({
      success: true,
      message: 'Bug report rewarded successfully',
      bugReport: {
        id: updatedBugReport.id,
        status: updatedBugReport.status,
        subscriptionExtendedUntil: newSubscriptionUntil.toISOString(),
        extendedDays: 30
      }
    });

  } catch (error) {
    console.error('Error rewarding bug report:', error);
    return NextResponse.json(
      { error: 'Failed to reward bug report' },
      { status: 500 }
    );
  }
}