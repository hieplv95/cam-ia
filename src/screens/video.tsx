import { Shell } from '@/src/admin/Shell';
import { useT } from '@/src/i18n';
import { VideoMaker } from '@/src/video/VideoMaker';

/** /video: AI video for everyone (a couple of free videos without an account, see src/server/videoJobs.ts). */
export default function VideoPage() {
  const t = useT();
  return (
    <Shell title={t('video.title')}>
      <VideoMaker />
    </Shell>
  );
}
