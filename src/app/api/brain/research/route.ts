import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/brain/research — Research & deep multi-step reasoning endpoint
 *
 * Provides structured research responses using large language models.
 * Supports two depth modes:
 *
 *   - shallow: Single-pass GPT-4o (or Gemini) with a research-focused system
 *     prompt. Fast, suitable for quick factual lookup and summarization.
 *
 *   - deep: Multi-step reasoning chain. Breaks the query into sub-questions,
 *     reasons over each, then synthesises a final answer with citation notes.
 *     Uses GPT-4o or o-series models where available.
 *
 * Providers (in order):
 *   1. OpenAI GPT-4o (primary)
 *   2. Gemini 1.5 Pro (fallback)
 *
 * Accepts JSON body:
 *   - query (string, required) — the research question
 *   - depth ('shallow' | 'deep', optional, default: 'shallow')
 *   - maxSources (number, optional, default: 5) — requested source count hint
 *
 * Returns:
 *   {
 *     capability,      // 'research_search' | 'deep_research'
 *     executed,
 *     answer,          // main synthesized answer
 *     reasoning,       // array of reasoning steps (deep mode only)
 *     sources,         // array of source notes (model-generated, not live web)
 *     provider,
 *     model,
 *     depth,
 *     latencyMs,
 *   }
 */

const SHALLOW_SYSTEM_PROMPT = `You are a research assistant. Answer the user's question with:
1. A clear, accurate, and well-structured answer
2. Key facts cited inline
3. A short list of likely authoritative sources (provide URLs or author/publication if known, otherwise describe the type of source)
4. A brief reasoning note explaining your answer approach

Format your response as JSON with these keys:
- answer: string (main answer, 2-5 paragraphs)
- sources: string[] (3-6 source references)
- reasoning_note: string (1-2 sentences on your approach)`;

const DEEP_SYSTEM_PROMPT = `You are a deep research analyst. For the user's query, perform a multi-step research process:

Step 1: Break the question into 3-5 specific sub-questions
Step 2: Answer each sub-question with supporting evidence
Step 3: Synthesise all sub-answers into a comprehensive final answer
Step 4: List likely authoritative sources

Format your response as JSON with these keys:
- answer: string (final synthesised answer, 3-7 paragraphs)
- reasoning: string[] (one entry per reasoning step, showing your chain of thought)
- sources: string[] (5-8 source references)
- sub_questions: string[] (the sub-questions you identified)`;

interface ResearchResponse {
  answer: string;
  reasoning?: string[];
  sources?: string[];
  sub_questions?: string[];
  reasoning_note?: string;
}

async function callOpenAI(
  query: string,
  depth: 'shallow' | 'deep',
): Promise<{ response: ResearchResponse; model: string } | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const systemPrompt = depth === 'deep' ? DEEP_SYSTEM_PROMPT : SHALLOW_SYSTEM_PROMPT;
  const model = 'gpt-4o';

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: query },
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) return null;

    const data = await response.json() as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content) as ResearchResponse;
    return { response: parsed, model };
  } catch {
    return null;
  }
}

async function callGemini(
  query: string,
  depth: 'shallow' | 'deep',
): Promise<{ response: ResearchResponse; model: string } | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const systemPrompt = depth === 'deep' ? DEEP_SYSTEM_PROMPT : SHALLOW_SYSTEM_PROMPT;
  const model = 'gemini-1.5-pro';

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: `${systemPrompt}\n\nQuery: ${query}` },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.3,
            responseMimeType: 'application/json',
          },
        }),
      },
    );

    if (!response.ok) return null;

    const data = await response.json() as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;

    const parsed = JSON.parse(text) as ResearchResponse;
    return { response: parsed, model };
  } catch {
    return null;
  }
}

/** Maximum query length to prevent token overflow and ensure reasonable response times. */
const MAX_QUERY_LENGTH = 4000;

export async function POST(request: NextRequest) {
  const start = Date.now();

  try {
    const body = await request.json();
    const {
      query,
      depth = 'shallow',
      maxSources = 5,
    } = body as {
      query?: string;
      depth?: string;
      maxSources?: number;
    };

    // ── Input validation ────────────────────────────────────────────────
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return NextResponse.json(
        { error: 'query is required and must be a non-empty string' },
        { status: 400 },
      );
    }

    if (query.trim().length > MAX_QUERY_LENGTH) {
      return NextResponse.json(
        { error: `query must be ${MAX_QUERY_LENGTH} characters or less` },
        { status: 400 },
      );
    }

    if (!['shallow', 'deep'].includes(depth)) {
      return NextResponse.json(
        { error: "depth must be 'shallow' or 'deep'" },
        { status: 400 },
      );
    }

    const resolvedDepth = depth as 'shallow' | 'deep';
    const capability = resolvedDepth === 'deep' ? 'deep_research' : 'research_search';

    // ── Provider: OpenAI ────────────────────────────────────────────────
    let result = await callOpenAI(query.trim(), resolvedDepth);
    let provider = 'openai';
    let fallbackUsed = false;

    // ── Provider fallback: Gemini ───────────────────────────────────────
    if (!result) {
      result = await callGemini(query.trim(), resolvedDepth);
      provider = 'gemini';
      fallbackUsed = true;
    }

    // ── No provider available ───────────────────────────────────────────
    if (!result) {
      return NextResponse.json(
        {
          capability,
          executed: false,
          error:
            'No research provider is configured. ' +
            'Add OPENAI_API_KEY or GEMINI_API_KEY to enable research capabilities.',
          providers_checked: ['openai', 'gemini'],
        },
        { status: 503 },
      );
    }

    // ── Trim sources to requested max ───────────────────────────────────
    const sources = result.response.sources
      ? result.response.sources.slice(0, maxSources)
      : [];

    return NextResponse.json({
      capability,
      executed: true,
      fallback_used: fallbackUsed,
      answer: result.response.answer ?? '',
      reasoning: result.response.reasoning ?? [],
      sub_questions: result.response.sub_questions ?? [],
      sources,
      reasoning_note: result.response.reasoning_note ?? null,
      provider,
      model: result.model,
      depth: resolvedDepth,
      latencyMs: Date.now() - start,
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'Internal server error', detail: String(err), executed: false },
      { status: 500 },
    );
  }
}
