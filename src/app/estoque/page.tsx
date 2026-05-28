'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import Link from 'next/link'
import Papa from 'papaparse'
import { listarEstoque, ajustarEstoque, cadastrarProduto, buscarHistoricoCodigo } from '@/services/estoque'
import { validarCSVFull, processarEnvioFull, listarEnviosFull, buscarItensEnvio } from '@/services/full'
import { supabase } from '@/lib/supabase'
import type { SaldoEstoque, EnvioFull, EnvioFullItem, CSVFullItem, CSVFullHeader, MotivoAjuste, EstoqueMovimentacao } from '@/types'

// Tipo enriquecido com dados de referência
interface MovimentacaoEnriquecida extends EstoqueMovimentacao {
  ref_label?: string // "NF 12345" ou "Envio ML-ABC123"
}
import ConfirmModal from '@/components/ConfirmModal'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  PieLabelRenderProps,
} from 'recharts'

type Tab = 'estoque' | 'enviar-full' | 'historico'

const MOTIVOS: { value: MotivoAjuste; label: string }[] = [
  { value: 'DEVOLUCAO', label: 'Devolução' },
  { value: 'CONSUMO_PROPRIO', label: 'Consumo próprio' },
  { value: 'PROBLEMA_ENTREGA', label: 'Problema na entrega' },
  { value: 'EXTRAVIO', label: 'Extravio' },
  { value: 'CORRECAO_INVENTARIO', label: 'Correção de inventário' },
  { value: 'OUTRO', label: 'Outro' },
]

const PIE_COLORS = ['#ff6a00', '#f97316', '#fb923c', '#fdba74', '#fed7aa', '#ffedd5', '#c2410c', '#9a3412']

export default function EstoquePage() {
  const [tab, setTab] = useState<Tab>('estoque')

  return (
    <div className="min-h-screen bg-[#f8f9fc]">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 px-8 py-4">
        <div className="max-w-[1200px] mx-auto flex items-center gap-4">
          <Link
            href="/"
            className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center text-gray-400 hover:text-[#ff6a00] hover:border-[#ff6a00] transition-colors bg-white"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">Estoque</h1>
            <p className="text-xs text-gray-400 mt-0.5">Saldo por Código ML, envios FULL e histórico</p>
          </div>
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto px-8 py-6">
        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-white rounded-xl p-1 border border-gray-200 w-fit shadow-sm">
          {[
            { id: 'estoque' as Tab, label: 'Estoque' },
            { id: 'enviar-full' as Tab, label: 'Enviar FULL' },
            { id: 'historico' as Tab, label: 'Histórico FULL' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-5 py-2 text-sm font-medium rounded-lg transition-colors ${
                tab === t.id
                  ? 'bg-[#ff6a00] text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'estoque' && <TabEstoque />}
        {tab === 'enviar-full' && <TabEnviarFull />}
        {tab === 'historico' && <TabHistorico />}
      </div>
    </div>
  )
}

// ============================================
// TAB: ESTOQUE (REDESIGN)
// ============================================
function TabEstoque() {
  const [estoque, setEstoque] = useState<SaldoEstoque[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [filtroFornecedor, setFiltroFornecedor] = useState('')

  // Modal Ajuste
  const [ajusteOpen, setAjusteOpen] = useState(false)
  const [ajusteItem, setAjusteItem] = useState<SaldoEstoque | null>(null)
  const [ajusteQtd, setAjusteQtd] = useState('')
  const [ajusteTipo, setAjusteTipo] = useState<'entrada' | 'saida'>('saida')
  const [ajusteMotivo, setAjusteMotivo] = useState<MotivoAjuste>('CORRECAO_INVENTARIO')
  const [ajusteObs, setAjusteObs] = useState('')
  const [ajusteLoading, setAjusteLoading] = useState(false)
  const [ajusteError, setAjusteError] = useState('')
  const [ajusteSuccess, setAjusteSuccess] = useState('')

  // Modal Novo Produto
  const [novoProdOpen, setNovoProdOpen] = useState(false)
  const [novoCodigoMl, setNovoCodigoMl] = useState('')
  const [novoDescricao, setNovoDescricao] = useState('')
  const [novoFornecedor, setNovoFornecedor] = useState('')
  const [novoCodigoFornecedor, setNovoCodigoFornecedor] = useState('')
  const [novoQtdInicial, setNovoQtdInicial] = useState('')
  const [novoProdLoading, setNovoProdLoading] = useState(false)
  const [novoProdError, setNovoProdError] = useState('')
  const [novoProdSuccess, setNovoProdSuccess] = useState('')

  // Modal Histórico
  const [historicoOpen, setHistoricoOpen] = useState(false)
  const [historicoItem, setHistoricoItem] = useState<SaldoEstoque | null>(null)
  const [historicoData, setHistoricoData] = useState<MovimentacaoEnriquecida[]>([])
  const [historicoLoading, setHistoricoLoading] = useState(false)

  // Sort
  const [sortCol, setSortCol] = useState<'produto' | 'quantidade' | 'fornecedor' | 'preco'>('produto')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const carregarEstoque = useCallback(async () => {
    setLoading(true)
    try {
      const data = await listarEstoque()
      setEstoque(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    carregarEstoque()
  }, [carregarEstoque])

  // Fornecedores
  const fornecedores = Array.from(
    new Set(estoque.map((item) => item.fornecedor_principal).filter(Boolean))
  ).sort()

  // Filtro + busca
  const filtrado = useMemo(() => {
    let items = estoque.filter((item) => {
      const matchBusca =
        item.codigo_ml.toLowerCase().includes(busca.toLowerCase()) ||
        item.produto.toLowerCase().includes(busca.toLowerCase())
      const matchFornecedor = !filtroFornecedor || item.fornecedor_principal === filtroFornecedor
      return matchBusca && matchFornecedor
    })

    // Sort
    items.sort((a, b) => {
      let cmp = 0
      switch (sortCol) {
        case 'produto':
          cmp = a.produto.localeCompare(b.produto)
          break
        case 'quantidade':
          cmp = a.quantidade_disponivel - b.quantidade_disponivel
          break
        case 'fornecedor':
          cmp = (a.fornecedor_principal || '').localeCompare(b.fornecedor_principal || '')
          break
        case 'preco':
          cmp = a.preco_compra - b.preco_compra
          break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })

    return items
  }, [estoque, busca, filtroFornecedor, sortCol, sortDir])

  // KPIs
  const totalSKUs = estoque.length
  const totalUnidades = estoque.reduce((s, i) => s + i.quantidade_disponivel, 0)
  const valorTotal = estoque.reduce((s, i) => s + (i.preco_compra * Math.max(0, i.quantidade_disponivel)), 0)
  const alertaCount = estoque.filter((i) => i.quantidade_disponivel < 10).length
  const zeradoCount = estoque.filter((i) => i.quantidade_disponivel <= 0).length

  // Chart: distribuição por fornecedor
  const chartFornecedor = useMemo(() => {
    const mapa = new Map<string, number>()
    estoque.forEach((i) => {
      const f = i.fornecedor_principal || 'Sem fornecedor'
      mapa.set(f, (mapa.get(f) || 0) + i.quantidade_disponivel)
    })
    return Array.from(mapa.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [estoque])

  // Chart: top 10 produtos por quantidade
  const chartTopProdutos = useMemo(() => {
    return [...estoque]
      .sort((a, b) => b.quantidade_disponivel - a.quantidade_disponivel)
      .slice(0, 10)
      .map((i) => ({
        name: i.produto.length > 25 ? i.produto.substring(0, 25) + '...' : i.produto,
        qtd: i.quantidade_disponivel,
        fullName: i.produto,
      }))
  }, [estoque])

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '—'
    const d = new Date(dateStr)
    return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }

  const formatPreco = (valor: number) => {
    if (!valor || valor === 0) return '—'
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  const handleSort = (col: typeof sortCol) => {
    if (sortCol === col) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortCol(col)
      setSortDir('asc')
    }
  }

  const SortIcon = ({ col }: { col: typeof sortCol }) => (
    <span className="ml-1 text-[9px]">
      {sortCol === col ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
    </span>
  )

  // === Handlers Ajuste ===
  const openAjuste = (item: SaldoEstoque) => {
    setAjusteItem(item)
    setAjusteQtd('')
    setAjusteTipo('saida')
    setAjusteMotivo('CORRECAO_INVENTARIO')
    setAjusteObs('')
    setAjusteError('')
    setAjusteSuccess('')
    setAjusteOpen(true)
  }

  const handleAjuste = async () => {
    if (!ajusteItem) return
    const qtd = parseInt(ajusteQtd, 10)
    if (isNaN(qtd) || qtd <= 0) {
      setAjusteError('Informe uma quantidade válida maior que zero.')
      return
    }
    setAjusteLoading(true)
    setAjusteError('')
    try {
      const quantidade = ajusteTipo === 'saida' ? -qtd : qtd
      await ajustarEstoque({
        codigo_ml: ajusteItem.codigo_ml,
        produto: ajusteItem.produto,
        quantidade,
        motivo: ajusteMotivo,
        observacao: ajusteObs,
      })
      setAjusteSuccess(`Estoque de ${ajusteItem.codigo_ml} ajustado com sucesso.`)
      await carregarEstoque()
      setTimeout(() => {
        setAjusteOpen(false)
        setAjusteSuccess('')
      }, 1200)
    } catch (err) {
      setAjusteError(err instanceof Error ? err.message : 'Erro ao ajustar estoque.')
    } finally {
      setAjusteLoading(false)
    }
  }

  // === Handlers Novo Produto ===
  const openNovoProduto = () => {
    setNovoCodigoMl('')
    setNovoDescricao('')
    setNovoFornecedor('')
    setNovoCodigoFornecedor('')
    setNovoQtdInicial('')
    setNovoProdError('')
    setNovoProdSuccess('')
    setNovoProdOpen(true)
  }

  const handleNovoProduto = async () => {
    if (!novoCodigoMl.trim() || !novoDescricao.trim() || !novoFornecedor.trim()) {
      setNovoProdError('Preencha Código ML, descrição e fornecedor.')
      return
    }
    setNovoProdLoading(true)
    setNovoProdError('')
    try {
      await cadastrarProduto({
        codigo_ml: novoCodigoMl.trim().toUpperCase(),
        descricao: novoDescricao.trim(),
        fornecedor: novoFornecedor.trim(),
        codigo_fornecedor: novoCodigoFornecedor.trim() || undefined,
      })
      const qtdIni = parseInt(novoQtdInicial, 10)
      if (!isNaN(qtdIni) && qtdIni > 0) {
        await ajustarEstoque({
          codigo_ml: novoCodigoMl.trim().toUpperCase(),
          produto: novoDescricao.trim(),
          quantidade: qtdIni,
          motivo: 'CORRECAO_INVENTARIO',
          observacao: 'Estoque inicial no cadastro',
        })
      }
      setNovoProdSuccess(`Produto ${novoCodigoMl.trim().toUpperCase()} cadastrado!`)
      await carregarEstoque()
      setTimeout(() => {
        setNovoProdOpen(false)
        setNovoProdSuccess('')
      }, 1200)
    } catch (err) {
      setNovoProdError(err instanceof Error ? err.message : 'Erro ao cadastrar produto.')
    } finally {
      setNovoProdLoading(false)
    }
  }

  // === Handler Histórico ===
  const openHistorico = async (item: SaldoEstoque) => {
    setHistoricoItem(item)
    setHistoricoData([])
    setHistoricoLoading(true)
    setHistoricoOpen(true)
    try {
      const data = await buscarHistoricoCodigo(item.codigo_ml)

      // Enriquecer com referências (NF número, Envio código)
      const nfIds = data.filter(m => m.origem === 'NF_RECEBIMENTO').map(m => m.referencia_id)
      const envioIds = data.filter(m => m.origem === 'ENVIO_FULL').map(m => m.referencia_id)

      const nfMap = new Map<string, string>()
      const envioMap = new Map<string, string>()

      if (nfIds.length > 0) {
        const { data: nfs } = await supabase
          .from('notas_fiscais')
          .select('id, numero_nf, fornecedor')
          .in('id', nfIds)
        for (const nf of nfs || []) {
          nfMap.set(nf.id, `NF ${nf.numero_nf} — ${nf.fornecedor}`)
        }
      }

      if (envioIds.length > 0) {
        const { data: envios } = await supabase
          .from('envios_full')
          .select('id, codigo_envio_ml')
          .in('id', envioIds)
        for (const env of envios || []) {
          envioMap.set(env.id, `Envio ${env.codigo_envio_ml}`)
        }
      }

      const enriquecido: MovimentacaoEnriquecida[] = data.map(mov => {
        let ref_label: string | undefined
        if (mov.origem === 'NF_RECEBIMENTO') {
          ref_label = nfMap.get(mov.referencia_id)
        } else if (mov.origem === 'ENVIO_FULL') {
          ref_label = envioMap.get(mov.referencia_id)
        } else if (mov.origem.startsWith('AJUSTE_')) {
          // Extrair motivo legível do nome da origem
          const motivo = mov.origem.replace('AJUSTE_', '')
          const motivos: Record<string, string> = {
            'DEVOLUCAO': 'Devolução de mercadoria',
            'CONSUMO_PROPRIO': 'Consumo próprio',
            'PROBLEMA_ENTREGA': 'Problema na entrega',
            'EXTRAVIO': 'Extravio de mercadoria',
            'CORRECAO_INVENTARIO': 'Correção de inventário',
            'OUTRO': 'Outro motivo',
            'INICIAL': 'Carga inicial do sistema',
          }
          ref_label = motivos[motivo] || motivo
        }
        return { ...mov, ref_label }
      })

      setHistoricoData(enriquecido)
    } catch (err) {
      console.error(err)
    } finally {
      setHistoricoLoading(false)
    }
  }

  const formatOrigem = (origem: string): { label: string; color: string } => {
    if (origem === 'NF_RECEBIMENTO') return { label: 'Nota Fiscal', color: 'bg-blue-100 text-blue-700' }
    if (origem === 'ENVIO_FULL') return { label: 'Envio FULL', color: 'bg-purple-100 text-purple-700' }
    if (origem === 'AJUSTE_INICIAL') return { label: 'Estoque Inicial', color: 'bg-gray-100 text-gray-600' }
    if (origem === 'AJUSTE_DEVOLUCAO') return { label: 'Devolução', color: 'bg-green-100 text-green-700' }
    if (origem === 'AJUSTE_CONSUMO_PROPRIO') return { label: 'Consumo Próprio', color: 'bg-amber-100 text-amber-700' }
    if (origem === 'AJUSTE_PROBLEMA_ENTREGA') return { label: 'Problema Entrega', color: 'bg-red-100 text-red-700' }
    if (origem === 'AJUSTE_EXTRAVIO') return { label: 'Extravio', color: 'bg-red-100 text-red-700' }
    if (origem === 'AJUSTE_CORRECAO_INVENTARIO') return { label: 'Correção Inventário', color: 'bg-gray-100 text-gray-600' }
    if (origem === 'AJUSTE_OUTRO') return { label: 'Outro Ajuste', color: 'bg-gray-100 text-gray-600' }
    return { label: origem, color: 'bg-gray-100 text-gray-600' }
  }

  // Badge de alerta
  const getStockBadge = (qtd: number) => {
    if (qtd <= 0) return { bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-500', label: 'Zerado' }
    if (qtd < 10) return { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500', label: 'Baixo' }
    return { bg: 'bg-green-50', text: 'text-green-700', dot: 'bg-green-500', label: '' }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex items-center gap-3 text-gray-400">
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm">Carregando estoque...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ========== KPI CARDS ========== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total SKUs */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Total SKUs</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="5" height="5" rx="1" stroke="#3b82f6" strokeWidth="1.5"/><rect x="9" y="2" width="5" height="5" rx="1" stroke="#3b82f6" strokeWidth="1.5"/><rect x="2" y="9" width="5" height="5" rx="1" stroke="#3b82f6" strokeWidth="1.5"/><rect x="9" y="9" width="5" height="5" rx="1" stroke="#3b82f6" strokeWidth="1.5"/></svg>
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900">{totalSKUs}</div>
          <p className="text-xs text-gray-400 mt-1">produtos cadastrados</p>
        </div>

        {/* Total Unidades */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Unidades</span>
            <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2v12M2 8h12" stroke="#22c55e" strokeWidth="2" strokeLinecap="round"/></svg>
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900">{totalUnidades.toLocaleString('pt-BR')}</div>
          <p className="text-xs text-gray-400 mt-1">em estoque</p>
        </div>

        {/* Valor Total */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Valor Total</span>
            <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1v14M5 4h4.5a2.5 2.5 0 010 5H5M5 9h5a2.5 2.5 0 010 5H5" stroke="#f97316" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900">{valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
          <p className="text-xs text-gray-400 mt-1">preço médio × quantidade</p>
        </div>

        {/* Alertas */}
        <div className={`rounded-xl border p-5 shadow-sm ${alertaCount > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center justify-between mb-3">
            <span className={`text-xs font-medium uppercase tracking-wider ${alertaCount > 0 ? 'text-red-500' : 'text-gray-400'}`}>Alertas</span>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${alertaCount > 0 ? 'bg-red-100' : 'bg-gray-50'}`}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 5v3M8 11h.01M3.5 14h9a1 1 0 00.87-1.49l-4.5-8a1 1 0 00-1.74 0l-4.5 8A1 1 0 003.5 14z" stroke={alertaCount > 0 ? '#ef4444' : '#9ca3af'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
          </div>
          <div className={`text-2xl font-bold ${alertaCount > 0 ? 'text-red-700' : 'text-gray-900'}`}>{alertaCount}</div>
          <p className={`text-xs mt-1 ${alertaCount > 0 ? 'text-red-500' : 'text-gray-400'}`}>
            {zeradoCount > 0 ? `${zeradoCount} zerado${zeradoCount > 1 ? 's' : ''} · ` : ''}{alertaCount} abaixo de 10
          </p>
        </div>
      </div>

      {/* ========== CHARTS ========== */}
      {estoque.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Bar: Top 10 Produtos */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Top 10 Produtos por Quantidade</h3>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartTopProdutos} layout="vertical" margin={{ left: 10, right: 20, top: 0, bottom: 0 }}>
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px' }}
                    formatter={(value) => [String(value), 'Qtd']}
                  />
                  <Bar dataKey="qtd" fill="#ff6a00" radius={[0, 4, 4, 0]} barSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Pie: Distribuição por Fornecedor */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Distribuição por Fornecedor</h3>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartFornecedor}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                    label={(props: PieLabelRenderProps) => `${props.name || ''} (${((props.percent || 0) * 100).toFixed(0)}%)`}
                    labelLine={{ stroke: '#d1d5db', strokeWidth: 1 }}
                  >
                    {chartFornecedor.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px' }}
                    formatter={(value) => [String(value), 'unidades']}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* ========== TOOLBAR: Busca + Filtro + Ações ========== */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
        <div className="flex gap-3 items-center flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-[240px]">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M11 11l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <input
              type="text"
              placeholder="Buscar por Código ML ou produto..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-9 pr-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#ff6a00]/20 focus:border-[#ff6a00] transition-all"
            />
          </div>
          {/* Filtro Fornecedor */}
          <select
            value={filtroFornecedor}
            onChange={(e) => setFiltroFornecedor(e.target.value)}
            className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#ff6a00]/20 focus:border-[#ff6a00] appearance-none cursor-pointer min-w-[180px]"
          >
            <option value="">Todos os fornecedores</option>
            {fornecedores.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
          {/* Botão Novo Produto */}
          <button
            onClick={openNovoProduto}
            className="px-4 py-2.5 text-sm font-semibold rounded-lg bg-[#ff6a00] text-white hover:bg-orange-600 transition-colors whitespace-nowrap shadow-sm flex items-center gap-2"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            Novo Produto
          </button>
          {/* Counter */}
          <span className="text-xs text-gray-400 font-medium ml-auto">
            {filtrado.length} de {estoque.length} itens
          </span>
        </div>
      </div>

      {/* ========== TABELA ========== */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {filtrado.length === 0 ? (
          <div className="px-6 py-16 text-center text-gray-400 text-sm">
            {estoque.length === 0 ? 'Estoque vazio. Confirme o recebimento de uma NF para dar entrada.' : 'Nenhum resultado encontrado.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Código ML</th>
                  <th
                    className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500 cursor-pointer hover:text-[#ff6a00] select-none"
                    onClick={() => handleSort('produto')}
                  >
                    Produto<SortIcon col="produto" />
                  </th>
                  <th
                    className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500 cursor-pointer hover:text-[#ff6a00] select-none"
                    onClick={() => handleSort('fornecedor')}
                  >
                    Fornecedor<SortIcon col="fornecedor" />
                  </th>
                  <th
                    className="text-center px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500 cursor-pointer hover:text-[#ff6a00] select-none"
                    onClick={() => handleSort('quantidade')}
                  >
                    Disponível<SortIcon col="quantidade" />
                  </th>
                  <th className="text-center px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Status</th>
                  <th
                    className="text-right px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500 cursor-pointer hover:text-[#ff6a00] select-none"
                    onClick={() => handleSort('preco')}
                  >
                    Preço Compra<SortIcon col="preco" />
                  </th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Última Mov.</th>
                  <th className="text-center px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtrado.map((item) => {
                  const badge = getStockBadge(item.quantidade_disponivel)
                  return (
                    <tr key={item.codigo_ml} className="border-b border-gray-100 hover:bg-gray-50/60 transition-colors">
                      <td className="px-5 py-3">
                        <span className="font-mono text-xs bg-orange-50 text-[#ff6a00] border border-orange-200 px-2 py-0.5 rounded font-medium">
                          {item.codigo_ml}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700 max-w-[220px] truncate font-medium">{item.produto}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs bg-gray-100 border border-gray-200 px-2 py-0.5 rounded text-gray-600">
                          {item.fornecedor_principal || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`font-bold text-base ${
                          item.quantidade_disponivel <= 0 ? 'text-red-600' :
                          item.quantidade_disponivel < 10 ? 'text-amber-600' :
                          'text-gray-900'
                        }`}>
                          {item.quantidade_disponivel}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {item.quantidade_disponivel < 10 && (
                          <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full ${badge.bg} ${badge.text}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                            {badge.label}
                          </span>
                        )}
                        {item.quantidade_disponivel >= 10 && (
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full bg-green-50 text-green-600">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                            OK
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-gray-500 font-mono">
                        {formatPreco(item.preco_compra)}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">{formatDate(item.ultima_movimentacao)}</td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => openHistorico(item)}
                            title="Histórico de movimentações"
                            className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50 transition-colors bg-white"
                          >
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                              <path d="M8 4v4l2.5 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5"/>
                              <path d="M2 8a6 6 0 0112 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                            </svg>
                          </button>
                          <button
                            onClick={() => openAjuste(item)}
                            className="px-3 py-1.5 text-[11px] font-medium rounded-lg border border-gray-200 text-gray-500 hover:text-[#ff6a00] hover:border-[#ff6a00] transition-colors bg-white"
                          >
                            Ajustar
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ========== MODAL AJUSTE DE ESTOQUE ========== */}
      {ajusteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setAjusteOpen(false)} />
          <div className="relative bg-white border border-gray-200 rounded-2xl p-8 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900 mb-1">Ajustar Estoque</h3>
            <p className="text-xs text-gray-400 mb-6">
              <span className="font-mono text-[#ff6a00] font-medium">{ajusteItem?.codigo_ml}</span>
              {' — '}{ajusteItem?.produto}
              {' — Saldo atual: '}<b className="text-gray-900">{ajusteItem?.quantidade_disponivel}</b>
            </p>

            {ajusteError && (
              <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-600">{ajusteError}</div>
            )}
            {ajusteSuccess && (
              <div className="mb-4 bg-green-50 border border-green-200 rounded-lg px-4 py-2 text-sm text-green-600">{ajusteSuccess}</div>
            )}

            <div className="space-y-4">
              {/* Tipo */}
              <div className="flex gap-2">
                <button
                  onClick={() => setAjusteTipo('saida')}
                  className={`flex-1 py-2.5 text-sm font-medium rounded-lg border transition-colors ${
                    ajusteTipo === 'saida'
                      ? 'bg-red-50 border-red-300 text-red-600'
                      : 'border-gray-200 text-gray-400 hover:border-gray-300'
                  }`}
                >
                  Saída (remover)
                </button>
                <button
                  onClick={() => setAjusteTipo('entrada')}
                  className={`flex-1 py-2.5 text-sm font-medium rounded-lg border transition-colors ${
                    ajusteTipo === 'entrada'
                      ? 'bg-green-50 border-green-300 text-green-600'
                      : 'border-gray-200 text-gray-400 hover:border-gray-300'
                  }`}
                >
                  Entrada (adicionar)
                </button>
              </div>

              {/* Quantidade */}
              <div>
                <label className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold block mb-1.5">Quantidade</label>
                <input
                  type="number"
                  min="1"
                  value={ajusteQtd}
                  onChange={(e) => setAjusteQtd(e.target.value)}
                  placeholder="Ex: 5"
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ff6a00]/20 focus:border-[#ff6a00]"
                />
              </div>

              {/* Motivo */}
              <div>
                <label className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold block mb-1.5">Motivo</label>
                <select
                  value={ajusteMotivo}
                  onChange={(e) => setAjusteMotivo(e.target.value as MotivoAjuste)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ff6a00]/20 focus:border-[#ff6a00] appearance-none cursor-pointer"
                >
                  {MOTIVOS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>

              {/* Observação */}
              <div>
                <label className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold block mb-1.5">Observação (opcional)</label>
                <input
                  type="text"
                  value={ajusteObs}
                  onChange={(e) => setAjusteObs(e.target.value)}
                  placeholder="Detalhes do ajuste..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ff6a00]/20 focus:border-[#ff6a00]"
                />
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={() => setAjusteOpen(false)}
                disabled={ajusteLoading}
                className="px-5 py-2.5 text-sm font-medium rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleAjuste}
                disabled={ajusteLoading}
                className="px-5 py-2.5 text-sm font-semibold rounded-lg bg-[#ff6a00] hover:bg-orange-600 text-white transition-colors disabled:opacity-50 flex items-center gap-2 shadow-sm"
              >
                {ajusteLoading && (
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                Confirmar Ajuste
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========== MODAL HISTÓRICO DE MOVIMENTAÇÕES ========== */}
      {historicoOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setHistoricoOpen(false)} />
          <div className="relative bg-white border border-gray-200 rounded-2xl max-w-2xl w-full mx-4 shadow-xl max-h-[80vh] flex flex-col">
            {/* Header */}
            <div className="p-6 pb-4 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" className="text-blue-500">
                      <path d="M8 4v4l2.5 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5"/>
                    </svg>
                    Histórico de Movimentações
                  </h3>
                  <p className="text-xs text-gray-400 mt-1">
                    <span className="font-mono text-[#ff6a00] font-medium">{historicoItem?.codigo_ml}</span>
                    {' — '}{historicoItem?.produto}
                    {' — Saldo atual: '}<b className="text-gray-900">{historicoItem?.quantidade_disponivel}</b>
                  </p>
                </div>
                <button
                  onClick={() => setHistoricoOpen(false)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="overflow-y-auto flex-1 p-6">
              {historicoLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="flex items-center gap-3 text-gray-400">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span className="text-sm">Carregando histórico...</span>
                  </div>
                </div>
              ) : historicoData.length === 0 ? (
                <div className="text-center py-12 text-gray-400 text-sm">
                  Nenhuma movimentação encontrada para este produto.
                </div>
              ) : (
                <div className="space-y-3">
                  {historicoData.map((mov, idx) => {
                    const isEntrada = mov.tipo === 'ENTRADA'
                    const origemInfo = formatOrigem(mov.origem)
                    return (
                      <div
                        key={mov.id || idx}
                        className="flex items-start gap-4 p-4 rounded-xl border border-gray-100 hover:border-gray-200 transition-colors bg-gray-50/50"
                      >
                        {/* Ícone tipo */}
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          isEntrada ? 'bg-green-100' : 'bg-red-100'
                        }`}>
                          {isEntrada ? (
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                              <path d="M8 12V4M5 7l3-3 3 3" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          ) : (
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                              <path d="M8 4v8M5 9l3 3 3-3" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-sm font-bold ${isEntrada ? 'text-green-700' : 'text-red-600'}`}>
                              {isEntrada ? '+' : '-'}{mov.quantidade} un.
                            </span>
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${origemInfo.color}`}>
                              {origemInfo.label}
                            </span>
                          </div>
                          {mov.ref_label && (
                            <p className="text-xs text-gray-500 mt-0.5">{mov.ref_label}</p>
                          )}
                          {mov.preco_compra && mov.preco_compra > 0 && (
                            <p className="text-xs text-gray-400 mt-0.5">
                              Preço compra: {mov.preco_compra.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </p>
                          )}
                        </div>

                        {/* Data */}
                        <div className="text-right flex-shrink-0">
                          <p className="text-xs text-gray-500 font-medium">
                            {new Date(mov.data).toLocaleDateString('pt-BR')}
                          </p>
                          <p className="text-[10px] text-gray-400">
                            {new Date(mov.data).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Footer resumo */}
            {!historicoLoading && historicoData.length > 0 && (
              <div className="p-4 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl">
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>{historicoData.length} movimentação{historicoData.length > 1 ? 'ões' : ''}</span>
                  <div className="flex gap-4">
                    <span className="text-green-600 font-medium">
                      Entradas: {historicoData.filter(m => m.tipo === 'ENTRADA').reduce((s, m) => s + m.quantidade, 0)}
                    </span>
                    <span className="text-red-600 font-medium">
                      Saídas: {historicoData.filter(m => m.tipo === 'SAIDA').reduce((s, m) => s + m.quantidade, 0)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========== MODAL NOVO PRODUTO ========== */}
      {novoProdOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setNovoProdOpen(false)} />
          <div className="relative bg-white border border-gray-200 rounded-2xl p-8 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900 mb-1">Novo Produto</h3>
            <p className="text-xs text-gray-400 mb-6">Cadastre um novo produto no sistema.</p>

            {novoProdError && (
              <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-600">{novoProdError}</div>
            )}
            {novoProdSuccess && (
              <div className="mb-4 bg-green-50 border border-green-200 rounded-lg px-4 py-2 text-sm text-green-600">{novoProdSuccess}</div>
            )}

            <div className="space-y-4">
              <div>
                <label className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold block mb-1.5">Código ML</label>
                <input
                  type="text"
                  value={novoCodigoMl}
                  onChange={(e) => setNovoCodigoMl(e.target.value)}
                  placeholder="Ex: ZRTB80652"
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 font-mono focus:outline-none focus:ring-2 focus:ring-[#ff6a00]/20 focus:border-[#ff6a00]"
                />
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold block mb-1.5">Descrição</label>
                <input
                  type="text"
                  value={novoDescricao}
                  onChange={(e) => setNovoDescricao(e.target.value)}
                  placeholder="Ex: Whey Protein 1,8kg Chocolate"
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ff6a00]/20 focus:border-[#ff6a00]"
                />
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold block mb-1.5">Fornecedor</label>
                <input
                  type="text"
                  value={novoFornecedor}
                  onChange={(e) => setNovoFornecedor(e.target.value)}
                  placeholder="Ex: Vitafor"
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ff6a00]/20 focus:border-[#ff6a00]"
                />
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold block mb-1.5">Código Fornecedor (opcional)</label>
                <input
                  type="text"
                  value={novoCodigoFornecedor}
                  onChange={(e) => setNovoCodigoFornecedor(e.target.value)}
                  placeholder="Ex: IMT120 (código interno do fornecedor)"
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 font-mono focus:outline-none focus:ring-2 focus:ring-[#ff6a00]/20 focus:border-[#ff6a00]"
                />
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold block mb-1.5">Quantidade Inicial (opcional)</label>
                <input
                  type="number"
                  min="0"
                  value={novoQtdInicial}
                  onChange={(e) => setNovoQtdInicial(e.target.value)}
                  placeholder="0"
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ff6a00]/20 focus:border-[#ff6a00]"
                />
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={() => setNovoProdOpen(false)}
                disabled={novoProdLoading}
                className="px-5 py-2.5 text-sm font-medium rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleNovoProduto}
                disabled={novoProdLoading}
                className="px-5 py-2.5 text-sm font-semibold rounded-lg bg-[#ff6a00] hover:bg-orange-600 text-white transition-colors disabled:opacity-50 flex items-center gap-2 shadow-sm"
              >
                {novoProdLoading && (
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                Cadastrar Produto
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================
// TAB: ENVIAR FULL
// ============================================
function TabEnviarFull() {
  const [csvItens, setCsvItens] = useState<CSVFullItem[]>([])
  const [csvHeader, setCsvHeader] = useState<CSVFullHeader | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const [fileName, setFileName] = useState('')
  const [step, setStep] = useState<'upload' | 'preview' | 'success'>('upload')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [processing, setProcessing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.name.toLowerCase().endsWith('.csv')) {
      setErrors(['Arquivo deve ser um CSV.'])
      return
    }

    setFileName(file.name)
    setErrors([])

    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      if (!text) {
        setErrors(['Erro ao ler arquivo.'])
        return
      }

      try {
        const result = parseCSVFull(text)
        if (result.errors.length > 0) {
          setErrors(result.errors)
        }
        if (result.itens.length > 0) {
          setCsvItens(result.itens)
          setCsvHeader(result.header)
          setStep('preview')
        }
      } catch {
        setErrors(['Erro ao processar CSV. Verifique o formato do arquivo.'])
      }
    }
    reader.readAsText(file, 'utf-8')
  }

  const handleEnviar = async () => {
    setProcessing(true)
    setErrors([])

    try {
      const validationErrors = await validarCSVFull(csvItens)
      if (validationErrors.length > 0) {
        setErrors(validationErrors)
        setConfirmOpen(false)
        setProcessing(false)
        return
      }

      await processarEnvioFull(csvItens, csvHeader || undefined)
      setConfirmOpen(false)
      setStep('success')
    } catch (err) {
      setErrors([err instanceof Error ? err.message : 'Erro ao processar envio FULL.'])
      setConfirmOpen(false)
    } finally {
      setProcessing(false)
    }
  }

  const handleReset = () => {
    setStep('upload')
    setCsvItens([])
    setCsvHeader(null)
    setErrors([])
    setFileName('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const totalItens = csvItens.reduce((s, i) => s + i.quantidade, 0)

  return (
    <div>
      {errors.length > 0 && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 space-y-1">
          {errors.map((err, i) => (
            <p key={i} className="text-sm text-red-600">{err}</p>
          ))}
        </div>
      )}

      {step === 'upload' && (
        <div
          className="bg-white border-2 border-dashed border-gray-300 rounded-2xl p-16 text-center cursor-pointer hover:border-[#ff6a00] transition-colors"
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            className="hidden"
          />
          <div className="text-4xl mb-4 text-[#ff6a00]">&uarr;</div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Enviar CSV FULL</h2>
          <p className="text-sm text-gray-400 mb-4">
            Use a planilha padrão de controle de envio (CONTROLE ENVIO CODIGO).
          </p>
        </div>
      )}

      {step === 'preview' && (
        <div className="space-y-6">
          {csvHeader && (
            <div className="bg-white border border-gray-200 rounded-xl px-6 py-4 flex flex-wrap gap-6 shadow-sm">
              <div>
                <span className="text-[10px] uppercase tracking-wider text-gray-400 block">Data do Envio</span>
                <span className="text-sm font-semibold text-gray-900">{csvHeader.data_envio}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider text-gray-400 block">NF</span>
                <span className="text-sm font-semibold text-gray-900">{csvHeader.numero_nf || '—'}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider text-gray-400 block">Envio ML N&deg;</span>
                <span className="text-sm font-mono font-semibold text-[#ff6a00]">{csvHeader.codigo_envio_ml}</span>
              </div>
            </div>
          )}

          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Itens do envio — {fileName}
              </h3>
              <span className="text-xs font-mono text-[#ff6a00] font-medium">
                {csvItens.length} códigos &middot; {totalItens} unidades
              </span>
            </div>
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-50">
                  <tr className="text-[10px] uppercase tracking-wider text-gray-500 border-b border-gray-200">
                    <th className="text-left px-6 py-3 font-semibold">Produto</th>
                    <th className="text-left px-4 py-3 font-semibold">Fornecedor</th>
                    <th className="text-left px-4 py-3 font-semibold">Código ML</th>
                    <th className="text-center px-4 py-3 font-semibold">Qtd</th>
                  </tr>
                </thead>
                <tbody>
                  {csvItens.map((item, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="px-6 py-3 text-gray-600 text-xs max-w-[220px] truncate">
                        {item.descricao || '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">{item.fornecedor || '—'}</td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs bg-orange-50 text-[#ff6a00] border border-orange-200 px-2 py-0.5 rounded">
                          {item.codigo_ml}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center font-medium text-gray-900">{item.quantidade}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex gap-4 justify-end">
            <button
              onClick={handleReset}
              className="px-6 py-3 text-sm font-medium rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={() => setConfirmOpen(true)}
              className="px-6 py-3 text-sm font-semibold rounded-xl bg-[#ff6a00] text-white hover:bg-orange-600 transition-colors shadow-sm"
            >
              Confirmar Envio FULL
            </button>
          </div>

          <ConfirmModal
            isOpen={confirmOpen}
            onConfirm={handleEnviar}
            onCancel={() => setConfirmOpen(false)}
            title="Confirmar Envio FULL?"
            message={`Serão registradas ${csvItens.length} saída(s) do estoque. Esta ação não pode ser desfeita.`}
          />
        </div>
      )}
    </div>
  )
}


/**
 * Parser customizado para o CSV de envio FULL da Crunch.
 */
function parseCSVFull(text: string): { header: CSVFullHeader; itens: CSVFullItem[]; errors: string[] } {
  const lines = text.split('\n').map(l => l.replace(/\r$/, ''))
  const errors: string[] = []

  let header: CSVFullHeader = { data_envio: '', numero_nf: '', codigo_envio_ml: '' }

  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const cells = lines[i].split(',')
    if (cells.some(c => c.trim().toUpperCase().includes('DATA')) &&
        cells.some(c => c.trim().toUpperCase().includes('ENVIO'))) {
      if (i + 1 < lines.length) {
        const vals = lines[i + 1].split(',')
        const dataIdx = cells.findIndex(c => c.trim().toUpperCase() === 'DATA')
        const nfIdx = cells.findIndex(c => c.trim().toUpperCase() === 'NF')
        const envioIdx = cells.findIndex(c => c.trim().toUpperCase().includes('ENVIO'))

        if (dataIdx >= 0) header.data_envio = vals[dataIdx]?.trim() || ''
        if (nfIdx >= 0) header.numero_nf = vals[nfIdx]?.trim() || ''
        if (envioIdx >= 0) header.codigo_envio_ml = vals[envioIdx]?.trim() || ''
      }
      break
    }
  }

  let itemHeaderIdx = -1
  const colMap = { item: -1, fornecedor: -1, ml: -1, variacao: -1, qtd: -1 }

  for (let i = 0; i < lines.length; i++) {
    const cells = lines[i].split(',').map(c => c.trim().toUpperCase())
    const mlIdx = cells.findIndex(c => c === 'ML')
    const qtdIdx = cells.findIndex(c => c === 'QTD')

    if (mlIdx >= 0 && qtdIdx >= 0) {
      itemHeaderIdx = i
      colMap.item = cells.findIndex(c => c === 'ITEM')
      colMap.fornecedor = cells.findIndex(c => c === 'FORNECEDOR')
      colMap.ml = mlIdx
      colMap.variacao = cells.findIndex(c => c === 'VARIAÇÃO' || c === 'VARIACAO')
      colMap.qtd = qtdIdx
      break
    }
  }

  if (itemHeaderIdx === -1) {
    errors.push('Formato inválido: não encontrou colunas ML e QTD no CSV.')
    return { header, itens: [], errors }
  }

  const rawItens: CSVFullItem[] = []

  for (let i = itemHeaderIdx + 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line.trim()) continue

    const parsed = Papa.parse(line, { header: false })
    const cells = (parsed.data[0] as string[]) || []
    if (!cells || cells.length <= colMap.ml) continue

    const codigoML = cells[colMap.ml]?.trim().toUpperCase() || ''
    const qtdStr = cells[colMap.qtd]?.trim() || ''
    const qtd = parseInt(qtdStr, 10)

    if (!codigoML || codigoML.length < 4) continue
    if (isNaN(qtd) || qtd <= 0) continue

    const descricao = colMap.item >= 0 && cells.length > 1
      ? cells[1]?.trim() || ''
      : ''
    const fornecedor = colMap.fornecedor >= 0 ? cells[colMap.fornecedor]?.trim() || '' : ''
    const variacao = colMap.variacao >= 0 ? cells[colMap.variacao]?.trim() || '' : ''

    rawItens.push({
      codigo_ml: codigoML,
      quantidade: qtd,
      descricao,
      fornecedor,
      variacao,
    })
  }

  const agrupado = new Map<string, CSVFullItem>()
  for (const item of rawItens) {
    const existing = agrupado.get(item.codigo_ml)
    if (existing) {
      existing.quantidade += item.quantidade
    } else {
      agrupado.set(item.codigo_ml, { ...item })
    }
  }

  const itens = Array.from(agrupado.values())

  if (itens.length === 0) {
    errors.push('Nenhum item válido encontrado no CSV.')
  }

  return { header, itens, errors }
}

// ============================================
// TAB: HISTÓRICO FULL
// ============================================
function TabHistorico() {
  const [envios, setEnvios] = useState<EnvioFull[]>([])
  const [loading, setLoading] = useState(true)
  const [expandido, setExpandido] = useState<string | null>(null)
  const [itensEnvio, setItensEnvio] = useState<EnvioFullItem[]>([])
  const [loadingItens, setLoadingItens] = useState(false)

  useEffect(() => {
    const carregar = async () => {
      try {
        const data = await listarEnviosFull()
        setEnvios(data)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    carregar()
  }, [])

  const toggleEnvio = async (envioId: string) => {
    if (expandido === envioId) {
      setExpandido(null)
      setItensEnvio([])
      return
    }
    setExpandido(envioId)
    setLoadingItens(true)
    try {
      const itens = await buscarItensEnvio(envioId)
      setItensEnvio(itens)
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingItens(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex items-center gap-3 text-gray-400">
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm">Carregando histórico...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {envios.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 px-6 py-16 text-center text-gray-400 text-sm shadow-sm">
          Nenhum envio FULL registrado ainda.
        </div>
      ) : (
        envios.map((envio) => (
          <div key={envio.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <button
              onClick={() => toggleEnvio(envio.id)}
              className="w-full text-left px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center">
                  <svg width="18" height="18" viewBox="0 0 16 16" fill="none"><path d="M2 3h12l-1.5 8H3.5L2 3z" stroke="#9333ea" strokeWidth="1.5" strokeLinejoin="round"/><path d="M6 14a1 1 0 100-2 1 1 0 000 2zM11 14a1 1 0 100-2 1 1 0 000 2z" stroke="#9333ea" strokeWidth="1.5"/></svg>
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-gray-900 text-sm">
                      {new Date(envio.data_envio).toLocaleDateString('pt-BR')}
                    </span>
                    {envio.codigo_envio_ml && (
                      <span className="font-mono text-xs bg-purple-50 text-purple-600 border border-purple-200 px-2 py-0.5 rounded">
                        {envio.codigo_envio_ml}
                      </span>
                    )}
                    {envio.numero_nf && (
                      <span className="text-xs text-gray-400">NF {envio.numero_nf}</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {envio.total_codigos} código{envio.total_codigos > 1 ? 's' : ''} · {envio.total_itens} unidade{envio.total_itens > 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <svg
                width="16" height="16" viewBox="0 0 16 16" fill="none"
                className={`text-gray-400 transition-transform ${expandido === envio.id ? 'rotate-180' : ''}`}
              >
                <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>

            {expandido === envio.id && (
              <div className="border-t border-gray-100 px-6 py-4 bg-gray-50/50">
                {loadingItens ? (
                  <div className="text-center py-4 text-gray-400 text-sm">Carregando itens...</div>
                ) : itensEnvio.length === 0 ? (
                  <div className="text-center py-4 text-gray-400 text-sm">Nenhum item encontrado.</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold">
                        <th className="text-left pb-2">Código ML</th>
                        <th className="text-left pb-2">Descrição</th>
                        <th className="text-left pb-2">Fornecedor</th>
                        <th className="text-center pb-2">Qtd</th>
                      </tr>
                    </thead>
                    <tbody>
                      {itensEnvio.map((it) => (
                        <tr key={it.id} className="border-t border-gray-100">
                          <td className="py-2">
                            <span className="font-mono text-xs bg-orange-50 text-[#ff6a00] border border-orange-200 px-1.5 py-0.5 rounded">
                              {it.codigo_ml}
                            </span>
                          </td>
                          <td className="py-2 text-gray-600">{it.descricao || '—'}</td>
                          <td className="py-2 text-gray-400 text-xs">{it.fornecedor || '—'}</td>
                          <td className="py-2 text-center font-medium">{it.quantidade}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  )
}
