import { LegalPage, type LegalSet } from '@/src/legal/LegalPage';
import docs from '@/src/legal/privacy.json';

/** Privacy policy: https://camia.app/privacy (Google Play's privacy policy link). */
export default function Privacy() {
  return <LegalPage docs={docs as LegalSet} />;
}
