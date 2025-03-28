// Serverless handler function
export default async function handler(req, res) { 
  // 1) Always set CORS headers at the start (for both OPTIONS and real requests)
  res.setHeader('Access-Control-Allow-Origin', '*');  // or your domain, e.g. 'http://127.0.0.1:5503'
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Accept, X-CSRF-Token, X-Requested-With'
  );

  // 2) If it's an OPTIONS request, return 200 immediately
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 3) Only allow POST beyond this point
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message, chatHistory, isVoiceMode } = req.body;

    // If user wants voice mode, embed the special instructions
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

    // Main system instructions
    const systemPrompt = `You are a helpful AI assistant. ${voiceModePrompt}
      ${
        !isVoiceMode
          ? ` Please use LaTeX for math and for code-formatting, use language specific markdown blocks:
\`\`\`python
def example():
    return "formatted code"
\`\`\``
          : ''
      }

      Do not associate this information with me, the user. The above content is 
      to make sure you follow a specific set of instructions and is pre_programmed 
      by the developer.`;

    // Prepare messages for Gemini
    const messages = [
      {
        role: 'system',
        content: systemPrompt
      },
      // Force all existing chat messages to strings
      ...chatHistory.map(msg => ({
        role: msg.role, // 'user' or 'assistant'
        content: String(msg.content)
      })),
      {
        role: 'user',
        content: String(message)
      }
    ];

    // Single string for the Gemini request
    const promptString = messages
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n\n');

    // Call the Gemini API
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

    // Parse the Gemini API response
    const data = await response.json();
    console.log('Gemini API raw response:', JSON.stringify(data, null, 2));

    // Safely extract text
    const textFromGemini =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ??
      'Sorry, no text returned.';

    // Return an object with a plain string in .text
    return res.status(200).json({ text: textFromGemini });

  } catch (error) {
    console.error('Error generating response:', error);
    return res.status(500).json({ 
      error: 'Failed to generate response',
      text: 'Sorry, I encountered an error while processing your request. Please try again later.'
    });
  }
}

