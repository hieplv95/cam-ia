import { AiError, type TextResult } from './gemini';

/**
 * Claude (Anthropic Messages API) for writing blog articles. Key: CAMI_CLAUDE_API_KEY in .env (server only).
 * Its own name on purpose: a machine-wide ANTHROPIC_API_KEY (set for other tools) must never be billed by mistake.
 * Plain fetch, no SDK. When a model is overloaded the next one in CLAUDE_FALLBACKS is tried.
 */

const API = 'https://api.anthropic.com/v1/messages';
const CLAUDE_FALLBACKS = ['claude-opus-5-5', 'claude-sonnet-5-5'];

const claudeKey = () => process.env.CAMI_CLAUDE_API_KEY?.trim() ?? '';

export const hasClaude = () => !!claudeKey();

/** Anthropic's error → the app's message keys (shown translated on the admin page). */
function classify(status: number, text: string): { key: ConstructorParameters<typeof AiError>[0]; tryNext: boolean } {
  if (status === 401 || status === 403) return { key: 'server.aiNoAccess', tryNext: false };
  if (/credit balance is too low|billing/i.test(text)) return { key: 'server.aiNoCredit', tryNext: false };
  if (status === 404 || (status === 400 && /not_found_error|model/i.test(text))) return { key: 'server.aiNoModel', tryNext: true };
  if (status === 429 || status === 529 || status >= 500) return { key: 'server.aiBusy', tryNext: true };
  return { key: 'common.aiError', tryNext: false };
}

export async function claudeText(prompt: string, system: string, opts: { model?: string; timeoutMs?: number; maxTokens?: number } = {}): Promise<TextResult> {
  const key = claudeKey();
  if (!key) throw new AiError('server.noAiSource', 'claude: CAMI_CLAUDE_API_KEY missing', 500);
  const models = [...new Set([opts.model, ...CLAUDE_FALLBACKS].filter(Boolean) as string[])];
  let last: AiError | null = null;
  for (const model of models) {
    let res: Response;
    try {
      res = await fetch(API, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model, max_tokens: opts.maxTokens ?? 16_000, system, messages: [{ role: 'user', content: prompt }] }),
        signal: AbortSignal.timeout(opts.timeoutMs ?? 240_000),
      });
    } catch (e) {
      const raw = e instanceof Error ? `${e.name} ${e.message}` : String(e);
      console.error(`[claude] ${model} failed:`, raw.slice(0, 200));
      last = new AiError(/Timeout|abort/i.test(raw) ? 'server.aiTimeout' : 'common.aiError', `claude: ${raw}`, 504);
      continue;
    }
    const text = await res.text();
    if (!res.ok) {
      const { key: msg, tryNext } = classify(res.status, text);
      console.error(`[claude] ${model} HTTP ${res.status}:`, text.slice(0, 300));
      last = new AiError(msg, `claude: ${text}`, res.status === 401 ? 401 : 502);
      if (tryNext) continue;
      throw last;
    }
    const data = JSON.parse(text);
    const out = (data.content ?? [])
      .filter((b: { type: string }) => b.type === 'text')
      .map((b: { text: string }) => b.text)
      .join('');
    if (!out.trim()) throw new AiError('server.aiCantDo', `claude: ${JSON.stringify(data.stop_reason ?? '')}`, 422);
    if (data.stop_reason === 'max_tokens') console.warn(`[claude] ${model} hit max_tokens`);
    return { text: out, model: data.model ?? model, source: 'anthropic', inTokens: Number(data.usage?.input_tokens ?? 0), outTokens: Number(data.usage?.output_tokens ?? 0) };
  }
  throw last ?? new AiError('common.aiError', 'claude:', 502);
}

/** Admin-page (Vietnamese) message for a failed Claude call; null when the error didn't come from Claude. */
export function claudeErrorText(e: unknown): string | null {
  if (!(e instanceof AiError) || !e.raw.startsWith('claude:')) return null;
  switch (e.key) {
    case 'server.noAiSource':
      return 'Server chưa có CAMI_CLAUDE_API_KEY trong .env.';
    case 'server.aiNoAccess':
      return 'Khoá Claude (CAMI_CLAUDE_API_KEY) không đúng hoặc đã bị xoá: tạo khoá mới ở console.anthropic.com.';
    case 'server.aiNoCredit':
      return 'Tài khoản Anthropic hết credit: nạp thêm ở console.anthropic.com › Billing.';
    case 'server.aiBusy':
      return 'Claude đang quá tải, thử lại sau ít phút (hoặc chọn Sonnet / Gemini Flash).';
    case 'server.aiNoModel':
      return 'Khoá này chưa dùng được model Claude đã chọn.';
    case 'server.aiTimeout':
      return 'Claude trả lời quá lâu, thử lại (hoặc chọn bài ngắn hơn).';
    default:
      return 'Claude không viết được, thử lại.';
  }
}
