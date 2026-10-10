import { File, Paths } from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { Linking } from 'react-native';
import { t } from './i18n';

export type ImageFormatId = 'jpg' | 'png';

const mime = (format: ImageFormatId) => (format === 'png' ? 'image/png' : 'image/jpeg');

function writeTemp(bytes: Uint8Array, format: ImageFormatId) {
  const file = new File(Paths.cache, `cami-${Date.now()}.${format}`);
  file.write(bytes);
  return file.uri;
}

export async function saveImage(bytes: Uint8Array, format: ImageFormatId = 'jpg'): Promise<string> {
  const { granted } = await MediaLibrary.requestPermissionsAsync(true, ['photo']);
  if (!granted) throw new Error(t('save.permission'));
  await MediaLibrary.saveToLibraryAsync(writeTemp(bytes, format));
  return t('save.saved');
}

export async function shareImage(bytes: Uint8Array, format: ImageFormatId = 'jpg') {
  await Sharing.shareAsync(writeTemp(bytes, format), { mimeType: mime(format), dialogTitle: t('save.shareTitle') });
}

export type SocialApp = 'instagram' | 'tiktok' | 'whatsapp';

const appUrls: Record<SocialApp, string> = {
  instagram: 'instagram://library',
  tiktok: 'snssdk1233://',
  whatsapp: 'whatsapp://',
};

export const socialAppsSupported = true;

/**
 * These apps don't accept a picture handed over by URL, so the picture is saved to the library first
 * and the app is opened for the user to pick it. Falls back to the share sheet when the app is missing.
 */
export async function sendToApp(app: SocialApp, bytes: Uint8Array, format: ImageFormatId): Promise<string> {
  await saveImage(bytes, format);
  try {
    await Linking.openURL(appUrls[app]);
    return t('save.savedPickLatest');
  } catch {
    await shareImage(bytes, format);
    return t('save.savedToLibrary');
  }
}
