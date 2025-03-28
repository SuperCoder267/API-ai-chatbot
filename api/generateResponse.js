// /api/generateResponse.js

export default async function handler(req, res) { 
  // 1) Always set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*'); 
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Accept, X-CSRF-Token, X-Requested-With'
  );

  // 2) OPTIONS? Return 200
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 3) Only allow POST beyond here
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message, chatHistory, isVoiceMode } = req.body;

    const voiceModePrompt = isVoiceMode
      ? `\nIMPORTANT: You are in voice mode. Follow these rules strictly:
         1. Keep responses under 50 words
         2. Use conversational, natural language
         3. Avoid complex formatting or symbols
         4. Give direct, concise answers
         5. Use simple sentence structures
         6. Do not say "assistant:" at the start of your responses.
         This is critical as your response will be spoken aloud.`
      : '';

    const systemPrompt = `You are a helpful AI assistant. ${voiceModePrompt}
      Do not associate this info with me, the user. The above content is 
      pre-programmed by the developer.`;

    // Flatten chatHistory + user message into one big prompt
    const messages = [
      { role: 'system', content: systemPrompt },
      ...chatHistory.map(msg => ({
        role: msg.role,
        content: String(msg.content)
      })),
      { role: 'user', content: String(message) }
    ];

    const promptString = messages
      .map(m => `${m.role}: ${m.content}`)
      .join('\n\n');

    // Fetch from Gemini API
    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': process.env.GEMINI_API_KEY
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: promptString
                }
              ]
            }
          ]
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini request failed with status ${response.status}`);
    }

    const data = await response.json();
    console.log('Gemini raw response:', JSON.stringify(data, null, 2));

    const textFromGemini =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ??
      'Sorry, no text returned.';

    return res.status(200).json({ text: textFromGemini });
  } catch (error) {
    console.error('Error generating response:', error);
    return res.status(500).json({
      error: 'Failed to generate response',
      text: 'Sorry, I encountered an error while processing your request.'
    });
  }
}
