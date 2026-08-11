import { NextRequest, NextResponse } from 'next/server'
import { salvarNotaFiscal } from '@/services/notas-fiscais'

/**
 * POST /api/notas-fiscais/salvar
 *
 * Salva a NF e seus itens no banco (server-side).
 * A notificacao Telegram eh disparada separadamente pelo gatilho do botao.
 */
export async function POST(req: NextRequest) {
  try {
    const { parsedNF, xmlUrl } = await req.json()

    if (!parsedNF || !parsedNF.numero_nf) {
      return NextResponse.json(
        { error: 'parsedNF eh obrigatorio' },
        { status: 400 }
      )
    }

    // Salvar NF e itens no banco.
    // A notificacao Telegram NAO acontece aqui — ela eh disparada pelo
    // gatilho do botao "Confirmar e Enviar" via /api/notify/nova-nf,
    // para evitar mensagem duplicada.
    const nf = await salvarNotaFiscal(parsedNF, xmlUrl || '')

    return NextResponse.json({ ok: true, nf })
  } catch (err) {
    console.error('[salvar-nf] Erro:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao salvar NF' },
      { status: 500 }
    )
  }
}
