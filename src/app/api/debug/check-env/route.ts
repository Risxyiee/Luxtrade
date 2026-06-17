import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    ai_services: {
      huggingface_vision: {
        name: 'HuggingFace Vision API',
        status: process.env.HUGGING_FACE_API_TOKEN ? 'Configured ✅' : 'Not configured ❌',
        type: 'FREE',
        required: true,
        description: 'Used for Auto-Journal trade data extraction'
      },
      anthropic_claude: {
        name: 'Claude Vision API',
        status: 'Disabled (Using FREE HuggingFace only) ⏸️',
        type: 'Paid',
        required: false,
        description: 'Not needed - using free HuggingFace Vision API'
      }
    },
    supabase: {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Configured ✅' : 'Not configured ❌',
      service_role: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Configured ✅' : 'Not configured ❌'
    }
  });
}