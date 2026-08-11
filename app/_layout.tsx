import { ethers } from 'ethers';
import { CONTRACT_ABI, CONTRACT_ADDRESS, ERC20_ABI } from '../constants/contractConfig';

// BSC Mainnet RPC URL para operaciones de lectura
const BSC_RPC_URL = 'https://bsc-dataseed.binance.org/';

// Provider básico para operaciones de lectura (funciona en React Native)
const getReadProvider = () => {
    return new ethers.providers.JsonRpcProvider(BSC_RPC_URL);
};

// Variable para almacenar el signer (se implementará con librería RN-compatible)
let walletSigner: any = null;

// Función para setear el signer externamente (desde Web3Modal)
export const setWalletSigner = (signer: any) => {
    walletSigner = signer;
};

// Inicializa y retorna el provider y el signer
const getProviderAndSigner = async () => {
    try {
        const provider = getReadProvider();
        
        // Si hay un signer configurado, úsalo; si no, retorna null para operaciones de solo lectura
        if (walletSigner) {
            return { provider, signer: walletSigner };
        }
        
        return { provider, signer: null };
    } catch (error) {
        console.error("Error al inicializar provider:", error);
        throw error;
    }
};

// Función auxiliar para aprobar tokens ERC20 antes de depositar o pagar
const asegurarAprobacionToken = async (signer: any, userAddress: string, tokenAddress: string, amountWei: string) => {
    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
    const allowance: bigint = await tokenContract.allowance(userAddress, CONTRACT_ADDRESS);

    if (allowance < BigInt(amountWei)) {
        console.log("Solicitando aprobación de tokens...");
        const txApprove = await tokenContract.approve(CONTRACT_ADDRESS, amountWei);
        await txApprove.wait();
        console.log("Token aprobado con éxito.");
    }
};

export const MagnocrediService = {
    // 0. Conectar billetera y retornar la address activa
    connectWallet: async () => {
        const { signer } = await getProviderAndSigner();
        if (!signer) {
            throw new Error("No hay billetera conectada. Por favor conecta tu billetera usando el botón de conexión.");
        }
        return await signer.getAddress();
    },

    // 1. Depositar liquidez (Aprobación ERC20 + Llamada al contrato)
    depositar: async (amountInWei: string, tokenAddress: string) => {
        const { signer } = await getProviderAndSigner();
        if (!signer) {
            throw new Error("Wallet connection not implemented for React Native yet");
        }
        const userAddress = await signer.getAddress();

        // Aseguramos que el contrato tiene permiso para mover los tokens
        await asegurarAprobacionToken(signer, userAddress, tokenAddress, amountInWei);

        const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
        const tx = await contract.depositarLiquidez(tokenAddress, amountInWei);
        return await tx.wait();
    },

    // 2. Solicitar préstamo
    solicitar: async (tokenAddress: string) => {
        const { signer } = await getProviderAndSigner();
        if (!signer) {
            throw new Error("Wallet connection not implemented for React Native yet");
        }
        const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
        const tx = await contract.solicitarPrestamo(tokenAddress);
        return await tx.wait();
    },

    // 3. Pagar préstamo (Aprobación ERC20 + Llamada al contrato)
    pagar: async (amountInWei: string, tokenAddress: string) => {
        const { signer } = await getProviderAndSigner();
        if (!signer) {
            throw new Error("Wallet connection not implemented for React Native yet");
        }
        const userAddress = await signer.getAddress();

        // Aseguramos que el contrato tiene permiso para mover los tokens
        await asegurarAprobacionToken(signer, userAddress, tokenAddress, amountInWei);

        const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
        const tx = await contract.pagarPrestamo(tokenAddress, amountInWei);
        return await tx.wait();
    },

    // 4. Verificación ZK
    registrarHumano: async (userAddress: string) => {
        const { signer } = await getProviderAndSigner();
        if (!signer) {
            throw new Error("Wallet connection not implemented for React Native yet");
        }
        // Generar prueba ZK (stub)
        const proof = await MagnocrediService.generateZKProof(userAddress);
        console.log('Prueba ZK generada (stub):', proof);
        
        const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
        const tx = await contract.registrarHumanoZK(userAddress);
        return await tx.wait();
    },

    // --- NUEVAS FUNCIONES DE LECTURA PARA LA UI ---

    // 5. Obtener balance y datos de liquidez del usuario en el protocolo
    obtenerDatosUsuario: async (userAddress: string) => {
        const { provider } = await getProviderAndSigner();
        const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
        
        // Llamada a función típica de lectura en contratos de liquidez (ajustar nombre según tu ABI si difiere)
        try {
            const infoLiquidez = await contract.obtenerLiquidezUsuario(userAddress);
            return {
                liquidezDepositada: infoLiquidez.toString(),
            };
        } catch (e) {
            console.warn("La función de lectura personalizada no está en el ABI o falló:", e);
            return { liquidezDepositada: "0" };
        }
    },

    // 6. Desconectar sesión de WalletConnect
    disconnect: async () => {
        walletSigner = null;
    },

    // 7. Obtener progreso del usuario
    obtenerProgresoUsuario: async (userAddress: string) => {
        const { provider } = await getProviderAndSigner();
        const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
        
        try {
            const progress = await contract.obtenerProgresoUsuario(userAddress);
            return {
                nivelActual: Number(progress.nivelActual),
                solicitudesCompletadas: Number(progress.solicitudesCompletadas),
                ultimoPrestamoTimestamp: Number(progress.ultimoPrestamoTimestamp),
            };
        } catch (e) {
            console.warn("La función obtenerProgresoUsuario no está en el ABI o falló:", e);
            return { nivelActual: 1, solicitudesCompletadas: 0, ultimoPrestamoTimestamp: 0 };
        }
    },

    // 8. Obtener cooldown restante
    obtenerCooldownRestante: async (userAddress: string) => {
        const { provider } = await getProviderAndSigner();
        const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
        
        try {
            const cooldown = await contract.obtenerCooldownRestante(userAddress);
            return Number(cooldown);
        } catch (e) {
            console.warn("La función obtenerCooldownRestante no está en el ABI o falló:", e);
            return 0;
        }
    },

    // 9. Obtener owner del contrato
    obtenerOwner: async () => {
        const { provider } = await getProviderAndSigner();
        const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
        
        try {
            const owner = await contract.owner();
            return owner;
        } catch (e) {
            console.warn("La función owner no está en el ABI o falló:", e);
            return "0x0000000000000000000000000000000000000000";
        }
    },

    // 10. Funciones de owner (retirar comisiones)
    retirarComisiones: async () => {
        const { signer } = await getProviderAndSigner();
        if (!signer) {
            throw new Error("Wallet connection not implemented for React Native yet");
        }
        const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
        const tx = await contract.retirarComisiones();
        return await tx.wait();
    },

    retirarComisionesToken: async (tokenAddress: string) => {
        const { signer } = await getProviderAndSigner();
        if (!signer) {
            throw new Error("Wallet connection not implemented for React Native yet");
        }
        const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
        const tx = await contract.retirarComisionesToken(tokenAddress);
        return await tx.wait();
    },

    // 11. Generación ZK (stub para desarrollo)
    generateZKProof: async (userAddress: string) => {
        console.log('Generando prueba ZK para', userAddress);
        return { proof: '0x00', publicSignals: [userAddress] };
    },

    // 12. Preparación de transacciones (simulación)
    prepareDeposit: async (tokenAddress: string, amountInWei: string) => {
        const iface = new ethers.utils.Interface(CONTRACT_ABI as any);
        const data = iface.encodeFunctionData('depositarLiquidez', [tokenAddress, amountInWei]);
        return { to: CONTRACT_ADDRESS, data, value: '0x0' };
    },

    prepareRegistrarHumano: async (userAddress: string) => {
        const iface = new ethers.utils.Interface(CONTRACT_ABI as any);
        const data = iface.encodeFunctionData('registrarHumanoZK', [userAddress]);
        return { to: CONTRACT_ADDRESS, data, value: '0x0' };
    }
};
