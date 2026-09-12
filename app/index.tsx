import { useEffect, useMemo, useState } from 'react';
import { Linking as RNLinking, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Linking from 'expo-linking';
import { parseAppDeepLink } from '../utils/appDeepLink';
import { rememberAppUrl, takePendingAppUrl } from '../utils/pendingDeepLink';
import { AppKit, useAccount, useProvider } from '@reown/appkit-react-native';
import { parseUnits } from 'ethers';
import { setWalletSigner } from '../services/quatriviumCreditService';
import { useWeb3Balances } from '../hooks/useWeb3Balances';
import { useHomeHandlers } from '../hooks/useHomeHandlers';
import { WalletSection } from '../components/WalletSection';
import { TokenSelector } from '../components/TokenSelector';
import { BalanceDisplay } from '../components/BalanceDisplay';
import { UserMetrics } from '../components/UserMetrics';
import { RankLadder } from '../components/RankLadder';
import { LoanTierCard } from '../components/LoanTierCard';
import { LockedLoanCatalog } from '../components/LockedLoanCatalog';
import { AdminPanel } from '../components/AdminPanel';
import { ActivateCreditSection } from '../components/ActivateCreditSection';
import { AccountWorldCard } from '../components/AccountWorldCard';
import { AccountOnboarding } from '../components/AccountOnboarding';
import { KycAccessBanner } from '../components/KycAccessBanner';
import { BrandLogo } from '../components/BrandLogo';
import { ReferralSection } from '../components/ReferralSection';
import { SettingsButton } from '../components/SettingsButton';
import { AppSubsection } from '../components/AppSection';
import { AppWindow } from '../components/AppWindow';
import { HomeHub, type HomeRoom } from '../components/HomeHub';
import { AppText } from '../components/AppText';
import { PoolSupportSection } from '../components/PoolSupportSection';
import { MilestoneBonusCatalog } from '../components/MilestoneBonusCatalog';
import { DonateFounderSection } from '../components/DonateFounderSection';
import { NotificationChannels } from '../components/NotificationChannels';
import { ReferralHistory } from '../components/ReferralHistory';
import { MovementHistory } from '../components/MovementHistory';
import { APP_DISPLAY_NAME } from '../constants/brand';
import { getConfigurableStables, getSupportedTokens } from '../constants/tokens';
import { isContractConfigured, isCreditReady } from '../constants/rpcConfig';
import { useI18n } from '../i18n/LanguageContext';
import { useTheme } from '../theme/ThemeContext';
import { usePendingInvite } from '../hooks/usePendingInvite';
import { useUserProfile } from '../profile/ProfileContext';
import { useLoanPaymentReminders } from '../hooks/useLoanPaymentReminders';
import { useAppWallet } from '../wallet/AppWalletContext';
import { useAppMode } from '../wallet/AppModeContext';
import { useFundsConfirm } from '../components/FundsConfirmHost';
import type { TranslationKey } from '../i18n/translations';

export default function HomeScreen() {
  return <HomeScreenWithHooks />;
}

function HomeScreenWithHooks() {
  const { t, rtl } = useI18n();
  const { colors, isDark } = useTheme();
  const { pendingInviteCode, clearPendingInvite } = usePendingInvite();
  const { profile } = useUserProfile();
  const { address: appAddress, signer: appSigner, ready: walletReady, failed: walletFailed, retry: retryWallet } = useAppWallet();
  const { address: adminAddress, isConnected: adminConnected } = useAccount();
  const { provider: adminProvider } = useProvider();

  const { mode } = useAppMode();
  const { confirmFunds } = useFundsConfirm();
  const tokens = useMemo(() => getSupportedTokens(), [mode]);
  const extraStables = useMemo(() => getConfigurableStables(), [mode]);
  const [selectedToken, setSelectedToken] = useState(tokens[0]);
  const [room, setRoom] = useState<HomeRoom | null>(null);

  useEffect(() => {
    if (mode === 'demo' && room === 'pool') {
      setRoom(null);
    }
  }, [mode, room]);

  useEffect(() => {
    const apply = (url?: string | null) => {
      if (url) rememberAppUrl(url);
      const link = parseAppDeepLink(url || takePendingAppUrl());
      if (link?.kind === 'room') setRoom(link.room);
    };
    apply(takePendingAppUrl());
    Linking.getInitialURL().then(apply).catch(() => {});
    RNLinking.getInitialURL().then(apply).catch(() => {});
    const sub = Linking.addEventListener('url', ({ url }) => apply(url));
    const rnSub = RNLinking.addEventListener('url', ({ url }) => apply(url));
    return () => {
      sub.remove();
      rnSub.remove();
    };
  }, []);

  useEffect(() => {
    setSelectedToken(tokens[0]);
  }, [tokens]);

  const walletAddress = appAddress;
  const isConnected = Boolean(walletAddress);

  const { balances, userInfo, loanTiers, isLoading: creditChecking, refetch } = useWeb3Balances(
    walletAddress,
    selectedToken
  );
  const { userInfo: adminInfo } = useWeb3Balances(
    adminConnected && adminAddress ? adminAddress.toLowerCase() : '',
    selectedToken
  );
  const debtReminder = useLoanPaymentReminders(userInfo);
  const creditReady = isCreditReady();
  const creditPaused = userInfo.paused || !creditReady;
  const activeLoan = userInfo.activeLoan;
  const unlockedTiers = loanTiers.filter((tier) => tier.id <= userInfo.userProgress.nivelActual);
  const lockedTiers = loanTiers.filter((tier) => tier.id > userInfo.userProgress.nivelActual);
  const visibleUnlocked = unlockedTiers.slice(-3);
  const labelTier = (tier: (typeof loanTiers)[number]) => ({
    ...tier,
    name: `${t('level')} ${tier.id}`,
    term: t('termDays' as TranslationKey, { days: String(tier.termDays || 7) }),
  });
  const matchesActiveLoan = (tier: (typeof loanTiers)[number]) => {
    if (!activeLoan) return false;
    if (activeLoan.tierId > 0 && activeLoan.tierId === tier.id) return true;
    try {
      return parseUnits(String(tier.usdAmount), 18).toString() === activeLoan.principalWei;
    } catch {
      return false;
    }
  };
  const hasMatchingPayCard = unlockedTiers.some(matchesActiveLoan);
  const fallbackPayTierId = !activeLoan || hasMatchingPayCard
    ? 0
    : (activeLoan.tierId || unlockedTiers[unlockedTiers.length - 1]?.id || 0);

  const {
    txLoading,
    handleRegistrarHumano,
    handleSolicitarCredito,
    handleCobrarBonoHito,
    handlePagar,
    handleDepositarPool,
    handleDonar,
    handleRetirarComisiones,
    handleRetirarComisionesToken,
    handleDeclararKyc,
    handleExecuteProposal,
    handleConfirmProposal,
    handleProposeAddAdmin,
    handleProposeRemoveAdmin,
    handleProposeFeeCollector,
    handleProposeConfirmations,
    handleProposeFundador,
    handleProposeOwner,
    handleProposeSetTokenConfig,
    handlePausarProtocolo,
    handleLiquidarDeudor,
    handleMarcarMorosoSiVencido,
  } = useHomeHandlers({
    walletAddress,
    userInfo,
    balances,
    selectedToken,
    appSigner,
    adminConnected,
    adminProvider,
    confirmFunds,
    refetch,
    clearPendingInvite,
  });

  useEffect(() => {
    if (appSigner) setWalletSigner(appSigner);
  }, [appSigner]);

  useEffect(() => {
    if (room === 'admin' && !adminInfo.isAdmin && !adminInfo.isOwner) {
      setRoom(null);
    }
  }, [room, adminInfo.isAdmin, adminInfo.isOwner]);

  useEffect(() => {
    if (room === 'bonuses' && !userInfo.canClaimHitos && !userInfo.canDonate) {
      setRoom(null);
    }
  }, [room, userInfo.canClaimHitos, userInfo.canDonate]);

  return (
    <AccountOnboarding
      walletAddress={walletAddress}
      walletReady={walletReady}
      walletFailed={walletFailed}
      onRetryWallet={retryWallet}
      isRegistered={userInfo.isRegistered}
      kycDeclarado={userInfo.kycDeclarado}
      identityBound={userInfo.identityBound}
      isLoading={txLoading}
      paused={userInfo.paused}
      inviteCode={pendingInviteCode}
      onRegister={(padre) => void handleRegistrarHumano(padre)}
      onDeclareKyc={handleDeclararKyc}
      onPhoneBound={refetch}
    >
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.topBar}>
          <BrandLogo size={44} />
          <View style={styles.topBarText}>
            <View style={styles.titleRow}>
              <AppText style={[styles.title, { color: colors.text }]}>{APP_DISPLAY_NAME}</AppText>
              <View
                style={[
                  styles.worldBadge,
                  {
                    borderColor: mode === 'demo' ? colors.warnText : colors.success,
                    backgroundColor: mode === 'demo' ? colors.warnBg : colors.chip,
                  },
                ]}
              >
                <AppText
                  style={[
                    styles.worldBadgeText,
                    { color: mode === 'demo' ? colors.warnText : colors.success },
                  ]}
                >
                  {mode === 'demo' ? t('appModeDemo') : t('appModeLive')}
                </AppText>
              </View>
            </View>
            <AppText style={[styles.subtitle, rtl && styles.rtlText, { color: colors.textMuted }]}>
              {profile.displayName ? t('helloName', { name: profile.displayName }) : t('subtitle')}
            </AppText>
          </View>
          <SettingsButton />
        </View>

        {walletReady && (walletFailed || !walletAddress) ? (
          <View style={[styles.configWarn, { backgroundColor: colors.warnBg }]}>
            <AppText style={{ color: colors.warnText }}>{t('appWalletFailed')}</AppText>
            <AppText style={{ color: colors.primary, marginTop: 8 }} onPress={() => retryWallet()}>
              {t('appWalletRetry')}
            </AppText>
          </View>
        ) : null}

        {mode === 'demo' || !isContractConfigured('mainnet') ? null : (
          <KycAccessBanner
            kycDone={userInfo.kycDeclarado}
            phoneDone={userInfo.identityBound}
            walletAddress={walletAddress}
            isRegistered={userInfo.isRegistered}
            kycDeclarado={userInfo.kycDeclarado}
            identityBound={userInfo.identityBound}
            isLoading={txLoading}
            paused={userInfo.paused}
            onDeclare={handleDeclararKyc}
            onPhoneBound={refetch}
          />
        )}

        <AccountWorldCard />
        {mode === 'demo' && !isContractConfigured() && (
          <AppText style={[styles.configWarn, rtl && styles.rtlText, { backgroundColor: colors.warnBg, color: colors.warnText }]}>{t('configWarn')}</AppText>
        )}
        {userInfo.paused && (
          <AppText style={[styles.configWarn, rtl && styles.rtlText, { backgroundColor: colors.warnBg, color: colors.warnText }]}>
            {t('securityPausedBanner')}
          </AppText>
        )}

        <AppText style={[styles.hubTitle, { color: colors.text }]}>{t('hubChoose')}</AppText>
        <HomeHub
          onOpen={setRoom}
          tiles={[
            {
              id: 'wallet',
              title: t('sectionAccount'),
              lead: mode === 'demo' ? t('hubWalletLeadDemo') : t('hubWalletLead'),
              icon: 'wallet',
            },
            {
              id: 'credit',
              title: t('sectionCreditLine'),
              lead: !creditReady
                ? t('hubCreditLeadPending')
                : userInfo.isRegistered || userInfo.hasActiveLoan
                  ? t('hubCreditLeadActive')
                  : t('hubCreditLead'),
              icon: 'id',
            },
            { id: 'loans', title: t('loanLevels'), lead: t('hubLoansLead'), icon: 'bank' },
            ...(userInfo.canClaimHitos || userInfo.canDonate
              ? [{ id: 'bonuses' as const, title: t('sectionBonuses'), lead: t('hubBonusesLead'), icon: 'star' as const }]
              : []),
            { id: 'network', title: t('referralNetwork'), lead: t('hubNetworkLead'), icon: 'people' },
            { id: 'history', title: t('historyTitle'), lead: t('hubHistoryLead'), icon: 'history' },
            ...(mode === 'demo'
              ? []
              : [{ id: 'pool' as const, title: t('sectionPool'), lead: t('hubPoolLead'), icon: 'pool' as const }]),
            ...(adminInfo.isOwner || adminInfo.isAdmin
              ? [{ id: 'admin' as const, title: t('admin'), lead: t('hubAdminLead'), icon: 'shield' as const }]
              : []),
          ]}
        />
      </ScrollView>

      <AppWindow
        visible={room === 'wallet'}
        title={t('sectionAccount')}
        lead={t('sectionAccountLead')}
        onClose={() => setRoom(null)}
      >
        <AppSubsection title={t('subsectionWallet')} icon="plug">
          <WalletSection
            walletAddress={walletAddress}
            bnbBalance={balances.bnbBalance}
            tokenBalance={balances.tokenBalance}
            selectedToken={selectedToken}
            isLoading={txLoading}
            onSent={refetch}
          />
        </AppSubsection>
        {isConnected ? (
          <AppSubsection title={t('subsectionBalances')} icon="wallet">
            {tokens.length > 1 ? (
              <TokenSelector
                tokens={tokens}
                selectedToken={selectedToken}
                onSelectToken={setSelectedToken}
              />
            ) : null}
            <BalanceDisplay
              balances={balances}
              selectedTokenSymbol={selectedToken.symbol}
            />
          </AppSubsection>
        ) : null}
        {isConnected && mode !== 'demo' ? (
          <AppSubsection title={t('notificationTitle')} defaultOpen={false} icon="bell">
            <NotificationChannels walletAddress={walletAddress} />
          </AppSubsection>
        ) : null}
      </AppWindow>

      <AppWindow
        visible={room === 'credit'}
        title={t('sectionCreditLine')}
        lead={t('sectionCreditLineLead')}
        onClose={() => setRoom(null)}
      >
        <AppSubsection
          title={userInfo.isRegistered || userInfo.hasActiveLoan ? t('subsectionCreditStatus') : t('subsectionActivate')}
          icon="id"
        >
          {!creditReady ? (
            <AppText style={[styles.configWarn, rtl && styles.rtlText, { backgroundColor: colors.warnBg, color: colors.warnText }]}>
              {t('liveCreditNotReady')}
            </AppText>
          ) : null}
          <ActivateCreditSection
            isRegistered={userInfo.isRegistered || userInfo.hasActiveLoan}
            checking={creditChecking && !userInfo.isRegistered && !userInfo.hasActiveLoan}
            hasActiveLoan={userInfo.hasActiveLoan}
            onRegister={handleRegistrarHumano}
            onGoLoans={() => setRoom('loans')}
            isLoading={txLoading}
            initialInviteCode={pendingInviteCode}
            paused={creditPaused}
          />
        </AppSubsection>
        {userInfo.isRegistered || userInfo.hasActiveLoan || !creditChecking ? (
          <AppSubsection title={t('subsectionRank')} icon="star">
            <UserMetrics
              userInfo={userInfo}
              reminder={debtReminder}
              showDebt={false}
              onOpenBonuses={() => setRoom('bonuses')}
              lpUsd={Number.parseFloat(balances.lpBalance) || 0}
              isPaying={txLoading}
            />
          </AppSubsection>
        ) : null}
        {userInfo.activeLoan ? (
          <AppSubsection title={t('subsectionDebt')} icon="warning">
            <UserMetrics
              userInfo={userInfo}
              reminder={debtReminder}
              showRank={false}
              showDebt
              onPayLoan={() => handlePagar('installment')}
              onPayAll={() => handlePagar('all')}
              onPayCount={(count) => handlePagar(count)}
              isPaying={txLoading}
            />
          </AppSubsection>
        ) : null}
      </AppWindow>

      <AppWindow
        visible={room === 'loans'}
        title={t('loanLevels')}
        lead={t('sectionLoansLead')}
        onClose={() => setRoom(null)}
      >
        {!creditReady ? (
          <AppText style={[styles.configWarn, rtl && styles.rtlText, { backgroundColor: colors.warnBg, color: colors.warnText }]}>
            {t('liveCreditNotReady')}
          </AppText>
        ) : null}
        {tokens.length > 1 ? (
          <TokenSelector
            tokens={tokens}
            selectedToken={selectedToken}
            onSelectToken={setSelectedToken}
          />
        ) : null}
        <AppSubsection title={t('subsectionLadder')} icon="chart">
          <RankLadder userLevel={userInfo.userProgress.nivelActual} />
        </AppSubsection>
        <AppSubsection title={t('subsectionUnlocked')} icon="bank">
          {visibleUnlocked.map((tier) => (
            <LoanTierCard
              key={tier.id}
              tier={labelTier(tier)}
              userLevel={userInfo.userProgress.nivelActual}
              hasActiveLoan={userInfo.hasActiveLoan}
                isDelinquent={userInfo.isDelinquent}
                paused={creditPaused}
                isActiveTier={matchesActiveLoan(tier) || Boolean(activeLoan && !hasMatchingPayCard && tier.id === fallbackPayTierId)}
              dueLabel={activeLoan?.totalDueLabel}
              cuotaLabel={activeLoan?.cuotaLabel}
              cuotasPagadas={activeLoan?.cuotasPagadas}
              cuotasTotales={activeLoan?.cuotasTotales}
              remainingLabel={activeLoan?.remainingLabel}
              isLoading={txLoading}
              curveRateBps={userInfo.curveRateBps}
              ultimoPrestamoTimestamp={userInfo.userProgress.ultimoPrestamoTimestamp}
              cooldownRestante={userInfo.userProgress.cooldownRestante}
              isRegistered={userInfo.isRegistered}
              onActivateCredit={() => setRoom('credit')}
              onRequestLoan={handleSolicitarCredito}
              onPayLoan={() => handlePagar('installment')}
              onPayAll={() => handlePagar('all')}
              onPayCount={(count) => handlePagar(count)}
              showMilestoneBonus={userInfo.canClaimHitos}
            />
          ))}
        </AppSubsection>
        {lockedTiers.length ? (
          <AppSubsection title={t('subsectionLocked')} icon="lock">
            <AppText style={[styles.lockedHint, rtl && styles.rtlText, { color: colors.textMuted }]}>
              {t('lockedLevelsHint')}
            </AppText>
            <LockedLoanCatalog
              tiers={lockedTiers}
              labelTier={labelTier}
              userLevel={userInfo.userProgress.nivelActual}
              hasActiveLoan={userInfo.hasActiveLoan}
              isDelinquent={userInfo.isDelinquent}
              paused={creditPaused}
              isLoading={txLoading}
              curveRateBps={userInfo.curveRateBps}
              ultimoPrestamoTimestamp={0}
              isRegistered={userInfo.isRegistered}
              onActivateCredit={() => setRoom('credit')}
              onRequestLoan={handleSolicitarCredito}
              onPayLoan={() => handlePagar('installment')}
              onPayAll={() => handlePagar('all')}
              onPayCount={(count) => handlePagar(count)}
              showMilestoneBonus={userInfo.canClaimHitos}
            />
          </AppSubsection>
        ) : null}
      </AppWindow>

      <AppWindow
        visible={room === 'bonuses' && (userInfo.canClaimHitos || userInfo.canDonate)}
        title={t('sectionBonuses')}
        lead={t('sectionBonusesLead')}
        onClose={() => setRoom(null)}
      >
        {!creditReady ? (
          <AppText style={[styles.configWarn, rtl && styles.rtlText, { backgroundColor: colors.warnBg, color: colors.warnText }]}>
            {t('liveCreditNotReady')}
          </AppText>
        ) : null}
        <AppSubsection title={t('sectionBonuses')} icon="star">
          <MilestoneBonusCatalog
            userLevel={userInfo.userProgress.nivelActual}
            lastHito={userInfo.userProgress.lastHito}
            claimable={userInfo.userProgress.bonusPending}
            canClaim={userInfo.canClaimHitos}
            maxLevel={userInfo.maxLoanLevel}
            isPaying={txLoading}
            onClaim={handleCobrarBonoHito}
          />
        </AppSubsection>
        {userInfo.canDonate ? (
        <DonateFounderSection
          isLoading={txLoading}
          tokenSymbol={selectedToken.symbol}
          tokenSupported={userInfo.isTokenSupported}
          walletConnected={Boolean(walletAddress)}
          founderAddress={userInfo.founderAddress}
          donatedUsd={userInfo.donatedUsd || 0}
          lpUsd={Number.parseFloat(balances.lpBalance) || 0}
          onDonate={handleDonar}
        />
        ) : null}
      </AppWindow>

      <AppWindow
        visible={room === 'network'}
        title={t('referralNetwork')}
        lead={t('sectionInviteLead')}
        onClose={() => setRoom(null)}
      >
        <ReferralSection
          walletAddress={walletAddress}
          isRegistered={userInfo.isRegistered}
          isRestricted={userInfo.isDelinquent}
          curveRateBps={userInfo.curveRateBps}
          referral={userInfo.referral ?? {
            padre: '',
            fundador: '',
            isFundador: false,
            bonoActivacionCobrado: false,
            royaltiesCongeladas: false,
          }}
          reputation={userInfo.reputation}
          networkPoints={userInfo.networkPoints}
          networkBonusThreshold={userInfo.networkBonusThreshold}
        >
          {isConnected ? (
            <AppSubsection title={t('referralHistoryTitle')} defaultOpen icon="history">
              <ReferralHistory walletAddress={walletAddress} enabled={userInfo.isRegistered} />
            </AppSubsection>
          ) : null}
        </ReferralSection>
      </AppWindow>

      <AppWindow
        visible={room === 'history'}
        title={t('historyTitle')}
        lead={t('historyLead')}
        onClose={() => setRoom(null)}
      >
        <MovementHistory walletAddress={walletAddress} enabled={room === 'history'} />
      </AppWindow>

      <AppWindow
        visible={room === 'pool'}
        title={t('sectionPool')}
        lead={t('sectionPoolLead')}
        onClose={() => setRoom(null)}
      >
        {!creditReady ? (
          <AppText style={[styles.configWarn, rtl && styles.rtlText, { backgroundColor: colors.warnBg, color: colors.warnText }]}>
            {t('liveCreditNotReady')}
          </AppText>
        ) : null}
        {tokens.length > 1 ? (
          <TokenSelector
            tokens={tokens}
            selectedToken={selectedToken}
            onSelectToken={setSelectedToken}
          />
        ) : null}
        <PoolSupportSection
          isLoading={txLoading}
          tokenSymbol={selectedToken.symbol}
          tokenSupported={userInfo.isTokenSupported}
          poolBalance={balances.poolBalance}
          poolOutstanding={balances.poolOutstanding}
          poolCash={balances.poolCash}
          walletConnected={Boolean(walletAddress)}
          paused={creditPaused}
          onDepositPool={handleDepositarPool}
        />
        {userInfo.canDonate ? (
        <DonateFounderSection
          isLoading={txLoading}
          tokenSymbol={selectedToken.symbol}
          tokenSupported={userInfo.isTokenSupported}
          walletConnected={Boolean(walletAddress)}
          founderAddress={userInfo.founderAddress}
          donatedUsd={userInfo.donatedUsd || 0}
          lpUsd={Number.parseFloat(balances.lpBalance) || 0}
          onDonate={handleDonar}
        />
        ) : null}
      </AppWindow>

      <AppWindow
        visible={room === 'admin'}
        title={t('admin')}
        lead={t('adminLead')}
        onClose={() => setRoom(null)}
      >
        {tokens.length > 1 ? (
          <TokenSelector
            tokens={tokens}
            selectedToken={selectedToken}
            onSelectToken={setSelectedToken}
          />
        ) : null}
        <AdminPanel
          isOwner={adminInfo.isOwner}
          isAdmin={adminInfo.isAdmin}
          isLoading={txLoading}
          paused={userInfo.paused}
          tokenSymbol={selectedToken.symbol}
          tokenAddress={selectedToken.address}
          onWithdrawFees={handleRetirarComisiones}
          onWithdrawTokenFees={handleRetirarComisionesToken}
          onPause={handlePausarProtocolo}
          onExecuteProposal={handleExecuteProposal}
          onConfirmProposal={handleConfirmProposal}
          onProposeAddAdmin={handleProposeAddAdmin}
          onProposeRemoveAdmin={handleProposeRemoveAdmin}
          onProposeFeeCollector={handleProposeFeeCollector}
          onProposeConfirmations={handleProposeConfirmations}
          onProposeFundador={handleProposeFundador}
          onProposeOwner={handleProposeOwner}
          extraStables={extraStables}
          onProposeSetTokenConfig={handleProposeSetTokenConfig}
          onLiquidar={handleLiquidarDeudor}
          onMarcarMoroso={handleMarcarMorosoSiVencido}
          adminRoster={adminInfo.adminRoster.length ? adminInfo.adminRoster : userInfo.adminRoster}
          requiredConfirmations={adminInfo.requiredConfirmations || userInfo.requiredConfirmations}
          proposalCount={adminInfo.proposalCount || userInfo.proposalCount}
          openProposal={adminInfo.openProposal || userInfo.openProposal}
          founderAddress={adminInfo.founderAddress || userInfo.founderAddress}
        />
      </AppWindow>
      <AppKit />
    </SafeAreaView>
    </AccountOnboarding>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 10,
  },
  topBarText: {
    flex: 1,
    paddingRight: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
  },
  worldBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  worldBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
  configWarn: {
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    fontSize: 13,
    lineHeight: 18,
  },
  rtlText: {
    textAlign: 'right',
  },
  hubTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 10,
  },
  lockedHint: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
  },
});
