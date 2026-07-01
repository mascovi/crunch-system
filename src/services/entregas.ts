import { supabase } from '@/lib/supabase'

// ============================================
// ESTIMATIVA DE ENTREGA POR TRANSPORTADORA
// ============================================

export interface EstatisticaTransportadora {
  transportadora: string
  total_nfs: number
  entregues: number
  em_transito: number
  media_dias: number | null
  min_dias: number | null
  max_dias: number | null
}

export interface NFEmTransitoEstimativa {
  id: string
  numero_nf: string
  fornecedor: string
  transportadora: string
  data_emissao: string
  dias_em_transito: number
  estimativa_dias: number | null
  estimativa_entrega: string | null
  status_estimativa: 'no_prazo' | 'atencao' | 'atrasado' | 'sem_dados'
}

/**
 * Busca estatísticas de entrega agrupadas por transportadora.
 */
export async function buscarEstatisticasEntrega(): Promise<EstatisticaTransportadora[]> {
  const { data: nfs, error } = await supabase
    .from('notas_fiscais')
    .select('transportadora, status, data_emissao, data_recebimento')

  if (error) throw new Error(`Erro ao buscar NFs: ${error.message}`)
  if (!nfs || nfs.length === 0) return []

  // Agrupar por transportadora
  const grupos: Record<string, {
    total: number
    entregues: number
    em_transito: number
    dias: number[]
  }> = {}

  for (const nf of nfs) {
    const transp = nf.transportadora || 'SEM TRANSPORTADORA'
    if (!grupos[transp]) {
      grupos[transp] = { total: 0, entregues: 0, em_transito: 0, dias: [] }
    }
    grupos[transp].total++

    if (nf.status === 'ENTREGUE') {
      grupos[transp].entregues++
      if (nf.data_emissao && nf.data_recebimento) {
        const emissao = new Date(nf.data_emissao)
        const recebimento = new Date(nf.data_recebimento)
        const dias = Math.round((recebimento.getTime() - emissao.getTime()) / (1000 * 60 * 60 * 24))
        if (dias >= 0) grupos[transp].dias.push(dias)
      }
    } else {
      grupos[transp].em_transito++
    }
  }

  // Converter para array
  const resultado: EstatisticaTransportadora[] = Object.entries(grupos).map(([transp, g]) => {
    const media = g.dias.length > 0 ? Math.round((g.dias.reduce((a, b) => a + b, 0) / g.dias.length) * 10) / 10 : null
    const min = g.dias.length > 0 ? Math.min(...g.dias) : null
    const max = g.dias.length > 0 ? Math.max(...g.dias) : null

    return {
      transportadora: transp,
      total_nfs: g.total,
      entregues: g.entregues,
      em_transito: g.em_transito,
      media_dias: media,
      min_dias: min,
      max_dias: max,
    }
  })

  // Ordenar: com dados primeiro (por média crescente), sem dados por último
  resultado.sort((a, b) => {
    if (a.media_dias === null && b.media_dias === null) return 0
    if (a.media_dias === null) return 1
    if (b.media_dias === null) return -1
    return a.media_dias - b.media_dias
  })

  return resultado
}

/**
 * Busca NFs em trânsito com estimativa de entrega baseada no histórico da transportadora.
 */
export async function buscarNFsComEstimativa(): Promise<NFEmTransitoEstimativa[]> {
  // Buscar estatísticas primeiro
  const stats = await buscarEstatisticasEntrega()
  const mediasPorTransp: Record<string, number> = {}
  const maxPorTransp: Record<string, number> = {}
  for (const s of stats) {
    if (s.media_dias !== null) {
      mediasPorTransp[s.transportadora] = s.media_dias
      maxPorTransp[s.transportadora] = s.max_dias!
    }
  }

  // Buscar NFs em trânsito
  const { data: nfs, error } = await supabase
    .from('notas_fiscais')
    .select('id, numero_nf, fornecedor, transportadora, data_emissao')
    .eq('status', 'EM_TRANSITO')
    .order('data_emissao', { ascending: true })

  if (error) throw new Error(`Erro ao buscar NFs em trânsito: ${error.message}`)
  if (!nfs || nfs.length === 0) return []

  const hoje = new Date()

  return nfs.map(nf => {
    const transp = nf.transportadora || 'SEM TRANSPORTADORA'
    const emissao = new Date(nf.data_emissao)
    const diasEmTransito = Math.round((hoje.getTime() - emissao.getTime()) / (1000 * 60 * 60 * 24))
    const estimativaDias = mediasPorTransp[transp] ?? null
    const maxDias = maxPorTransp[transp] ?? null

    let estimativaEntrega: string | null = null
    let statusEstimativa: 'no_prazo' | 'atencao' | 'atrasado' | 'sem_dados' = 'sem_dados'

    if (estimativaDias !== null) {
      const dataEstimada = new Date(emissao)
      dataEstimada.setDate(dataEstimada.getDate() + Math.ceil(estimativaDias))
      estimativaEntrega = dataEstimada.toISOString().split('T')[0]

      if (diasEmTransito <= estimativaDias) {
        statusEstimativa = 'no_prazo'
      } else if (maxDias !== null && diasEmTransito <= maxDias) {
        statusEstimativa = 'atencao'
      } else {
        statusEstimativa = 'atrasado'
      }
    }

    return {
      id: nf.id,
      numero_nf: nf.numero_nf,
      fornecedor: nf.fornecedor,
      transportadora: transp,
      data_emissao: nf.data_emissao,
      dias_em_transito: diasEmTransito,
      estimativa_dias: estimativaDias,
      estimativa_entrega: estimativaEntrega,
      status_estimativa: statusEstimativa,
    }
  })
}
