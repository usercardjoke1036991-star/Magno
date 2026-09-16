/**
 * Endurece el manifiesto Android de release (MobSF).
 * Debug / expo-dev-client sigue pudiendo usar HTTP a Metro.
 */
const { withAndroidManifest, withDangerousMod, withGradleProperties } =
  require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const BLOCKED_ALWAYS = [
  'android.permission.RECORD_AUDIO',
  'android.permission.MODIFY_AUDIO_SETTINGS',
  'android.permission.WRITE_EXTERNAL_STORAGE',
  'android.permission.READ_EXTERNAL_STORAGE',
];

const NETWORK_XML = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <base-config cleartextTrafficPermitted="false">
    <trust-anchors>
      <certificates src="system" />
    </trust-anchors>
  </base-config>
</network-security-config>
`;

const RELEASE_MANIFEST = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:tools="http://schemas.android.com/tools">
  <uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW" tools:node="remove" />
  <uses-permission android:name="android.permission.RECORD_AUDIO" tools:node="remove" />
  <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" tools:node="remove" />
  <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" tools:node="remove" />
  <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" tools:node="remove" />
  <application
      android:usesCleartextTraffic="false"
      android:networkSecurityConfig="@xml/network_security_config"
      tools:replace="android:usesCleartextTraffic">
    <activity android:name="expo.modules.devlauncher.launcher.DevLauncherActivity" tools:node="remove" />
    <activity android:name="expo.modules.devlauncher.compose.AuthActivity" tools:node="remove" />
    <activity android:name="androidx.compose.ui.tooling.PreviewActivity" tools:node="remove" />
    <activity
        android:name="com.canhub.cropper.CropImageActivity"
        android:exported="false"
        tools:replace="android:exported" />
  </application>
</manifest>
`;

function ensureToolsNs(manifest) {
  manifest.manifest.$ = manifest.manifest.$ || {};
  manifest.manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
}

function addRemovePermission(manifest, name) {
  if (!manifest.manifest['uses-permission']) {
    manifest.manifest['uses-permission'] = [];
  }
  const perms = manifest.manifest['uses-permission'];
  const already = perms.some(
    (item) => item.$?.['android:name'] === name && item.$?.['tools:node'] === 'remove'
  );
  if (!already) {
    perms.push({
      $: {
        'android:name': name,
        'tools:node': 'remove',
      },
    });
  }
}

function withQuatriviumAndroidSecurity(config) {
  config = withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults;
    ensureToolsNs(manifest);
    for (const name of BLOCKED_ALWAYS) {
      addRemovePermission(manifest, name);
    }

    const apps = manifest.manifest.application;
    const app = Array.isArray(apps) ? apps[0] : apps;
    if (app && app.$) {
      app.$['android:allowBackup'] = 'false';
      const replace = String(app.$['tools:replace'] || '')
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean);
      if (!replace.includes('android:allowBackup')) replace.push('android:allowBackup');
      app.$['tools:replace'] = replace.join(',');
      app.activity = app.activity || [];
      const cropName = 'com.canhub.cropper.CropImageActivity';
      let crop = app.activity.find((item) => item.$?.['android:name'] === cropName);
      if (!crop) {
        crop = { $: { 'android:name': cropName } };
        app.activity.push(crop);
      }
      crop.$['android:exported'] = 'false';
      crop.$['tools:replace'] = 'android:exported';
    }
    return cfg;
  });

  config = withDangerousMod(config, [
    'android',
    async (cfg) => {
      const androidRoot = cfg.modRequest.platformProjectRoot;
      const xmlDir = path.join(androidRoot, 'app/src/main/res/xml');
      fs.mkdirSync(xmlDir, { recursive: true });
      fs.writeFileSync(path.join(xmlDir, 'network_security_config.xml'), NETWORK_XML, 'utf8');
      const releaseDir = path.join(androidRoot, 'app/src/release');
      fs.mkdirSync(releaseDir, { recursive: true });
      fs.writeFileSync(path.join(releaseDir, 'AndroidManifest.xml'), RELEASE_MANIFEST, 'utf8');
      return cfg;
    },
  ]);

  config = withGradleProperties(config, (cfg) => {
    const setProp = (key, value) => {
      const idx = cfg.modResults.findIndex((item) => item.type === 'property' && item.key === key);
      const prop = { type: 'property', key, value };
      if (idx >= 0) cfg.modResults[idx] = prop;
      else cfg.modResults.push(prop);
    };
    setProp('android.enableMinifyInReleaseBuilds', 'true');
    setProp('android.enableShrinkResourcesInReleaseBuilds', 'true');
    return cfg;
  });

  return config;
}

module.exports = withQuatriviumAndroidSecurity;
