#!/usr/bin/env bash
# Slither en WSL con el Hardhat 2 de Magno, no el Hardhat 3 del directorio padre.
cd "$(dirname "$0")/.." || exit 1
export PATH="$HOME/.local/bin:$PATH"
unset npm_config_prefix npm_config_devdir npm_config_local_prefix NODE_PATH HARDHAT_CONFIG
npx hardhat --config hardhat.config.cjs compile --force || exit 1
if command -v slither >/dev/null 2>&1; then
  slither . --config-file slither.config.json --hardhat-ignore-compile "$@"
else
  python3 -m slither . --config-file slither.config.json --hardhat-ignore-compile "$@"
fi
