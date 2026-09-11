'use client'

import { useState, useCallback } from 'react'
import { extrairFull, type ItemFull } from '@/lib/preparar-full'
import { listarEstoque, cadastrarProduto } from '@/services/estoque'
import { processarEnvioFull } from '@/services/full'

/** Item já cruzado com o estoque */
interface ItemCruzado extends ItemFull {
  /** null = produto não existe no cadastro */
  saldo: number | null
  descricaoEstoque: string
}

export default function TabPrepararFull() {
  const [texto, setTexto] = useState('')
  const [itens, setItens] = useState<ItemCruzado[]>([])
  const [avisos, setAvisos] = useState<string[]>([])
  const [processando, setProcessando] = useState(false)
  const [erro, setErro] = useState('')
  const [copiado, setCopiado] = useState('')
  const [cadastrando, setCadastrando] = useState('')
  // Envio automático para o Google Sheets
  const [enviando, setEnviando] = useState(false)
  const [envioErro, setEnvioErro] = useState('')
  const [envioOk, setEnvioOk] = useState<{ aba: string; url: string; linhas: number } | null>(null)
  const [popupBloqueado, setPopupBloqueado] = useState(false)
  // Baixa no estoque
  const [confirmandoBaixa, setConfirmandoBaixa] = useState(false)
  const [dandoBaixa, setDandoBaixa] = useState(false)
  const [baixaErro, setBaixaErro] = useState('')
  const [baixaFeita, setBaixaFeita] = useState<{ total: number; codigos: number } | null>(null)

  /**
   * Um clique só: extrai do texto, cruza com o estoque, cria a aba na planilha
   * e abre em outra aba.
   *
   * A aba do navegador é aberta ANTES da chamada assíncrona, ainda dentro do
   * clique. Navegador bloqueia window.open disparado depois de um await — por
   * isso a janela é criada vazia e o endereço é preenchido quando a resposta
   * chega. Se mesmo assim for bloqueada, a tela mostra o link para clicar.
   */
  const criarPlanilha = useCallback(async () => {
    setErro('')
    setCopiado('')
    setEnvioOk(null)
    setEnvioErro('')
    setPopupBloqueado(false)
    setBaixaFeita(null)
    setBaixaErro('')
    setConfirmandoBaixa(false)

    const resultado = extrairFull(texto)
    if (resultado.itens.length === 0) {
      setItens([])
      setAvisos(resultado.avisos)
      setErro('Nenhum produto encontrado. Confira se o texto foi colado inteiro.')
      return
    }

    // Reservar a aba agora, enquanto ainda é um clique do usuário
    const janela = window.open('', '_blank')

    setProcessando(true)
    setEnviando(true)
    try {
      // 1. Cruzar com o estoque
      let cruzados: ItemCruzado[]
      try {
        const saldos = await listarEstoque()
        const porCodigo = new Map(saldos.map((s) => [s.codigo_ml.toUpperCase(), s]))
        cruzados = resultado.itens.map((it) => {
          const s = porCodigo.get(it.codigo)
          return {
            ...it,
            saldo: s ? s.quantidade_disponivel : null,
            descricaoEstoque: s ? s.produto : '',
          }
        })
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'Erro ao consultar o estoque.')
        cruzados = resultado.itens.map((it) => ({ ...it, saldo: null, descricaoEstoque: '' }))
      }
      setItens(cruzados)
      setAvisos(resultado.avisos)

      // 2. Criar a aba na planilha
      const res = await fetch('/api/sheets/preparar-envio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itens: resultado.itens.map((i) => ({ codigo: i.codigo, quantidade: i.quantidade })),
        }),
      })
      const data = await res.json()
      console.log('[Planilha] resposta:', res.status, data)

      if (data.ok) {
        setEnvioOk({ aba: data.aba, url: data.url, linhas: data.linhas })
        if (janela && !janela.closed) {
          janela.location.href = data.url
        } else {
          setPopupBloqueado(true)
        }
      } else {
        if (janela && !janela.closed) janela.close()
        setEnvioErro(
          `${data.error || `HTTP ${res.status}`}${data.deploy ? ` [build ${data.deploy}]` : ''}`
        )
      }
    } catch (e) {
      if (janela && !janela.closed) janela.close()
      setEnvioErro(e instanceof Error ? e.message : 'Falha ao falar com o servidor.')
    } finally {
      setProcessando(false)
      setEnviando(false)
    }
  }, [texto])

  /**
   * Dá baixa no estoque, registrando o envio FULL.
   * É irreversível, por isso exige confirmação e trava depois de feita.
   */
  const darBaixa = async () => {
    setDandoBaixa(true)
    setBaixaErro('')
    try {
      const hoje = new Date()
      const dataBR = `${String(hoje.getDate()).padStart(2, '0')}/${String(hoje.getMonth() + 1).padStart(2, '0')}/${hoje.getFullYear()}`

      const envio = await processarEnvioFull(
        itens.map((i) => ({
          codigo_ml: i.codigo,
          quantidade: i.quantidade,
          descricao: i.descricaoEstoque || i.descricao || undefined,
        })),
        { data_envio: dataBR, numero_nf: '', codigo_envio_ml: envioOk?.aba || '' }
      )

      setBaixaFeita({
        total: itens.reduce((s, i) => s + i.quantidade, 0),
        codigos: itens.length,
      })
      setConfirmandoBaixa(false)
      console.log('[Baixa FULL] envio registrado:', envio)
    } catch (e) {
      setBaixaErro(e instanceof Error ? e.message : 'Erro ao dar baixa no estoque.')
    } finally {
      setDandoBaixa(false)
    }
  }

  const limpar = () => {
    setTexto('')
    setItens([])
    setAvisos([])
    setErro('')
    setCopiado('')
    setEnvioOk(null)
    setEnvioErro('')
    setPopupBloqueado(false)
    setBaixaFeita(null)
    setBaixaErro('')
    setConfirmandoBaixa(false)
  }

  const copiar = async (valor: string, qual: string) => {
    try {
      await navigator.clipboard.writeText(valor)
    } catch {
      const el = document.createElement('textarea')
      el.value = valor
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    }
    setCopiado(qual)
    setTimeout(() => setCopiado(''), 2000)
  }

  /** Cadastra o produto que ainda não existe, usando os dados do próprio texto do ML */
  const cadastrar = async (item: ItemCruzado) => {
    setCadastrando(item.codigo)
    setErro('')
    try {
      await cadastrarProduto({
        codigo_ml: item.codigo,
        descricao: item.descricao || item.codigo,
        fornecedor: '',
        codigo_fornecedor: item.sku || undefined,
      })
      // Passa a existir com saldo zero
      setItens((atual) =>
        atual.map((i) =>
          i.codigo === item.codigo
            ? { ...i, saldo: 0, descricaoEstoque: item.descricao || item.codigo }
            : i
        )
      )
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao cadastrar produto.')
    } finally {
      setCadastrando('')
    }
  }

  const naoCadastrados = itens.filter((i) => i.saldo === null).length
  const semSaldo = itens.filter((i) => i.saldo !== null && i.saldo < i.quantidade).length
  const totalEtiquetas = itens.reduce((s, i) => s + i.quantidade, 0)

  return (
    <div className="space-y-5">
      {/* Entrada do texto */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <label className="block text-sm font-medium text-gray-900 mb-1">
          Cole aqui o texto do Mercado Livre
        </label>
        <p className="text-xs text-gray-500 mb-3">
          Pode colar bagunçado. O sistema encontra os códigos e as quantidades sozinho.
        </p>
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={8}
          placeholder={'Código ML:\nALWO97425\n...\n60 etiquetas'}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 font-mono text-xs text-gray-800 focus:outline-none focus:border-[#ff6a00] focus:ring-1 focus:ring-[#ff6a00]"
        />
        <div className="flex items-center gap-3 mt-3">
          <button
            onClick={criarPlanilha}
            disabled={processando || enviando || !texto.trim()}
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-[#ff6a00] text-white hover:bg-orange-600 disabled:opacity-50 transition-colors"
          >
            {processando || enviando ? 'Criando planilha...' : 'Criar planilha'}
          </button>
          <button
            onClick={limpar}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Limpar
          </button>
          {itens.length > 0 && (
            <span className="ml-auto text-sm text-gray-600">
              <b className="text-gray-900">{itens.length}</b> produtos ·{' '}
              <b className="text-gray-900">{totalEtiquetas.toLocaleString('pt-BR')}</b> etiquetas
            </span>
          )}
        </div>
      </div>

      {erro && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {erro}
        </div>
      )}

      {avisos.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-800 mb-1">
            Avisos
          </p>
          <ul className="text-sm text-amber-800 space-y-0.5">
            {avisos.map((a, i) => (
              <li key={i}>· {a}</li>
            ))}
          </ul>
        </div>
      )}

      {itens.length > 0 && (
        <>
          {/* Alertas de conferência */}
          {(naoCadastrados > 0 || semSaldo > 0) && (
            <div className="flex flex-wrap gap-3">
              {naoCadastrados > 0 && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  <b>{naoCadastrados}</b> produto{naoCadastrados > 1 ? 's' : ''} não cadastrado
                  {naoCadastrados > 1 ? 's' : ''} no estoque
                </div>
              )}
              {semSaldo > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  <b>{semSaldo}</b> com saldo menor que a quantidade pedida
                </div>
              )}
            </div>
          )}

          {/* Conferência item a item */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900">Conferência com o estoque</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-gray-500 border-b border-gray-200">
                    <th className="text-left px-5 py-2 font-semibold">Código</th>
                    <th className="text-left px-4 py-2 font-semibold">Produto</th>
                    <th className="text-center px-4 py-2 font-semibold">Pedido</th>
                    <th className="text-center px-4 py-2 font-semibold">Em estoque</th>
                    <th className="text-center px-4 py-2 font-semibold">Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {itens.map((item) => {
                    const naoExiste = item.saldo === null
                    const insuficiente = !naoExiste && (item.saldo as number) < item.quantidade
                    return (
                      <tr key={item.codigo} className="border-b border-gray-100 last:border-0">
                        <td className="px-5 py-3 font-mono text-xs text-gray-900">{item.codigo}</td>
                        <td className="px-4 py-3 text-gray-600 text-xs max-w-[280px] truncate">
                          {item.descricaoEstoque || item.descricao || '—'}
                        </td>
                        <td className="px-4 py-3 text-center font-semibold text-gray-900">
                          {item.quantidade}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {naoExiste ? (
                            <span className="text-gray-400">—</span>
                          ) : (
                            <span
                              className={`font-semibold ${
                                insuficiente ? 'text-amber-600' : 'text-green-600'
                              }`}
                            >
                              {item.saldo}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {naoExiste ? (
                            <button
                              onClick={() => cadastrar(item)}
                              disabled={cadastrando === item.codigo}
                              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                            >
                              {cadastrando === item.codigo
                                ? 'Cadastrando...'
                                : 'Cadastrar no estoque'}
                            </button>
                          ) : insuficiente ? (
                            <span className="text-xs text-amber-600 font-medium">
                              Faltam {item.quantidade - (item.saldo as number)}
                            </span>
                          ) : (
                            <span className="text-xs text-green-600 font-medium">OK</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* As duas listas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ListaCopiavel
              titulo="Códigos"
              valores={itens.map((i) => i.codigo)}
              copiado={copiado === 'codigos'}
              onCopiar={() => copiar(itens.map((i) => i.codigo).join('\n'), 'codigos')}
            />
            <ListaCopiavel
              titulo="Quantidades"
              valores={itens.map((i) => String(i.quantidade))}
              copiado={copiado === 'quantidades'}
              onCopiar={() => copiar(itens.map((i) => i.quantidade).join('\n'), 'quantidades')}
            />
          </div>

          {/* Resultado da planilha */}
          {envioOk && (
            <div className="bg-white rounded-xl border border-green-200 p-5 shadow-sm">
              <div className="flex items-start gap-2">
                <span className="text-green-600 mt-px">&#10003;</span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-900">
                    Aba <span className="font-mono">{envioOk.aba}</span> criada na planilha
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {envioOk.linhas} produto{envioOk.linhas > 1 ? 's' : ''} nas colunas D e F, a partir
                    da linha 8.
                    {!popupBloqueado && ' A planilha abriu em outra aba.'}
                  </p>
                </div>
                <a
                  href={envioOk.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`shrink-0 inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
                    popupBloqueado
                      ? 'bg-[#ff6a00] text-white hover:bg-orange-600'
                      : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {popupBloqueado ? 'Abrir a planilha' : 'Abrir de novo'}
                  <span aria-hidden="true">&rarr;</span>
                </a>
              </div>
              {popupBloqueado && (
                <p className="mt-3 text-xs text-amber-700">
                  O navegador bloqueou a abertura automática. Clique no botão acima — e, se quiser que
                  abra sozinho das próximas vezes, libere pop-ups para este site.
                </p>
              )}
            </div>
          )}

          {envioErro && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
              <p className="text-sm font-medium text-amber-900">
                Não consegui criar a aba na planilha
              </p>
              <p className="mt-1 font-mono text-[11px] leading-relaxed text-amber-800 break-words">
                {envioErro}
              </p>
              <p className="mt-2 text-xs text-amber-700">
                As listas acima continuam válidas — pode copiar e colar à mão enquanto isso.
              </p>
            </div>
          )}

          {/* Baixa no estoque */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            {baixaFeita ? (
              <div className="flex items-start gap-2">
                <span className="text-green-600 mt-px">&#10003;</span>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Baixa registrada no estoque</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {baixaFeita.total.toLocaleString('pt-BR')} unidades de {baixaFeita.codigos} código
                    {baixaFeita.codigos > 1 ? 's' : ''} saíram do estoque. O envio está no histórico FULL.
                  </p>
                </div>
              </div>
            ) : confirmandoBaixa ? (
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  Confirmar a baixa de {itens.reduce((s, i) => s + i.quantidade, 0).toLocaleString('pt-BR')} unidades?
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Isso gera saída no estoque dos {itens.length} produtos da lista e registra o envio no
                  histórico. Não dá para desfazer pela tela.
                </p>
                {itens.some((i) => i.saldo !== null && i.saldo < i.quantidade) && (
                  <p className="mt-2 text-xs text-amber-700">
                    Atenção: há produto com saldo menor que a quantidade pedida. O estoque vai ficar
                    negativo nesses itens.
                  </p>
                )}
                <div className="flex items-center gap-3 mt-4">
                  <button
                    onClick={darBaixa}
                    disabled={dandoBaixa}
                    className="px-5 py-2.5 text-sm font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                  >
                    {dandoBaixa ? 'Dando baixa...' : 'Sim, dar baixa'}
                  </button>
                  <button
                    onClick={() => setConfirmandoBaixa(false)}
                    disabled={dandoBaixa}
                    className="px-4 py-2.5 text-sm font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <p className="text-sm font-semibold text-gray-900">Dar baixa no estoque</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Registra o envio FULL e desconta as quantidades do saldo.
                  </p>
                </div>
                <button
                  onClick={() => setConfirmandoBaixa(true)}
                  className="px-5 py-3 text-sm font-semibold rounded-xl border border-red-300 text-red-700 hover:bg-red-50 transition-colors"
                >
                  Dar baixa no estoque
                </button>
              </div>
            )}

            {baixaErro && (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                <p className="text-sm font-medium text-red-900">Não consegui dar baixa</p>
                <p className="mt-1 font-mono text-[11px] leading-relaxed text-red-800 break-words">
                  {baixaErro}
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function ListaCopiavel({
  titulo,
  valores,
  copiado,
  onCopiar,
}: {
  titulo: string
  valores: string[]
  copiado: boolean
  onCopiar: () => void
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">{titulo}</h3>
        <button
          onClick={onCopiar}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
            copiado
              ? 'border-green-300 bg-green-50 text-green-700'
              : 'border-gray-200 text-gray-600 hover:border-[#ff6a00] hover:text-[#ff6a00]'
          }`}
        >
          {copiado ? 'Copiado' : 'Copiar'}
        </button>
      </div>
      <pre className="px-5 py-4 font-mono text-xs text-gray-800 leading-7 whitespace-pre">
        {valores.join('\n')}
      </pre>
    </div>
  )
}
