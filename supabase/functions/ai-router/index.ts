const ALLOWED_ORIGINS = new Set([
  'https://dar.ikanisa.com',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173'
]);

const DEFAULT_MODELS = {
  gemini: 'gemini-3-pro',
  openai: 'gpt-5.2',
  anthropic: 'claude-4.5-opus'
} as const;

const corsHeaders = (origin: string | null) => ({
  'Access-Control-Allow-Origin': origin && ALLOWED_ORIGINS.has(origin) ? origin : 'https://dar.ikanisa.com',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
});

const jsonResponse = (data: unknown, status = 200, origin?: string | null) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(origin ?? null)
    }
  });

const readPayload = async (req: Request) => {
  try {
    return await req.json();
  } catch (_) {
    return null;
  }
};

const normalizeMessages = (payload: any) => {
  if (Array.isArray(payload?.messages)) {
    return payload.messages.map((msg: any) => ({
      role: msg.role ?? 'user',
      content: msg.content ?? ''
    }));
  }
  const input = payload?.input ?? payload?.prompt ?? '';
  return [{ role: 'user', content: input }];
};

const ensureModel = (payload: any, envKey: string, defaultModel: string) =>
  payload?.model ?? Deno.env.get(envKey) ?? defaultModel;

const dedupeSources = (sources: Array<{ title?: string; url?: string }>) => {
  const seen = new Set<string>();
  return sources.filter((source) => {
    if (!source?.url) return false;
    if (seen.has(source.url)) return false;
    seen.add(source.url);
    return true;
  });
};

const extractOpenAISources = (data: any) => {
  const sources: Array<{ title?: string; url?: string }> = [];
  const outputs = Array.isArray(data?.output) ? data.output : [];

  for (const item of outputs) {
    if (item?.type === 'web_search_call') {
      const found = item?.action?.sources || item?.sources || [];
      if (Array.isArray(found)) {
        found.forEach((source: any) => {
          sources.push({ title: source?.title, url: source?.url });
        });
      }
    }
  }

  return dedupeSources(sources);
};

const extractGeminiSources = (data: any) => {
  const sources: Array<{ title?: string; url?: string }> = [];
  const candidates = Array.isArray(data?.candidates) ? data.candidates : [];

  for (const candidate of candidates) {
    const grounding = candidate?.groundingMetadata || candidate?.grounding_metadata || null;
    const chunks = grounding?.groundingChunks || grounding?.grounding_chunks || [];
    if (Array.isArray(chunks)) {
      chunks.forEach((chunk: any) => {
        const web = chunk?.web || chunk;
        const url = web?.uri || web?.url;
        const title = web?.title || web?.name;
        sources.push({ title, url });
      });
    }
  }

  return dedupeSources(sources);
};

// Provider-specific call functions
const callGemini = async (payload: any, maxTokens: number, temperature: number) => {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) throw new Error('Missing GEMINI_API_KEY');

  const model = ensureModel(payload, 'GEMINI_MODEL', DEFAULT_MODELS.gemini);
  const messages = normalizeMessages(payload);
  const prompt = messages.map((msg: any) => `${msg.role.toUpperCase()}: ${msg.content}`).join('\n');
  const tools = payload.use_web_search ? [{ google_search: {} }] : undefined;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature, maxOutputTokens: maxTokens },
        tools
      })
    }
  );

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message ?? 'Gemini request failed');
  }

  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  const sources = payload.use_web_search ? extractGeminiSources(data) : [];
  return { provider: 'gemini', model, text, sources, raw: payload.debug ? data : undefined };
};

const callOpenAI = async (payload: any, maxTokens: number, temperature: number) => {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) throw new Error('Missing OPENAI_API_KEY');

  const model = ensureModel(payload, 'OPENAI_MODEL', DEFAULT_MODELS.openai);
  const input = payload.input ?? payload.prompt ?? normalizeMessages(payload);
  const tools = payload.use_web_search ? [{ type: 'web_search' }] : undefined;

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      input,
      temperature,
      max_output_tokens: maxTokens,
      tools,
      include: payload.use_web_search ? ['web_search_call.action.sources'] : undefined
    })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message ?? 'OpenAI request failed');
  }

  const text = data.output_text ?? '';
  const sources = payload.use_web_search ? extractOpenAISources(data) : [];
  return { provider: 'openai', model, text, sources, raw: payload.debug ? data : undefined };
};

const callAnthropic = async (payload: any, maxTokens: number, temperature: number) => {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) throw new Error('Missing ANTHROPIC_API_KEY');

  const model = ensureModel(payload, 'ANTHROPIC_MODEL', DEFAULT_MODELS.anthropic);
  const messages = normalizeMessages(payload);

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature,
      messages
    })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message ?? 'Anthropic request failed');
  }

  const text = data?.content?.[0]?.text ?? '';
  return { provider: 'anthropic', model, text, sources: [], raw: payload.debug ? data : undefined };
};

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders(origin) });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405, origin);
  }

  const payload = await readPayload(req);
  if (!payload) {
    return jsonResponse({ error: 'Invalid JSON payload' }, 400, origin);
  }

  // Default to 'gemini' instead of 'openai'
  const requestedProvider = (payload.provider ?? 'gemini').toLowerCase();
  const maxTokens = payload.max_tokens ?? payload.maxTokens ?? 1024;
  const temperature = payload.temperature ?? 0.4;

  try {
    // Handle 'auto' provider: try Gemini first, fallback to OpenAI
    if (requestedProvider === 'auto') {
      let result;
      try {
        result = await callGemini(payload, maxTokens, temperature);
      } catch (geminiError) {
        // Gemini failed, try OpenAI as fallback
        try {
          result = await callOpenAI(payload, maxTokens, temperature);
        } catch (openaiError) {
          // Both failed
          return jsonResponse(
            { error: `Gemini failed: ${(geminiError as Error).message}; OpenAI fallback also failed: ${(openaiError as Error).message}` },
            500,
            origin
          );
        }
      }
      return jsonResponse(result, 200, origin);
    }

    // Handle specific providers
    if (requestedProvider === 'gemini') {
      const result = await callGemini(payload, maxTokens, temperature);
      return jsonResponse(result, 200, origin);
    }

    if (requestedProvider === 'openai') {
      const result = await callOpenAI(payload, maxTokens, temperature);
      return jsonResponse(result, 200, origin);
    }

    if (requestedProvider === 'anthropic') {
      const result = await callAnthropic(payload, maxTokens, temperature);
      return jsonResponse(result, 200, origin);
    }

    return jsonResponse({ error: `Unsupported provider: ${requestedProvider}` }, 400, origin);
  } catch (error) {
    return jsonResponse({ error: (error as Error)?.message ?? 'Unexpected error' }, 500, origin);
  }
});
