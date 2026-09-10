const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Enable package exports for modern packages
config.resolver.unstable_enablePackageExports = true;

const zkNodeStub = path.resolve(__dirname, 'stubs/zk-node-stub.js');
const previousResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'snarkjs' || moduleName === 'circomlibjs') {
    return { type: 'sourceFile', filePath: zkNodeStub };
  }
  if (previousResolveRequest) {
    return previousResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

// Add support for ZK circuit files (.wasm and .zkey)
config.resolver.assetExts = [
  ...config.resolver.assetExts,
  'wasm',
  'zkey',
];

// Add support for source files if needed for ZK libraries
config.resolver.sourceExts = [
  ...config.resolver.sourceExts,
  'wasm',
];

module.exports = config;
