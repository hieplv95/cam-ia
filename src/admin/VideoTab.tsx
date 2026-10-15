import * as ImagePicker from 'expo-image-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { createElement, useEffect, useRef, useState } from 'react';
import { Image, Platform, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { MAX_VIDEO_EXTRA, videoTemplates } from '../ai/video';
import { encodeBase64, loadPendingPair, resizeImage } from '../editor/imageOps';
import { colors, font } from '../theme';
import { checkVideo, startVideo, type VideoJob } from './api';
import { Button, Card } from './ui';

const POLL_MS = 6000;
/** Google usually needs one to three minutes; past this the page stops asking. */
const GIVE_UP_MS = 8 * 60_000;

/**
 * Trying out AI video (Gemini Omni) before it goes into the app: pick a template, optionally a photo of a pet,
 * start it, and the page checks every few seconds until the video is ready. Admin only, no points taken.
 */
export function VideoTab() {
  const [template, setTemplate] = useState(videoTemplates[0].id);
  const [extra, setExtra] = useState('');
  const [music, setMusic] = useState(true);
  const [photo, setPhoto] = useState<{ uri: string; base64: string } | null>(null);
  const [job, setJob] = useState<(VideoJob & { started: number }) | null>(null);
  const [state, setState] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [video, setVideo] = useState<{ data: string; mimeType: string; seconds: number } | null>(null);
  const [now, setNow] = useState(Date.now());
  const busy = !!job;
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!job) return;
    let stopped = false;
    const tick = async () => {
      setNow(Date.now());
      if (Date.now() - job.started > GIVE_UP_MS) {
        setError('Quá 8 phút vẫn chưa xong, trang ngừng chờ. Xem log máy chủ (pm2 logs camia).');
        setJob(null);
        return;
      }
      try {
        const r = await checkVideo(job.id, job.source);
        if (stopped) return;
        if (r.status === 'running') setState(r.state);
        else {
          if (r.status === 'done') setVideo({ data: r.video, mimeType: r.mimeType, seconds: Math.round((Date.now() - job.started) / 1000) });
          else setError(r.error);
          setJob(null);
        }
      } catch (e) {
        if (!stopped) setState(`đang thử lại (${e instanceof Error ? e.message : e})`);
      }
    };
    timer.current = setInterval(tick, POLL_MS);
    const clock = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      stopped = true;
      if (timer.current) clearInterval(timer.current);
      clearInterval(clock);
    };
  }, [job]);

  const pickPhoto = async () => {
    setError(null);
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 });
    const uri = res.canceled ? null : res.assets?.[0]?.uri;
    if (!uri) return;
    try {
      const { image } = await loadPendingPair({ kind: 'uri', uri });
      setPhoto({ uri, base64: encodeBase64(await resizeImage(image, 1280), 90) });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const start = async () => {
    setError(null);
    setVideo(null);
    setState('đang gửi');
    try {
      const j = await startVideo({ template, extra: extra.trim(), music, image: photo?.base64 });
      setJob({ ...j, started: Date.now() });
      setState('queued');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setState('');
    }
  };

  const save = async () => {
    if (!video) return;
    if (Platform.OS === 'web') {
      const a = document.createElement('a');
      a.href = `data:${video.mimeType};base64,${video.data}`;
      a.download = `camia-video-${Date.now()}.mp4`;
      a.click();
      return;
    }
    const file = new File(Paths.cache, `camia-video-${Date.now()}.mp4`);
    file.write(Uint8Array.from(atob(video.data), (c) => c.charCodeAt(0)));
    await Sharing.shareAsync(file.uri, { mimeType: video.mimeType });
  };

  const elapsed = job ? Math.round((now - job.started) / 1000) : 0;
  const custom = template === 'custom';

  return (
    <View style={{ gap: 16 }}>
      <Card
        title="Video AI (chạy thử)"
        subtitle="Model Gemini Omni trên nguồn AI đang dùng. Chỉ admin thấy, không trừ điểm, nhưng Google vẫn tính tiền mỗi video vào nguồn AI."
      >
        <Text style={styles.label}>Mẫu</Text>
        <View style={styles.chips}>
          {videoTemplates.map((t) => (
            <Pressable key={t.id} onPress={() => setTemplate(t.id)} disabled={busy} style={[styles.chip, template === t.id && styles.chipOn]}>
              <Text style={[styles.chipText, template === t.id && styles.chipTextOn]}>{t.label}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Ảnh thú cưng (không bắt buộc)</Text>
        <View style={styles.photoRow}>
          {photo ? <Image source={{ uri: photo.uri }} style={styles.thumb} /> : null}
          <Button label={photo ? 'Đổi ảnh' : 'Chọn ảnh'} icon="image-outline" onPress={pickPhoto} tone="plain" disabled={busy} />
          {photo ? <Button label="Bỏ ảnh" icon="close" onPress={() => setPhoto(null)} tone="plain" disabled={busy} /> : null}
        </View>
        <Text style={styles.hint}>Không chọn ảnh thì AI tự vẽ hai con mèo (cam trắng và xám) như video mẫu.</Text>

        <Text style={styles.label}>{custom ? 'Mô tả video' : 'Yêu cầu thêm (không bắt buộc)'}</Text>
        <TextInput
          value={extra}
          onChangeText={setExtra}
          editable={!busy}
          maxLength={MAX_VIDEO_EXTRA}
          multiline
          placeholder={custom ? 'VD: chú chó corgi lướt ván trên biển, quay chậm' : 'VD: nền là bãi biển lúc hoàng hôn'}
          placeholderTextColor={colors.textMute}
          style={[styles.input, styles.area]}
        />

        <View style={styles.switchRow}>
          <Switch value={music} onValueChange={setMusic} disabled={busy} />
          <Text style={styles.hint}>Có nhạc nền (tắt nếu định chọn nhạc trend trên TikTok)</Text>
        </View>

        <View style={styles.actions}>
          <Button label={busy ? `Đang tạo… ${elapsed}s` : 'Tạo video'} icon="videocam-outline" onPress={start} disabled={busy || (custom && !extra.trim())} />
          {busy ? <Text style={styles.hint}>Trạng thái: {state || '…'} · thường mất 1–3 phút, cứ để trang mở.</Text> : null}
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </Card>

      {video && (
        <Card title="Kết quả" subtitle={`Xong sau ${video.seconds} giây · ${(video.data.length * 0.75 / 1024 / 1024).toFixed(1)} MB`} right={<Button label="Tải video" icon="download-outline" onPress={save} />}>
          {Platform.OS === 'web' ? (
            <View style={styles.player}>
              {createElement('video', {
                src: `data:${video.mimeType};base64,${video.data}`,
                controls: true,
                autoPlay: true,
                loop: true,
                playsInline: true,
                style: { width: '100%', maxHeight: 640, borderRadius: 12, background: '#000' },
              })}
            </View>
          ) : (
            <Text style={styles.hint}>Bấm “Tải video” để mở hoặc chia sẻ video.</Text>
          )}
        </Card>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: font.semi, fontSize: 13, color: colors.text, marginTop: 4 },
  hint: { fontFamily: font.regular, fontSize: 12, color: colors.textSoft, lineHeight: 17, flexShrink: 1 },
  error: { fontFamily: font.medium, fontSize: 13, color: colors.danger },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface2 },
  chipOn: { backgroundColor: colors.goldDeep, borderColor: colors.goldDeep },
  chipText: { fontFamily: font.medium, fontSize: 13, color: colors.text },
  chipTextOn: { color: '#FFFFFF' },
  photoRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10 },
  thumb: { width: 64, height: 64, borderRadius: 10, backgroundColor: colors.bg },
  input: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: font.regular,
    fontSize: 14,
    color: colors.text,
  },
  area: { minHeight: 72, textAlignVertical: 'top' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  actions: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginTop: 4 },
  player: { alignItems: 'center' },
});
