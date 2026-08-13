const AI_API_BASE_URL = 'https://api.wsgpolar.me/v1/ai/chat';
const ALLOWED_MODELS = new Set(['llama-3.1-8b-instant']);

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.AI_API_KEY;
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

  if (!model || !ALLOWED_MODELS.has(model)) {
    return res.status(400).json({ error: 'Invalid model' });
  }

  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 20) {
    return res.status(400).json({ error: 'Invalid messages' });
  }

  for (const msg of messages) {
    if (!msg || typeof msg.role !== 'string' || typeof msg.content !== 'string') {
      return res.status(400).json({ error: 'Invalid message format' });
    }
    if (msg.content.length > 8000) {
      return res.status(400).json({ error: 'Message too long' });
    }
  }

  try {
    // Append the API key as a query parameter
    const targetUrl = `${AI_API_BASE_URL}?API=${encodeURIComponent(apiKey)}`;

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ model, messages })
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    console.error('AI Route Error:', error);
    return res.status(500).json({ error: error.message || 'AI request failed' });
  }
};
