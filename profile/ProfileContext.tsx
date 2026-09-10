import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAppWallet } from '../wallet/AppWalletContext';
import {
  EMPTY_PROFILE,
  fetchPublicProfiles,
  loadOwnProfile,
  loadProfileDirectory,
  publishOwnProfile,
  rememberProfile,
  rememberProfiles,
  saveOwnProfile,
  type UserProfile,
} from '../services/userProfile';
import { loadClaimedUsername } from '../services/accountUsername';

interface ProfileValue {
  profile: UserProfile;
  directory: Record<string, UserProfile>;
  walletAddress: string;
  saveProfile: (next: UserProfile) => Promise<UserProfile>;
  lookup: (wallet?: string) => UserProfile | undefined;
  refreshDirectory: (wallets: string[]) => Promise<void>;
  ingestProfile: (wallet: string, next: UserProfile) => Promise<void>;
}

const ProfileContext = createContext<ProfileValue | null>(null);

export const ProfileProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { address } = useAppWallet();
  const walletAddress = address || '';
  const [profile, setProfile] = useState<UserProfile>(EMPTY_PROFILE);
  const [directory, setDirectory] = useState<Record<string, UserProfile>>({});

  useEffect(() => {
    Promise.all([
      loadOwnProfile(walletAddress || undefined),
      loadClaimedUsername(),
    ])
      .then(([stored, username]) => {
        setProfile(username ? { ...stored, displayName: username } : stored);
      })
      .catch(() => {});
    loadProfileDirectory().then(setDirectory).catch(() => {});
  }, [walletAddress]);

  useEffect(() => {
    if (!walletAddress || !profile.displayName) return;
    rememberProfile(walletAddress, profile).then(setDirectory).catch(() => {});
  }, [walletAddress, profile]);

  const saveProfile = useCallback(async (next: UserProfile) => {
    const username = await loadClaimedUsername().catch(() => '');
    const stored = await saveOwnProfile(
      { ...next, displayName: username || next.displayName },
      walletAddress || undefined
    );
    setProfile(stored);
    if (walletAddress) {
      const updated = await rememberProfile(walletAddress, stored);
      if (updated) setDirectory(updated);
      await publishOwnProfile(walletAddress, stored);
    }
    return stored;
  }, [walletAddress]);

  const lookup = useCallback(
    (wallet?: string) => {
      if (!wallet) return undefined;
      const key = wallet.toLowerCase();
      if (walletAddress && key === walletAddress) return profile;
      return directory[key];
    },
    [directory, profile, walletAddress]
  );

  const refreshDirectory = useCallback(async (wallets: string[]) => {
    const remote = await fetchPublicProfiles(wallets);
    if (Object.keys(remote).length === 0) return;
    const next = await rememberProfiles(remote);
    setDirectory(next);
  }, []);

  const ingestProfile = useCallback(async (wallet: string, next: UserProfile) => {
    const updated = await rememberProfile(wallet, next);
    setDirectory(updated);
  }, []);

  const value = useMemo(
    () => ({ profile, directory, walletAddress, saveProfile, lookup, refreshDirectory, ingestProfile }),
    [profile, directory, walletAddress, saveProfile, lookup, refreshDirectory, ingestProfile]
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
};

export const useUserProfile = (): ProfileValue => {
  const ctx = useContext(ProfileContext);
  if (!ctx) {
    throw new Error('useUserProfile must be used inside ProfileProvider');
  }
  return ctx;
};
