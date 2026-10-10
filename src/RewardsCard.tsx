import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, Share, StyleSheet, Text, View } from 'react-native';

import { getRewards, inviteLink, openAuth, useAccount } from './account';
import { MAX_REFERRALS_PER_MONTH, REFERRAL_FRIEND_POINTS, REFERRAL_INVITER_POINTS, SHARE_POINTS, type Rewards, type SharePlatform } from './ai/credits';
import { cardShadow, colors, font, goldGradient } from './theme';
import { track } from './track';
import { useT } from './i18n';

/**
 * "Nhận thêm điểm thưởng" on the profile: an invite code to share with friends, and a monthly bonus when someone
 * opens the link the user shared on Facebook. The server decides and records every bonus; this card only starts the shares.
 */
export function RewardsCard() {
  const t = useT();
  const { user } = useAccount();
  const [rewards, setRewards] = useState<Rewards | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(() => {
    if (user) getRewards().then(setRewards, () => {});
  }, [user]);
  useEffect(load, [load]);

  const say = (msg: string) => {
    setNote(msg);
    setTimeout(() => setNote(null), 3500);
  };

  if (!user) {
    return (
      <View style={styles.card}>
        <Header />
        <Text style={styles.body}>
          {t('rewards.guestBody', { n: REFERRAL_INVITER_POINTS })}
        </Text>
        <GoldButton icon="person-add-outline" label={t('rewards.guestButton')} onPress={() => openAuth({ mode: 'register' })} />
      </View>
    );
  }

  if (!rewards) {
    return (
      <View style={[styles.card, { alignItems: 'center', paddingVertical: 28 }]}>
        <ActivityIndicator color={colors.gold} />
      </View>
    );
  }

  const link = inviteLink(rewards.code);
  const message = t('rewards.inviteMessage', { code: rewards.code, n: REFERRAL_FRIEND_POINTS, link });

  const copyCode = async () => {
    await Clipboard.setStringAsync(rewards.code);
    say(t('rewards.codeCopied'));
  };

  /** Share sheet on phones (and supporting browsers); elsewhere the message is copied instead. */
  const shareMessage = async (): Promise<'shared' | 'copied' | 'cancelled'> => {
    if (Platform.OS === 'web') {
      if (typeof navigator !== 'undefined' && navigator.share) {
        try {
          await navigator.share({ text: message });
          return 'shared';
        } catch {
          return 'cancelled';
        }
      }
      await Clipboard.setStringAsync(message);
      return 'copied';
    }
    const res = await Share.share({ message });
    return res.action === Share.dismissedAction ? 'cancelled' : 'shared';
  };

  const invite = async () => {
    const r = await shareMessage().catch(() => 'cancelled' as const);
    if (r !== 'cancelled') track('invite_share');
    if (r === 'copied') say(t('rewards.inviteCopied'));
  };

  /** WhatsApp is the main messenger in Latin America: open it with the invite already typed (app on phones, web otherwise). */
  const inviteOnWhatsApp = () => {
    track('invite_whatsapp');
    Linking.openURL(`https://wa.me/?text=${encodeURIComponent(message)}`).catch(() => say(t('rewards.whatsappFailed')));
  };

  const shareOn = async (platform: SharePlatform) => {
    setBusy(platform);
    try {
      // Facebook's share page posts the link (tagged s=fb); points come when someone else opens it.
      track('fb_share');
      await Linking.openURL(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(inviteLink(rewards.code, 'fb'))}`);
      if (!rewards.shared[platform]) say(t('rewards.sharePending', { n: SHARE_POINTS }));
    } catch (e: any) {
      say(e.message ?? t('rewards.shareFailed'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={styles.card}>
      <Header />
      <Text style={styles.body}>{t('rewards.body')}</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('rewards.inviteTitle')}</Text>
        <Text style={styles.small}>
          {t('rewards.inviteBody', { inviter: REFERRAL_INVITER_POINTS, friend: REFERRAL_FRIEND_POINTS })}
        </Text>
        <View style={styles.inviteRow}>
          <Pressable onPress={copyCode} style={({ pressed }) => [styles.code, pressed && { opacity: 0.7 }]} accessibilityLabel={t('rewards.copyCode')}>
            <Text style={styles.codeText}>{rewards.code}</Text>
            <Ionicons name="copy-outline" size={16} color={colors.goldDeep} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <GoldButton icon="share-social-outline" label={t('rewards.inviteButton')} onPress={invite} />
          </View>
        </View>
        <Pressable onPress={inviteOnWhatsApp} style={({ pressed }) => [styles.whatsapp, pressed && { opacity: 0.8 }]}>
          <Ionicons name="logo-whatsapp" size={20} color="#FFFFFF" />
          <Text style={styles.whatsappText}>{t('rewards.whatsapp')}</Text>
        </Pressable>
        <Text style={styles.small}>
          {t('rewards.invitedStats', { n: rewards.invited, points: rewards.referralPoints })}
          {rewards.invitesLeftThisMonth < MAX_REFERRALS_PER_MONTH ? t('rewards.invitesLeft', { n: rewards.invitesLeftThisMonth }) : ''}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('rewards.shareTitle')}</Text>
        <Text style={styles.small}>
          {t('rewards.shareBody', { n: SHARE_POINTS })}
        </Text>
        <View style={styles.shareRow}>
          <ShareButton platform="facebook" claimed={rewards.shared.facebook} busy={busy === 'facebook'} onPress={() => shareOn('facebook')} />
        </View>
        {rewards.shareVisits > 0 && (
          <Text style={styles.small}>{t('rewards.shareVisits', { n: rewards.shareVisits })}</Text>
        )}
      </View>

      {note ? <Text style={styles.note}>{note}</Text> : null}
    </View>
  );
}

function Header() {
  const t = useT();
  return (
    <View style={styles.header}>
      <LinearGradient colors={goldGradient} style={styles.headerIcon}>
        <Ionicons name="gift-outline" size={18} color={colors.onGold} />
      </LinearGradient>
      <Text style={styles.title}>{t('rewards.title')}</Text>
    </View>
  );
}

function GoldButton({ icon, label, onPress }: { icon: 'person-add-outline' | 'share-social-outline'; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [pressed && { opacity: 0.85 }]}>
      <LinearGradient colors={goldGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.gold}>
        <Ionicons name={icon} size={16} color={colors.onGold} />
        <Text style={styles.goldText}>{label}</Text>
      </LinearGradient>
    </Pressable>
  );
}

const brand = {
  facebook: { label: 'Facebook', icon: 'logo-facebook', color: '#1877F2' },
} as const;

function ShareButton({ platform, claimed, busy, onPress }: { platform: SharePlatform; claimed: boolean; busy: boolean; onPress: () => void }) {
  const t = useT();
  const b = brand[platform];
  return (
    <Pressable onPress={onPress} disabled={busy} style={({ pressed }) => [styles.share, pressed && { opacity: 0.8 }]}>
      {busy ? <ActivityIndicator size="small" color={b.color} /> : <Ionicons name={b.icon} size={20} color={b.color} />}
      <View style={{ flex: 1 }}>
        <Text style={styles.shareLabel}>{b.label}</Text>
        <Text style={[styles.shareSub, claimed && { color: colors.textMute }]}>{claimed ? t('rewards.shareClaimed', { n: SHARE_POINTS }) : t('rewards.shareCta', { n: SHARE_POINTS })}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, backgroundColor: colors.surface, padding: 16, gap: 12, ...cardShadow },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: font.semi, fontSize: 16, color: colors.text },
  body: { fontFamily: font.regular, fontSize: 13, lineHeight: 19, color: colors.textSoft },
  section: { gap: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
  sectionTitle: { fontFamily: font.semi, fontSize: 14, color: colors.text },
  small: { fontFamily: font.regular, fontSize: 12, lineHeight: 17, color: colors.textSoft },
  inviteRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  whatsapp: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 999, paddingVertical: 11, backgroundColor: '#25D366' },
  whatsappText: { fontFamily: font.semi, fontSize: 14, color: '#FFFFFF' },
  code: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.gold,
    backgroundColor: colors.goldSoft,
  },
  codeText: { fontFamily: font.bold, fontSize: 15, letterSpacing: 2, color: colors.goldDeep },
  gold: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 11 },
  goldText: { fontFamily: font.semi, fontSize: 14, color: colors.onGold },
  shareRow: { flexDirection: 'row', gap: 10 },
  share: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
  },
  shareLabel: { fontFamily: font.semi, fontSize: 14, color: colors.text },
  shareSub: { fontFamily: font.medium, fontSize: 12, color: colors.goldDeep },
  note: { fontFamily: font.medium, fontSize: 13, color: colors.goldDeep, textAlign: 'center' },
});
