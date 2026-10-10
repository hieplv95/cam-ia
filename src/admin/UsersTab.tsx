import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { cardShadow, colors, font } from '../theme';
import { fetchUsers } from './api';
import { date, num, shortDay } from './labels';
import { Failed, Loading } from './Shell';
import type { UserList, UserRow, UserSort } from './types';
import { Badge, Button, Empty, Segmented } from './ui';
import { useLoad } from './useLoad';

const SORTS: { id: UserSort; label: string }[] = [
  { id: 'new', label: 'Mới nhất' },
  { id: 'ai', label: 'Dùng AI nhiều' },
  { id: 'active', label: 'Hoạt động gần đây' },
];

/** Customer accounts: search by email, name or invite code; tap one for details and actions. */
export function UsersTab({ refresh }: { refresh: number }) {
  const router = useRouter();
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<UserSort>('new');
  const [more, setMore] = useState<UserRow[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);

  // Search as the admin types, without a request per key press.
  useEffect(() => {
    const timer = setTimeout(() => setQ(text.trim()), 300);
    return () => clearTimeout(timer);
  }, [text]);

  const { data, error, reload } = useLoad<UserList>(() => fetchUsers(q, sort), [q, sort]);
  useEffect(() => setMore([]), [data]);
  useEffect(() => {
    if (refresh) reload();
  }, [refresh, reload]);

  const users = [...(data?.users ?? []), ...more];
  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const next = await fetchUsers(q, sort, users.length);
      setMore((m) => [...m, ...next.users]);
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <View style={{ gap: 14 }}>
      <View style={styles.search}>
        <Ionicons name="search" size={18} color={colors.textMute} />
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Tìm theo email, tên hoặc mã mời"
          placeholderTextColor={colors.textMute}
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {text ? (
          <Pressable onPress={() => setText('')} hitSlop={8} accessibilityLabel="Xóa tìm kiếm">
            <Ionicons name="close-circle" size={18} color={colors.textMute} />
          </Pressable>
        ) : null}
      </View>
      <View style={styles.toolbar}>
        <Segmented options={SORTS} value={sort} onChange={setSort} />
        {data ? <Text style={styles.total}>{num(data.total)} tài khoản</Text> : null}
      </View>

      {error && !data ? (
        <Failed message={error} onRetry={reload} />
      ) : !data ? (
        <Loading />
      ) : users.length ? (
        <View style={{ gap: 10 }}>
          {users.map((u) => (
            <UserCard key={u.id} u={u} onPress={() => router.push(`/admin/user/${u.id}`)} />
          ))}
          {users.length < data.total && (
            <View style={{ alignItems: 'center' }}>
              <Button label={loadingMore ? 'Đang tải…' : `Tải thêm (${num(data.total - users.length)})`} onPress={loadMore} disabled={loadingMore} tone="plain" />
            </View>
          )}
        </View>
      ) : (
        <Empty text={q ? 'Không tìm thấy tài khoản nào.' : 'Chưa có tài khoản nào.'} />
      )}
    </View>
  );
}

function UserCard({ u, onPress }: { u: UserRow; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && { opacity: 0.75 }]}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{(u.name || u.email).charAt(0).toUpperCase()}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <View style={styles.nameRow}>
          <Text style={styles.email} numberOfLines={1}>
            {u.email}
          </Text>
          {u.admin && <Badge text="Quản trị" tone="gold" />}
          {u.locked && <Badge text="Đã khóa" tone="red" />}
        </View>
        <Text style={styles.meta} numberOfLines={1}>
          {[u.name, `Tạo ${date(u.createdAt)}`, u.lastDay ? `hoạt động ${shortDay(u.lastDay)}` : 'chưa hoạt động', u.invited ? `mời ${u.invited} bạn` : '']
            .filter(Boolean)
            .join(' · ')}
        </Text>
      </View>
      <View style={styles.numbers}>
        <Text style={styles.big}>{num(u.ai)} ảnh</Text>
        <Text style={styles.small}>
          {num(u.points)} điểm{u.bonus ? ` (${num(u.bonus)} thưởng)` : ''}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textMute} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    height: 46,
  },
  input: { flex: 1, fontFamily: font.regular, fontSize: 14.5, color: colors.text, height: '100%' },
  toolbar: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between' },
  total: { fontFamily: font.medium, fontSize: 13, color: colors.textSoft },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    ...cardShadow,
    shadowOpacity: 0.05,
  },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.goldSoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: font.bold, fontSize: 16, color: colors.goldDeep },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  email: { flexShrink: 1, fontFamily: font.semi, fontSize: 14, color: colors.text },
  meta: { fontFamily: font.regular, fontSize: 12, color: colors.textSoft },
  numbers: { alignItems: 'flex-end', gap: 2 },
  big: { fontFamily: font.semi, fontSize: 13.5, color: colors.text },
  small: { fontFamily: font.regular, fontSize: 12, color: colors.textSoft },
});
