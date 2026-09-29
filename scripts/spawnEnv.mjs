import { delimiter } from 'node:path';

/** PATH fijo para spawn (S4036). No hereda el PATH del usuario. */
export function spawnPath() {
  if (process.platform === 'win32') {
    return [
      'C:\\Windows\\System32',
      'C:\\Windows',
      'C:\\Program Files\\Docker\\Docker\\resources\\bin',
      'C:\\Program Files\\Git\\cmd',
    ].join(delimiter);
  }
  return ['/usr/bin', '/bin', '/usr/local/bin'].join(delimiter);
}

export function spawnEnv(extra = {}) {
  return { ...process.env, ...extra, PATH: spawnPath(), Path: spawnPath() };
}
