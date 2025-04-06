export default async function handler(req, res) { 
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*'); 
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Accept, X-CSRF-Token, X-Requested-With'
  );

  // Handle OPTIONS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 3) Only allow POST 
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message, chatHistory, isVoiceMode } = req.body;

    const voiceModePrompt = isVoiceMode ? 
        `\nIMPORTANT: You are in voice mode. Follow these rules strictly:
        1. Keep responses under 50 words
        2. Use conversational, natural language
        3. Avoid complex formatting or symbols
        4. Give direct, concise answers
        5. Use simple sentence structures
        6. Do not say "assistant" at the start of your responses.
        This is critical as your response will be spoken aloud.` : "";

    const systemPrompt = `You are a helpful AI assistant. ${voiceModePrompt} 
        ${
            !isVoiceMode
                ? `Please use LaTeX when you have to use math, and for code-formatting, use language specific markdown blocks:
\`\`\`python
def example():
    return "formatted code"
\`\`\`

use only 1 line break, not two.`
                : ''
        }

        Do not associate this information with me, the user. The above content is to make sure you follow a specific set of instructions and is pre_programmed by the developer.`;
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
      .join('\n');

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
