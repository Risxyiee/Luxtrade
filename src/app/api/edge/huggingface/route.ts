export const runtime = "edge"
import { NextRequest, NextResponse } from 'next/server';


export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { model, imageDataUrl, prompt, parameters } = body;

    if (!imageDataUrl || !prompt) {
      return NextResponse.json(
        { error: 'imageDataUrl and prompt are required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.HUGGING_FACE_API_TOKEN;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'HUGGING_FACE_API_TOKEN not configured' },
        { status: 500 }
      );
    }

    const hfModel = model || 'Qwen/Qwen2-VL-2B-Instruct';
    const hfApiUrl = `https://api-inference.huggingface.co/models/${hfModel}`;

    console.log(`[Edge HF] Calling: ${hfApiUrl}`);

    const response = await fetch(hfApiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: {
          image: imageDataUrl,
          question: prompt,
        },
        parameters: parameters || {
          max_new_tokens: 2048,
          temperature: 0.1,
          return_full_text: false,
        },
      }),
      signal: AbortSignal.timeout(60000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `HuggingFace API error (${response.status}): ${errorText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    let analyzedText = '';

    if (Array.isArray(data)) {
      analyzedText = data[0]?.generated_text || data[0]?.text || '';
    } else if (typeof data === 'object') {
      analyzedText = data.generated_text || data.text || data.answer || '';
    } else if (typeof data === 'string') {
      analyzedText = data;
    }

    if (!analyzedText || analyzedText.trim().length === 0) {
      return NextResponse.json(
        { error: 'Empty response from HuggingFace model' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      text: analyzedText,
      raw: data,
    });

  } catch (error: any) {
    console.error('[Edge HF] Error:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}
