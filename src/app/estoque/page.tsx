'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import Papa from 'papaparse'
import { listarEstoque } from '@/services/estoque'
import { validarCSVFull, processarEnvioFull, listarEnviosFull, buscarItensEnvio } from '@/services/full'
import type { SaldoEstoque, EnvioFull, EnvioFullItem, CSVFullItem } from '@/types'
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

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const itens: CSVFullItem[] = []
        const parseErrors: string[] = []

        results.data.forEach((row, i) => {
          // Procurar coluna de código ML (flexível)
          const codigoML = row['codigo_ml'] || row['Codigo ML'] || row['CODIGO_ML'] || row['CodigoML'] || row['MLB'] || ''
          const qtd = parseInt(row['quantidade'] || row['Quantidade'] || row['QUANTIDADE'] || row['qtd'] || row['QTD'] || '0', 10)

          if (!codigoML) {
            parseErrors.push(`Linha ${i + 2}: Código ML não encontrado.`)
            return
          }

          if (isNaN(qtd) || qtd <= 0) {
            parseErrors.push(`Linha ${i + 2}: Quantidade inválida para ${codigoML}.`)
            return
          }

          itens.push({ codigo_ml: codigoML.toUpperCase(), quantidade: qtd })
        })

        if (parseErrors.length > 0) {
          setErrors(parseErrors)
        }

        if (itens.length > 0) {
          setCsvItens(itens)
          setStep('preview')
        }
      },
      error: () => {
        setErrors(['Erro ao processar CSV. Verifique o formato do arquivo.'])
      },
    })
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

      // Processar envio
      await processarEnvioFull(csvItens)
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
            O CSV deve conter as colunas: <code className="font-mono text-crunch-accent">codigo_ml</code> e <code className="font-mono text-crunch-accent">quantidade</code>
          </p>
        </div>
      )}

      {step === 'preview' && (
        <div className="space-y-6">
          <div className="bg-crunch-panel border border-crunch-line rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-crunch-line flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-crunch-ink-dim">
                Pré-visualização — {fileName}
              </h3>
              <span className="text-xs font-mono text-crunch-accent">
                {csvItens.length} códigos &middot; {totalItens} unidades
              </span>
            </div>
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-crunch-panel">
                  <tr className="text-[10px] uppercase tracking-wider text-crunch-ink-mute border-b border-crunch-line">
                    <th className="text-left px-6 py-3 font-semibold">Código ML</th>
                    <th className="text-center px-6 py-3 font-semibold">Quantidade</th>
                  </tr>
                </thead>
                <tbody>
                  {csvItens.map((item, i) => (
                    <tr key={i} className="border-b border-crunch-line/50">
                      <td className="px-6 py-3">
                        <span className="font-mono text-xs bg-crunch-accent/10 text-crunch-accent border border-crunch-accent/30 px-2 py-0.5 rounded">
                          {item.codigo_ml}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-center font-medium">{item.quantidade}</td>
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
          <p className="text-sm text-crunch-ink-dim mb-8">
            {csvItens.length} códigos enviados, {totalItens} unidades subtraídas do estoque.
          </p>
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
                <div className="flex items-center gap-4">
                  <span className="text-sm font-semibold">{formatDate(envio.data_envio)}</span>
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
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                      {viewItens.map((item) => (
                        <div key={item.id} className="bg-crunch-panel-2 border border-crunch-line-2 rounded-lg px-3 py-2 text-xs">
                          <span className="font-mono text-crunch-accent">{item.codigo_ml}</span>
                          <span className="text-crunch-ink-mute ml-2">&times;{item.quantidade}</span>
                        </div>
                      ))}
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
