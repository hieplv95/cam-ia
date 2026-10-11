/**
 * Sets a new password for an account, run on the server (there is no reset by email yet):
 *
 *   node --env-file=.env scripts/reset-password.cjs someone@example.com
 *
 * Asks for the new password (not shown, not kept in the shell history) and signs the account out everywhere.
 * Same hash format as src/server/password.ts.
 */
const path = require('node:path');
const readline = require('node:readline');
const { randomBytes, scryptSync } = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

const email = (process.argv[2] ?? '').trim().toLowerCase();
if (!email.includes('@')) {
  console.log('Cách dùng: node --env-file=.env scripts/reset-password.cjs email@cua-ban.com');
  process.exit(1);
}

const file = path.join(process.env.CAMI_DATA_DIR ?? path.join(process.cwd(), 'data'), 'cami.db');
const db = new DatabaseSync(file);
const user = db.prepare('SELECT id, email, disabled FROM users WHERE email = ? COLLATE NOCASE').get(email);
if (!user) {
  const n = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
  console.log(`Không có tài khoản ${email} trong ${file} (máy chủ này có ${n} tài khoản).`);
  console.log('Hãy bấm "Đăng ký" trong app/web với email này: email trong ADMIN_EMAILS tự có quyền quản trị.');
  process.exit(1);
}

// One interface for both questions (a second one would lose input that is already buffered).
const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
let echo = true;
// Show the question, hide what is typed.
rl._writeToOutput = (text) => {
  if (echo) process.stdout.write(text);
  else if (text.includes('\n')) process.stdout.write('\n');
};
// Lines typed (or pasted) before the next question is asked wait here instead of being lost.
const lines = [];
const waiting = [];
rl.on('line', (line) => (waiting.length ? waiting.shift()(line) : lines.push(line)));
/** Reads a line without echoing what is typed. */
const askHidden = (question) => {
  process.stdout.write(question);
  echo = false;
  return new Promise((resolve) => (lines.length ? resolve(lines.shift()) : waiting.push(resolve)));
};

(async () => {
  const password = await askHidden(`Mật khẩu mới cho ${user.email}: `);
  if (password.length < 6 || password.length > 128) {
    console.log('Mật khẩu cần từ 6 đến 128 ký tự. Chưa đổi gì.');
    process.exit(1);
  }
  const again = await askHidden('Nhập lại mật khẩu mới: ');
  rl.close();
  if (again !== password) {
    console.log('Hai lần nhập không giống nhau. Chưa đổi gì.');
    process.exit(1);
  }
  const salt = randomBytes(16);
  const hash = `scrypt$${salt.toString('base64')}$${scryptSync(password, salt, 64).toString('base64')}`;
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, user.id);
  const out = db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id).changes;
  console.log(`Đã đổi mật khẩu cho ${user.email} (đăng xuất ${out} phiên cũ).`);
  if (user.disabled) console.log('Lưu ý: tài khoản này đang bị khoá; mở khoá trong trang quản trị › Khách hàng.');
})();
