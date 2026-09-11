import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Linking from 'expo-linking';
import { AppKit, useAccount, useProvider } from '@reown/appkit-react-native';
import { parseUnits } from 'ethers';
import { setWalletSigner, clearWalletSigner } from '../services/quatriviumCreditService';
import { useWeb3Balances } from '../hooks/useWeb3Balances';
import { useHomeHandlers } from '../hooks/useHomeHandlers';
import { WalletSection } from '../components/WalletSection';
import { TokenSelector } from '../components/TokenSelector';
import { BalanceDisplay } from '../components/BalanceDisplay';
import { UserMetrics } from '../components/UserMetrics';
import { RankLadder } from '../components/RankLadder';
import { LoanTierCard } from '../components/LoanTierCard';
import { AdminPanel } from '../components/AdminPanel';
import { ActivateCreditSection } from '../components/ActivateCreditSection';
import { NetworkStatusBanner } from '../components/NetworkStatusBanner';
import { DemoModeBanner } from '../components/DemoModeBanner';
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
import { NotificationChannels } from '../components/NotificationChannels';
import { ReferralHistory } from '../components/ReferralHistory';
import { LOAN_TIERS } from '../constants/loanTiers';
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
    const allowed: HomeRoom[] = ['wallet', 'credit', 'loans', 'network', 'pool', 'admin'];
    const apply = (url?: string | null) => {
      if (!url) return;
      const parsed = Linking.parse(url);
      const parts = String(parsed.path || '').replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);
      const fromQuery = String(parsed.queryParams?.room || '');
      const fromPath = parts[0] === 'room' ? parts[1] || '' : parts[0] || '';
      const candidate = (fromQuery || fromPath) as HomeRoom;
      if (allowed.includes(candidate)) setRoom(candidate);
    };
    Linking.getInitialURL().then(apply).catch(() => {});
    const sub = Linking.addEventListener('url', ({ url }) => apply(url));
    return () => sub.remove();
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

  const {
    txLoading,
    handleRegistrarHumano,
    handleSolicitarCredito,
    handlePagar,
    handleDepositarPool,
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
    if (appSigner) {
      setWalletSigner(appSigner);
    } else {
      clearWalletSigner();
    }
  }, [appSigner]);

  useEffect(() => {
    if (room === 'admin' && !adminInfo.isAdmin && !adminInfo.isOwner) {
      setRoom(null);
    }
  }, [room, adminInfo.isAdmin, adminInfo.isOwner]);

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
            <AppText style={[styles.title, { color: colors.text }]}>Quatrivium Credit</AppText>
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

        <DemoModeBanner />
        <NetworkStatusBanner />
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
            { id: 'wallet', title: t('sectionAccount'), lead: t('hubWalletLead'), icon: 'wallet' },
            {
              id: 'credit',
              title: t('sectionCreditLine'),
              lead: userInfo.isRegistered || userInfo.hasActiveLoan ? t('hubCreditLeadActive') : t('hubCreditLead'),
              icon: 'id',
            },
            { id: 'loans', title: t('loanLevels'), lead: t('hubLoansLead'), icon: 'bank' },
            { id: 'network', title: t('referralNetwork'), lead: t('hubNetworkLead'), icon: 'people' },
            { id: 'pool', title: t('sectionPool'), lead: t('hubPoolLead'), icon: 'pool' },
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
        {isConnected ? (
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
            <UserMetrics userInfo={userInfo} reminder={debtReminder} showDebt={false} />
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
          {loanTiers.filter((tier) => tier.id <= userInfo.userProgress.nivelActual).map((tier) => (
            <LoanTierCard
              key={tier.id}
              tier={{
                ...tier,
                name: t(`tier${tier.id}` as TranslationKey),
                term: t(`term${tier.id}` as TranslationKey),
              }}
              userLevel={userInfo.userProgress.nivelActual}
              hasActiveLoan={userInfo.hasActiveLoan}
                isDelinquent={userInfo.isDelinquent}
                paused={creditPaused}
                isActiveTier={
                Boolean(userInfo.activeLoan)
                && parseUnits(
                  String(LOAN_TIERS.find((item) => item.id === tier.id)?.usdAmount ?? 0),
                  18
                ).toString() === userInfo.activeLoan?.principalWei
              }
              dueLabel={userInfo.activeLoan?.totalDueLabel}
              cuotaLabel={userInfo.activeLoan?.cuotaLabel}
              cuotasPagadas={userInfo.activeLoan?.cuotasPagadas}
              cuotasTotales={userInfo.activeLoan?.cuotasTotales}
              remainingLabel={userInfo.activeLoan?.remainingLabel}
              isLoading={txLoading}
              curveRateBps={userInfo.curveRateBps}
              onRequestLoan={handleSolicitarCredito}
              onPayLoan={() => handlePagar('installment')}
              onPayAll={() => handlePagar('all')}
              onPayCount={(count) => handlePagar(count)}
            />
          ))}
        </AppSubsection>
        {loanTiers.some((tier) => tier.id > userInfo.userProgress.nivelActual) ? (
          <AppSubsection title={t('subsectionLocked')} icon="lock">
            {loanTiers.filter((tier) => tier.id > userInfo.userProgress.nivelActual).map((tier) => (
              <LoanTierCard
                key={tier.id}
                tier={{
                  ...tier,
                  name: t(`tier${tier.id}` as TranslationKey),
                  term: t(`term${tier.id}` as TranslationKey),
                }}
                userLevel={userInfo.userProgress.nivelActual}
                hasActiveLoan={userInfo.hasActiveLoan}
                isDelinquent={userInfo.isDelinquent}
                paused={creditPaused}
                isActiveTier={false}
                isLoading={txLoading}
                curveRateBps={userInfo.curveRateBps}
                onRequestLoan={handleSolicitarCredito}
                onPayLoan={() => handlePagar('installment')}
              onPayAll={() => handlePagar('all')}
              onPayCount={(count) => handlePagar(count)}
              />
            ))}
          </AppSubsection>
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
            <AppSubsection title={t('referralHistoryTitle')} defaultOpen={false} icon="history">
              <ReferralHistory walletAddress={walletAddress} enabled={userInfo.isRegistered} />
            </AppSubsection>
          ) : null}
        </ReferralSection>
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
  title: {
    fontSize: 22,
    fontWeight: '600',
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
});
