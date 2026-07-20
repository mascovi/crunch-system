import { NextRequest, NextResponse } from 'next/server'
import { notificarNovaNF } from '@/services/telegram'

/**
 * POST /api/notify/nova-nf
 *
 * Chamado pelo frontend após salvarNotaFiscal() com sucesso.
 * Envia notificação Telegram com dados da NF.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const { numero_nf, fornecedor, transportadora, volumes, itens } = body

    if (!numero_nf || !fornecedor) {
      return NextResponse.json(
        { error: 'numero_nf e fornecedor são obrigatórios' },
        { status: 400 }
      )
    }

    const enviado = await notificarNovaNF({
      numero_nf,
      fornecedor,
      transportadora: transportadora || '',
      volumes: volumes || 0,
      itens: itens || [],
    })

    return NextResponse.json({ ok: enviado })
  } catch (err) {
    console.error('[notify/nova-nf] Erro:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
