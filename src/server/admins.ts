import type { AccountUser } from '../ai/credits';

/** Admins are the accounts whose email is listed in ADMIN_EMAILS (comma separated); they sign in like any user. */
export const adminEmails = () =>
  (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

export const isAdmin = (u: AccountUser | null): u is AccountUser => !!u && adminEmails().includes(u.email.toLowerCase());
