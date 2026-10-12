import { NextResponse, NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { transcript, contextWindow, systemPrompt, masterSummary } = await req.json();
    
    const apiKey = req.cookies.get('groqApiKey')?.value;
    
    // Validate input
    if (!transcript || transcript.length === 0) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Empty transcript' } },
        { status: 400 }
      );
    }
    
    if (!apiKey) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'API key required' } },
        { status: 401 }
      );
    }
    
    // Slice transcript based on contextWindow (batches of utterances)
    const windowSize = contextWindow || 10;
    const recentTranscript = transcript.slice(-windowSize);
    
    // Convert transcript array to a readable text block
    const transcriptText = recentTranscript.map((t: any) => `[${t.timestamp}] ${t.text}`).join('\n');
    
    const defaultSystemPrompt = `You are an expert AI meeting copilot. 
Your job is to read the live transcript of a meeting and generate exactly 3 highly relevant suggestions.
The suggestions must be based ONLY on the provided transcript.
You MUST output your response in JSON format exactly matching this schema:
{
  "suggestions": [
    { "type": "question" | "talking" | "answer" | "fact", "text": "The suggestion text..." }
  ]
}

- "question": A insightful question the user should ask right now based on what was just said.
- "talking": A relevant talking point to push the conversation forward.
- "answer": A factual answer to a question someone just asked in the transcript.
- "fact": A relevant fact-check or piece of context to support exactly what was just said.

Generate exactly 3 suggestions that provide the highest value to the user.`;

    const finalSystemPrompt = systemPrompt || defaultSystemPrompt;

    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: finalSystemPrompt },
          { role: 'user', content: `Current Live Transcript (Recent Context):\n\n${transcriptText}\n\nGenerate 3 suggestions in JSON format.` }
        ],
        temperature: 0.5,
        response_format: { type: 'json_object' }
      })
    });

    if (!groqResponse.ok) {
      const errorData = await groqResponse.json();
      console.error('Groq API Error:', errorData);
      return NextResponse.json(
        { error: { code: 'GROQ_API_ERROR', message: 'Failed to generate suggestions' } },
        { status: groqResponse.status }
      );
    }

    const completion = await groqResponse.json();
    const resultObj = JSON.parse(completion.choices[0].message.content);
    
    // Validate output structure safely
    const suggestions = resultObj.suggestions || resultObj.items || resultObj;
    
    return NextResponse.json({ suggestions: Array.isArray(suggestions) ? suggestions.slice(0, 3) : [] });
  } catch (error) {
    console.error('Suggestions error:', error);
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Failed to process suggestions' } },
      { status: 500 }
    );
  }
}