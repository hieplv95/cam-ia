import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';

/**
 * Joins the clips of a 20 / 30 second video into one MP4 with ffmpeg (the ffmpeg-static package brings the binary for
 * Windows, macOS and Linux, so the VPS needs nothing installed). Loaded at run time, not bundled, like CanvasKit.
 */

function ffmpegPath(): string {
  const p = createRequire(path.join(process.cwd(), 'package.json'))('ffmpeg-static') as string | null;
  if (!p) throw new Error('ffmpeg-static has no binary for this system');
  return p;
}

const run = (args: string[]) =>
  new Promise<void>((resolve, reject) =>
    execFile(ffmpegPath(), args, { timeout: 180_000, maxBuffer: 16 * 1024 * 1024 }, (e, _out, err) =>
      e ? reject(new Error(`ffmpeg: ${String(err || e.message).slice(-600)}`)) : resolve(),
    ),
  );

/** The clips (base64 MP4, in order) as one MP4 (base64). */
export async function joinVideos(clips: string[]): Promise<string> {
  if (clips.length === 1) return clips[0];
  const dir = await mkdtemp(path.join(tmpdir(), 'camia-video-'));
  try {
    const files = await Promise.all(
      clips.map(async (b64, i) => {
        const f = path.join(dir, `part${i}.mp4`);
        await writeFile(f, Buffer.from(b64, 'base64'));
        return f;
      }),
    );
    const out = path.join(dir, 'joined.mp4');
    const list = path.join(dir, 'list.txt');
    await writeFile(list, files.map((f) => `file '${f.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`).join('\n'));
    try {
      // Same model, same settings: the clips can usually be joined without re-encoding (instant, no quality loss).
      await run(['-y', '-hide_banner', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', out]);
    } catch {
      // Otherwise re-encode to one common format. Sound is kept when every clip has some.
      const inputs = files.flatMap((f) => ['-i', f]);
      const sound = (await Promise.all(files.map(hasAudioStream))).every(Boolean);
      const scaled = files.map((_, i) => `[${i}:v]scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=24[v${i}]`);
      const audio = sound ? files.map((_, i) => `[${i}:a]aresample=48000[a${i}]`) : [];
      const pairs = files.map((_, i) => `[v${i}]${sound ? `[a${i}]` : ''}`).join('');
      const filter = [...scaled, ...audio, `${pairs}concat=n=${files.length}:v=1:a=${sound ? 1 : 0}${sound ? '[v][a]' : '[v]'}`].join(';');
      await run([
        '-y', '-hide_banner', '-loglevel', 'error', ...inputs, '-filter_complex', filter, '-map', '[v]', ...(sound ? ['-map', '[a]', '-c:a', 'aac', '-b:a', '160k'] : []),
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '21', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out,
      ]);
    }
    return (await readFile(out)).toString('base64');
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/** Whether an MP4 has a sound track (ffmpeg prints the streams when given no output). */
function hasAudioStream(file: string) {
  return new Promise<boolean>((resolve) =>
    execFile(ffmpegPath(), ['-hide_banner', '-i', file], { timeout: 30_000 }, (_e, _out, err) => resolve(/Stream #.*Audio/.test(String(err)))),
  );
}
