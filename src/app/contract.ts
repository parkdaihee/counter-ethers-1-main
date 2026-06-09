/** Sepolia testnet — MetaMask 등에서 네트워크 전환 시 사용 */
export const SEPOLIA_CHAIN_ID = 11155111

/**
 * 공개 Sepolia RPC (앞쪽부터 시도). `rpc.sepolia.org`는 간헐적 522/HTML 응답이 있어 후순위로 둡니다.
 * @see https://chainlist.org/chain/11155111
 */
export const SEPOLIA_RPC_ENDPOINTS = [
  'https://ethereum-sepolia-rpc.publicnode.com',
  'https://sepolia.drpc.org',
  'https://1rpc.io/sepolia',
  'https://rpc2.sepolia.org',
  'https://rpc.sepolia.org',
] as const

/**
 * WebSocket Sepolia RPC (이벤트 구독용)
 * - 일부 제공자는 ws 경로를 별도로 요구할 수 있어, 실패 시 자동 폴백 로직을 사용합니다.
 */
export const SEPOLIA_WS_ENDPOINTS = [
  'wss://ethereum-sepolia-rpc.publicnode.com',
  'wss://sepolia.drpc.org/ws',
  'wss://1rpc.io/sepolia/ws',
] as const

/** 지갑에 네트워크 추가 시 사용하는 RPC URL */
export const SEPOLIA_RPC = SEPOLIA_RPC_ENDPOINTS[0]

/** 브라우저 읽기 전용 호출은 App Router API로 프록시 (CORS 회피) */
export const SEPOLIA_READ_RPC_PATH = '/api/sepolia-rpc'

export const contract = {
  address: '0x794000Cf1B7CeCFA4355E1582ED6348895Eef766',
  abi: [
    {
      inputs: [],
      stateMutability: 'nonpayable',
      type: 'constructor',
    },
    {
      inputs: [],
      name: 'CounterUnderflow',
      type: 'error',
    },
    {
      inputs: [],
      name: 'NotOwner',
      type: 'error',
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: false,
          internalType: 'uint256',
          name: 'newValue',
          type: 'uint256',
        },
        {
          indexed: true,
          internalType: 'address',
          name: 'actor',
          type: 'address',
        },
      ],
      name: 'CounterChanged',
      type: 'event',
    },
    {
      inputs: [],
      name: 'decrementCounter',
      outputs: [],
      stateMutability: 'nonpayable',
      type: 'function',
    },
    {
      inputs: [],
      name: 'incrementCounter',
      outputs: [],
      stateMutability: 'nonpayable',
      type: 'function',
    },
    {
      inputs: [],
      name: 'resetCounter',
      outputs: [],
      stateMutability: 'nonpayable',
      type: 'function',
    },
    {
      inputs: [],
      name: 'getCounter',
      outputs: [
        {
          internalType: 'uint256',
          name: '',
          type: 'uint256',
        },
      ],
      stateMutability: 'view',
      type: 'function',
    },
    {
      inputs: [],
      name: 'owner',
      outputs: [
        {
          internalType: 'address',
          name: '',
          type: 'address',
        },
      ],
      stateMutability: 'view',
      type: 'function',
    },
  ],
}
