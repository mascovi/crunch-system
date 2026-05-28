'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import Papa from 'papaparse'
import { listarEstoque, ajustarEstoque, cadastrarProduto } from '@/services/estoque'
import { validarCSVFull, processarEnvioFull, listarEnviosFull, buscarItensEnvio } from '@/services/full'
import type { SaldoEstoque, EnvioFull, EnvioFullItem, CSVFullItem, CSVFullHeader, MotivoAjuste } from '@/types'
import ConfirmModal from '@/components/ConfirmModal'

type Tab = 'estoque' | 'enviar-full' | 'historico'

const MOTIVOS: { value: MotivoAjuste; label: string }[] = [
  { value: 'DEVOLUCAO', label: 'Devolução' },
  { value: 'CONSUMO_PROPRIO', label: 'Consumo próprio' },
  { value: 'PROBLEMA_ENTREGA', label: 'Problema na entrega' },
  { value: 'EXTRAVIO', label: 'Extravio' },
  { value: 'CORRECAO_INVENTARIO', label: 'Correção de inventário' },
  { value: 'OUTRO', label: 'Outro' },
]

export default function EstoquePage() {
  const [tab, setTab] = useState<Tab>('estoque')

  return (
    <div className="max-w-[1080px] mx-auto px-8 py-20">
      {/* Header */}
      <div className="flex items-center gap-4 mb-10">
        <Link
          href="/"
          className="w-9 h-9 rounded-lg border border-crunch-line flex items-center justify-center text-crunch-ink-mute hover:text-crunch-accent hover:border-crunch-accent transition-colors"
        >
          &larr;
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Estoque</h1>
          <p className="text-sm text-crunch-ink-mute mt-1">Saldo por Código ML, envios FULL e histórico</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-8 bg-crunch-panel rounded-xl p-1 border border-crunch-line w-fit">
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
                ? 'bg-crunch-accent text-white'
                : 'text-crunch-ink-mute hover:text-crunch-ink'
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
  )
}

// ============================================
// TAB: ESTOQUE
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
  const [novoQtdInicial, setNovoQtdInicial] = useState('')
  const [novoProdLoading, setNovoProdLoading] = useState(false)
  const [novoProdError, setNovoProdError] = useState('')
  const [novoProdSuccess, setNovoProdSuccess] = useState('')

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

  // Extrair fornecedores para o dropdown
  const fornecedores = Array.from(
    new Set(estoque.map((item) => item.fornecedor_principal).filter(Boolean))
  ).sort()

  const filtrado = estoque.filter((item) => {
    const matchBusca =
      item.codigo_ml.toLowerCase().includes(busca.toLowerCase()) ||
      item.produto.toLowerCase().includes(busca.toLowerCase())
    const matchFornecedor = !filtroFornecedor || item.fornecedor_principal === filtroFornecedor
    return matchBusca && matchFornecedor
  })

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '—'
    const d = new Date(dateStr)
    return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }

  const formatPreco = (valor: number) => {
    if (!valor || valor === 0) return '—'
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

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
      })
      // Se informou qtd inicial, criar movimentação
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

  if (loading) {
    return <div className="text-center py-12 text-crunch-ink-mute">Carregando estoque...</div>
  }

  return (
    <div className="space-y-4 animate-fade-in-up">
      {/* Busca + Filtro + Ações */}
      <div className="flex gap-4 items-center flex-wrap">
        <input
          type="text"
          placeholder="Buscar por Código ML ou produto..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="flex-1 min-w-[200px] bg-crunch-panel border border-crunch-line rounded-xl px-4 py-3 text-sm text-crunch-ink placeholder:text-crunch-ink-mute focus:outline-none focus:border-crunch-accent transition-colors"
        />
        <select
          value={filtroFornecedor}
          onChange={(e) => setFiltroFornecedor(e.target.value)}
          className="bg-crunch-panel border border-crunch-line rounded-xl px-4 py-3 text-sm text-crunch-ink focus:outline-none focus:border-crunch-accent transition-colors appearance-none cursor-pointer"
        >
          <option value="">Todos os fornecedores</option>
          {fornecedores.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
        <button
          onClick={openNovoProduto}
          className="px-4 py-3 text-sm font-semibold rounded-xl bg-crunch-accent text-white hover:bg-orange-600 transition-colors whitespace-nowrap"
        >
          + Novo Produto
        </button>
        <span className="text-xs text-crunch-ink-mute font-mono">
          {filtrado.length} itens
        </span>
      </div>

      {/* Tabela */}
      <div className="bg-crunch-panel border border-crunch-line rounded-2xl overflow-hidden">
        {filtrado.length === 0 ? (
          <div className="px-6 py-12 text-center text-crunch-ink-mute text-sm">
            {estoque.length === 0 ? 'Estoque vazio. Confirme o recebimento de uma NF para dar entrada.' : 'Nenhum resultado encontrado.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-crunch-ink-mute border-b border-crunch-line">
                  <th className="text-left px-6 py-3 font-semibold">Código ML</th>
                  <th className="text-left px-4 py-3 font-semibold">Produto</th>
                  <th className="text-left px-4 py-3 font-semibold">Fornecedor</th>
                  <th className="text-center px-4 py-3 font-semibold">Disponível</th>
                  <th className="text-right px-4 py-3 font-semibold">Preço Compra</th>
                  <th className="text-left px-4 py-3 font-semibold">Última Mov.</th>
                  <th className="text-center px-4 py-3 font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtrado.map((item) => (
                  <tr key={item.codigo_ml} className="border-b border-crunch-line/50 hover:bg-crunch-panel-2/50 transition-colors">
                    <td className="px-6 py-3">
                      <span className="font-mono text-xs bg-crunch-accent/10 text-crunch-accent border border-crunch-accent/30 px-2 py-0.5 rounded">
                        {item.codigo_ml}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-crunch-ink-dim max-w-[220px] truncate">{item.produto}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs bg-crunch-panel-2 border border-crunch-line-2 px-2 py-0.5 rounded text-crunch-ink-dim">
                        {item.fornecedor_principal || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`font-semibold ${
                        item.quantidade_disponivel <= 0
                          ? 'text-red-400'
                          : item.quantidade_disponivel <= 5
                          ? 'text-yellow-400'
                          : 'text-green-400'
                      }`}>
                        {item.quantidade_disponivel}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-crunch-ink-dim font-mono">
                      {formatPreco(item.preco_compra)}
                    </td>
                    <td className="px-4 py-3 text-xs text-crunch-ink-mute">{formatDate(item.ultima_movimentacao)}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => openAjuste(item)}
                        className="px-3 py-1 text-[11px] font-medium rounded-lg border border-crunch-line text-crunch-ink-dim hover:text-crunch-accent hover:border-crunch-accent transition-colors"
                      >
                        Ajustar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ========== MODAL AJUSTE DE ESTOQUE ========== */}
      {ajusteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setAjusteOpen(false)} />
          <div className="relative bg-crunch-panel border border-crunch-line rounded-2xl p-8 max-w-md w-full mx-4 animate-fade-in-up">
            <h3 className="text-xl font-semibold mb-1">Ajustar Estoque</h3>
            <p className="text-xs text-crunch-ink-mute mb-6">
              <span className="font-mono text-crunch-accent">{ajusteItem?.codigo_ml}</span>
              {' — '}{ajusteItem?.produto}
              {' — Saldo atual: '}<b className="text-crunch-ink">{ajusteItem?.quantidade_disponivel}</b>
            </p>

            {ajusteError && (
              <div className="mb-4 bg-red-900/20 border border-red-800/40 rounded-lg px-4 py-2 text-sm text-red-400">{ajusteError}</div>
            )}
            {ajusteSuccess && (
              <div className="mb-4 bg-green-900/20 border border-green-800/40 rounded-lg px-4 py-2 text-sm text-green-400">{ajusteSuccess}</div>
            )}

            <div className="space-y-4">
              {/* Tipo */}
              <div className="flex gap-2">
                <button
                  onClick={() => setAjusteTipo('saida')}
                  className={`flex-1 py-2.5 text-sm font-medium rounded-lg border transition-colors ${
                    ajusteTipo === 'saida'
                      ? 'bg-red-600/20 border-red-500 text-red-400'
                      : 'border-crunch-line text-crunch-ink-mute hover:border-crunch-accent'
                  }`}
                >
                  Saída (remover)
                </button>
                <button
                  onClick={() => setAjusteTipo('entrada')}
                  className={`flex-1 py-2.5 text-sm font-medium rounded-lg border transition-colors ${
                    ajusteTipo === 'entrada'
                      ? 'bg-green-600/20 border-green-500 text-green-400'
                      : 'border-crunch-line text-crunch-ink-mute hover:border-crunch-accent'
                  }`}
                >
                  Entrada (adicionar)
                </button>
              </div>

              {/* Quantidade */}
              <div>
                <label className="text-[10px] uppercase tracking-wider text-crunch-ink-mute font-semibold block mb-1">Quantidade</label>
                <input
                  type="number"
                  min="1"
                  value={ajusteQtd}
                  onChange={(e) => setAjusteQtd(e.target.value)}
                  placeholder="Ex: 5"
                  className="w-full bg-crunch-bg border border-crunch-line rounded-lg px-4 py-2.5 text-sm text-crunch-ink focus:outline-none focus:border-crunch-accent"
                />
              </div>

              {/* Motivo */}
              <div>
                <label className="text-[10px] uppercase tracking-wider text-crunch-ink-mute font-semibold block mb-1">Motivo</label>
                <select
                  value={ajusteMotivo}
                  onChange={(e) => setAjusteMotivo(e.target.value as MotivoAjuste)}
                  className="w-full bg-crunch-bg border border-crunch-line rounded-lg px-4 py-2.5 text-sm text-crunch-ink focus:outline-none focus:border-crunch-accent appearance-none cursor-pointer"
                >
                  {MOTIVOS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>

              {/* Observação */}
              <div>
                <label className="text-[10px] uppercase tracking-wider text-crunch-ink-mute font-semibold block mb-1">Observação (opcional)</label>
                <input
                  type="text"
                  value={ajusteObs}
                  onChange={(e) => setAjusteObs(e.target.value)}
                  placeholder="Detalhes do ajuste..."
                  className="w-full bg-crunch-bg border border-crunch-line rounded-lg px-4 py-2.5 text-sm text-crunch-ink focus:outline-none focus:border-crunch-accent"
                />
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={() => setAjusteOpen(false)}
                disabled={ajusteLoading}
                className="px-5 py-2.5 text-sm font-medium rounded-lg border border-crunch-line text-crunch-ink-dim hover:bg-crunch-panel-2 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleAjuste}
                disabled={ajusteLoading}
                className="px-5 py-2.5 text-sm font-semibold rounded-lg bg-crunch-accent hover:bg-orange-600 text-white transition-colors disabled:opacity-50 flex items-center gap-2"
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

      {/* ========== MODAL NOVO PRODUTO ========== */}
      {novoProdOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setNovoProdOpen(false)} />
          <div className="relative bg-crunch-panel border border-crunch-line rounded-2xl p-8 max-w-md w-full mx-4 animate-fade-in-up">
            <h3 className="text-xl font-semibold mb-1">Novo Produto</h3>
            <p className="text-xs text-crunch-ink-mute mb-6">Cadastre um novo produto no sistema.</p>

            {novoProdError && (
              <div className="mb-4 bg-red-900/20 border border-red-800/40 rounded-lg px-4 py-2 text-sm text-red-400">{novoProdError}</div>
            )}
            {novoProdSuccess && (
              <div className="mb-4 bg-green-900/20 border border-green-800/40 rounded-lg px-4 py-2 text-sm text-green-400">{novoProdSuccess}</div>
            )}

            <div className="space-y-4">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-crunch-ink-mute font-semibold block mb-1">Código ML</label>
                <input
                  type="text"
                  value={novoCodigoMl}
                  onChange={(e) => setNovoCodigoMl(e.target.value)}
                  placeholder="Ex: ZRTB80652"
                  className="w-full bg-crunch-bg border border-crunch-line rounded-lg px-4 py-2.5 text-sm text-crunch-ink font-mono focus:outline-none focus:border-crunch-accent"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-crunch-ink-mute font-semibold block mb-1">Descrição</label>
                <input
                  type="text"
                  value={novoDescricao}
                  onChange={(e) => setNovoDescricao(e.target.value)}
                  placeholder="Ex: Whey Protein 1,8kg Chocolate"
                  className="w-full bg-crunch-bg border border-crunch-line rounded-lg px-4 py-2.5 text-sm text-crunch-ink focus:outline-none focus:border-crunch-accent"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-crunch-ink-mute font-semibold block mb-1">Fornecedor</label>
                <input
                  type="text"
                  value={novoFornecedor}
                  onChange={(e) => setNovoFornecedor(e.target.value)}
                  placeholder="Ex: Vitafor"
                  className="w-full bg-crunch-bg border border-crunch-line rounded-lg px-4 py-2.5 text-sm text-crunch-ink focus:outline-none focus:border-crunch-accent"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-crunch-ink-mute font-semibold block mb-1">Quantidade Inicial (opcional)</label>
                <input
                  type="number"
                  min="0"
                  value={novoQtdInicial}
                  onChange={(e) => setNovoQtdInicial(e.target.value)}
                  placeholder="0"
                  className="w-full bg-crunch-bg border border-crunch-line rounded-lg px-4 py-2.5 text-sm text-crunch-ink focus:outline-none focus:border-crunch-accent"
                />
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={() => setNovoProdOpen(false)}
                disabled={novoProdLoading}
                className="px-5 py-2.5 text-sm font-medium rounded-lg border border-crunch-line text-crunch-ink-dim hover:bg-crunch-panel-2 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleNovoProduto}
                disabled={novoProdLoading}
                className="px-5 py-2.5 text-sm font-semibold rounded-lg bg-crunch-accent hover:bg-orange-600 text-white transition-colors disabled:opacity-50 flex items-center gap-2"
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
    <div className="animate-fade-in-up">
      {errors.length > 0 && (
        <div className="mb-6 bg-red-900/20 border border-red-800/40 rounded-xl p-4 space-y-1">
          {errors.map((err, i) => (
            <p key={i} className="text-sm text-red-400">{err}</p>
          ))}
        </div>
      )}

      {step === 'upload' && (
        <div
          className="bg-crunch-panel border-2 border-dashed border-crunch-line rounded-2xl p-16 text-center cursor-pointer hover:border-crunch-accent transition-colors"
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            className="hidden"
          />
          <div className="text-4xl mb-4 text-crunch-accent">&uarr;</div>
          <h2 className="text-lg font-semibold mb-2">Enviar CSV FULL</h2>
          <p className="text-sm text-crunch-ink-mute mb-4">
            Use a planilha padrão de controle de envio (CONTROLE ENVIO CODIGO).
          </p>
        </div>
      )}

      {step === 'preview' && (
        <div className="space-y-6">
          {csvHeader && (
            <div className="bg-crunch-panel border border-crunch-line rounded-xl px-6 py-4 flex flex-wrap gap-6">
              <div>
                <span className="text-[10px] uppercase tracking-wider text-crunch-ink-mute block">Data do Envio</span>
                <span className="text-sm font-semibold">{csvHeader.data_envio}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider text-crunch-ink-mute block">NF</span>
                <span className="text-sm font-semibold">{csvHeader.numero_nf || '—'}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider text-crunch-ink-mute block">Envio ML N&deg;</span>
                <span className="text-sm font-mono font-semibold text-crunch-accent">{csvHeader.codigo_envio_ml}</span>
              </div>
            </div>
          )}

          <div className="bg-crunch-panel border border-crunch-line rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-crunch-line flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-crunch-ink-dim">
                Itens do envio — {fileName}
              </h3>
              <span className="text-xs font-mono text-crunch-accent">
                {csvItens.length} códigos &middot; {totalItens} unidades
              </span>
            </div>
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-crunch-panel">
                  <tr className="text-[10px] uppercase tracking-wider text-crunch-ink-mute border-b border-crunch-line">
                    <th className="text-left px-6 py-3 font-semibold">Produto</th>
                    <th className="text-left px-4 py-3 font-semibold">Fornecedor</th>
                    <th className="text-left px-4 py-3 font-semibold">Código ML</th>
                    <th className="text-center px-4 py-3 font-semibold">Qtd</th>
                  </tr>
                </thead>
                <tbody>
                  {csvItens.map((item, i) => (
                    <tr key={i} className="border-b border-crunch-line/50">
                      <td className="px-6 py-3 text-crunch-ink-dim text-xs max-w-[220px] truncate">
                        {item.descricao || '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-crunch-ink-mute">{item.fornecedor || '—'}</td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs bg-crunch-accent/10 text-crunch-accent border border-crunch-accent/30 px-2 py-0.5 rounded">
                          {item.codigo_ml}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center font-medium">{item.quantidade}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex gap-4 justify-end">
            <button
              onClick={handleReset}
              className="px-6 py-3 text-sm font-medium rounded-xl border border-crunch-line text-crunch-ink-dim hover:bg-crunch-panel-2 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={() => setConfirmOpen(true)}
              className="px-6 py-3 text-sm font-semibold rounded-xl bg-crunch-accent text-white hover:bg-orange-600 transition-colors"
            >
              Enviar FULL
            </button>
          </div>
        </div>
      )}

      {step === 'success' && (
        <div className="bg-crunch-panel border border-crunch-line rounded-2xl p-12 text-center">
          <div className="text-4xl mb-4 text-green-400">&#10003;</div>
          <h2 className="text-xl font-semibold mb-2">Envio FULL processado</h2>
          <p className="text-sm text-crunch-ink-dim mb-2">
            {csvItens.length} códigos enviados, {totalItens} unidades subtraídas do estoque.
          </p>
          {csvHeader && (
            <p className="text-xs text-crunch-ink-mute mb-8">
              Envio ML: <b className="text-crunch-accent">{csvHeader.codigo_envio_ml}</b> &middot; Data: {csvHeader.data_envio}
            </p>
          )}
          <button
            onClick={handleReset}
            className="px-6 py-3 text-sm font-medium rounded-xl border border-crunch-line text-crunch-ink-dim hover:bg-crunch-panel-2 transition-colors"
          >
            Novo envio
          </button>
        </div>
      )}

      <ConfirmModal
        isOpen={confirmOpen}
        title="Confirmar Envio FULL"
        message={`Deseja enviar ${csvItens.length} códigos (${totalItens} unidades) ao FULL? Os itens serão subtraídos do estoque.`}
        confirmLabel="Confirmar Envio"
        onConfirm={handleEnviar}
        onCancel={() => setConfirmOpen(false)}
        loading={processing}
        variant="danger"
      />
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
  const [viewEnvio, setViewEnvio] = useState<EnvioFull | null>(null)
  const [viewItens, setViewItens] = useState<EnvioFullItem[]>([])
  const [viewLoading, setViewLoading] = useState(false)

  useEffect(() => {
    listarEnviosFull()
      .then(setEnvios)
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }, [])

  const handleVisualizar = async (envio: EnvioFull) => {
    setViewEnvio(envio)
    setViewLoading(true)
    try {
      const itens = await buscarItensEnvio(envio.id)
      setViewItens(itens)
    } catch {
      setViewItens([])
    } finally {
      setViewLoading(false)
    }
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }

  if (loading) {
    return <div className="text-center py-12 text-crunch-ink-mute">Carregando histórico...</div>
  }

  return (
    <div className="animate-fade-in-up">
      {envios.length === 0 ? (
        <div className="bg-crunch-panel border border-crunch-line rounded-2xl px-6 py-12 text-center text-crunch-ink-mute text-sm">
          Nenhum envio FULL registrado.
        </div>
      ) : (
        <div className="space-y-4">
          {envios.map((envio) => (
            <div
              key={envio.id}
              className="bg-crunch-panel border border-crunch-line rounded-xl p-5"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-4 flex-wrap">
                  {envio.codigo_envio_ml && (
                    <span className="text-xs font-semibold bg-crunch-accent/10 text-crunch-accent border border-crunch-accent/30 px-2.5 py-1 rounded-lg">
                      Envio #{envio.codigo_envio_ml}
                    </span>
                  )}
                  <span className="text-sm font-semibold">
                    {envio.data_envio_csv
                      ? new Date(envio.data_envio_csv + 'T12:00:00').toLocaleDateString('pt-BR')
                      : formatDate(envio.data_envio)}
                  </span>
                  {envio.numero_nf && (
                    <span className="text-xs text-crunch-ink-mute">
                      NF {envio.numero_nf}
                    </span>
                  )}
                  <span className="text-xs font-mono bg-crunch-panel-2 border border-crunch-line-2 px-2 py-0.5 rounded text-crunch-ink-dim">
                    {envio.total_codigos} códigos
                  </span>
                  <span className="text-xs font-mono bg-crunch-panel-2 border border-crunch-line-2 px-2 py-0.5 rounded text-crunch-ink-dim">
                    {envio.total_itens} unidades
                  </span>
                </div>
                <button
                  onClick={() => handleVisualizar(envio)}
                  className="px-4 py-1.5 text-xs font-medium rounded-lg border border-crunch-line text-crunch-ink-dim hover:text-crunch-accent hover:border-crunch-accent transition-colors"
                >
                  Visualizar
                </button>
              </div>

              {viewEnvio?.id === envio.id && (
                <div className="mt-4 pt-4 border-t border-crunch-line/50">
                  {viewLoading ? (
                    <p className="text-xs text-crunch-ink-mute">Carregando itens...</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-[10px] uppercase tracking-wider text-crunch-ink-mute border-b border-crunch-line/50">
                            <th className="text-left px-3 py-2 font-semibold">Produto</th>
                            <th className="text-left px-3 py-2 font-semibold">Fornecedor</th>
                            <th className="text-left px-3 py-2 font-semibold">Código ML</th>
                            <th className="text-center px-3 py-2 font-semibold">Qtd</th>
                          </tr>
                        </thead>
                        <tbody>
                          {viewItens.map((item) => (
                            <tr key={item.id} className="border-b border-crunch-line/30">
                              <td className="px-3 py-2 text-crunch-ink-dim max-w-[200px] truncate">{item.descricao || '—'}</td>
                              <td className="px-3 py-2 text-crunch-ink-mute">{item.fornecedor || '—'}</td>
                              <td className="px-3 py-2">
                                <span className="font-mono text-crunch-accent">{item.codigo_ml}</span>
                              </td>
                              <td className="px-3 py-2 text-center font-medium">{item.quantidade}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
