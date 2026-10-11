import type { NewSource } from '@/src/admin/types';
import { adminOf, aiSettings, audit } from '@/src/server/admin';
import {
  addSource,
  cleanCredit,
  clearAiConfig,
  getAiSources,
  moveSource,
  newToRuntime,
  removeSource,
  setLocation,
  setSourceCredit,
  setSourceEnabled,
  setSourceLabel,
  SourceError,
} from '@/src/server/aiSources';
import { testConnection } from '@/src/server/gemini';
import { SecretError } from '@/src/server/secret';

/** AI sources (Google Cloud projects and API keys) for the admin Settings tab. Keys never leave the server. */
export function GET(request: Request) {
  const admin = adminOf(request);
  if (admin instanceof Response) return admin;
  return Response.json({ settings: aiSettings() });
}

type Body = {
  action?: string;
  id?: string;
  dir?: number;
  enabled?: boolean;
  label?: string;
  credit?: unknown;
  location?: string;
  source?: NewSource;
};

/**
 * One change: add · test (a new source, not saved) · test-all · move · enable · label · credit · remove · location · reset.
 * Answers with the updated settings, plus a message or connection test results.
 */
export async function POST(request: Request) {
  const admin = adminOf(request);
  if (admin instanceof Response) return admin;
  const b = (await request.json().catch(() => ({}))) as Body;
  const id = typeof b.id === 'string' ? b.id : '';
  const log = (detail: string) => audit(admin, 'ai-source', null, detail);
  const reply = (extra: Record<string, unknown> = {}) => Response.json({ settings: aiSettings(), ...extra });

  try {
    switch (b.action) {
      case 'test':
        return reply({ tests: await testConnection([newToRuntime(b.source ?? ({} as NewSource))]) });
      case 'test-all': {
        const sources = getAiSources().sources;
        return reply({ tests: sources.length ? await testConnection(sources) : [], ok: sources.length ? undefined : 'Chưa có nguồn nào.' });
      }
      case 'add': {
        const source = b.source ?? ({} as NewSource);
        const tests = await testConnection([newToRuntime(source)]);
        if (tests.some((t) => !t.ok)) return reply({ tests });
        const name = addSource(source);
        log(`Thêm nguồn AI "${name}"`);
        return reply({ ok: `Đã thêm nguồn "${name}" vào cuối danh sách.` });
      }
      case 'move':
        moveSource(id, b.dir === -1 ? -1 : 1);
        return reply();
      case 'enable': {
        const name = setSourceEnabled(id, !!b.enabled);
        log(`${b.enabled ? 'Bật lại' : 'Tạm tắt'} nguồn AI "${name}"`);
        return reply();
      }
      case 'label':
        setSourceLabel(id, typeof b.label === 'string' ? b.label : '');
        return reply();
      case 'credit': {
        const credit = b.credit === null ? null : cleanCredit(b.credit);
        const name = setSourceCredit(id, credit);
        log(credit ? `Cập nhật số dư "${name}": ${credit.amount} ${credit.currency}` : `Bỏ theo dõi credit "${name}"`);
        return reply();
      }
      case 'remove': {
        const name = removeSource(id);
        log(`Xoá nguồn AI "${name}"`);
        return reply({ ok: `Đã xoá nguồn "${name}".` });
      }
      case 'location':
        setLocation(typeof b.location === 'string' ? b.location : '');
        log(`Đổi khu vực AI thành ${b.location}`);
        return reply();
      case 'reset':
        clearAiConfig();
        log('Bỏ cấu hình nguồn AI trên web, dùng lại .env');
        return reply({ ok: 'Đã quay lại dùng nguồn trong file .env.' });
      default:
        return Response.json({ error: 'Thao tác không hợp lệ.' }, { status: 400 });
    }
  } catch (e) {
    if (e instanceof SourceError || e instanceof SecretError) return Response.json({ error: e.message, settings: aiSettings() }, { status: 400 });
    throw e;
  }
}
