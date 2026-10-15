import { AdminGate } from '@/src/admin/AdminGate';
import { Shell } from '@/src/admin/Shell';
import { VideoTab } from '@/src/admin/VideoTab';

/** /video: the AI video trial on its own page (admin only, same as the admin page's Video AI tab). */
export default function VideoPage() {
  return (
    <AdminGate title="Video AI">
      <Shell title="Video AI" subtitle="Chạy thử · chỉ admin">
        <VideoTab />
      </Shell>
    </AdminGate>
  );
}
