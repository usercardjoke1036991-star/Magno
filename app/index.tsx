import { ethers } from 'ethers';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CONTRACT_ADDRESS, CONTRACT_ABI, ERC20_ABI } from '../constants/contractConfig';
import { MagnocrediService, setWalletSigner } from './_layout';
import { useAppKit, useAccount, useDisconnect, useAppKitProvider } from '@reown/appkit-react-native';
import { wagmiToEthersProvider } from '../web3Config';

// Configuración de Red y Contratos en BSC Mainnet
const BSC_MAINNET_RPC = 'https://bsc-dataseed.binance.org/';

interface Token {
  symbol: string;
  address: string;
  decimals: number;
  priceUSD: number;
  color: string;
}

interface LoanTier {
  id: number;
  name: string;
  usdAmount: number;
  term: string;
  requiredCount: number;
}

const SUPPORTED_TOKENS: Token[] = [
  { symbol: 'USDT', address: '0x55d398326f99059ff775485246999027b3197955'.toLowerCase(), decimals: 18, priceUSD: 1.0, color: '#26A17B' },
  { symbol: 'USDC', address: '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d'.toLowerCase(), decimals: 18, priceUSD: 1.0, color: '#2775CA' },
  { symbol: 'DAI', address: '0x1af3f329e8be154074d8769d1ffa4ee058b1dbc3'.toLowerCase(), decimals: 18, priceUSD: 1.0, color: '#ffb347' },
];
 
const LOAN_TIERS: LoanTier[] = [
  { id: 1, name: "Semilla", usdAmount: 1, term: "7 días (1 cuota)", requiredCount: 3 },
  { id: 2, name: "Inicial", usdAmount: 2, term: "10 días (1 cuota)", requiredCount: 5 },
  { id: 3, name: "Micro", usdAmount: 5, term: "15 días (1 cuota)", requiredCount: 5 },
  { id: 4, name: "Plus", usdAmount: 10, term: "20 días (1 cuota)", requiredCount: 5 },
  { id: 5, name: "Avance", usdAmount: 20, term: "25 días (2 cuotas)", requiredCount: 5 },
  { id: 6, name: "Crecimiento", usdAmount: 35, term: "30 días (2 cuotas)", requiredCount: 5 },
  { id: 7, name: "Escala", usdAmount: 50, term: "35 días (2 cuotas)", requiredCount: 5 },
  { id: 8, name: "Avanzado", usdAmount: 65, term: "40 días (3 cuotas)", requiredCount: 5 },
  { id: 9, name: "Elite", usdAmount: 80, term: "45 días (3 cuotas)", requiredCount: 5 },
  { id: 10, name: "Máximo", usdAmount: 100, term: "50 días (3 cuotas)", requiredCount: 5 },
];

export default function HomeScreen() {
  return (
    <HomeScreenContent />
  );
}

// Componente wrapper para manejar el error de contexto de AppKit
function HomeScreenContent() {
  const [isReady, setIsReady] = useState(false);
  
  // Esperar a que el contexto de AppKit esté disponible
  useEffect(() => {
    // Pequeño delay para asegurar que el provider esté inicializado
    const timer = setTimeout(() => {
      setIsReady(true);
    }, 100);
    
    return () => clearTimeout(timer);
  }, []);
  
  if (!isReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Inicializando Web3...</Text>
      </View>
    );
  }
  
  return <HomeScreenWithHooks />;
}

// Componente que contiene los hooks de AppKit
function HomeScreenWithHooks() {
  const { open } = useAppKit();
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { walletProvider } = useAppKitProvider();
  
  const [walletAddress, setWalletAddress] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const [selectedToken, setSelectedToken] = useState<Token>(SUPPORTED_TOKENS[0]);
  const [tokenBalance, setTokenBalance] = useState<string>('0.00');
  const [poolBalance, setPoolBalance] = useState<string>('0.00');
  const [bnbBalance, setBnbBalance] = useState<string>('0.00');

  const [userLevel, setUserLevel] = useState<number>(1);
  const [isRegisteredZK, setIsRegisteredZK] = useState<boolean>(false);
  const [hasActiveLoan, setHasActiveLoan] = useState<boolean>(false);
  const [reputation, setReputation] = useState<number>(0);
  const [creditHistory, setCreditHistory] = useState<{ paidOnTime: number; missedLoans: number; penalties: number }>({ paidOnTime: 0, missedLoans: 0, penalties: 0 });
  const [isDelinquent, setIsDelinquent] = useState<boolean>(false);
  const [userProgress, setUserProgress] = useState<{ nivelActual: number; solicitudesCompletadas: number; ultimoPrestamoTimestamp: number; cooldownRestante: number }>({ nivelActual: 1, solicitudesCompletadas: 0, ultimoPrestamoTimestamp: 0, cooldownRestante: 0 });
  const [isOwner, setIsOwner] = useState<boolean>(false);

  useEffect(() => {
    if (address) {
      setWalletAddress(address.toLowerCase());
      
      // Configurar el signer de ethers cuando el provider de Wagmi está disponible
      if (walletProvider) {
        const ethersProvider = wagmiToEthersProvider(walletProvider);
        const signer = ethersProvider.getSigner();
        setWalletSigner(signer);
      }
      
      fetchBalances();
    } else {
      setWalletAddress('');
      setWalletSigner(null);
    }
  }, [address, walletProvider, selectedToken]);

  const fetchBalances = async () => {
    try {
      if (!ethers.utils.isAddress(walletAddress)) return;
      const provider = new ethers.providers.JsonRpcProvider(BSC_MAINNET_RPC);

      // BNB balance
      try {
        const bnb = await provider.getBalance(walletAddress);
        setBnbBalance(Number(ethers.utils.formatEther(bnb)).toFixed(4));
      } catch (e) { setBnbBalance('0.00'); }

      // Token balances
      try {
        const tokenContract = new ethers.Contract(selectedToken.address, ERC20_ABI, provider);
        let decimals = selectedToken.decimals;
        try { decimals = Number(await tokenContract.decimals()); } catch (e) {}

        const bal = await tokenContract.balanceOf(walletAddress);
        setTokenBalance(Number(ethers.utils.formatUnits(bal, decimals)).toFixed(4));

        const pool = await tokenContract.balanceOf(CONTRACT_ADDRESS);
        setPoolBalance(Number(ethers.utils.formatUnits(pool, decimals)).toFixed(2));
      } catch (e) {
        setTokenBalance('0.00');
        setPoolBalance('0.00');
      }

      // User & protocol info (read-only)
      try {
        const magnocrediContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
        try {
          const userInfo = await magnocrediContract.usuarios(walletAddress);
          setHasActiveLoan(Number(userInfo.montoActivo) > 0 || Boolean(userInfo.enMora));
        } catch (e) {}

        try {
          const zk = await magnocrediContract.humanosVerificados(walletAddress);
          setIsRegisteredZK(Boolean(zk));
        } catch (e) { setIsRegisteredZK(false); }

        try {
          const history = await magnocrediContract.obtenerHistorialUsuario(walletAddress);
          setReputation(Number(history.puntosReputacion));
          setIsDelinquent(Boolean(history.moroso));
          setCreditHistory({
            paidOnTime: Number(history.pagadosATiempo),
            missedLoans: Number(history.morosos),
            penalties: Number(history.totalPenalizaciones),
          });
        } catch (e) {
          setReputation(0);
          setIsDelinquent(false);
          setCreditHistory({ paidOnTime: 0, missedLoans: 0, penalties: 0 });
        }

        try {
          const progress = await MagnocrediService.obtenerProgresoUsuario(walletAddress);
          const cooldown = await MagnocrediService.obtenerCooldownRestante(walletAddress);
          const currentLevel = Number(progress.nivelActual) > 0 ? Number(progress.nivelActual) : 1;
          setUserLevel(currentLevel);
          setUserProgress({
            nivelActual: currentLevel,
            solicitudesCompletadas: Number(progress.solicitudesCompletadas),
            ultimoPrestamoTimestamp: Number(progress.ultimoPrestamoTimestamp),
            cooldownRestante: Number(cooldown),
          });
        } catch (e) {
          setUserProgress({ nivelActual: 1, solicitudesCompletadas: 0, ultimoPrestamoTimestamp: 0, cooldownRestante: 0 });
        }

        try {
          const ownerAddress = await MagnocrediService.obtenerOwner();
          setIsOwner(walletAddress.toLowerCase() === ownerAddress.toLowerCase());
        } catch (e) {
          setIsOwner(false);
        }
      } catch (e) {}

    } catch (error) {
      console.warn('Fetch balances failed', error);
    }
  };

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      await open();
      // La dirección se maneja automáticamente por el hook useAccount
    } catch (e) {
      Alert.alert('Error', (e as any)?.message || 'No se pudo conectar');
    } finally { setIsConnecting(false); }
  };

  const handleDisconnect = async () => {
    await disconnect();
    await MagnocrediService.disconnect();
    setWalletAddress('');
    setTokenBalance('0.00');
    setPoolBalance('0.00');
    setBnbBalance('0.00');
  };

  const runTx = async (name: string, fn: () => Promise<any>, onSuccess?: () => void) => {
    setLoadingAction(name);
    try {
      await fn();
      if (onSuccess) onSuccess();
      Alert.alert('✅ Éxito', `${name} confirmada en la blockchain.`);
    } catch (e: any) {
      console.error(e);
      if (e?.code === 4001 || (e?.message || '').includes('user rejected')) {
        Alert.alert('Operación Cancelada', 'Rechazaste la transacción.');
      } else {
        Alert.alert('Error', e?.reason || e?.message || 'Fallo en la transacción.');
      }
    } finally {
      setLoadingAction(null);
      fetchBalances();
    }
  };

  const registrarHumano = () => {
    if (!walletAddress) return Alert.alert('Conectar', 'Conecta tu billetera primero.');
    runTx('registrarHumanoZK', () => MagnocrediService.registrarHumano(walletAddress), () => setIsRegisteredZK(true));
  };

  const solicitarCredito = (tier: LoanTier) => {
    if (!isRegisteredZK) return Alert.alert('Registro ZK', 'Registra tu identidad ZK antes de solicitar.');
    runTx('solicitarPrestamo', () => MagnocrediService.solicitar(selectedToken.address), () => setHasActiveLoan(true));
  };

  const pagarCuota = (tier: LoanTier) => {
    if (!walletAddress) return Alert.alert('Conectar', 'Conecta tu billetera primero.');
    const montoUSD = tier.usdAmount * 1.3;
    const amountWei = ethers.utils.parseUnits(montoUSD.toString(), selectedToken.decimals).toString();
    runTx('pagarPrestamo', () => MagnocrediService.pagar(amountWei, selectedToken.address), () => setHasActiveLoan(false));
  };

  const formatCooldown = (seconds: number) => {
    if (seconds <= 0) return 'Disponible';
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    const parts = [];
    if (days) parts.push(`${days}d`);
    if (hours) parts.push(`${hours}h`);
    if (minutes) parts.push(`${minutes}m`);
    if (secs) parts.push(`${secs}s`);
    return parts.join(' ');
  };

  const depositarPool = async () => {
    if (!walletAddress) return Alert.alert('Conectar', 'Conecta tu billetera primero.');
    const amountWei = ethers.utils.parseUnits('10', selectedToken.decimals).toString();
    runTx('depositarLiquidez', () => MagnocrediService.depositar(amountWei, selectedToken.address));
  };

  const retirarComisiones = async () => {
    runTx('retirarComisiones', () => MagnocrediService.retirarComisiones());
  };

  const retirarComisionesToken = async () => {
    runTx('retirarComisionesToken', () => MagnocrediService.retirarComisionesToken(selectedToken.address));
  };

  const TierCard = ({ tier }: { tier: LoanTier }) => {
    const locked = tier.id > userLevel;
    return (
      <View style={[styles.tierCard, locked && styles.tierCardLocked]}>
        <View style={styles.tierRow}>
          <Text style={styles.tierTitle}>{tier.name}</Text>
          {locked ? <Text style={styles.lock}>🔒</Text> : <View style={styles.greenDot} />}
        </View>
        <Text style={styles.tierAmount}>${tier.usdAmount.toFixed(2)}</Text>
        <Text style={styles.tierMeta}>Plazo: {tier.term}</Text>
        <Text style={styles.tierMeta}>Requisitos: {tier.requiredCount} usuarios</Text>
        <View style={styles.tierActions}>
          <TouchableOpacity disabled={locked || !!loadingAction} onPress={() => solicitarCredito(tier)} style={[styles.btn, styles.btnPrimary]}>
            {loadingAction === 'solicitarPrestamo' ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Solicitar</Text>}
          </TouchableOpacity>
          <TouchableOpacity disabled={locked || !!loadingAction || !hasActiveLoan} onPress={() => pagarCuota(tier)} style={[styles.btn, styles.btnGhost]}>
            {loadingAction === 'pagarPrestamo' ? <ActivityIndicator color="#38bdf8" /> : <Text style={[styles.btnText, styles.btnGhostText]}>Pagar</Text>}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.appTitle}>Magnocredi</Text>
        <View style={styles.topRight}>
          {isConnected && address ? (
            <TouchableOpacity style={styles.walletBtn} onPress={handleDisconnect}>
              <Text style={styles.walletText}>{`🔗 ${address.substring(0,6)}...${address.substring(address.length-4)}`}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.connectBtn} onPress={handleConnect} disabled={isConnecting}>
              {isConnecting ? <ActivityIndicator color="#fff" /> : <Text style={styles.connectText}>Conectar</Text>}
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Token</Text>
          <View style={styles.tokenRow}>
            {SUPPORTED_TOKENS.map((t) => (
              <TouchableOpacity key={t.symbol} style={[styles.tokenPill, selectedToken.symbol === t.symbol && styles.tokenPillActive]} onPress={() => setSelectedToken(t)}>
                <Text style={[styles.tokenPillText, selectedToken.symbol === t.symbol && styles.tokenPillTextActive]}>{t.symbol}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.balancesRow}>
            <View style={styles.balanceCol}>
              <Text style={styles.balanceLabel}>Tu saldo</Text>
              <Text style={styles.balanceValue}>{tokenBalance} {selectedToken.symbol}</Text>
            </View>
            <View style={styles.balanceCol}>
              <Text style={styles.balanceLabel}>Pool</Text>
              <Text style={styles.balanceValue}>{poolBalance} {selectedToken.symbol}</Text>
            </View>
            <View style={styles.balanceCol}>
              <Text style={styles.balanceLabel}>Gas</Text>
              <Text style={styles.balanceValue}>{bnbBalance} BNB</Text>
            </View>
          </View>

          <View style={styles.userMetricsRow}>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Reputación</Text>
              <Text style={styles.metricValue}>{reputation}</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Morosidad</Text>
              <Text style={[styles.metricValue, isDelinquent ? styles.delinquentText : styles.onTimeText]}>{isDelinquent ? 'Sí' : 'No'}</Text>
            </View>
          </View>

          <View style={styles.userMetricsRow}>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Pagos a tiempo</Text>
              <Text style={styles.metricValue}>{creditHistory.paidOnTime}</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Préstamos morosos</Text>
              <Text style={styles.metricValue}>{creditHistory.missedLoans}</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Penalizaciones</Text>
              <Text style={styles.metricValue}>{creditHistory.penalties}</Text>
            </View>
          </View>

          <View style={styles.userMetricsRow}>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Nivel actual</Text>
              <Text style={styles.metricValue}>{userProgress.nivelActual}</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Solicitudes</Text>
              <Text style={styles.metricValue}>{userProgress.solicitudesCompletadas}/{userProgress.nivelActual === 1 ? 3 : 5}</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Cooldown</Text>
              <Text style={styles.metricValue}>{formatCooldown(userProgress.cooldownRestante)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Niveles de Préstamo</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tiersScroll}>
            {LOAN_TIERS.map((tier) => (
              <TierCard key={tier.id} tier={tier} />
            ))}
          </ScrollView>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Acciones</Text>
          <View style={styles.actionsGrid}>
            <TouchableOpacity style={styles.actionBtn} onPress={registrarHumano} disabled={!!loadingAction}>
              {loadingAction === 'registrarHumanoZK' ? <ActivityIndicator color="#38bdf8" /> : <Text style={styles.actionText}>🛡️ Registrar Humano</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionBtn} onPress={() => solicitarCredito(LOAN_TIERS[0])} disabled={!!loadingAction}>
              {loadingAction === 'solicitarPrestamo' ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionText}>💳 Solicitar Crédito</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionBtn} onPress={() => pagarCuota(LOAN_TIERS[0])} disabled={!!loadingAction || !hasActiveLoan}>
              {loadingAction === 'pagarPrestamo' ? <ActivityIndicator color="#38bdf8" /> : <Text style={styles.actionText}>🧾 Pagar Cuota</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionBtn} onPress={depositarPool} disabled={!!loadingAction}>
              {loadingAction === 'depositarLiquidez' ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionText}>💧 Depositar Liquidez</Text>}
            </TouchableOpacity>
            {isOwner && (
              <>
                <TouchableOpacity style={[styles.actionBtn, styles.adminBtn]} onPress={retirarComisiones} disabled={!!loadingAction}>
                  {loadingAction === 'retirarComisiones' ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionText}>🏦 Retirar Comisiones BNB</Text>}
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, styles.adminBtn]} onPress={retirarComisionesToken} disabled={!!loadingAction}>
                  {loadingAction === 'retirarComisionesToken' ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionText}>🏦 Retirar Token</Text>}
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  topBar: { height: 72, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#0b1220' },
  appTitle: { color: '#38bdf8', fontSize: 20, fontWeight: '700' },
  topRight: { flexDirection: 'row', alignItems: 'center' },
  connectBtn: { backgroundColor: '#0ea5e9', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10 },
  connectText: { color: '#fff', fontWeight: '700' },
  walletBtn: { backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#22303b', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12 },
  walletText: { color: '#38bdf8', fontWeight: '700' },

  scroll: { padding: 20, paddingBottom: 40 },
  sectionCard: { backgroundColor: '#0f172a', borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#13202a' },
  sectionTitle: { color: '#cfeffd', fontSize: 16, fontWeight: '700', marginBottom: 12 },

  tokenRow: { flexDirection: 'row', gap: 8 },
  tokenPill: { paddingVertical: 8, paddingHorizontal: 12, backgroundColor: '#12202a', borderRadius: 10, marginRight: 8 },
  tokenPillActive: { backgroundColor: '#0ea5e9', borderWidth: 0 },
  tokenPillText: { color: '#94a3b8', fontWeight: '700' },
  tokenPillTextActive: { color: '#fff' },

  balancesRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 },
  balanceCol: { flex: 1, alignItems: 'center' },
  balanceLabel: { color: '#94a3b8', fontSize: 12 },
  balanceValue: { color: '#fff', fontSize: 16, fontWeight: '700', marginTop: 6 },

  tiersScroll: { marginTop: 8 },
  tierCard: { width: 220, backgroundColor: '#162433', padding: 14, borderRadius: 12, marginRight: 12, borderWidth: 1, borderColor: '#21343d' },
  tierCardLocked: { opacity: 0.6 },
  tierRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  tierTitle: { color: '#cfeffd', fontWeight: '800' },
  lock: { color: '#94a3b8' },
  greenDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#10b981' },
  tierAmount: { color: '#fff', fontSize: 20, fontWeight: '800', marginBottom: 6 },
  tierMeta: { color: '#94a3b8', fontSize: 12, marginBottom: 4 },
  tierActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },

  userMetricsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16, gap: 8 },
  metricCard: { flex: 1, backgroundColor: '#12202a', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#21343d', alignItems: 'center' },
  metricLabel: { color: '#94a3b8', fontSize: 12, marginBottom: 6 },
  metricValue: { color: '#fff', fontSize: 18, fontWeight: '700' },
  delinquentText: { color: '#f87171' },
  onTimeText: { color: '#34d399' },

  btn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', marginHorizontal: 4 },
  btnPrimary: { backgroundColor: '#0ea5e9' },
  btnGhost: { backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#21343d' },
  btnText: { color: '#0f172a', fontWeight: '800' },
  btnGhostText: { color: '#38bdf8' },

  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 },
  actionBtn: { backgroundColor: '#12202a', padding: 14, borderRadius: 12, width: '48%', alignItems: 'center', marginBottom: 8 },
  adminBtn: { backgroundColor: '#9333ea', borderColor: '#a855f7', borderWidth: 1 },
  actionText: { color: '#cfeffd', fontWeight: '700' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' },
  loadingText: { color: '#fff', marginTop: 16, fontSize: 16 },
});