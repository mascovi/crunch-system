'use client'

import { useState, useCallback } from 'react'
import { extrairFull, type ItemFull } from '@/lib/preparar-full'
import { listarEstoque, cadastrarProduto } from '@/services/estoque'

const URL_PLANILHA =
  'https://docs.google.com/spreadsheets/d/1DcXbresRLktKlvkqOUzPBNUL1WNVX0kyio1mlnx6HI4/edit?gid=0#gid=0'

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

  const separar = useCallback(async () => {
    setErro('')
    setCopiado('')
    const resultado = extrairFull(texto)

    if (resultado.itens.length === 0) {
      setItens([])
      setAvisos(resultado.avisos)
      setErro('Nenhum produto encontrado. Confira se o texto foi colado inteiro.')
      return
    }

    setProcessando(true)
    try {
      // Cruzar com o estoque atual
      const saldos = await listarEstoque()
      const porCodigo = new Map(saldos.map((s) => [s.codigo_ml.toUpperCase(), s]))

      setItens(
        resultado.itens.map((it) => {
          const s = porCodigo.get(it.codigo)
          return {
            ...it,
            saldo: s ? s.quantidade_disponivel : null,
            descricaoEstoque: s ? s.produto : '',
          }
        })
      )
      setAvisos(resultado.avisos)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao consultar o estoque.')
      // Mesmo sem o cruzamento, entregar as listas
      setItens(resultado.itens.map((it) => ({ ...it, saldo: null, descricaoEstoque: '' })))
      setAvisos(resultado.avisos)
    } finally {
      setProcessando(false)
    }
  }, [texto])

  const limpar = () => {
    setTexto('')
    setItens([])
    setAvisos([])
    setErro('')
    setCopiado('')
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
            onClick={separar}
            disabled={processando || !texto.trim()}
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-[#ff6a00] text-white hover:bg-orange-600 disabled:opacity-50 transition-colors"
          >
            {processando ? 'Processando...' : 'Separar listas'}
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

          {/* Ir para a planilha */}
          <div className="flex justify-end">
            <a
              href={URL_PLANILHA}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold rounded-xl bg-[#ff6a00] text-white hover:bg-orange-600 transition-colors"
            >
              Ir para planilha de envio
              <span aria-hidden="true">&rarr;</span>
            </a>
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
