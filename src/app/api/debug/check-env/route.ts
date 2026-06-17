import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    anthropic: {
      configured: !!process.env.ANTHROPIC_API_KEY,
      hasValue: process.env.ANTHROPIC_API_KEY ? 'Yes (hidden)' : 'No'
    },
    huggingface: {
      configured: !!process.env.HUGGING_FACE_API_TOKEN,
      hasValue: process.env.HUGGING_FACE_API_TOKEN ? 'Yes (hidden)' : 'No'
    }
  });
}