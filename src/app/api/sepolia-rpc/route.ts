import { SEPOLIA_RPC_ENDPOINTS } from '@/app/contract'

function looksLikeJsonRpcBody(text: string) {
  const t = text.trimStart()
  return t.startsWith('{') || t.startsWith('[')
}

/**
 * 브라우저 → 공개 RPC 직접 호출은 CORS로 막히는 경우가 많아,
 * 서버에서 동일한 JSON-RPC 요청을 전달합니다.
 * 단일 엔드포인트(예: rpc.sepolia.org)가 522로 HTML을 돌려도 다음 URL을 시도합니다.
 */
export async function POST(req: Request) {
  const body = await req.text()

  for (const url of SEPOLIA_RPC_ENDPOINTS) {
    try {
      const upstream = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        cache: 'no-store',
        signal: AbortSignal.timeout(25_000),
      })

      const text = await upstream.text()

      if (!looksLikeJsonRpcBody(text)) {
        continue
      }

      const ct = upstream.headers.get('content-type') ?? ''
      return new Response(text, {
        status: upstream.status,
        headers: {
          'Content-Type': ct.includes('json') ? ct : 'application/json',
        },
      })
    } catch {
      continue
    }
  }

  return Response.json(
    {
      error:
        '사용 가능한 Sepolia RPC에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.',
    },
    { status: 502 },
  )
}
