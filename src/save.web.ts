import { t } from './i18n';
export type ImageFormatId = 'jpg' | 'png';
export type SocialApp = 'instagram' | 'tiktok' | 'whatsapp';

const makeFile = (bytes: Uint8Array, format: ImageFormatId) =>
  new File([bytes as BlobPart], `cami-${Date.now()}.${format}`, { type: format === 'png' ? 'image/png' : 'image/jpeg' });

export async function saveImage(bytes: Uint8Array, format: ImageFormatId = 'jpg'): Promise<string> {
  const file = makeFile(bytes, format);
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return t('save.downloaded');
}

export async function shareImage(bytes: Uint8Array, format: ImageFormatId = 'jpg') {
  const file = makeFile(bytes, format);
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: 'Cami' });
  } else {
    await saveImage(bytes, format);
  }
}

/** Browsers can't open native apps with a picture, so these targets are hidden on web. */
export const socialAppsSupported = false;

export async function sendToApp(_app: SocialApp, bytes: Uint8Array, format: ImageFormatId): Promise<string> {
  await shareImage(bytes, format);
  return t('save.shared');
}
