import { NextRequest, NextResponse } from 'next/server'
import { salvarNoBancoDeDados } from '@/services/google-sheets'

/**
 * POST /api/sheets/banco-de-dados
 *
 * Acrescenta (ou atualiza) um produto na aba BANCO_DE_DADOS da planilha —
 * a tabela que a aba de envio consulta por PROCV.
 *
 * Roda no servidor porque as credenciais da conta de servico nunca podem
 * chegar ao navegador.
 */
export async function POST(req: NextRequest) {
  try {
    const corpo = await req.json()

    const codigoMl = String(corpo.codigoMl || '').trim().toUpperCase()
    const descricao = String(corpo.descricao || '').trim()
    const fornecedor = String(corpo.fornecedor || '').trim()
    const variacao = String(corpo.variacao || '').trim()
    const itensPorVolume = Number(corpo.itensPorVolume)
    const kgUnitario = Number(corpo.kgUnitario)
    // Só atualiza linha existente quando a tela pediu explicitamente
    const permitirAtualizar = corpo.permitirAtualizar === true

    const problemas = [
      !codigoMl && 'código ML',
      !descricao && 'descrição',
      !fornecedor && 'fornecedor',
      (!Number.isFinite(itensPorVolume) || itensPorVolume <= 0) && 'itens por caixa',
      (!Number.isFinite(kgUnitario) || kgUnitario <= 0) && 'peso unitário',
    ].filter(Boolean)

    if (problemas.length > 0) {
      return NextResponse.json(
        { ok: false, error: `Faltou preencher: ${problemas.join(', ')}.` },
        { status: 400 }
      )
    }

    const resultado = await salvarNoBancoDeDados(
      { codigoMl, descricao, fornecedor, variacao, itensPorVolume, kgUnitario },
      permitirAtualizar
    )
    const deploy = (process.env.VERCEL_GIT_COMMIT_SHA || 'local').substring(0, 7)

    console.log('[sheets/banco-de-dados]', resultado)
    return NextResponse.json({ ...resultado, deploy }, { status: resultado.ok ? 200 : 500 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno'
    console.error('[sheets/banco-de-dados] Erro:', err)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
