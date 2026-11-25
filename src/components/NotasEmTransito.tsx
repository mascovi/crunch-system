'use client'

import { useState, useEffect, useCallback } from 'react'
import type { NotaEmTransito, ItemNF } from '@/types'
import { listarNotasEmTransito, buscarItensNF, confirmarRecebimento } from '@/services/notas-fiscais'
import { buscarEstatisticasEntrega } from '@/services/entregas'
import { acharTransportadora } from '@/lib/rastreio'
import ConfirmModal from './ConfirmModal'
import XmlViewer from './XmlViewer'

/** CNPJ da Crunch — usado nas consultas de rastreio */
const CNPJ_CRUNCH = '50.288.627/0001-68'

export default function NotasEmTransito() {
  const [notas, setNotas] = useState<NotaEmTransito[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [mediasPorTransp, setMediasPorTransp] = useState<Record<string, number>>({})

  // Viewer
  const [viewerOpen, setViewerOpen] = useState(false)
  const [viewerNota, setViewerNota] = useState<NotaEmTransito | null>(null)
  const [viewerItens, setViewerItens] = useState<ItemNF[]>([])
  const [viewerLoading, setViewerLoading] = useState(false)

  // Confirm recebimento
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmNota, setConfirmNota] = useState<NotaEmTransito | null>(null)
  const [confirmLoading, setConfirmLoading] = useState(false)

  // Aviso flutuante do rastreio
  const [avisoRastreio, setAvisoRastreio] = useState('')
  /** Resultado do aviso de Telegram ao marcar entrega. Fica na tela até fechar. */
  const [avisoTelegram, setAvisoTelegram] = useState('')

  const carregarNotas = useCallback(async () => {
    try {
      setLoading(true)
      const [data, stats] = await Promise.all([
        listarNotasEmTransito(),
        buscarEstatisticasEntrega(),
      ])
      setNotas(data)
      const medias: Record<string, number> = {}
      for (const s of stats) {
        if (s.media_dias !== null) {
          medias[s.transportadora] = s.media_dias
        }
      }
      setMediasPorTransp(medias)
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

  /**
   * Confirma o recebimento e avisa no Telegram.
   *
   * A ORDEM IMPORTA: primeiro a entrada no estoque, depois o aviso. Se o
   * Telegram falhar, o recebimento já está registrado e só o aviso se perde —
   * o contrário seria bem pior.
   *
   * O envio é feito por uma rota de API porque o token do bot não pode chegar
   * ao navegador. E a falha aparece NA TELA, não só no console: foi justamente
   * uma notificação falhando em silêncio que nos custou uma sessão inteira de
   * depuração.
   */
  const handleConfirmarRecebimento = async () => {
    if (!confirmNota) return
    const nota = confirmNota
    setConfirmLoading(true)
    setAvisoTelegram('')
    try {
      const itens = await buscarItensNF(nota.id)

      await confirmarRecebimento(nota.id)
      setConfirmOpen(false)
      setConfirmNota(null)
      await carregarNotas()

      // Dias em trânsito, quando dá para calcular
      let dias: number | null = null
      if (nota.data_emissao) {
        const ms = Date.now() - new Date(nota.data_emissao).getTime()
        const d = Math.floor(ms / 86400000)
        if (Number.isFinite(d) && d >= 0) dias = d
      }

      try {
        const res = await fetch('/api/notas-fiscais/entregue', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            numero_nf: nota.numero_nf,
            fornecedor: nota.fornecedor,
            transportadora: nota.transportadora || '',
            volumes: nota.volumes,
            data_emissao: nota.data_emissao,
            dias_em_transito: dias,
            itens: itens.map((i) => ({ produto: i.produto, quantidade: i.quantidade })),
          }),
        })
        const data = await res.json()
        console.log('[Telegram entregue]', res.status, data)

        if (data.ok) {
          setAvisoTelegram(`NF ${nota.numero_nf} recebida. Aviso enviado no Telegram.`)
        } else {
          setAvisoTelegram(
            `NF ${nota.numero_nf} recebida e no estoque, mas o aviso no Telegram falhou: ` +
              `${data.error || `HTTP ${res.status}`}${data.deploy ? ` [build ${data.deploy}]` : ''}`
          )
        }
      } catch (e) {
        setAvisoTelegram(
          `NF ${nota.numero_nf} recebida e no estoque, mas não consegui falar com o servidor ` +
            `para enviar o aviso: ${e instanceof Error ? e.message : String(e)}`
        )
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao confirmar recebimento')
    } finally {
      setConfirmLoading(false)
    }
  }

  /**
   * Abre a pagina de rastreio da transportadora com o CNPJ ja copiado.
   * O numero da NF vai no aviso, pronto para digitar.
   */
  const handleRastrear = async (nota: NotaEmTransito) => {
    const transp = acharTransportadora(nota.transportadora)
    if (!transp) return

    try {
      await navigator.clipboard.writeText(CNPJ_CRUNCH)
    } catch {
      const el = document.createElement('textarea')
      el.value = CNPJ_CRUNCH
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    }

    window.open(transp.url, '_blank', 'noopener,noreferrer')
    setAvisoRastreio(
      `CNPJ copiado. Na ${transp.nome}: ${transp.instrucao} Numero da NF: ${nota.numero_nf}`
    )
    setTimeout(() => setAvisoRastreio(''), 12000)
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-'
    const [y, m, d] = dateStr.split('-')
    return `${d}/${m}/${y}`
  }

  const getDiasUteisColor = (dias: number) => {
    if (dias <= 3) return 'text-green-400'
    if (dias <= 7) return 'text-yellow-400'
    return 'text-red-400'
  }

  const renderPrevisao = (nota: NotaEmTransito) => {
    const transp = nota.transportadora || ''
    const media = mediasPorTransp[transp]
    if (media === undefined || !nota.data_emissao) {
      return <td className="px-4 py-4 text-center text-crunch-ink-mute text-xs">--</td>
    }
    const emissao = new Date(nota.data_emissao)
    const estimada = new Date(emissao)
    estimada.setDate(estimada.getDate() + Math.ceil(media))
    const hoje = new Date()
    const cor = estimada >= hoje ? 'text-green-400' : 'text-red-400'
    const dataStr = formatDate(estimada.toISOString().split('T')[0])
    return (
      <td className="px-4 py-4 text-center">
        <span className={`font-medium text-xs ${cor}`}>{dataStr}</span>
      </td>
    )
  }

  if (loading) {
    return (
      <div className="bg-crunch-panel border border-crunch-line rounded-2xl p-8">
        <div className="text-center text-crunch-ink-mute">Carregando notas...</div>
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
              Notas Fiscais em Transito
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

        {avisoRastreio && (
          <div className="px-6 py-3 bg-blue-900/20 text-blue-300 text-xs border-b border-crunch-line flex items-start gap-2">
            <span className="mt-px">&#8505;</span>
            <span>{avisoRastreio}</span>
          </div>
        )}

        {/* Resultado do aviso de Telegram. Fica até você fechar — falha de
            notificação que some sozinha é falha que ninguém vê. */}
        {avisoTelegram && (
          <div
            className={`px-6 py-3 text-xs border-b border-crunch-line flex items-start gap-2 ${
              avisoTelegram.includes('falhou') || avisoTelegram.includes('não consegui')
                ? 'bg-amber-900/20 text-amber-300'
                : 'bg-green-900/20 text-green-300'
            }`}
          >
            <span className="mt-px">
              {avisoTelegram.includes('falhou') || avisoTelegram.includes('não consegui')
                ? '⚠'
                : '✓'}
            </span>
            <span className="flex-1 break-words">{avisoTelegram}</span>
            <button
              onClick={() => setAvisoTelegram('')}
              className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
              aria-label="Fechar aviso"
            >
              &#10005;
            </button>
          </div>
        )}

        {notas.length === 0 ? (
          <div className="px-6 py-12 text-center text-crunch-ink-mute text-sm">
            Nenhuma nota fiscal em transito.
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
                  <th className="text-center px-4 py-3 font-semibold">Dias</th>
                  <th className="text-center px-4 py-3 font-semibold">Previsao</th>
                  <th className="text-center px-4 py-3 font-semibold">Acoes</th>
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
                    <td className="px-4 py-4 text-crunch-ink-dim text-xs">{nota.transportadora || '-'}</td>
                    <td className="px-4 py-4 text-center text-crunch-ink-dim">{nota.volumes}</td>
                    <td className="px-4 py-4 text-crunch-ink-dim">{formatDate(nota.data_emissao)}</td>
                    <td className={`px-4 py-4 text-center font-semibold ${getDiasUteisColor(nota.dias_uteis)}`}>
                      {nota.dias_uteis}d
                    </td>
                    {renderPrevisao(nota)}
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-center gap-2">
                        {acharTransportadora(nota.transportadora) && (
                          <button
                            onClick={() => handleRastrear(nota)}
                            title={`Abrir rastreio da ${acharTransportadora(nota.transportadora)?.nome} com o CNPJ copiado`}
                            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-crunch-line text-crunch-ink-dim hover:text-blue-400 hover:border-blue-400 transition-colors"
                          >
                            Rastrear
                          </button>
                        )}
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

      {/* Modal de confirmacao */}
      <ConfirmModal
        isOpen={confirmOpen}
        title="Confirmar Recebimento"
        message={`Confirmar recebimento da NF ${confirmNota?.numero_nf} de ${confirmNota?.fornecedor}? Os itens serao adicionados ao estoque.`}
        confirmLabel="Confirmar Entrega"
        onConfirm={handleConfirmarRecebimento}
        onCancel={() => { setConfirmOpen(false); setConfirmNota(null) }}
        loading={confirmLoading}
      />
    </>
  )
}
