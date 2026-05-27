'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import Papa from 'papaparse'
import { listarEstoque } from '@/services/estoque'
import { validarCSVFull, processarEnvioFull, listarEnviosFull, buscarItensEnvio } from '@/services/full'
import type { SaldoEstoque, EnvioFull, EnvioFullItem, CSVFullItem, CSVFullHeader } from '@/types'
import ConfirmModal from '@/components/ConfirmModal'

type Tab = 'estoque' | 'enviar-full' | 'historico'

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

  useEffect(() => {
    listarEstoque()
      .then(setEstoque)
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }, [])

  const filtrado = estoque.filter(
    (item) =>
      item.codigo_ml.toLowerCase().includes(busca.toLowerCase()) ||
      item.produto.toLowerCase().includes(busca.toLowerCase())
  )

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '—'
    const d = new Date(dateStr)
    return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }

  if (loading) {
    return <div className="text-center py-12 text-crunch-ink-mute">Carregando estoque...</div>
  }

  return (
    <div className="space-y-4 animate-fade-in-up">
      {/* Busca */}
      <div className="flex gap-4 items-center">
        <input
          type="text"
          placeholder="Buscar por Código ML ou produto..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="flex-1 bg-crunch-panel border border-crunch-line rounded-xl px-4 py-3 text-sm text-crunch-ink placeholder:text-crunch-ink-mute focus:outline-none focus:border-crunch-accent transition-colors"
        />
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
                  <th className="text-center px-4 py-3 font-semibold">Disponível</th>
                  <th className="text-left px-4 py-3 font-semibold">Última Mov.</th>
                  <th className="text-left px-6 py-3 font-semibold">Fornecedor</th>
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
                    <td className="px-4 py-3 text-crunch-ink-dim max-w-[300px] truncate">{item.produto}</td>
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
                    <td className="px-4 py-3 text-xs text-crunch-ink-mute">{formatDate(item.ultima_movimentacao)}</td>
                    <td className="px-6 py-3 text-crunch-ink-dim text-xs">{item.fornecedor_principal}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
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

    // Ler como texto bruto para parsing customizado
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
      // Validar contra estoque
      const validationErrors = await validarCSVFull(csvItens)
      if (validationErrors.length > 0) {
        setErrors(validationErrors)
        setConfirmOpen(false)
        setProcessing(false)
        return
      }

      // Processar envio com dados do cabeçalho
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
          {/* Dados do cabeçalho */}
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
 * Lê cabeçalho (DATA, NF, ENVIO ML N°) e itens (FORNECEDOR, ML, QTD).
 * Agrupa produtos duplicados somando quantidades.
 */
function parseCSVFull(text: string): { header: CSVFullHeader; itens: CSVFullItem[]; errors: string[] } {
  const lines = text.split('\n').map(l => l.replace(/\r$/, ''))
  const errors: string[] = []

  // 1) Extrair cabeçalho — procurar linha que contém DATA, NF e ENVIO ML
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

  // 2) Encontrar linha de cabeçalho dos itens — contém "ML" e "QTD"
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

  // 3) Ler itens — linhas após o cabeçalho dos itens
  const rawItens: CSVFullItem[] = []

  for (let i = itemHeaderIdx + 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line.trim()) continue

    // Usar PapaParse para lidar com aspas em campos
    const parsed = Papa.parse(line, { header: false })
    const cells = (parsed.data[0] as string[]) || []
    if (!cells || cells.length <= colMap.ml) continue

    const codigoML = cells[colMap.ml]?.trim().toUpperCase() || ''
    const qtdStr = cells[colMap.qtd]?.trim() || ''
    const qtd = parseInt(qtdStr, 10)

    // Pular linhas sem código ML ou com texto de resumo
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

  // 4) Agrupar duplicados (mesmo codigo_ml) somando quantidades
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

              {/* Detalhes do envio (expandido) */}
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
