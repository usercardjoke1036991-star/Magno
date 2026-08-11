const { ethers } = require('ethers');

const CONTRACT_ABI = [
  {
    inputs: [{ internalType: 'uint256', name: '_monto', type: 'uint256' }],
    name: 'depositarLiquidez',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: '_usuario', type: 'address' }],
    name: 'registrarHumanoZK',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
];

const iface = new ethers.utils.Interface(CONTRACT_ABI);
const depositData = iface.encodeFunctionData('depositarLiquidez', ['1000000000000000000']);
const regData = iface.encodeFunctionData('registrarHumanoZK', ['0x000000000000000000000000000000000000dEaD']);

console.log('Deposit payload:', JSON.stringify({ to: '0xA6Aac9CE4923789a4095fBC0504db9A697F8A46D', data: depositData, value: '0x0' }, null, 2));
console.log('Registrar payload:', JSON.stringify({ to: '0xA6Aac9CE4923789a4095fBC0504db9A697F8A46D', data: regData, value: '0x0' }, null, 2));
