import AsyncStorage from '@react-native-async-storage/async-storage';

const PAIRS: [string, string][] = [
  ['bitcredit.lang', 'quatrivium.lang'],
  ['bitcredit.theme', 'quatrivium.theme'],
  ['bitcredit.invite', 'quatrivium.invite'],
  ['bitcredit.notify.profile', 'quatrivium.notify.profile'],
  ['bitcredit.profile.own', 'quatrivium.profile.own'],
  ['bitcredit.profile.directory', 'quatrivium.profile.directory'],
];

export async function migrateLegacyStorage(): Promise<void> {
  for (const [from, to] of PAIRS) {
    try {
      const next = await AsyncStorage.getItem(to);
      if (next) continue;
      const prev = await AsyncStorage.getItem(from);
      if (!prev) continue;
      await AsyncStorage.setItem(to, prev);
      await AsyncStorage.removeItem(from);
    } catch {
      // ignore
    }
  }
}
