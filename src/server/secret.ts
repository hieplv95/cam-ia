import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/**
 * AES-256-GCM for secrets kept in the database (Google Cloud service-account keys, AI Studio API keys).
 * The key comes from CAMI_SECRET in .env, so the database file alone can't reveal them.
 * Changing CAMI_SECRET makes stored keys unreadable: they then have to be added again on the admin page.
 */

export class SecretError extends Error {}

function key() {
  const s = process.env.CAMI_SECRET;
  if (!s || s.length < 16) throw new SecretError('Chưa đặt CAMI_SECRET (≥ 16 ký tự) trong .env nên chưa lưu được khoá bí mật.');
  return createHash('sha256').update(`cami-keys|${s}`).digest();
}

export function encrypt(plain: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), data.toString('base64')].join(':');
}

export function decrypt(sealed: string) {
  const [v, iv, tag, data] = sealed.split(':');
  if (v !== 'v1') throw new SecretError('Dữ liệu mã hoá không hợp lệ.');
  try {
    const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
  } catch (e) {
    if (e instanceof SecretError) throw e;
    throw new SecretError('Không giải mã được khoá đã lưu (CAMI_SECRET đã bị đổi?). Hãy xoá nguồn này và thêm lại.');
  }
}
