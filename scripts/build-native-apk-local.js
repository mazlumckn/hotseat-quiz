const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const root = path.resolve(__dirname, '..');
const androidDir = path.join(root, 'android-native');
const sdkHome = path.join(root, 'tools', 'android-sdk');

function resolveJdkHome() {
  const candidates = [path.join(root, 'tools', 'jdk21'), path.join(root, 'tools', 'jdk17')];
  for (const parent of candidates) {
    if (!fs.existsSync(parent)) continue;
    const dir = fs
      .readdirSync(parent, { withFileTypes: true })
      .find((x) => x.isDirectory() && x.name.toLowerCase().startsWith('jdk-'));
    if (dir) return path.join(parent, dir.name);
  }
  return '';
}

function run(command, args, cwd = root, extraEnv = {}) {
  const env = { ...process.env, ...extraEnv };
  const result = spawnSync(command, args, { cwd, env, stdio: 'inherit' });
  if (result.error) {
    console.error(result.error.message || result.error);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

function ensure(pathValue, message) {
  if (!fs.existsSync(pathValue)) throw new Error(message + ': ' + pathValue);
}

function writeLocalProperties() {
  const sdkForProps = sdkHome.replace(/\\/g, '/');
  fs.writeFileSync(path.join(androidDir, 'local.properties'), `sdk.dir=${sdkForProps}\n`, 'ascii');
}

function copyApkOut() {
  const src = path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
  const out = path.join(root, 'cinematic-native-debug.apk');
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, out);
    console.log(`Native APK hazir: ${out}`);
  }
}

function resolveApiBaseFromConfigJs() {
  try {
    const configPath = path.join(root, 'config.js');
    if (!fs.existsSync(configPath)) return '';
    const raw = fs.readFileSync(configPath, 'utf8');
    const match = raw.match(/apiBase\s*:\s*['"]([^'"]*)['"]/i);
    return match ? String(match[1] || '').trim().replace(/\/+$/, '') : '';
  } catch {
    return '';
  }
}

function main() {
  const jdkHome = resolveJdkHome();
  ensure(androidDir, 'android-native klasoru bulunamadi');
  ensure(jdkHome, 'JDK bulunamadi');
  ensure(sdkHome, 'Android SDK bulunamadi');
  writeLocalProperties();

  const localAndroidHome = path.join(root, '.android-home-native');
  const localGradleHome = path.join(root, '.gradle-home-native');
  fs.mkdirSync(localAndroidHome, { recursive: true });
  fs.mkdirSync(localGradleHome, { recursive: true });

  const configuredApiBase = String(
    process.env.CINEMATIC_API_BASE || resolveApiBaseFromConfigJs() || ''
  ).trim();

  const env = {
    JAVA_HOME: jdkHome,
    ANDROID_HOME: sdkHome,
    ANDROID_SDK_ROOT: sdkHome,
    ANDROID_USER_HOME: localAndroidHome,
    HOME: root,
    USERPROFILE: root,
    GRADLE_USER_HOME: localGradleHome,
    JAVA_TOOL_OPTIONS: `-Duser.home=${root}`,
    PATH: `${path.join(jdkHome, 'bin')};${process.env.PATH || ''}`,
  };
  if (configuredApiBase) {
    env.CINEMATIC_API_BASE = configuredApiBase;
    console.log(`Native API base: ${configuredApiBase}`);
  } else {
    console.log('Native API base: default (http://127.0.0.1:3001)');
  }

  run('cmd', ['/c', 'gradlew.bat', 'assembleDebug'], androidDir, env);
  copyApkOut();
}

main();
