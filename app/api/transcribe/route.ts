import { NextResponse, NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { audio, prompt } = await request.json();
    
    // Get API key from cookies
    const apiKey = request.cookies.get('groqApiKey')?.value;
    
    // Validate inputs
    if (!audio) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Invalid audio' } },
        { status: 400 }
      );
    }
    
    if (!apiKey) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'API key required' } },
        { status: 401 }
      );
    }
    
    // Convert base64 audio to buffer
    const audioBuffer = Buffer.from(audio, 'base64');
    
    // Create FormData payload
    const formData = new FormData();
    const blob = new Blob([audioBuffer], { type: 'audio/webm' });
    formData.append('file', blob, 'audio.webm');
    formData.append('model', 'whisper-large-v3');
    formData.append('response_format', 'json');
    formData.append('language', 'en'); // Optional, helps Whisper
    
    if (prompt && prompt.trim() !== '') {
      formData.append('prompt', prompt.trim());
    }
    
    // Call Groq API
    const groqResponse = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: formData,
    });
    
    if (!groqResponse.ok) {
      const errorData = await groqResponse.json();
      console.error('Groq Whisper API Error:', errorData);
      return NextResponse.json(
        { error: { code: 'GROQ_API_ERROR', message: 'Whisper transcription failed', details: errorData } },
        { status: groqResponse.status }
      );
    }
    
    const data = await groqResponse.json();
    
    return NextResponse.json({ text: data.text });
  } catch (error) {
    console.error('Transcription error:', error);
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Transcription processing failed' } },
      { status: 500 }
    );
  }
}