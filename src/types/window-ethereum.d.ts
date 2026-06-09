import type { Eip1193Provider } from 'ethers'

/** MetaMask 등이 EIP-1193 위에 노출하는 이벤트 API (표준에는 없음) */
type InjectedEthereum = Eip1193Provider & {
  on?(event: string, handler: (...args: unknown[]) => void): void
  removeListener?(event: string, handler: (...args: unknown[]) => void): void
}

declare global {
  interface Window {
    ethereum?: InjectedEthereum
  }
}

export {}
