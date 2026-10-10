import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { openAuth, signOut, useAccount } from '@/src/account';
import { OverviewTab } from '@/src/admin/OverviewTab';
import { Loading, Shell } from '@/src/admin/Shell';
import { SystemTab } from '@/src/admin/SystemTab';
import { Button, Card, Segmented } from '@/src/admin/ui';
import { UsersTab } from '@/src/admin/UsersTab';
import { colors, font } from '@/src/theme';

type Tab = 'overview' | 'users' | 'system';
const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Tổng quan' },
  { id: 'users', label: 'Khách hàng' },
  { id: 'system', label: 'Hệ thống' },
];

/**
 * Admin dashboard (/admin). Only accounts listed in ADMIN_EMAILS on the server can see the data;
 * the server checks every request, this screen only decides what to show.
 */
export default function Admin() {
  const { ready, user, admin } = useAccount();
  const [tab, setTab] = useState<Tab>('overview');
  const [refresh, setRefresh] = useState(0);

  if (!ready) {
    return (
      <Shell title="Quản trị Cami">
        <Loading />
      </Shell>
    );
  }

  if (!user || !admin) {
    return (
      <Shell title="Quản trị Cami">
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

  return (
    <Shell title="Quản trị Cami" subtitle={user.email} onRefresh={() => setRefresh((n) => n + 1)}>
      <Segmented options={TABS} value={tab} onChange={setTab} />
      {tab === 'overview' && <OverviewTab refresh={refresh} />}
      {tab === 'users' && <UsersTab refresh={refresh} />}
      {tab === 'system' && <SystemTab refresh={refresh} />}
    </Shell>
  );
}

const styles = StyleSheet.create({
  text: { fontFamily: font.regular, fontSize: 14, lineHeight: 21, color: colors.textSoft },
  actions: { flexDirection: 'row', gap: 10 },
});
