const { withAppBuildGradle } = require('expo/config-plugins');

/**
 * Signs local release builds (the Google Play .aab) with the upload key when this machine has one:
 * CAMIA_UPLOAD_STORE_FILE, CAMIA_UPLOAD_STORE_PASSWORD, CAMIA_UPLOAD_KEY_ALIAS and CAMIA_UPLOAD_KEY_PASSWORD
 * in ~/.gradle/gradle.properties (never in the repo). Without them, release builds keep the debug key as before.
 * EAS builds ignore this and use the credentials stored on Expo.
 */
const MARK = '// CamIA upload key';

const signingConfig = `
        release {
            ${MARK}
            if (findProperty('CAMIA_UPLOAD_STORE_FILE')) {
                storeFile file(findProperty('CAMIA_UPLOAD_STORE_FILE'))
                storePassword findProperty('CAMIA_UPLOAD_STORE_PASSWORD')
                keyAlias findProperty('CAMIA_UPLOAD_KEY_ALIAS')
                keyPassword findProperty('CAMIA_UPLOAD_KEY_PASSWORD')
            }
        }`;

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (config) => {
    let gradle = config.modResults.contents;
    if (gradle.includes(MARK)) return config;
    const debugBlock = /(signingConfigs \{\s*debug \{[^}]*\})/;
    const releaseUsesDebug = /(release \{[^}]*?)signingConfig signingConfigs\.debug/;
    if (!debugBlock.test(gradle) || !releaseUsesDebug.test(gradle)) {
      throw new Error('withReleaseSigning: android/app/build.gradle does not look like the Expo template any more');
    }
    gradle = gradle.replace(debugBlock, `$1${signingConfig}`);
    gradle = gradle.replace(
      releaseUsesDebug,
      "$1signingConfig findProperty('CAMIA_UPLOAD_STORE_FILE') ? signingConfigs.release : signingConfigs.debug",
    );
    config.modResults.contents = gradle;
    return config;
  });
};
