import { NextResponse } from 'next/server'
import { lerDadosProdutos } from '@/services/google-sheets'

/**
 * GET /api/sheets/produtos
 *
 * Devolve { codigoML: { nomeCurto, itensPorVolume } } a partir do
 * BANCO_DE_DADOS. É o que permite a tela mostrar quantas caixas de cada
 * item vêm numa nota.
 *
 * CACHE: mesma lógica do /api/sheets/nomes-curtos — a tabela só muda quando
 * um produto novo é cadastrado, então 5 minutos evita bater no Google a cada
 * nota aberta sem atrasar um cadastro recente.
 */
const VALIDADE_MS = 5 * 60 * 1000

let cache: { em: number; produtos: Record<string, { nomeCurto: string; itensPorVolume: number }> } | null =
  null

export async function GET() {
  const agora = Date.now()

  if (cache && agora - cache.em < VALIDADE_MS) {
    return NextResponse.json({ ok: true, produtos: cache.produtos, doCache: true })
  }

  const resultado = await lerDadosProdutos()

  if (resultado.ok && resultado.produtos) {
    cache = { em: agora, produtos: resultado.produtos }
    return NextResponse.json({ ok: true, produtos: resultado.produtos, doCache: false })
  }

  // Falhou agora, mas temos versão antiga: melhor dado velho que nenhum.
  // A tela não pode quebrar porque a planilha está fora do ar.
  if (cache) {
    return NextResponse.json({
      ok: true,
      produtos: cache.produtos,
      doCache: true,
      aviso: resultado.error,
    })
  }

  console.error('[sheets/produtos] Erro:', resultado.error)
  return NextResponse.json({ ok: false, error: resultado.error }, { status: 500 })
}
