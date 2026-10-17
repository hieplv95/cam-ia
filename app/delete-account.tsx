import { LegalPage, type LegalSet } from '@/src/legal/LegalPage';
import docs from '@/src/legal/delete-account.json';

/** How to delete an account: https://camia.app/delete-account (Google Play's "Delete account URL"). */
export default function DeleteAccount() {
  return <LegalPage docs={docs as LegalSet} />;
}
