import { NextRequest, NextResponse } from 'next/server';

/**
 * Debug endpoint to check if HUGGING_FACE_API_TOKEN is configured
 * Shows status only, never exposes the token value
 */
export async function GET(request: NextRequest) {
  try {
    // Check if token exists and is not empty
    const hasToken = !!process.env.HUGGING_FACE_API_TOKEN;
    const tokenLength = hasToken ? process.env.HUGGING_FACE_API_TOKEN!.length : 0;

    // Check other relevant environment variables
    const envChecks = {
      huggingFace: {
        configured: hasToken,
        tokenLength: tokenLength,
        status: hasToken && tokenLength > 10 ? 'VALID' : 'NOT_CONFIGURED_OR_INVALID'
      },
      database: {
        configured: !!process.env.DATABASE_URL,
        status: !!process.env.DATABASE_URL ? 'CONFIGURED' : 'NOT_CONFIGURED'
      },
      nodeEnv: {
        value: process.env.NODE_ENV || 'undefined',
        status: process.env.NODE_ENV === 'production' ? 'PRODUCTION' : 'DEVELOPMENT'
      }
    };

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      environment: envChecks,
      message: hasToken
        ? 'HUGGING_FACE_API_TOKEN is configured'
        : 'HUGGING_FACE_API_TOKEN is NOT configured'
    });

  } catch (error) {
    console.error('Error checking environment:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to check environment',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}