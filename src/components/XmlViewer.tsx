'use client'

import type { ItemNF, NotaFiscal } from '@/types'

interface XmlViewerProps {
  isOpen: boolean
  nota: NotaFiscal | null
  itens: ItemNF[]
  loading: boolean
  onClose: () => void
}

export default function XmlViewer({
  isOpen,
  nota,
  itens,
  loading,
  onClose,
}: XmlViewerProps) {
  if (!isOpen || !nota) return null

  const totalValor = itens.reduce((sum, i) => sum + i.valor_total, 0)
  const totalQtd = itens.reduce((sum, i) => sum + i.quantidade, 0)

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer lateral */}
      <div className="relative w-full max-w-xl bg-crunch-bg border-l border-crunch-line h-full overflow-y-auto animate-fade-in-up">
        {/* Header */}
        <div className="sticky top-0 bg-crunch-bg/95 backdrop-blur border-b border-crunch-line p-6 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">NF {nota.numero_nf}</h3>
            <p className="text-sm text-crunch-ink-mute">{nota.fornecedor}</p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-lg border border-crunch-line flex items-center justify-center text-crunch-ink-mute hover:text-crunch-ink hover:border-crunch-accent transition-colors"
          >
            &times;
          </button>
        </div>

        {/* Dados da NF */}
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <InfoBox label="Fornecedor" value={nota.fornecedor} />
            <InfoBox label="CNPJ" value={nota.cnpj} />
            <InfoBox label="Número NF" value={nota.numero_nf} />
            <InfoBox label="Data Emissão" value={formatDate(nota.data_emissao)} />
            <InfoBox label="Volumes" value={String(nota.volumes)} />
            <InfoBox label="Status" value={nota.status === 'EM_TRANSITO' ? 'Em Trânsito' : 'Entregue'} />
          </div>

          {/* Itens */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-crunch-ink-dim mb-4">
              Itens da Nota ({itens.length})
            </h4>

            {loading ? (
              <div className="text-center py-8 text-crunch-ink-mute">Carregando itens...</div>
            ) : itens.length === 0 ? (
              <div className="text-center py-8 text-crunch-ink-mute">Nenhum item encontrado.</div>
            ) : (
              <div className="space-y-3">
                {itens.map((item) => (
                  <div
                    key={item.id}
                    className="bg-crunch-panel border border-crunch-line rounded-xl p-4"
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <p className="text-sm font-medium leading-tight">{item.produto}</p>
                      <span className="shrink-0 text-xs font-mono bg-crunch-panel-2 border border-crunch-line-2 px-2 py-1 rounded text-crunch-accent">
                        {item.codigo_ml}
                      </span>
                    </div>
                    <div className="flex gap-4 text-xs text-crunch-ink-mute">
                      <span>Qtd: <b className="text-crunch-ink-dim">{item.quantidade}</b></span>
                      <span>Unit: <b className="text-crunch-ink-dim">R$ {item.valor_unitario.toFixed(2)}</b></span>
                      <span>Total: <b className="text-crunch-ink-dim">R$ {item.valor_total.toFixed(2)}</b></span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Resumo */}
          {itens.length > 0 && (
            <div className="bg-crunch-panel-2 border border-crunch-line-2 rounded-xl p-4 flex justify-between text-sm">
              <span className="text-crunch-ink-mute">
                {itens.length} itens &middot; {totalQtd} unidades
              </span>
              <span className="font-semibold text-crunch-accent">
                R$ {totalValor.toFixed(2)}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-crunch-panel border border-crunch-line rounded-lg p-3">
      <span className="text-[10px] uppercase tracking-wider text-crunch-ink-mute block mb-1">{label}</span>
      <span className="text-sm font-medium">{value || '—'}</span>
    </div>
  )
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '—'
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}
