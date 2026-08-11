import { Web3Provider } from './web3Config';
import HomeScreen from './app/index';

// Export the app's main screen so Metro/Expo loads it as the root component
export default function App() {
  return (
    <Web3Provider>
      <HomeScreen />
    </Web3Provider>
  );
}
