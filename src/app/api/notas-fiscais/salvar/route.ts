import { NextRequest, NextResponse } from 'next/server'
import { salvarNotaFiscal } from '@/services/notas-fiscais'
import { notificarNovaNF } from '@/services/telegram'

/**
 * POST /api/notas-fiscais/salvar
 *
 * Salva a NF e seus itens no banco E notifica no Telegram — tudo server-side.
 *
 * POR QUE A NOTIFICACAO MORA AQUI:
 * Ja tentamos disparar do clique do botao, no navegador. Falhava sempre que o
 * browser estava com bundle antigo em cache: a nota era salva pelo fluxo velho
 * e a notificacao nunca acontecia. O cron de lembrete de entrega, que roda no
 * servidor, nunca falhou pelo mesmo motivo inverso — nao depende do navegador.
 * Entao a notificacao ficou aqui, no unico ponto por onde toda NF salva passa.
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

    // 2. Notificar no Telegram. Uma falha aqui nao invalida o salvamento —
    //    a NF ja esta no banco. Mas o motivo volta na resposta para aparecer
    //    na tela, em vez de sumir em silencio.
    let telegramOk = false
    let telegramErro = ''
    try {
      const r = await notificarNovaNF({
        numero_nf: parsedNF.numero_nf,
        fornecedor: parsedNF.fornecedor,
        transportadora: parsedNF.transportadora || '',
        volumes: parsedNF.volumes || 0,
        itens: (parsedNF.itens || []).map(
          (it: { produto: string; quantidade: number }) => ({
            produto: it.produto,
            quantidade: it.quantidade,
          })
        ),
      })
      telegramOk = r.ok
      telegramErro = r.error || ''
      console.log('[salvar-nf] Telegram:', r)
    } catch (notifyErr) {
      telegramErro =
        notifyErr instanceof Error ? notifyErr.message : String(notifyErr)
      console.error('[salvar-nf] Falha ao notificar:', notifyErr)
    }

    return NextResponse.json({ ok: true, nf, telegramOk, telegramErro })
  } catch (err) {
    console.error('[salvar-nf] Erro:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao salvar NF' },
      { status: 500 }
    )
  }
}
