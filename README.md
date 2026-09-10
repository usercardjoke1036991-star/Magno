# Quatrivium Credit

Quatrivium Credit es crédito on-chain **sin colateral**: pides un préstamo, lo pagas dentro del plazo y subes de nivel para pedir más.

## Qué lo hace distinto

- No bloqueas tokens para pedir.
- Un préstamo activo a la vez.
- Si pagas a tiempo, subes de nivel (más monto, más plazo).
- Si no pagas, quedas en mora y no puedes pedir otro hasta regularizar.

## App

React Native (Expo) + WalletConnect/Reown en BNB Smart Chain.

```bash
npm install
npx expo run:android
```

## Contratos

```bash
npx hardhat test
npx hardhat run scripts/deploy.cjs --network bscMainnet
```
