import { useState } from 'react';

import { useAccount } from '@/src/account';
import { AdminGate } from '@/src/admin/AdminGate';
import { BlogTab } from '@/src/admin/BlogTab';
import { OverviewTab } from '@/src/admin/OverviewTab';
import { ReportsTab } from '@/src/admin/ReportsTab';
import { Shell } from '@/src/admin/Shell';
import { SystemTab } from '@/src/admin/SystemTab';
import { SeoTab } from '@/src/admin/SeoTab';
import { SettingsTab } from '@/src/admin/SettingsTab';
import { TrafficTab } from '@/src/admin/TrafficTab';
import { Segmented } from '@/src/admin/ui';
import { UsersTab } from '@/src/admin/UsersTab';
import { VideoMaker } from '@/src/video/VideoMaker';

type Tab = 'overview' | 'traffic' | 'users' | 'reports' | 'seo' | 'blog' | 'video' | 'system' | 'settings';
const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Tổng quan' },
  { id: 'traffic', label: 'Truy cập' },
  { id: 'users', label: 'Khách hàng' },
  { id: 'reports', label: 'Báo cáo' },
  { id: 'seo', label: 'SEO' },
  { id: 'blog', label: 'Blog' },
  { id: 'video', label: 'Video AI' },
  { id: 'system', label: 'Hệ thống' },
  { id: 'settings', label: 'Cài đặt' },
];

/**
 * Admin dashboard (/admin). Only accounts listed in ADMIN_EMAILS on the server can see the data;
 * the server checks every request, this screen only decides what to show.
 */
export default function Admin() {
  return (
    <AdminGate title="Quản trị Cami">
      <Dashboard />
    </AdminGate>
  );
}

function Dashboard() {
  const { user } = useAccount();
  const [tab, setTab] = useState<Tab>('overview');
  const [refresh, setRefresh] = useState(0);

  return (
    <Shell title="Quản trị Cami" subtitle={user?.email} onRefresh={() => setRefresh((n) => n + 1)}>
      <Segmented options={TABS} value={tab} onChange={setTab} />
      {tab === 'overview' && <OverviewTab refresh={refresh} />}
      {tab === 'traffic' && <TrafficTab refresh={refresh} />}
      {tab === 'users' && <UsersTab refresh={refresh} />}
      {tab === 'reports' && <ReportsTab refresh={refresh} />}
      {tab === 'seo' && <SeoTab refresh={refresh} />}
      {tab === 'blog' && <BlogTab refresh={refresh} />}
      {tab === 'video' && <VideoMaker />}
      {tab === 'system' && <SystemTab refresh={refresh} />}
      {tab === 'settings' && <SettingsTab refresh={refresh} />}
    </Shell>
  );
}
