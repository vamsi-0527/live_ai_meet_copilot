import { NextResponse, NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { transcript, previousSummary } = await request.json();
    
    const apiKey = request.cookies.get('groqApiKey')?.value;
    
    if (!apiKey) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'API key required' } },
        { status: 401 }
      );
    }

    if (!transcript || transcript.length === 0) {
        return NextResponse.json({ summary: previousSummary });
    }

    // Format transcript context
    const transcriptContext = transcript.map((t: any) => 
      `[${t.timestamp}] ${t.speaker ? `[${t.speaker}] ` : ''}${t.text}`
    ).join('\n');

    const prompt = `You are an AI meeting assistant. Your job is to maintain a "Master Context" summary of an ongoing meeting.
You will be provided with the PREVIOUS SUMMARY and the NEW TRANSCRIPT CHUNKS that just occurred.

Please generate an updated, comprehensive, and concise summary of the entire meeting so far.
Focus on:
1. The main topics discussed.
2. Key decisions made.
3. Important context or facts mentioned.

Keep it highly compressed but informative, as it will be used as context for an AI copilot.

PREVIOUS SUMMARY:
${previousSummary || "None."}

NEW TRANSCRIPT CHUNKS:
${transcriptContext}

Return ONLY the updated summary text. Do not include introductory phrases like "Here is the summary:".`;

    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 1024,
      })
    });

    if (!groqResponse.ok) {
      throw new Error(`Groq API error: ${groqResponse.status}`);
    }

    const data = await groqResponse.json();
    const newSummary = data.choices[0]?.message?.content || "";

    return NextResponse.json({ summary: newSummary.trim() });
  } catch (error) {
    console.error('Summarization error:', error);
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Summarization failed' } },
      { status: 500 }
    );
  }
}
