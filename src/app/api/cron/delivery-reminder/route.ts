import { NextRequest, NextResponse } from 'next/server'
import { buscarNFsComEstimativa } from '@/services/entregas'
import { notificarEntregaProxima } from '@/services/telegram'

/**
 * GET /api/cron/delivery-reminder
 *
 * Vercel Cron — roda todos os dias às 11:00 UTC (8:00 BRT).
 * Verifica NFs em trânsito cuja estimativa_entrega é amanhã
 * e envia notificação no Telegram.
 */
export async function GET(req: NextRequest) {
  // Segurança: verificar CRON_SECRET em produção
  const authHeader = req.headers.get('authorization')
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const nfs = await buscarNFsComEstimativa()

    // Calcular a data de amanhã (BRT = UTC-3)
    const agora = new Date()
    // Ajustar para BRT
    const agoraBRT = new Date(agora.getTime() - 3 * 60 * 60 * 1000)
    const amanha = new Date(agoraBRT)
    amanha.setDate(amanha.getDate() + 1)
    const amanhaStr = amanha.toISOString().split('T')[0] // YYYY-MM-DD

    let notificadas = 0

    for (const nf of nfs) {
      if (nf.estimativa_entrega === amanhaStr) {
        const ok = await notificarEntregaProxima({
          numero_nf: nf.numero_nf,
          fornecedor: nf.fornecedor,
          transportadora: nf.transportadora,
          data_emissao: nf.data_emissao,
          estimativa_entrega: nf.estimativa_entrega,
          dias_em_transito: nf.dias_em_transito,
        })
        if (ok) notificadas++
      }
    }

    return NextResponse.json({
      ok: true,
      total_em_transito: nfs.length,
      notificadas,
      data_alvo: amanhaStr,
    })
  } catch (err) {
    console.error('[cron/delivery-reminder] Erro:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
