import { NextRequest, NextResponse } from 'next/server'
import { notificarNFEntregue } from '@/services/telegram'

/**
 * POST /api/notas-fiscais/entregue
 *
 * Dispara o aviso de Telegram quando uma NF é marcada como entregue.
 *
 * Roda no SERVIDOR porque o token do bot nunca pode chegar ao navegador —
 * qualquer pessoa com o token manda mensagem pelo bot.
 *
 * A entrada no estoque continua sendo feita pela tela, antes desta chamada.
 * Separado de propósito: se o Telegram cair, o recebimento já está registrado
 * e só o aviso falha. O contrário — perder a entrada porque o Telegram falhou
 * — seria muito pior.
 *
 * Sempre devolve 200 com { ok, error }. Falha de notificação não é falha da
 * operação, e a tela mostra o motivo exato em vez de ficar calada.
 */
export async function POST(req: NextRequest) {
  const deploy = (process.env.VERCEL_GIT_COMMIT_SHA || 'local').substring(0, 7)

  try {
    const corpo = await req.json()

    const numero_nf = String(corpo.numero_nf || '').trim()
    if (!numero_nf) {
      return NextResponse.json(
        { ok: false, error: 'Número da NF não informado.', deploy },
        { status: 400 }
      )
    }

    const itens = Array.isArray(corpo.itens)
      ? corpo.itens.map((i: { produto?: string; quantidade?: number }) => ({
          produto: String(i.produto || 'Produto sem nome'),
          quantidade: Number(i.quantidade) || 0,
        }))
      : []

    const resultado = await notificarNFEntregue({
      numero_nf,
      fornecedor: String(corpo.fornecedor || ''),
      transportadora: String(corpo.transportadora || ''),
      volumes: Number(corpo.volumes) || 0,
      data_emissao: corpo.data_emissao ? String(corpo.data_emissao) : undefined,
      dias_em_transito:
        corpo.dias_em_transito === null || corpo.dias_em_transito === undefined
          ? null
          : Number(corpo.dias_em_transito),
      itens,
    })

    console.log('[notas-fiscais/entregue]', numero_nf, resultado)
    return NextResponse.json({ ...resultado, deploy })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno'
    console.error('[notas-fiscais/entregue] Erro:', err)
    return NextResponse.json({ ok: false, error: msg, deploy })
  }
}
