import { Directory, File, Paths } from 'expo-file-system';

/** Draft pictures live as files in the app's documents folder. */
const dir = () => {
  const d = new Directory(Paths.document, 'drafts');
  if (!d.exists) d.create({ idempotent: true, intermediates: true });
  return d;
};

export async function putBlob(key: string, bytes: Uint8Array) {
  const file = new File(dir(), `${key}.jpg`);
  if (file.exists) file.delete();
  file.create();
  file.write(bytes);
}

export async function getBlob(key: string): Promise<Uint8Array | null> {
  const file = new File(dir(), `${key}.jpg`);
  return file.exists ? file.bytes() : null;
}

export async function deleteBlob(key: string) {
  const file = new File(dir(), `${key}.jpg`);
  if (file.exists) file.delete();
}
