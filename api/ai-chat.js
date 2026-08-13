const AI_API_BASE_URL = 'https://api.wsgpolar.me/v1/ai/chat';
const ALLOWED_MODELS = new Set(['llama-3.1-8b-instant', 'meta-llama/llama-3.2-11b-vision-instruct:free']);

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.AI_API_KEY;
  const openRouterKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'AI service not configured' });
  }

  // Handle stringified bodies cleanly
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (e) {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }
  }

  const { model, messages } = body || {};

  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 20) {
    return res.status(400).json({ error: 'Invalid messages' });
  }

  // Detect if any message content includes an image payload
  let hasImage = false;

  for (const msg of messages) {
    if (!msg || typeof msg.role !== 'string') {
      return res.status(400).json({ error: 'Invalid message format' });
    }

    if (typeof msg.content === 'string') {
      if (msg.content.length > 8000) {
        return res.status(400).json({ error: 'Message too long' });
      }
    } else if (Array.isArray(msg.content)) {
      // Vision message payload structure validation
      hasImage = true;
      for (const item of msg.content) {
        if (!item || typeof item.type !== 'string') {
          return res.status(400).json({ error: 'Invalid content block format' });
        }
        if (item.type === 'text' && typeof item.text === 'string' && item.text.length > 8000) {
          return res.status(400).json({ error: 'Message text block too long' });
        }
      }
    } else {
      return res.status(400).json({ error: 'Invalid content type' });
    }
  }

  try {
    let targetUrl;
    let targetHeaders = { 'Content-Type': 'application/json' };
    let payloadModel = model || 'llama-3.1-8b-instant';

    if (hasImage) {
      if (!openRouterKey) {
        return res.status(500).json({ error: 'OpenRouter API key not configured for vision requests' });
      }

      // Route image analysis directly to OpenRouter free vision endpoint
      targetUrl = 'https://openrouter.ai/api/v1/chat/completions';
      targetHeaders['Authorization'] = `Bearer ${openRouterKey}`;
      targetHeaders['HTTP-Referer'] = 'https://zeta.wsgpolar.me';
      targetHeaders['X-Title'] = 'zeta';
      
      // Override target model to OpenRouter's free Llama Vision model
      payloadModel = 'meta-llama/llama-3.2-11b-vision-instruct:free';
    } else {
      // Standard text route to your primary proxy target
      if (!ALLOWED_MODELS.has(payloadModel)) {
        return res.status(400).json({ error: 'Invalid model' });
      }
      targetUrl = `${AI_API_BASE_URL}?API=${encodeURIComponent(apiKey)}`;
    }

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: targetHeaders,
      body: JSON.stringify({ 
        model: payloadModel, 
        messages: messages 
      })
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    console.error('AI Route Error:', error);
    return res.status(500).json({ error: error.message || 'AI request failed' });
  }
};

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb', // Increases max payload size for Base64 images
    },
  },
};
