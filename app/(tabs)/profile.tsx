import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState, type ComponentProps } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { deleteAccount, openAuth, refreshAccount, signOut, useAccount } from '@/src/account';
import { useAiModel } from '@/src/ai/client';
import { pointsFor, pointsLeftLabel } from '@/src/ai/credits';
import { modelInfo } from '@/src/ai/models';
import { Dialog } from '@/src/Dialog';
import { getLanguage, languageName, t, useT } from '@/src/i18n';
import { LanguageSheet } from '@/src/LanguageSheet';
import { ModelSheet } from '@/src/ModelPicker';
import { RewardsCard } from '@/src/RewardsCard';
import { photoAuthors } from '@/src/photos';
import { clearRecents, useRecents } from '@/src/recents';
import { cardShadow, colors, font, goldGradient } from '@/src/theme';
import { Screen } from '@/src/ui';

const confirm = (msg: string, onYes: () => void, yesLabel = t('common.delete')) => {
  if (Platform.OS === 'web') {
    if (window.confirm(msg)) onYes();
    return;
  }
  Alert.alert('Cami', msg, [
    { text: t('common.no'), style: 'cancel' },
    { text: yesLabel, style: 'destructive', onPress: onYes },
  ]);
};

function Row({
  icon,
  title,
  value,
  onPress,
}: {
  icon: ComponentProps<typeof Ionicons>['name'];
  title: string;
  value?: string;
  onPress?: () => void;
}) {
  return (
    <Pressable disabled={!onPress} onPress={onPress} style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}>
      <Ionicons name={icon} size={20} color={colors.gold} />
      <Text style={styles.rowTitle}>{title}</Text>
      {value ? <Text style={styles.rowValue}>{value}</Text> : null}
      {onPress ? <Ionicons name="chevron-forward" size={16} color={colors.textMute} /> : null}
    </Pressable>
  );
}

export default function Profile() {
  useT();
  const { recents, reload } = useRecents();
  const router = useRouter();
  const { user, credits, admin, plan } = useAccount();
  const [model] = useAiModel();
  const [picker, setPicker] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [removing, setRemoving] = useState<{ password: string; error?: string } | null>(null);
  const info = modelInfo(model);
  const modelLabel = info ? `${info.name} · ${t('common.points', { n: pointsFor(plan, info.id) })}` : model;
  const resetDay = credits?.kind === 'member' ? credits.resetLabel : '';

  // Credits change when AI is used on other screens; refresh when coming back.
  useFocusEffect(
    useCallback(() => {
      refreshAccount();
    }, []),
  );

  const confirmDelete = async () => {
    if (!removing) return;
    try {
      await deleteAccount(removing.password);
      setRemoving(null);
    } catch (e: any) {
      setRemoving({ ...removing, error: e.message });
    }
  };

  return (
    <Screen>
      <View style={styles.hero}>
        <LinearGradient colors={goldGradient} style={styles.avatar}>
          <Ionicons name="happy-outline" size={40} color={colors.onGold} />
        </LinearGradient>
        <Text style={styles.name}>{user ? user.name || user.email.split('@')[0] : t('profile.guest')}</Text>
        <Text style={styles.sub}>{user ? user.email : t('profile.notSignedIn')}</Text>
        {!user && (
          <Pressable onPress={() => openAuth({ mode: 'register' })} style={({ pressed }) => [{ marginTop: 10 }, pressed && { opacity: 0.85 }]}>
            <LinearGradient colors={goldGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.signUp}>
              <Ionicons name="person-add-outline" size={16} color={colors.onGold} />
              <Text style={styles.signUpText}>{t('profile.signUpCta', { n: plan.monthlyPoints })}</Text>
            </LinearGradient>
          </Pressable>
        )}
      </View>

      <View style={styles.stats}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{recents.length}</Text>
          <Text style={styles.statLabel}>{t('profile.savedPhotos')}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{credits ? pointsLeftLabel(credits) : '–'}</Text>
          <Text style={styles.statLabel}>
            {credits?.kind === 'member' ? t('profile.pointsLeft', { day: resetDay }) : t('profile.freeLeft')}
          </Text>
        </View>
      </View>

      <RewardsCard />

      <View style={styles.group}>
        <Row icon="hardware-chip-outline" title={t('profile.model')} value={modelLabel} onPress={() => setPicker(true)} />
        <Row
          icon="sparkles-outline"
          title={credits?.kind === 'member' ? t('profile.pointsRow', { n: plan.monthlyPoints }) : t('profile.trialRow')}
          value={
            credits
              ? credits.kind === 'member'
                ? credits.bonus
                  ? t('profile.pointsValueBonus', { n: pointsLeftLabel(credits), bonus: credits.bonus })
                  : t('profile.pointsValue', { n: pointsLeftLabel(credits) })
                : t('profile.triesValue', { left: credits.left, limit: credits.limit })
              : undefined
          }
        />
        <Row icon="language-outline" title={t('profile.language')} value={languageName(getLanguage())} onPress={() => setLangOpen(true)} />
        <Row icon="shield-checkmark-outline" title={t('profile.privacy')} />
        <Row
          icon="trash-outline"
          title={t('profile.clearRecents')}
          onPress={() => confirm(t('profile.clearRecentsConfirm'), () => clearRecents().then(reload))}
        />
        <Row icon="shield-checkmark-outline" title={t('legal.privacy')} onPress={() => router.push('/privacy')} />
        <Row icon="document-text-outline" title={t('legal.terms')} onPress={() => router.push('/terms')} />
        <Row icon="information-circle-outline" title={t('profile.version')} value={Constants.expoConfig?.version ?? '1.0.0'} />
        {/* Only for the team (emails in ADMIN_EMAILS); the admin page is in Vietnamese. */}
        {admin && <Row icon="stats-chart-outline" title="Quản trị" onPress={() => router.push('/admin')} />}
      </View>

      <View style={styles.group}>
        {user ? (
          <>
            <Row icon="log-out-outline" title={t('profile.signOut')} onPress={() => confirm(t('profile.signOutConfirm'), signOut, t('profile.signOut'))} />
            <Row icon="person-remove-outline" title={t('profile.deleteAccount')} onPress={() => setRemoving({ password: '' })} />
          </>
        ) : (
          <Row icon="log-in-outline" title={t('profile.signIn')} onPress={() => openAuth({ mode: 'login' })} />
        )}
      </View>

      <Dialog
        visible={!!removing}
        title={t('profile.deleteAccountTitle')}
        message={removing?.error ?? t('profile.deleteAccountMsg')}
        input={{ value: removing?.password ?? '', onChange: (password) => setRemoving({ password }), placeholder: t('common.password'), secure: true }}
        onClose={() => setRemoving(null)}
        actions={[
          { label: t('profile.deleteAccount'), destructive: true, onPress: confirmDelete },
          { label: t('common.keep'), onPress: () => setRemoving(null) },
        ]}
      />

      <ModelSheet visible={picker} onClose={() => setPicker(false)} />
      <LanguageSheet visible={langOpen} onClose={() => setLangOpen(false)} />

      <Text style={styles.credits}>{t('profile.photoCredits', { names: photoAuthors.join(', ') })}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', paddingTop: 24, gap: 4 },
  avatar: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  name: { fontFamily: font.serif, fontSize: 28, color: colors.text },
  sub: { fontFamily: font.regular, fontSize: 14, color: colors.textSoft },
  stats: { flexDirection: 'row', gap: 10, marginTop: 8 },
  stat: {
    flex: 1,
    padding: 16,
    borderRadius: 18,
    backgroundColor: colors.surface,
    gap: 4,
    ...cardShadow,
  },
  statValue: { fontFamily: font.serif, fontSize: 28, color: colors.gold },
  statLabel: { fontFamily: font.regular, fontSize: 12, color: colors.textSoft },
  group: { borderRadius: 18, backgroundColor: colors.surface, ...cardShadow },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowTitle: { flex: 1, fontFamily: font.medium, fontSize: 14, color: colors.text },
  credits: { fontFamily: font.regular, fontSize: 11, lineHeight: 16, color: colors.textMute, textAlign: 'center' },
  rowValue: { fontFamily: font.regular, fontSize: 13, color: colors.textSoft },
  signUp: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 10 },
  signUpText: { fontFamily: font.semi, fontSize: 14, color: colors.onGold },
});
