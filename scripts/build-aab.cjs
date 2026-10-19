/**
 * Builds the Google Play bundle on this machine (Windows, macOS, Linux): `npm run build:aab`.
 * 1. Regenerates android/ from app.json (prebuild rewrites package.json scripts; they are put back).
 * 2. Runs Gradle bundleRelease against https://camia.app, signed with the upload key from
 *    ~/.gradle/gradle.properties (see plugins/withReleaseSigning.js).
 * 3. Copies the result to builds/camia-<version>-vc<versionCode>.aab.
 * Google Play refuses a versionCode it has already seen, so every run raises expo.android.versionCode in app.json
 * by one first (commit app.json afterwards). A failed build just leaves a gap, which Play accepts.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const run = (cmd, cwd = root, env = process.env) => execSync(cmd, { cwd, env, stdio: 'inherit' });

const props = path.join(require('os').homedir(), '.gradle', 'gradle.properties');
if (!fs.existsSync(props) || !fs.readFileSync(props, 'utf8').includes('CAMIA_UPLOAD_STORE_FILE')) {
  console.error(`No upload key settings in ${props}: the bundle would be signed with the debug key. Stopping.`);
  process.exit(1);
}

const appJsonPath = path.join(root, 'app.json');
const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
const { expo } = appJson;
const version = expo.version;
// No versionCode yet means the first bundle (1) went up already.
const versionCode = (expo.android?.versionCode ?? 1) + 1;
expo.android = { ...expo.android, versionCode };
fs.writeFileSync(appJsonPath, `${JSON.stringify(appJson, null, 2)}\n`);
console.log(`Building CamIA ${version} (versionCode ${versionCode})…`);

const pkgPath = path.join(root, 'package.json');
const pkg = fs.readFileSync(pkgPath, 'utf8');
try {
  run('npx expo prebuild -p android --clean --no-install', root, { ...process.env, CI: '1' });
} finally {
  fs.writeFileSync(pkgPath, pkg);
}

// A full path: cmd.exe does not always look in the current folder.
const android = path.join(root, 'android');
const gradlew = path.join(android, process.platform === 'win32' ? 'gradlew.bat' : 'gradlew');
run(`"${gradlew}" bundleRelease`, android, {
  ...process.env,
  EXPO_PUBLIC_API_URL: 'https://camia.app',
  EXPO_PUBLIC_SHARE_URL: 'https://camia.app',
});

const out = path.join(root, 'android', 'app', 'build', 'outputs', 'bundle', 'release', 'app-release.aab');
const dest = path.join(root, 'builds', `camia-${version}-vc${versionCode}.aab`);
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.copyFileSync(out, dest);
console.log(`\nDone: ${dest} (${Math.round(fs.statSync(dest).size / 1e6)} MB)`);
