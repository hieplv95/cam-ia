import { LegalPage, type LegalSet } from '@/src/legal/LegalPage';
import docs from '@/src/legal/terms.json';

/** Terms of use: https://camia.app/terms */
export default function Terms() {
  return <LegalPage docs={docs as LegalSet} />;
}
