'use client'

import { useState, useEffect, useCallback } from 'react'
import type { NotaEmTransito, ItemNF } from '@/types'
import { listarNotasEmTransito, buscarItensNF, confirmarRecebimento } from '@/services/notas-fiscais'
import ConfirmModal from './ConfirmModal'
import XmlViewer from './XmlViewer'

export default function NotasEmTransito() {
  const [notas, setNotas] = useState<NotaEmTransito[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Viewer
  const [viewerOpen, setViewerOpen] = useState(false)
  const [viewerNota, setViewerNota] = useState<NotaEmTransito | null>(null)
  const [viewerItens, setViewerItens] = useState<ItemNF[]>([])
  const [viewerLoading, setViewerLoading] = useState(false)

  // Confirm recebimento
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmNota, setConfirmNota] = useState<NotaEmTransito | null>(null)
  const [confirmLoading, setConfirmLoading] = useState(false)

  const carregarNotas = useCallback(async () => {
    try {
      setLoading(true)
      const data = await listarNotasEmTransito()
      setNotas(data)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar notas')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    carregarNotas()
  }, [carregarNotas])

  const handleVisualizar = async (nota: NotaEmTransito) => {
    setViewerNota(nota)
    setViewerOpen(true)
    setViewerLoading(true)
    try {
      const itens = await buscarItensNF(nota.id)
      setViewerItens(itens)
    } catch {
      setViewerItens([])
    } finally {
      setViewerLoading(false)
    }
  }

  const handleEntregue = (nota: NotaEmTransito) => {
    setConfirmNota(nota)
    setConfirmOpen(true)
  }

  const handleConfirmarRecebimento = async () => {
    if (!confirmNota) return
    setConfirmLoading(true)
    try {
      await confirmarRecebimento(confirmNota.id)
      setConfirmOpen(false)
      setConfirmNota(null)
      await carregarNotas()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao confirmar recebimento')
    } finally {
      setConfirmLoading(false)
    }
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '—'
    const [y, m, d] = dateStr.split('-')
    return `${d}/${m}/${y}`
  }

  const getDiasUteisColor = (dias: number) => {
    if (dias <= 3) return 'text-green-400'
    if (dias <= 7) return 'text-yellow-400'
    return 'text-red-400'
  }

  if (loading) {
    return (
      <div className="bg-crunch-panel border border-crunch-line rounded-2xl p-8">
        <div className="text-center text-crunch-ink-mute">Carregando notas em trânsito...</div>
      </div>
    )
  }

  return (
    <>
      <div className="bg-crunch-panel border border-crunch-line rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-crunch-line flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-crunch-accent animate-pulse" />
            <h3 className="text-sm font-semibold uppercase tracking-wider text-crunch-ink-dim">
              Notas Fiscais em Trânsito
            </h3>
          </div>
          <span className="text-xs font-mono bg-crunch-panel-2 border border-crunch-line-2 px-3 py-1 rounded-full text-crunch-accent">
            {notas.length}
          </span>
        </div>

        {error && (
          <div className="px-6 py-3 bg-red-900/20 text-red-400 text-sm border-b border-crunch-line">
            {error}
          </div>
        )}

        {notas.length === 0 ? (
          <div className="px-6 py-12 text-center text-crunch-ink-mute text-sm">
            Nenhuma nota fiscal em trânsito.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-crunch-ink-mute border-b border-crunch-line">
                  <th className="text-left px-6 py-3 font-semibold">Fornecedor</th>
                  <th className="text-left px-4 py-3 font-semibold">NF</th>
                  <th className="text-left px-4 py-3 font-semibold">Transportadora</th>
                  <th className="text-center px-4 py-3 font-semibold">Volumes</th>
                  <th className="text-left px-4 py-3 font-semibold">Faturamento</th>
                  <th className="text-center px-4 py-3 font-semibold">Dias Úteis</th>
                  <th className="text-center px-4 py-3 font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody>
                {notas.map((nota) => (
                  <tr
                    key={nota.id}
                    className="border-b border-crunch-line/50 hover:bg-crunch-panel-2/50 transition-colors"
                  >
                    <td className="px-6 py-4 font-medium">{nota.fornecedor}</td>
                    <td className="px-4 py-4 font-mono text-crunch-ink-dim">{nota.numero_nf}</td>
                    <td className="px-4 py-4 text-crunch-ink-dim text-xs">{nota.transportadora || '—'}</td>
                    <td className="px-4 py-4 text-center text-crunch-ink-dim">{nota.volumes}</td>
                    <td className="px-4 py-4 text-crunch-ink-dim">{formatDate(nota.data_emissao)}</td>
                    <td className={`px-4 py-4 text-center font-semibold ${getDiasUteisColor(nota.dias_uteis)}`}>
                      {nota.dias_uteis}d
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleVisualizar(nota)}
                          className="px-3 py-1.5 text-xs font-medium rounded-lg border border-crunch-line text-crunch-ink-dim hover:text-crunch-accent hover:border-crunch-accent transition-colors"
                        >
                          Ver XML
                        </button>
                        <button
                          onClick={() => handleEntregue(nota)}
                          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-crunch-accent text-white hover:bg-orange-600 transition-colors"
                        >
                          Entregue
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Drawer do XML */}
      <XmlViewer
        isOpen={viewerOpen}
        nota={viewerNota}
        itens={viewerItens}
        loading={viewerLoading}
        onClose={() => { setViewerOpen(false); setViewerNota(null) }}
      />

      {/* Modal de confirmação */}
      <ConfirmModal
        isOpen={confirmOpen}
        title="Confirmar Recebimento"
        message={`Confirmar recebimento da NF ${confirmNota?.numero_nf} de ${confirmNota?.fornecedor}? Os itens serão adicionados ao estoque.`}
        confirmLabel="Confirmar Entrega"
        onConfirm={handleConfirmarRecebimento}
        onCancel={() => { setConfirmOpen(false); setConfirmNota(null) }}
        loading={confirmLoading}
      />
    </>
  )
}
