import { NextResponse } from 'next/server'
import { lerNomesCurtos } from '@/services/google-sheets'

/**
 * GET /api/sheets/nomes-curtos
 *
 * Devolve { codigoML: nomeCurto } a partir da coluna DESCRIÇÃO do
 * BANCO_DE_DADOS. A tela de estoque usa isso para mostrar o nome curto em
 * destaque e o título do anúncio abaixo.
 *
 * CACHE: a lista muda raramente — só quando um produto novo é cadastrado.
 * Bater no Google a cada abertura da tela de estoque seria desperdício e
 * deixaria a página mais lenta. Cinco minutos é curto o bastante para um
 * cadastro novo aparecer sozinho, e longo o bastante para o uso normal do
 * dia não gerar chamada nenhuma.
 */
const VALIDADE_MS = 5 * 60 * 1000

let cache: { em: number; nomes: Record<string, string> } | null = null

export async function GET() {
  const agora = Date.now()

  if (cache && agora - cache.em < VALIDADE_MS) {
    return NextResponse.json({ ok: true, nomes: cache.nomes, doCache: true })
  }

  const resultado = await lerNomesCurtos()

  if (resultado.ok && resultado.nomes) {
    cache = { em: agora, nomes: resultado.nomes }
    return NextResponse.json({ ok: true, nomes: resultado.nomes, doCache: false })
  }

  // Falhou agora, mas temos uma versão antiga: melhor um nome curto velho do
  // que nenhum. A tela não quebra por causa da planilha.
  if (cache) {
    return NextResponse.json({
      ok: true,
      nomes: cache.nomes,
      doCache: true,
      aviso: resultado.error,
    })
  }

  console.error('[sheets/nomes-curtos] Erro:', resultado.error)
  return NextResponse.json({ ok: false, error: resultado.error }, { status: 500 })
}
