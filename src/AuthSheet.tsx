import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { accountState, pendingInvite, refreshAccount, setAuthHandler, signIn, signUp, takeInviteFromLink } from './account';
import { GUEST_FREE_TRIES, MONTHLY_POINTS, REFERRAL_FRIEND_POINTS } from './ai/credits';
import { imageModels } from './ai/models';
import { colors, font, goldGradient } from './theme';
import { t, useT } from './i18n';

type Mode = 'login' | 'register';

/** Mounted once at the root; any screen opens it with openAuth(). */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState<{ reason?: string; mode: Mode } | null>(null);
  useEffect(() => {
    setAuthHandler((r) => setOpen({ reason: r.reason, mode: r.mode ?? 'register' }));
    // Opened from a friend's invite link: offer to sign up with their code right away
    // (not to someone already signed in, e.g. the owner opening their own link).
    takeInviteFromLink().then(async (code) => {
      if (!code) return;
      await refreshAccount();
      if (accountState().user) return;
      setOpen({ mode: 'register', reason: t('auth.invited', { code, n: REFERRAL_FRIEND_POINTS }) });
    });
    return () => setAuthHandler(null);
  }, []);
  return (
    <>
      {children}
      {open && <AuthSheet reason={open.reason} initialMode={open.mode} onClose={() => setOpen(null)} />}
    </>
  );
}

function AuthSheet({ reason, initialMode, onClose }: { reason?: string; initialMode: Mode; onClose: () => void }) {
  useT();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [ref, setRef] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ bonus: number } | null>(null);

  useEffect(() => {
    pendingInvite().then((code) => code && setRef(code));
  }, []);

  const submit = async () => {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      if (mode === 'register') {
        const { referralBonus } = await signUp(email, password, name, ref);
        setDone({ bonus: referralBonus });
      } else {
        await signIn(email, password);
        setDone({ bonus: 0 });
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const perPoints = imageModels.map((m) => `${m.name} ${t('common.points', { n: m.points })}`).join(', ');

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.backdrop} onPress={onClose}>
          <Pressable style={[styles.sheet, { paddingBottom: 20 + insets.bottom }]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.handle} />
            <Pressable hitSlop={8} onPress={onClose} style={styles.close} accessibilityLabel={t('common.close')}>
              <Ionicons name="close" size={18} color={colors.text} />
            </Pressable>

            {done ? (
              <View style={styles.doneBox}>
                <LinearGradient colors={goldGradient} style={styles.doneIcon}>
                  <Ionicons name="sparkles" size={30} color={colors.onGold} />
                </LinearGradient>
                <Text style={styles.title}>{mode === 'register' ? t('auth.welcome') : t('auth.signedIn')}</Text>
                <Text style={styles.sub}>
                  {mode === 'register'
                    ? done.bonus
                      ? t('auth.welcomePointsBonus', { n: MONTHLY_POINTS, bonus: done.bonus })
                      : t('auth.welcomePoints', { n: MONTHLY_POINTS })
                    : t('auth.continueAi')}
                </Text>
                <Pressable onPress={onClose} style={({ pressed }) => [{ alignSelf: 'stretch' }, pressed && { opacity: 0.85 }]}>
                  <LinearGradient colors={goldGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.button}>
                    <Text style={styles.buttonText}>{t('auth.continue')}</Text>
                  </LinearGradient>
                </Pressable>
              </View>
            ) : (
              <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 12 }} showsVerticalScrollIndicator={false}>
                <Text style={styles.title}>{mode === 'register' ? t('auth.createTitle') : t('auth.signInTitle')}</Text>
                {reason ? (
                  <View style={styles.reason}>
                    <Ionicons name="information-circle" size={18} color={colors.goldDeep} />
                    <Text style={styles.reasonText}>{reason}</Text>
                  </View>
                ) : null}

                <View style={styles.perks}>
                  <Perk icon="gift-outline" text={t('auth.perkPoints', { n: MONTHLY_POINTS })} />
                  <Perk icon="hardware-chip-outline" text={t('auth.perkCost', { list: perPoints })} />
                  <Perk icon="color-palette-outline" text={t('auth.perkFree')} />
                </View>

                <View style={styles.tabs}>
                  {(['register', 'login'] as const).map((m) => (
                    <Pressable
                      key={m}
                      onPress={() => {
                        setMode(m);
                        setError(null);
                      }}
                      style={[styles.tab, mode === m && styles.tabActive]}
                    >
                      <Text style={[styles.tabText, mode === m && styles.tabTextActive]}>{m === 'register' ? t('auth.tabRegister') : t('auth.tabLogin')}</Text>
                    </Pressable>
                  ))}
                </View>

                {mode === 'register' && (
                  <TextInput value={name} onChangeText={setName} placeholder={t('auth.namePlaceholder')} placeholderTextColor={colors.textMute} maxLength={40} style={styles.input} />
                )}
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder={t('common.email')}
                  placeholderTextColor={colors.textMute}
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  style={styles.input}
                />
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder={mode === 'register' ? t('auth.newPassword') : t('common.password')}
                  placeholderTextColor={colors.textMute}
                  secureTextEntry
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                  onSubmitEditing={submit}
                  style={styles.input}
                />
                {mode === 'register' && (
                  <TextInput
                    value={ref}
                    onChangeText={(v) => setRef(v.toUpperCase())}
                    placeholder={t('auth.refPlaceholder', { n: REFERRAL_FRIEND_POINTS })}
                    placeholderTextColor={colors.textMute}
                    autoCapitalize="characters"
                    maxLength={16}
                    style={styles.input}
                  />
                )}
                {error ? <Text style={styles.error}>{error}</Text> : null}

                <Pressable disabled={busy || !email || !password} onPress={submit} style={({ pressed }) => [(pressed || busy || !email || !password) && { opacity: 0.6 }]}>
                  <LinearGradient colors={goldGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.button}>
                    {busy ? <ActivityIndicator color={colors.onGold} /> : <Text style={styles.buttonText}>{mode === 'register' ? t('auth.createButton') : t('auth.loginButton')}</Text>}
                  </LinearGradient>
                </Pressable>
                <Text style={styles.foot}>
                  {mode === 'register'
                    ? t('auth.guestTries', { n: GUEST_FREE_TRIES })
                    : t('auth.forgot')}
                </Text>
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Perk({ icon, text }: { icon: 'gift-outline' | 'hardware-chip-outline' | 'color-palette-outline'; text: string }) {
  return (
    <View style={styles.perk}>
      <Ionicons name={icon} size={16} color={colors.gold} />
      <Text style={styles.perkText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(42,32,24,0.4)', justifyContent: 'flex-end', alignItems: 'center' },
  sheet: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '94%',
    backgroundColor: colors.bg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  handle: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: colors.border, marginBottom: 14 },
  close: {
    position: 'absolute',
    top: 14,
    right: 16,
    zIndex: 2,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontFamily: font.serif, fontSize: 24, color: colors.text, paddingRight: 40 },
  sub: { fontFamily: font.regular, fontSize: 14, color: colors.textSoft, textAlign: 'center' },
  reason: { flexDirection: 'row', gap: 8, backgroundColor: colors.goldSoft, borderRadius: 14, padding: 12 },
  reasonText: { flex: 1, fontFamily: font.medium, fontSize: 13, lineHeight: 19, color: colors.text },
  perks: { gap: 8, backgroundColor: colors.surface, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: colors.border },
  perk: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  perkText: { flex: 1, fontFamily: font.regular, fontSize: 13, color: colors.text },
  tabs: { flexDirection: 'row', backgroundColor: colors.surface2, borderRadius: 14, padding: 4 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 11 },
  tabActive: { backgroundColor: colors.surface },
  tabText: { fontFamily: font.medium, fontSize: 14, color: colors.textSoft },
  tabTextActive: { color: colors.text, fontFamily: font.semi },
  input: {
    fontFamily: font.regular,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  error: { fontFamily: font.medium, fontSize: 13, color: colors.danger },
  button: { alignItems: 'center', justifyContent: 'center', borderRadius: 16, paddingVertical: 14, minHeight: 50 },
  buttonText: { fontFamily: font.semi, fontSize: 16, color: colors.onGold },
  foot: { fontFamily: font.regular, fontSize: 12, color: colors.textSoft, textAlign: 'center' },
  doneBox: { alignItems: 'center', gap: 12, paddingVertical: 16 },
  doneIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
});
