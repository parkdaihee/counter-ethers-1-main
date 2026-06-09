'use client'

import {
  BrowserProvider,
  Contract,
  JsonRpcProvider,
  WebSocketProvider,
  type ContractTransactionResponse,
} from 'ethers'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  SEPOLIA_CHAIN_ID,
  SEPOLIA_READ_RPC_PATH,
  SEPOLIA_RPC,
  SEPOLIA_WS_ENDPOINTS,
  contract as counterContract,
} from '../contract'

type Status = 'idle' | 'connecting' | 'pending'

function shortenAddress(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

function parseContractError(e: unknown): string {
  if (
    e &&
    typeof e === 'object' &&
    'reason' in e &&
    typeof (e as { reason?: string }).reason === 'string'
  ) {
    return (e as { reason: string }).reason
  }
  if (e instanceof Error) return e.message
  return String(e)
}

export default function CounterApp() {
  const [readProvider, setReadProvider] = useState<JsonRpcProvider | null>(null)
  const [wsProvider, setWsProvider] = useState<WebSocketProvider | null>(null)
  const [wsOk, setWsOk] = useState(false)
  const [wsRpcUrl, setWsRpcUrl] = useState<string | null>(null)
  const [readRpcUrl, setReadRpcUrl] = useState<string | null>(null)

  const [counter, setCounter] = useState<string | null>(null)
  const [owner, setOwner] = useState<string | null>(null)
  const [account, setAccount] = useState<string | null>(null)
  const [chainOk, setChainOk] = useState(false)
  const [status, setStatus] = useState<Status>('idle')
  const [message, setMessage] = useState<string | null>(null)
  /** SSR과 첫 페인트 이후 동일하게 맞추기 위해 마운트 후에만 지갑 존재 여부 판별 */
  const [walletReady, setWalletReady] = useState<'unknown' | 'none' | 'ok'>(
    'unknown',
  )

  useEffect(() => {
    const url = `${window.location.origin}${SEPOLIA_READ_RPC_PATH}`
    setReadRpcUrl(url)
    setReadProvider(new JsonRpcProvider(url))
  }, [])

  useEffect(() => {
    let cancelled = false
    let p: WebSocketProvider | null = null

    async function connectWs() {
      for (const url of SEPOLIA_WS_ENDPOINTS) {
        try {
          p = new WebSocketProvider(url)
          // getNetwork() 호출이 성공하면 연결 가능한 것으로 간주
          await p.getNetwork()
          if (cancelled) {
            try {
              p.destroy()
            } catch {}
            return
          }
          setWsProvider(p)
          setWsOk(true)
          setWsRpcUrl(url)
          return
        } catch {
          try {
            p?.destroy()
          } catch {}
          p = null
          continue
        }
      }
      if (!cancelled) {
        setWsProvider(null)
        setWsOk(false)
        setWsRpcUrl(null)
      }
    }

    void connectWs()

    return () => {
      cancelled = true
      try {
        p?.destroy()
      } catch {}
    }
  }, [])

  const readOnlyContract = useMemo(() => {
    if (!readProvider) return null
    return new Contract(
      counterContract.address,
      counterContract.abi,
      readProvider,
    )
  }, [readProvider])

  const wsContract = useMemo(() => {
    if (!wsProvider) return null
    return new Contract(
      counterContract.address,
      counterContract.abi,
      wsProvider,
    )
  }, [wsProvider])

  const refreshRead = useCallback(async () => {
    if (!readOnlyContract) return
    try {
      const [value, ownerAddr] = await Promise.all([
        readOnlyContract.getCounter() as Promise<bigint>,
        readOnlyContract.owner() as Promise<string>,
      ])
      setCounter(value.toString())
      setOwner(ownerAddr)
    } catch (e) {
      setMessage(parseContractError(e))
    }
  }, [readOnlyContract])

  const syncWallet = useCallback(async () => {
    const eth = typeof window !== 'undefined' ? window.ethereum : undefined
    if (!eth) return
    const provider = new BrowserProvider(eth)
    const network = await provider.getNetwork()
    const cid = Number(network.chainId)
    setChainOk(cid === SEPOLIA_CHAIN_ID)
    const signer = await provider.getSigner().catch(() => null)
    if (signer) {
      setAccount(await signer.getAddress())
    } else {
      setAccount(null)
    }
  }, [])

  useEffect(() => {
    void refreshRead()
  }, [refreshRead])

  useEffect(() => {
    // WS 이벤트 구독이 가능하면 WS를 우선 사용 (HTTP 폴링으로 /api 반복 호출 감소)
    const c = wsContract ?? readOnlyContract
    if (!c) return
    const onChanged = () => {
      void refreshRead()
    }
    c.on('CounterChanged', onChanged)
    return () => {
      c.off('CounterChanged', onChanged)
    }
  }, [readOnlyContract, refreshRead, wsContract])

  useEffect(() => {
    const eth = typeof window !== 'undefined' ? window.ethereum : undefined
    if (!eth?.on) return

    const handleAccounts = (...args: unknown[]) => {
      const accs = args[0] as string[] | undefined
      setAccount(accs?.[0] ?? null)
    }
    const handleChain = () => {
      void syncWallet()
    }

    eth.on('accountsChanged', handleAccounts)
    eth.on('chainChanged', handleChain)

    return () => {
      eth.removeListener?.('accountsChanged', handleAccounts)
      eth.removeListener?.('chainChanged', handleChain)
    }
  }, [syncWallet])

  useEffect(() => {
    setWalletReady(
      typeof window !== 'undefined' && window.ethereum ? 'ok' : 'none',
    )
  }, [])

  useEffect(() => {
    void syncWallet()
  }, [syncWallet])

  async function connect() {
    const eth = typeof window !== 'undefined' ? window.ethereum : undefined
    if (!eth) {
      setMessage('MetaMask 등 EIP-1193 지갑이 필요합니다.')
      return
    }
    setStatus('connecting')
    setMessage(null)
    try {
      await eth.request({ method: 'eth_requestAccounts' })
      await syncWallet()
    } catch (e) {
      setMessage(parseContractError(e))
    } finally {
      setStatus('idle')
    }
  }

  async function switchToSepolia() {
    const eth = typeof window !== 'undefined' ? window.ethereum : undefined
    if (!eth) return
    setMessage(null)
    try {
      await eth.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${SEPOLIA_CHAIN_ID.toString(16)}` }],
      })
    } catch (e: unknown) {
      const code =
        e && typeof e === 'object' && 'code' in e
          ? (e as { code: number }).code
          : undefined
      if (code === 4902) {
        await eth.request({
          method: 'wallet_addEthereumChain',
          params: [
            {
              chainId: `0x${SEPOLIA_CHAIN_ID.toString(16)}`,
              chainName: 'Sepolia',
              nativeCurrency: {
                name: 'Sepolia Ether',
                symbol: 'ETH',
                decimals: 18,
              },
              rpcUrls: [SEPOLIA_RPC],
              blockExplorerUrls: ['https://sepolia.etherscan.io'],
            },
          ],
        })
      } else {
        setMessage(parseContractError(e))
      }
    }
    await syncWallet()
  }

  async function runTx(
    label: string,
    fn: (c: Contract) => Promise<ContractTransactionResponse>,
  ) {
    const eth = typeof window !== 'undefined' ? window.ethereum : undefined
    if (!eth || !account || !chainOk) {
      setMessage('Sepolia에 연결된 지갑이 필요합니다.')
      return
    }
    setStatus('pending')
    setMessage(null)
    try {
      const provider = new BrowserProvider(eth)
      const signer = await provider.getSigner()
      const c = new Contract(
        counterContract.address,
        counterContract.abi,
        signer,
      )
      const tx = await fn(c)
      await tx.wait()
      setMessage(`${label} 트랜잭션이 반영되었습니다.`)
      await refreshRead()
    } catch (e) {
      setMessage(parseContractError(e))
    } finally {
      setStatus('idle')
    }
  }

  const busy = status !== 'idle'
  const canTx = Boolean(account && chainOk && !busy)

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-8 px-4 py-16">
      <header className="space-y-2 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Sepolia 온체인 카운터
        </h1>

        <div className="mx-auto grid w-full max-w-md gap-1 text-left text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-zinc-500 dark:text-zinc-400">
              컨트랙트 주소
            </span>
            <a
              className="font-mono text-zinc-900 underline decoration-zinc-400 underline-offset-2 hover:decoration-zinc-600 dark:text-zinc-100"
              href={`https://sepolia.etherscan.io/address/${counterContract.address}`}
              target="_blank"
              rel="noreferrer"
            >
              {shortenAddress(counterContract.address)}
            </a>
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="text-zinc-500 dark:text-zinc-400">지갑 주소</span>
            <span className="font-mono text-zinc-800 dark:text-zinc-200">
              {account ? shortenAddress(account) : '—'}
            </span>
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="text-zinc-500 dark:text-zinc-400">
              이벤트 구독
            </span>
            <span className="font-mono text-zinc-800 dark:text-zinc-200">
              webSocket{wsOk ? '' : ' (HTTP 폴백)'}
            </span>
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="text-zinc-500 dark:text-zinc-400">연결된 RPC</span>
            <span className="font-mono text-zinc-800 dark:text-zinc-200">
              {wsRpcUrl ?? '—'}
            </span>
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="text-zinc-500 dark:text-zinc-400">읽기 RPC</span>
            <span className="font-mono text-zinc-800 dark:text-zinc-200">
              {readRpcUrl ?? '—'}
            </span>
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="text-zinc-500 dark:text-zinc-400">라이브러리</span>
            <span className="font-mono text-zinc-800 dark:text-zinc-200">
              ethers.js
            </span>
          </div>
        </div>
      </header>

      <section className="rounded-2xl border border-zinc-200 bg-white/80 p-8 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
        <div className="mb-8 text-center">
          <p className="font-mono text-7xl font-semibold tabular-nums tracking-tight text-zinc-900 dark:text-zinc-50">
            {counter ?? '—'}
          </p>
        </div>

        <div className="flex flex-col gap-3 border-t border-zinc-100 pt-6 dark:border-zinc-800">
          {walletReady === 'unknown' ? (
            <p className="text-center text-sm text-zinc-500">로딩 중…</p>
          ) : walletReady === 'none' ? (
            <p className="text-center text-sm text-amber-700 dark:text-amber-400">
              브라우저에 지갑 확장 프로그램을 설치하면 트랜잭션을 보낼 수
              있습니다. 읽기 전용 값은 위에 표시됩니다.
            </p>
          ) : !account ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void connect()}
              className="h-11 rounded-xl bg-zinc-900 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {status === 'connecting' ? '연결 중…' : '지갑 연결'}
            </button>
          ) : (
            <>
              {!chainOk ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void switchToSepolia()}
                  className="h-11 rounded-xl border border-amber-300 bg-amber-50 text-sm font-medium text-amber-900 transition hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-100 dark:hover:bg-amber-900/40"
                >
                  Sepolia 네트워크로 전환
                </button>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    disabled={!canTx}
                    onClick={() =>
                      void runTx('증가', (c) => c.incrementCounter())
                    }
                    className="h-14 rounded-2xl bg-emerald-600 text-3xl font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-40"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    disabled={!canTx}
                    onClick={() =>
                      void runTx('초기화', (c) => c.resetCounter())
                    }
                    className="h-14 rounded-2xl bg-sky-600 text-xl font-semibold text-white transition hover:bg-sky-500 disabled:opacity-40 dark:bg-sky-500 dark:hover:bg-sky-400"
                  >
                    초기화
                  </button>
                  <button
                    type="button"
                    disabled={!canTx}
                    onClick={() =>
                      void runTx('감소', (c) => c.decrementCounter())
                    }
                    className="h-14 rounded-2xl bg-rose-600 text-3xl font-semibold text-white transition hover:bg-rose-500 disabled:opacity-40 dark:bg-rose-500 dark:hover:bg-rose-400"
                  >
                    -
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {message && (
          <p className="mt-4 rounded-lg bg-zinc-100 px-3 py-2 text-center text-sm text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
            {message}
          </p>
        )}
        {status === 'pending' && (
          <p className="mt-2 text-center text-xs text-zinc-500">
            트랜잭션 확인 대기 중…
          </p>
        )}
      </section>
    </div>
  )
}
