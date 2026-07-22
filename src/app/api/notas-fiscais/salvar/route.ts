import { NextRequest, NextResponse } from 'next/server'
import { salvarNotaFiscal } from '@/services/notas-fiscais'
import { notificarNovaNF } from '@/services/telegram'

/**
 * POST /api/notas-fiscais/salvar
 *
 * Salva NF no banco + envia notificacao Telegram — tudo server-side.
 * Garante que a notificacao sempre dispara quando a NF eh salva.
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

    // 1. Salvar NF e itens no banco
    const nf = await salvarNotaFiscal(parsedNF, xmlUrl || '')

    // 2. Notificar no Telegram (nao bloqueia em caso de falha)
    let telegramOk = false
    try {
      telegramOk = await notificarNovaNF({
        numero_nf: parsedNF.numero_nf,
        fornecedor: parsedNF.fornecedor,
        transportadora: parsedNF.transportadora || '',
        volumes: parsedNF.volumes || 0,
        itens: (parsedNF.itens || []).map((it: { produto: string; quantidade: number }) => ({
          produto: it.produto,
          quantidade: it.quantidade,
        })),
      })
      console.log('[Telegram] Notificacao enviada:', telegramOk)
    } catch (notifyErr) {
      console.error('[Telegram] Falha ao notificar:', notifyErr)
    }

    return NextResponse.json({ ok: true, nf, telegramOk })
  } catch (err) {
    console.error('[salvar-nf] Erro:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao salvar NF' },
      { status: 500 }
    )
  }
}
