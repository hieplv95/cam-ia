import * as ImagePicker from 'expo-image-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { createElement, useCallback, useEffect, useState } from 'react';
import { Image, Platform, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { apiFetch, openAuth, useAccount } from '../account';
import { Button, Card } from '../admin/ui';
import { DEFAULT_VIDEO_SECONDS, MAX_VIDEO_PROMPT, VIDEO_SECONDS, type VideoSeconds } from '../ai/video';
import { encodeBase64, loadPendingPair, resizeImage } from '../editor/imageOps';
import { useT } from '../i18n';
import { colors, font } from '../theme';

const POLL_MS = 6000;
/** Google usually needs one to three minutes; past this the page stops asking. */
const GIVE_UP_MS = 12 * 60_000;

type Quota = { kind: 'guest'; left: number; limit: number } | { kind: 'member'; cost: number; left: number; unlimited: boolean };

/**
 * AI video (/video, and the admin page's Video AI tab): describe the video, optionally add a photo to start from, start it,
 * and the page asks the server every few seconds until the video is ready. Guests get a couple of free videos,
 * then the sign-up sheet opens; members pay points (the server decides, see src/server/videoJobs.ts).
 */
export function VideoMaker() {
  const t = useT();
  const { user } = useAccount();
  const [extra, setExtra] = useState('');
  const [music, setMusic] = useState(true);
  const [seconds, setSeconds] = useState<VideoSeconds>(DEFAULT_VIDEO_SECONDS);
  const [photo, setPhoto] = useState<{ uri: string; base64: string } | null>(null);
  const [job, setJob] = useState<{ id: string; started: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsAccount, setNeedsAccount] = useState(false);
  const [video, setVideo] = useState<{ data: string; mimeType: string } | null>(null);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [now, setNow] = useState(Date.now());
  const busy = !!job;

  const loadQuota = useCallback(() => {
    apiFetch('/api/video')
      .then(({ ok, data }) => ok && data?.quota && setQuota(data.quota))
      .catch(() => {});
  }, []);
  // Signing in or out changes the quota.
  useEffect(loadQuota, [loadQuota, user?.id]);

  useEffect(() => {
    if (!job) return;
    let stopped = false;
    const finish = (msg?: string) => {
      if (msg) setError(msg);
      setJob(null);
    };
    const tick = async () => {
      // Still sending the request (no id yet): only the clock runs.
      if (!job.id) return;
      if (Date.now() - job.started > GIVE_UP_MS) return finish(t('video.timeout'));
      try {
        const { ok, data } = await apiFetch(`/api/video?id=${encodeURIComponent(job.id)}`);
        if (stopped) return;
        if (data?.quota) setQuota(data.quota);
        if (!ok) return finish(data?.error ?? t('common.aiError'));
        if (data.status === 'done') {
          setVideo({ data: data.video, mimeType: data.mimeType });
          finish();
        } else if (data.status === 'failed') finish(data.error);
      } catch {
        // No network for a moment: ask again on the next tick.
      }
    };
    const poll = setInterval(tick, POLL_MS);
    const clock = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      stopped = true;
      clearInterval(poll);
      clearInterval(clock);
    };
  }, [job, t]);

  const pickPhoto = async () => {
    setError(null);
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 });
    const uri = res.canceled ? null : res.assets?.[0]?.uri;
    if (!uri) return;
    try {
      const { image } = await loadPendingPair({ kind: 'uri', uri });
      setPhoto({ uri, base64: encodeBase64(await resizeImage(image, 1280), 90) });
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.cantOpenPhoto'));
    }
  };

  const start = async () => {
    setError(null);
    setNeedsAccount(false);
    setVideo(null);
    const started = Date.now();
    setNow(started);
    setJob({ id: '', started });
    try {
      const { ok, data } = await apiFetch('/api/video', { body: { prompt: extra.trim(), music, seconds, image: photo?.base64 } });
      if (data?.quota) setQuota(data.quota);
      if (!ok) {
        setJob(null);
        setError(data?.error ?? t('common.aiError'));
        if (data?.code === 'login_required') {
          setNeedsAccount(true);
          openAuth({ mode: 'register', reason: data.error });
        }
        return;
      }
      setJob({ id: data.id, started });
    } catch (e) {
      setJob(null);
      setError(e instanceof Error ? e.message : t('common.aiError'));
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
  const quotaText = !quota
    ? null
    : quota.kind === 'guest'
      ? t('video.freeLeft', { left: quota.left, limit: quota.limit })
      : quota.unlimited
        ? t('video.unlimited')
        : t('video.cost', { cost: quota.cost, left: quota.left });

  return (
    <View style={{ gap: 16 }}>
      <Card title={t('video.title')} subtitle={t('video.subtitle')} right={quotaText ? <Text style={styles.quota}>{quotaText}</Text> : undefined}>
        <Text style={styles.label}>{t('video.describe')}</Text>
        <TextInput
          value={extra}
          onChangeText={setExtra}
          editable={!busy}
          maxLength={MAX_VIDEO_PROMPT}
          multiline
          placeholder={t('video.describePlaceholder')}
          placeholderTextColor={colors.textMute}
          style={[styles.input, styles.area]}
        />
        <Text style={[styles.hint, styles.counter]}>{extra.length}/{MAX_VIDEO_PROMPT}</Text>

        <Text style={styles.label}>{t('video.photo')}</Text>
        <View style={styles.photoRow}>
          {photo ? <Image source={{ uri: photo.uri }} style={styles.thumb} /> : null}
          <Button label={photo ? t('video.photoChange') : t('video.photoPick')} icon="image-outline" onPress={pickPhoto} tone="plain" disabled={busy} />
          {photo ? <Button label={t('video.photoRemove')} icon="close" onPress={() => setPhoto(null)} tone="plain" disabled={busy} /> : null}
        </View>
        <Text style={styles.hint}>{t('video.photoHint')}</Text>

        <Text style={styles.label}>{t('video.length')}</Text>
        <View style={styles.chips}>
          {VIDEO_SECONDS.map((n) => (
            <Pressable key={n} onPress={() => setSeconds(n)} disabled={busy} style={[styles.chip, seconds === n && styles.chipOn]}>
              <Text style={[styles.chipText, seconds === n && styles.chipTextOn]}>{n} s</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.switchRow}>
          <Switch value={music} onValueChange={setMusic} disabled={busy} />
          <Text style={styles.hint}>{t('video.music')}</Text>
        </View>

        <View style={styles.actions}>
          <Button label={busy ? t('video.creating', { s: elapsed }) : t('video.create')} icon="videocam-outline" onPress={start} disabled={busy || !extra.trim()} />
          {busy ? <Text style={styles.hint}>{t('video.wait')}</Text> : null}
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {needsAccount && !user ? (
          <View style={styles.actions}>
            <Button label={t('video.signUp')} icon="person-add-outline" onPress={() => openAuth({ mode: 'register' })} />
          </View>
        ) : null}
      </Card>

      {video && (
        <Card title={t('video.result')} right={<Button label={t('video.save')} icon="download-outline" onPress={save} />}>
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
            <Text style={styles.hint}>{t('video.saveNative')}</Text>
          )}
        </Card>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: font.semi, fontSize: 13, color: colors.text, marginTop: 4 },
  hint: { fontFamily: font.regular, fontSize: 12, color: colors.textSoft, lineHeight: 17, flexShrink: 1 },
  quota: { fontFamily: font.semi, fontSize: 12.5, color: colors.goldDeep },
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
  area: { minHeight: 120, maxHeight: 320, textAlignVertical: 'top' },
  counter: { alignSelf: 'flex-end', marginTop: -6 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  actions: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginTop: 4 },
  player: { alignItems: 'center' },
});
