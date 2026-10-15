import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { openAuth, signOut, useAccount } from '../account';
import { colors, font } from '../theme';
import { Loading, Shell } from './Shell';
import { Button, Card } from './ui';

/**
 * Shows `children` only to accounts listed in ADMIN_EMAILS (the server checks every request anyway);
 * everyone else gets a sign-in card. Used by /admin and /video.
 */
export function AdminGate({ title, children }: { title: string; children: ReactNode }) {
  const { ready, user, admin } = useAccount();

  if (!ready) {
    return (
      <Shell title={title}>
        <Loading />
      </Shell>
    );
  }

  if (!user || !admin) {
    return (
      <Shell title={title}>
        <Card title={user ? 'Không có quyền quản trị' : 'Đăng nhập quản trị'}>
          <Text style={styles.text}>
            {user
              ? `Tài khoản ${user.email} chưa có quyền xem trang này. Thêm email vào ADMIN_EMAILS trong file .env của server rồi khởi động lại server.`
              : 'Đăng nhập bằng tài khoản Cami có email nằm trong ADMIN_EMAILS (file .env của server).'}
          </Text>
          <View style={styles.actions}>
            {user ? (
              <Button label="Đăng nhập tài khoản khác" icon="swap-horizontal" onPress={() => signOut().then(() => openAuth({ mode: 'login' }))} />
            ) : (
              <Button label="Đăng nhập" icon="log-in-outline" onPress={() => openAuth({ mode: 'login' })} />
            )}
          </View>
        </Card>
      </Shell>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  text: { fontFamily: font.regular, fontSize: 14, lineHeight: 21, color: colors.textSoft },
  actions: { flexDirection: 'row', gap: 10 },
});
