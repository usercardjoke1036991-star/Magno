const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Configuración optimizada para librerías Web3 en React Native
config.resolver.unstable_enablePackageExports = true;

// Resolver rutas internas de librerías Web3
config.resolver.sourceExts = [...config.resolver.sourceExts, 'js', 'json', 'ts', 'tsx'];

// Silenciar advertencias específicas
config.transformer = {
  ...config.transformer,
  minifierConfig: {
    ...config.transformer.minifierConfig,
    keep_classnames: true,
    keep_fnames: true,
  },
};

module.exports = config;
