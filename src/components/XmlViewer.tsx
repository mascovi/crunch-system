'use client'

import { useEffect, useState } from 'react'
import type { ItemNF, NotaFiscal } from '@/types'

interface DadosProduto {
  nomeCurto: string
  itensPorVolume: number
}

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
  /**
   * Itens por caixa, vindos da coluna F do BANCO_DE_DADOS.
   * Carrega em paralelo: se a planilha demorar ou cair, a nota continua
   * aparecendo normalmente, só sem a contagem de caixas.
   */
  const [produtos, setProdutos] = useState<Record<string, DadosProduto>>({})

  /**
   * Itens já conferidos, por id do item.
   *
   * POR QUE GRAVAR NO NAVEGADOR:
   * Conferir uma descarga leva tempo — o celular apaga a tela, alguém fecha
   * a janela sem querer, a página recarrega. Perder meia conferência e ter
   * que recontar tudo é pior que o problema que isso resolve. Fica guardado
   * por NF, então duas notas abertas no mesmo dia não se misturam.
   *
   * LIMITE: é por navegador. Se você confere no celular e seu irmão no
   * computador, cada um vê os próprios checks. Para conferência a quatro
   * mãos, isso precisaria ir para o banco.
   */
  const [conferidos, setConferidos] = useState<Record<string, boolean>>({})

  const chaveConferencia = nota ? `conferencia-nf-${nota.id}` : ''

  useEffect(() => {
    if (!isOpen) return
    fetch('/api/sheets/produtos')
      .then((r) => r.json())
      .then((d) => {
        if (d.ok && d.produtos) setProdutos(d.produtos)
        else console.warn('[caixas] indisponíveis:', d.error)
      })
      .catch((e) => console.warn('[caixas] falha ao buscar:', e))
  }, [isOpen])

  // Retoma a conferência de onde parou
  useEffect(() => {
    if (!isOpen || !chaveConferencia) return
    try {
      const salvo = window.localStorage.getItem(chaveConferencia)
      setConferidos(salvo ? JSON.parse(salvo) : {})
    } catch {
      // localStorage pode estar bloqueado (aba anônima, política do
      // navegador). A conferência segue funcionando, só não sobrevive ao
      // fechamento da janela.
      setConferidos({})
    }
  }, [isOpen, chaveConferencia])

  const alternarConferido = (itemId: string) => {
    setConferidos((atual) => {
      const novo = { ...atual, [itemId]: !atual[itemId] }
      if (!novo[itemId]) delete novo[itemId]
      try {
        window.localStorage.setItem(chaveConferencia, JSON.stringify(novo))
      } catch {
        /* sem persistência — a tela continua funcionando */
      }
      return novo
    })
  }

  const limparConferencia = () => {
    setConferidos({})
    try {
      window.localStorage.removeItem(chaveConferencia)
    } catch {
      /* idem */
    }
  }

  if (!isOpen || !nota) return null

  const totalValor = itens.reduce((sum, i) => sum + i.valor_total, 0)
  const totalQtd = itens.reduce((sum, i) => sum + i.quantidade, 0)

  /**
   * Caixas de um item. Devolve null quando o produto não está na planilha
   * ou está sem itens por volume — nesse caso a tela não mostra palpite.
   *
   * O resto (unidades que não fecham uma caixa) é mostrado separado em vez
   * de arredondado: 593 unidades a 6 por caixa são 98 caixas e 5 soltas, e
   * quem está conferindo a descarga precisa saber das 5.
   */
  const calcularCaixas = (item: ItemNF) => {
    const dados = produtos[(item.codigo_ml || '').toUpperCase()]
    if (!dados || dados.itensPorVolume <= 0) return null
    const porCaixa = dados.itensPorVolume
    return {
      porCaixa,
      caixas: Math.floor(item.quantidade / porCaixa),
      soltas: item.quantidade % porCaixa,
    }
  }

  // Soma das caixas calculadas, para conferir contra os volumes declarados
  const comCaixas = itens.map(calcularCaixas).filter(Boolean) as {
    porCaixa: number
    caixas: number
    soltas: number
  }[]
  const totalCaixas = comCaixas.reduce((s, c) => s + c.caixas + (c.soltas > 0 ? 1 : 0), 0)
  const totalConferidos = itens.filter((i) => conferidos[i.id]).length
  const todosTemCaixa = comCaixas.length === itens.length && itens.length > 0
  const diferencaVolumes = todosTemCaixa ? totalCaixas - (nota.volumes || 0) : null

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
            <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-crunch-ink-dim">
                Itens da Nota ({itens.length})
              </h4>

              {itens.length > 0 && (
                <div className="flex items-center gap-3">
                  <span
                    className={`text-xs font-medium ${
                      totalConferidos === itens.length
                        ? 'text-green-400'
                        : 'text-crunch-ink-mute'
                    }`}
                  >
                    {totalConferidos === itens.length
                      ? '✓ Tudo conferido'
                      : `${totalConferidos} de ${itens.length} conferidos`}
                  </span>
                  {totalConferidos > 0 && (
                    <button
                      onClick={limparConferencia}
                      className="text-xs text-crunch-ink-mute hover:text-crunch-accent transition-colors"
                    >
                      Limpar
                    </button>
                  )}
                </div>
              )}
            </div>

            {loading ? (
              <div className="text-center py-8 text-crunch-ink-mute">Carregando itens...</div>
            ) : itens.length === 0 ? (
              <div className="text-center py-8 text-crunch-ink-mute">Nenhum item encontrado.</div>
            ) : (
              <div className="space-y-3">
                {itens.map((item) => {
                  const cx = calcularCaixas(item)
                  const conferido = Boolean(conferidos[item.id])
                  return (
                    <div
                      key={item.id}
                      onClick={() => alternarConferido(item.id)}
                      className={`border rounded-xl p-4 cursor-pointer transition-colors select-none ${
                        conferido
                          ? 'bg-green-500/5 border-green-500/40'
                          : 'bg-crunch-panel border-crunch-line hover:border-crunch-line-2'
                      }`}
                    >
                      <div className="flex items-start gap-3 mb-2">
                        {/* O cartão inteiro é clicável: conferência é feita
                            de pé, com caixa na mão — alvo grande importa */}
                        <span
                          className={`mt-0.5 shrink-0 w-5 h-5 rounded border flex items-center justify-center text-xs font-bold transition-colors ${
                            conferido
                              ? 'bg-green-500 border-green-500 text-white'
                              : 'border-crunch-line-2 text-transparent'
                          }`}
                          aria-hidden="true"
                        >
                          &#10003;
                        </span>
                        <p
                          className={`text-sm font-medium leading-tight flex-1 ${
                            conferido ? 'text-crunch-ink-mute line-through' : ''
                          }`}
                        >
                          {item.produto}
                        </p>
                        <span className="shrink-0 text-xs font-mono bg-crunch-panel-2 border border-crunch-line-2 px-2 py-1 rounded text-crunch-accent">
                          {item.codigo_ml}
                        </span>
                      </div>

                      {/* Caixas em destaque — é o número que serve na descarga */}
                      {cx ? (
                        <div className="flex items-baseline gap-2 mb-2">
                          <span className="text-lg font-bold text-crunch-accent">
                            {cx.caixas} {cx.caixas === 1 ? 'caixa' : 'caixas'}
                          </span>
                          {cx.soltas > 0 && (
                            <span className="text-xs text-amber-400">
                              + {cx.soltas} {cx.soltas === 1 ? 'unidade solta' : 'unidades soltas'}
                            </span>
                          )}
                          <span className="text-[11px] text-crunch-ink-mute">
                            ({cx.porCaixa} por caixa)
                          </span>
                        </div>
                      ) : (
                        <p className="text-[11px] text-crunch-ink-mute mb-2">
                          Sem itens por caixa no BANCO_DE_DADOS — não dá para calcular.
                        </p>
                      )}

                      <div className="flex gap-4 text-xs text-crunch-ink-mute">
                        <span>Qtd: <b className="text-crunch-ink-dim">{item.quantidade}</b></span>
                        <span>Unit: <b className="text-crunch-ink-dim">R$ {item.valor_unitario.toFixed(2)}</b></span>
                        <span>Total: <b className="text-crunch-ink-dim">R$ {item.valor_total.toFixed(2)}</b></span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Resumo */}
          {itens.length > 0 && (
            <div className="bg-crunch-panel-2 border border-crunch-line-2 rounded-xl p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-crunch-ink-mute">
                  {itens.length} itens &middot; {totalQtd} unidades
                </span>
                <span className="font-semibold text-crunch-accent">
                  R$ {totalValor.toFixed(2)}
                </span>
              </div>

              {comCaixas.length > 0 && (
                <div className="pt-3 border-t border-crunch-line-2 flex items-center justify-between gap-3 flex-wrap">
                  <span className="text-sm">
                    <b className="text-crunch-ink">{totalCaixas}</b>{' '}
                    <span className="text-crunch-ink-mute">
                      {totalCaixas === 1 ? 'caixa no total' : 'caixas no total'}
                      {!todosTemCaixa && ` (${comCaixas.length} de ${itens.length} itens)`}
                    </span>
                  </span>

                  {/*
                    Confere a conta contra o que o fornecedor declarou. Uma
                    divergência grande significa que os itens por caixa da
                    planilha estão errados, ou que o fornecedor embalou de um
                    jeito diferente — e é melhor descobrir antes da descarga.
                    Só compara quando TODOS os itens têm caixa; comparar uma
                    soma parcial contra o total declarado acusaria diferença
                    o tempo todo.
                  */}
                  {diferencaVolumes !== null && (
                    <span
                      className={`text-xs px-2 py-1 rounded border ${
                        Math.abs(diferencaVolumes) <= 1
                          ? 'text-green-400 border-green-500/30 bg-green-500/10'
                          : 'text-amber-400 border-amber-500/30 bg-amber-500/10'
                      }`}
                    >
                      {Math.abs(diferencaVolumes) <= 1
                        ? `Bate com os ${nota.volumes} volumes da nota`
                        : `Nota declara ${nota.volumes} volumes — ${
                            diferencaVolumes > 0 ? 'calculei' : 'faltam'
                          } ${Math.abs(diferencaVolumes)} a ${
                            diferencaVolumes > 0 ? 'mais' : 'menos'
                          }`}
                    </span>
                  )}
                </div>
              )}
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
