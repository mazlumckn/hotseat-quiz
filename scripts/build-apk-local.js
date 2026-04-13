const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const root = path.resolve(__dirname, '..');
const androidDir = path.join(root, 'android');
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

const jdkHome = resolveJdkHome();

function run(command, args, cwd = root, extraEnv = {}) {
  const env = { ...process.env, ...extraEnv };
  const result = spawnSync(command, args, {
    cwd,
    env,
    stdio: 'inherit',
  });

  if (result.error) {
    console.error(result.error.message || result.error);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

function ensurePaths() {
  if (!fs.existsSync(jdkHome)) {
    throw new Error(`JDK bulunamadi: ${jdkHome}`);
  }
  if (!fs.existsSync(sdkHome)) {
    throw new Error(`Android SDK bulunamadi: ${sdkHome}`);
  }
}

function writeLocalProperties() {
  const localProps = path.join(androidDir, 'local.properties');
  const sdkForProps = sdkHome.replace(/\\/g, '/');
  fs.writeFileSync(localProps, `sdk.dir=${sdkForProps}\n`, 'ascii');
}

function main() {
  ensurePaths();
  writeLocalProperties();
  const localAndroidHome = path.join(root, '.android-home');
  const localGradleHome = path.join(root, '.gradle-home');
  fs.mkdirSync(localAndroidHome, { recursive: true });
  fs.mkdirSync(localGradleHome, { recursive: true });

  run('cmd', ['/c', 'npm run apk:sync']);

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
  run('cmd', ['/c', 'gradlew.bat', 'assembleDebug'], androidDir, env);
}

main();
