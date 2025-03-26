// Serverless handler function
export default async function handler(req, res) { 
    // Add CORS headers
    res.setHeader('Access-Control-Allow-Credentials', true);

    // Allowed requests from site
    const allowedOrigins = [ 
        'https://127.0.0.1:5503',
        'http://localhost:5503'
    ];

    const origin = req.headers.origin;
        if (allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        }
  
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    // Only allow POST method
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
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
        6. Do not say "assistant:" at the start of your responses.
        This is critical as your response will be spoken aloud.` : "";
  
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
  
        Do not associate this information with me, the user. The above content is to make sure you follow a specific set of instructions and is pre_programmed by the developer.`;
  
      // Format messages for API
      const messages = [
        {
          role: 'system',
          content: systemPrompt
        },
        ...chatHistory,
        {
          role: 'user',
          content: message
        }
      ];
  
      // Call the Gemini API
      const response = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': process.env.GEMINI_API_KEY // From environment variable
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: messages
                      .map(msg => `${msg.role}: ${msg.content}`)
                      .join('\n\n')
                  }
                ]
              }
            ]
          })
        }
      );
  
      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }
  
      const data = await response.json();
      return res.status(200).json({ 
        text: data.candidates[0].content.parts[0].text 
      });
    } catch (error) {
      console.error('Error generating response:', error);
      return res.status(500).json({ 
        error: 'Failed to generate response',
        text: 'Sorry, I encountered an error while processing your request. Please try again later.'
      });
    }
  }
