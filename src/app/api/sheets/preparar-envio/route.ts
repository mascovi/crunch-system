import { NextRequest, NextResponse } from 'next/server'
import { criarAbaDeEnvio } from '@/services/google-sheets'

/**
 * POST /api/sheets/preparar-envio
 *
 * Recebe os itens já extraídos na aba Preparar FULL, duplica a aba modelo
 * na planilha do Google e escreve códigos (coluna D) e quantidades (coluna F)
 * a partir da linha 8.
 *
 * Roda no servidor porque as credenciais da conta de serviço nunca podem
 * chegar ao navegador.
 */
export async function POST(req: NextRequest) {
  try {
    const { itens } = await req.json()

    if (!Array.isArray(itens) || itens.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'Nenhum item recebido.' },
        { status: 400 }
      )
    }

    // Só o que a planilha precisa, validado
    const limpos = itens
      .map((i: { codigo?: string; quantidade?: number }) => ({
        codigo: String(i.codigo || '').trim().toUpperCase(),
        quantidade: Number(i.quantidade),
      }))
      .filter((i) => i.codigo && Number.isFinite(i.quantidade) && i.quantidade > 0)

    if (limpos.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'Os itens recebidos não têm código ou quantidade válidos.' },
        { status: 400 }
      )
    }

    const resultado = await criarAbaDeEnvio(limpos)
    const deploy = (process.env.VERCEL_GIT_COMMIT_SHA || 'local').substring(0, 7)

    console.log('[sheets/preparar-envio]', resultado)
    return NextResponse.json({ ...resultado, deploy }, { status: resultado.ok ? 200 : 500 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno'
    console.error('[sheets/preparar-envio] Erro:', err)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
