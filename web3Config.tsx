import { createConfig, http } from 'wagmi';
import { bsc } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReownAppKitProvider } from '@reown/appkit-react-native';
import { setWalletSigner } from './app/_layout';
import { ethers } from 'ethers';

// Project ID de WalletConnect
const PROJECT_ID = 'cdfc21e1934207c7e7caa09412168a4c';

// Configuración de Wagmi para BSC - Configuración estricta para React Native
const wagmiConfig = createConfig({
  chains: [bsc],
  transports: {
    [bsc.id]: http('https://bsc-dataseed.binance.org/'),
  },
  ssr: true,
  multiInjectedProvider: false,
  syncConnectedChain: false,
});

// Configuración de QueryClient
const queryClient = new QueryClient();

// Metadatos de la aplicación
const metadata = {
  name: 'Magno',
  description: 'Decentralized credit platform',
  url: 'https://magnocredi.com',
  icons: ['https://avatars.githubusercontent.com/u/37784886'],
};

// Configuración de Reown AppKit
const appKitConfig = {
  projectId: PROJECT_ID,
  metadata,
  themeMode: 'light' as const,
  themeVariables: {
    '--w3m-z-index': '999',
  },
};

// Provider que envuelve la aplicación con la configuración de Web3
export function Web3Provider({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ReownAppKitProvider 
        {...appKitConfig}
        wagmiConfig={wagmiConfig}
      >
        {children}
      </ReownAppKitProvider>
    </QueryClientProvider>
  );
}

// Función para convertir cualquier provider a ethers signer (sin dependencia de wagmi)
export function wagmiToEthersProvider(provider: any) {
  return new ethers.providers.Web3Provider(provider);
}

// El modal de Reown AppKit se maneja internamente por la librería
// No es necesario exportar un componente de modal explícito

// Hook personalizado para obtener el signer de ethers
export function useEthersSigner() {
  // Este es un wrapper simple - en producción necesitarías
  // integrar más profundamente con la librería
  return {
    signer: null, // Se implementará en el componente
    setSigner: setWalletSigner,
  };
}
