import '@walletconnect/react-native-compat';

// Polyfills para React Native - DEBE SER LO PRIMERO QUE SE EJECUTE
// Fix para window.addEventListener error con Web3 libraries

if (typeof window !== 'undefined') {
  if (!window.addEventListener) {
    window.addEventListener = () => {};
  }
  if (!window.removeEventListener) {
    window.removeEventListener = () => {};
  }
  if (!window.dispatchEvent) {
    window.dispatchEvent = () => true;
  }
} else {
  global.window = global.window || {};
  global.window.addEventListener = global.window.addEventListener || (() => {});
  global.window.removeEventListener = global.window.removeEventListener || (() => {});
  global.window.dispatchEvent = global.window.dispatchEvent || (() => true);
}

// Polyfill adicional para matchMedia
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = ((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }));
}

// Importar LogBox para suprimir advertencias de Web3
import { LogBox } from 'react-native';

// Ignorar advertencias específicas de terceros (Web3/WalletConnect)
LogBox.ignoreLogs([
  'Attempted to import',
  'Falling back to file-based resolution'
]);

import 'react-native-get-random-values';
import '@react-native-async-storage/async-storage';

import { registerRootComponent } from 'expo';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
