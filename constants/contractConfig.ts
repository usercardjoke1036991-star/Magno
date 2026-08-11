export const CONTRACT_ADDRESS = "0xA6Aac9CE4923789a4095fBC0504db9A697F8A46D";
// Direcciones de stablecoins en BSC Mainnet
export const USDT_ADDRESS = "0x55d398326f99059ff775485246999027b3197955";
export const USDC_ADDRESS = "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d";
export const DAI_ADDRESS = "0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3";

// ABI estándar para interactuar con stablecoins ERC20 (aprobar gastos y ver balances)
export const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function transferFrom(address from, address to, uint256 amount) returns (bool)"
];

export const CONTRACT_ABI = [
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "_usdtAddress",
                "type": "address"
            },
            {
                "internalType": "address payable",
                "name": "_feeCollector",
                "type": "address"
            },
            {
                "internalType": "uint256",
                "name": "_feeBP",
                "type": "uint256"
            }
        ],
        "stateMutability": "nonpayable",
        "type": "constructor"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "address",
                "name": "usuario",
                "type": "address"
            }
        ],
        "name": "HumanoVerificado",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "address",
                "name": "proveedor",
                "type": "address"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "monto",
                "type": "uint256"
            }
        ],
        "name": "LiquidezAportada",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "address",
                "name": "usuario",
                "type": "address"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "monto",
                "type": "uint256"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "vencimiento",
                "type": "uint256"
            }
        ],
        "name": "PrestamoEmitido",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "address",
                "name": "usuario",
                "type": "address"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "monto",
                "type": "uint256"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "nuevoNivel",
                "type": "uint256"
            }
        ],
        "name": "PrestamoPagado",
        "type": "event"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "token",
                "type": "address"
            },
            {
                "internalType": "uint256",
                "name": "_monto",
                "type": "uint256"
            }
        ],
        "name": "depositarLiquidez",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "feeCollector",
        "outputs": [
            {
                "internalType": "address payable",
                "name": "",
                "type": "address"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "",
                "type": "address"
            }
        ],
        "name": "humanosVerificados",
        "outputs": [
            {
                "internalType": "bool",
                "name": "",
                "type": "bool"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "name": "niveles",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "montoPrestamo",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "plazo",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "tasaInteres",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "owner",
        "outputs": [
            {
                "internalType": "address",
                "name": "",
                "type": "address"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "token",
                "type": "address"
            },
            {
                "internalType": "uint256",
                "name": "_montoConInteres",
                "type": "uint256"
            }
        ],
        "name": "pagarPrestamo",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "_usuario",
                "type": "address"
            }
        ],
        "name": "registrarHumanoZK",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "token",
                "type": "address"
            }
        ],
        "name": "solicitarPrestamo",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "usdtToken",
        "outputs": [
            {
                "internalType": "contract IERC20",
                "name": "",
                "type": "address"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "",
                "type": "address"
            }
        ],
        "name": "usuarios",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "nivelActual",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "montoActivo",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "vencimiento",
                "type": "uint256"
            },
            {
                "internalType": "bool",
                "name": "enMora",
                "type": "bool"
            },
            {
                "internalType": "address",
                "name": "monedaActivo",
                "type": "address"
            },
            {
                "internalType": "uint256",
                "name": "tasaAplicadaBP",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "usuario",
                "type": "address"
            }
        ],
        "name": "obtenerHistorialUsuario",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "puntosReputacion",
                "type": "uint256"
            },
            {
                "internalType": "bool",
                "name": "moroso",
                "type": "bool"
            },
            {
                "internalType": "uint256",
                "name": "pagadosATiempo",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "morosos",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "totalPenalizaciones",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "usuario",
                "type": "address"
            }
        ],
        "name": "obtenerProgresoUsuario",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "nivelActual",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "solicitudesCompletadas",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "ultimoPrestamoTimestamp",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "usuario",
                "type": "address"
            }
        ],
        "name": "obtenerCooldownRestante",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "segundosRestantes",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "owner",
        "outputs": [
            {
                "internalType": "address payable",
                "name": "",
                "type": "address"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "retirarComisiones",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "token",
                "type": "address"
            }
        ],
        "name": "retirarComisionesToken",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "usuario",
                "type": "address"
            }
        ],
        "name": "obtenerProgresoUsuario",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "nivelActual",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "solicitudesCompletadas",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "ultimoPrestamoTimestamp",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "usuario",
                "type": "address"
            }
        ],
        "name": "obtenerCooldownRestante",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "segundosRestantes",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "usuario",
                "type": "address"
            }
        ],
        "name": "obtenerHistorialUsuario",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "puntosReputacion",
                "type": "uint256"
            },
            {
                "internalType": "bool",
                "name": "moroso",
                "type": "bool"
            },
            {
                "internalType": "uint256",
                "name": "pagadosATiempo",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "morosos",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "totalPenalizaciones",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    }
];