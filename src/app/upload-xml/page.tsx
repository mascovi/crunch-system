'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { parseNFeXML, validarCodigosML } from '@/lib/xml-parser'
import { verificarNFDuplicada } from '@/services/notas-fiscais'
import { supabase } from '@/lib/supabase'
import type { XMLParsedNF, NotaFiscal } from '@/types'

type Step = 'upload' | 'preview' | 'success'

export default function UploadXMLPage() {
  const [step, setStep] = useState<Step>('upload')
  const [fileName, setFileName] = useState('')
  const [xmlContent, setXmlContent] = useState('')
  const [parsedNF, setParsedNF] = useState<XMLParsedNF | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const [warnings, setWarnings] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Histórico de NFs
  const [historicoNFs, setHistoricoNFs] = useState<NotaFiscal[]>([])
  const [historicoLoading, setHistoricoLoading] = useState(true)

  useEffect(() => {
    const carregarHistorico = async () => {
      try {
        const { data, error } = await supabase
          .from('notas_fiscais')
          .select('*')
          .order('data_upload', { ascending: false })
          .limit(50)
        if (!error && data) setHistoricoNFs(data)
      } catch (err) {
        console.error(err)
      } finally {
        setHistoricoLoading(false)
      }
    }
    carregarHistorico()
  }, [])

  // Reload history after success
  const recarregarHistorico = async () => {
    const { data } = await supabase
      .from('notas_fiscais')
      .select('*')
      .order('data_upload', { ascending: false })
      .limit(50)
    if (data) setHistoricoNFs(data)
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validar tipo
    if (!file.name.toLowerCase().endsWith('.xml')) {
      setErrors(['Arquivo deve ser um XML.'])
      return
    }

    // Validar tamanho (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setErrors(['Arquivo muito grande. Máximo 10MB.'])
      return
    }

    setLoading(true)
    setErrors([])
    setWarnings([])
    setFileName(file.name)

    try {
      const text = await file.text()
      setXmlContent(text)

      // Parse
      const parsed = parseNFeXML(text)

      // Validar Código ML
      const mlErrors = validarCodigosML(parsed.itens)
      if (mlErrors.length > 0) {
        setWarnings(mlErrors)
      }

      // Verificar duplicata
      const duplicada = await verificarNFDuplicada(parsed.numero_nf, parsed.cnpj)
      if (duplicada) {
        setErrors([`NF ${parsed.numero_nf} do CNPJ ${parsed.cnpj} já existe no sistema.`])
        setLoading(false)
        return
      }

      setParsedNF(parsed)
      setStep('preview')
    } catch (err) {
      setErrors([err instanceof Error ? err.message : 'Erro ao processar XML.'])
    } finally {
      setLoading(false)
    }
  }

  const handleConfirmar = async () => {
    if (!parsedNF || !xmlContent) return
    setSaving(true)
    setErrors([])

    try {
      // Upload do XML para Supabase Storage
      const xmlFileName = `nf_${parsedNF.numero_nf}_${Date.now()}.xml`
      const { data: storageData, error: storageError } = await supabase.storage
        .from('xml-notas')
        .upload(xmlFileName, new Blob([xmlContent], { type: 'text/xml' }))

      let xmlUrl = ''
      if (storageError) {
        // Se storage não estiver configurado, seguir sem URL
        console.warn('Storage não configurado:', storageError.message)
      } else {
        const { data: urlData } = supabase.storage
          .from('xml-notas')
          .getPublicUrl(storageData.path)
        xmlUrl = urlData.publicUrl
      }

      // Salvar NF + notificar Telegram (tudo server-side, numa chamada só)
      const salvarRes = await fetch('/api/notas-fiscais/salvar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parsedNF, xmlUrl }),
      })
      const salvarData = await salvarRes.json()
      if (!salvarRes.ok) {
        throw new Error(salvarData.error || 'Erro ao salvar nota fiscal.')
      }

      setStep('success')
      recarregarHistorico()
    } catch (err) {
      setErrors([err instanceof Error ? err.message : 'Erro ao salvar nota fiscal.'])
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    setStep('upload')
    setFileName('')
    setXmlContent('')
    setParsedNF(null)
    setErrors([])
    setWarnings([])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '—'
    const [y, m, d] = dateStr.split('-')
    return `${d}/${m}/${y}`
  }

  return (
    <div className="max-w-[900px] mx-auto px-8 py-20">
      {/* Header */}
      <div className="flex items-center gap-4 mb-10">
        <Link
          href="/"
          className="w-9 h-9 rounded-lg border border-crunch-line flex items-center justify-center text-crunch-ink-mute hover:text-crunch-accent hover:border-crunch-accent transition-colors"
        >
          &larr;
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Subir XML</h1>
          <p className="text-sm text-crunch-ink-mute mt-1">Upload de nota fiscal eletrônica</p>
        </div>
      </div>

      {/* Erros */}
      {errors.length > 0 && (
        <div className="mb-6 bg-red-900/20 border border-red-800/40 rounded-xl p-4">
          {errors.map((err, i) => (
            <p key={i} className="text-sm text-red-400">{err}</p>
          ))}
        </div>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="mb-6 bg-yellow-900/20 border border-yellow-800/40 rounded-xl p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-yellow-500 mb-2">Atenção</p>
          {warnings.map((w, i) => (
            <p key={i} className="text-sm text-yellow-400">{w}</p>
          ))}
        </div>
      )}

      {/* ============================================ */}
      {/* STEP: UPLOAD                                  */}
      {/* ============================================ */}
      {step === 'upload' && (
        <div
          className="bg-crunch-panel border-2 border-dashed border-crunch-line rounded-2xl p-16 text-center cursor-pointer hover:border-crunch-accent transition-colors"
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xml"
            onChange={handleFileSelect}
            className="hidden"
          />

          {loading ? (
            <div className="text-crunch-ink-mute">
              <svg className="animate-spin h-8 w-8 mx-auto mb-4 text-crunch-accent" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <p className="text-sm">Processando {fileName}...</p>
            </div>
          ) : (
            <>
              <div className="text-4xl mb-4 text-crunch-accent">&uarr;</div>
              <h2 className="text-lg font-semibold mb-2">Arraste o arquivo XML ou clique aqui</h2>
              <p className="text-sm text-crunch-ink-mute">Aceita apenas arquivos .xml de NF-e (máx. 10MB)</p>
            </>
          )}
        </div>
      )}

      {/* ============================================ */}
      {/* STEP: PREVIEW                                 */}
      {/* ============================================ */}
      {step === 'preview' && parsedNF && (
        <div className="space-y-6 animate-fade-in-up">
          {/* Dados da NF */}
          <div className="bg-crunch-panel border border-crunch-line rounded-2xl p-6">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-crunch-ink-dim mb-4">Dados da Nota Fiscal</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <InfoBox label="Fornecedor" value={parsedNF.fornecedor} />
              <InfoBox label="CNPJ" value={parsedNF.cnpj} />
              <InfoBox label="Número NF" value={parsedNF.numero_nf} />
              <InfoBox label="Data Emissão" value={formatDate(parsedNF.data_emissao)} />
              <InfoBox label="Volumes" value={String(parsedNF.volumes)} />
              <InfoBox label="Total de Itens" value={String(parsedNF.itens.length)} />
            </div>
          </div>

          {/* Itens */}
          <div className="bg-crunch-panel border border-crunch-line rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-crunch-line">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-crunch-ink-dim">
                Itens Encontrados ({parsedNF.itens.length})
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-crunch-ink-mute border-b border-crunch-line">
                    <th className="text-left px-6 py-3 font-semibold">Código ML</th>
                    <th className="text-left px-4 py-3 font-semibold">Produto</th>
                    <th className="text-center px-4 py-3 font-semibold">Qtd</th>
                    <th className="text-right px-4 py-3 font-semibold">Unit.</th>
                    <th className="text-right px-6 py-3 font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedNF.itens.map((item, i) => (
                    <tr key={i} className="border-b border-crunch-line/50">
                      <td className="px-6 py-3">
                        <span className={`font-mono text-xs px-2 py-0.5 rounded ${
                          item.codigo_ml
                            ? 'bg-crunch-accent/10 text-crunch-accent border border-crunch-accent/30'
                            : 'bg-red-900/20 text-red-400 border border-red-800/30'
                        }`}>
                          {item.codigo_ml || 'SEM CÓDIGO'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-crunch-ink-dim max-w-[300px] truncate">{item.produto}</td>
                      <td className="px-4 py-3 text-center">{item.quantidade}</td>
                      <td className="px-4 py-3 text-right text-crunch-ink-dim">R$ {item.valor_unitario.toFixed(2)}</td>
                      <td className="px-6 py-3 text-right font-medium">R$ {item.valor_total.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totais */}
            <div className="px-6 py-4 border-t border-crunch-line bg-crunch-panel-2/50 flex justify-between text-sm">
              <span className="text-crunch-ink-mute">
                {parsedNF.itens.length} itens &middot; {parsedNF.itens.reduce((s, i) => s + i.quantidade, 0)} unidades
              </span>
              <span className="font-semibold text-crunch-accent">
                R$ {parsedNF.itens.reduce((s, i) => s + i.valor_total, 0).toFixed(2)}
              </span>
            </div>
          </div>

          {/* Ações */}
          <div className="flex gap-4 justify-end">
            <button
              onClick={handleReset}
              className="px-6 py-3 text-sm font-medium rounded-xl border border-crunch-line text-crunch-ink-dim hover:bg-crunch-panel-2 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirmar}
              disabled={saving}
              className="px-6 py-3 text-sm font-semibold rounded-xl bg-crunch-accent text-white hover:bg-orange-600 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {saving && (
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              Confirmar e Enviar
            </button>
          </div>
        </div>
      )}

      {/* ============================================ */}
      {/* STEP: SUCCESS                                 */}
      {/* ============================================ */}
      {step === 'success' && (
        <div className="bg-crunch-panel border border-crunch-line rounded-2xl p-12 text-center animate-fade-in-up">
          <div className="text-4xl mb-4 text-green-400">&#10003;</div>
          <h2 className="text-xl font-semibold mb-2">Nota fiscal enviada com sucesso</h2>
          <p className="text-sm text-crunch-ink-dim mb-8">
            A NF foi adicionada ao painel de trânsito. O estoque será atualizado quando o recebimento for confirmado.
          </p>
          <div className="flex gap-4 justify-center">
            <button
              onClick={handleReset}
              className="px-6 py-3 text-sm font-medium rounded-xl border border-crunch-line text-crunch-ink-dim hover:bg-crunch-panel-2 transition-colors"
            >
              Enviar outra XML
            </button>
            <Link
              href="/"
              className="px-6 py-3 text-sm font-semibold rounded-xl bg-crunch-accent text-white hover:bg-orange-600 transition-colors"
            >
              Voltar ao Hub
            </Link>
          </div>
        </div>
      )}

      {/* ============================================ */}
      {/* HISTÓRICO DE NFs SUBIDAS                     */}
      {/* ============================================ */}
      <div className="mt-12">
        <div className="text-xs font-semibold uppercase tracking-widest text-crunch-ink-dim mb-5">
          Histórico de Notas Fiscais
        </div>

        {historicoLoading ? (
          <div className="bg-crunch-panel border border-crunch-line rounded-2xl p-8">
            <div className="text-center text-crunch-ink-mute">Carregando histórico...</div>
          </div>
        ) : historicoNFs.length === 0 ? (
          <div className="bg-crunch-panel border border-crunch-line rounded-2xl p-8 text-center text-crunch-ink-mute text-sm">
            Nenhuma nota fiscal enviada ainda.
          </div>
        ) : (
          <div className="bg-crunch-panel border border-crunch-line rounded-2xl overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-crunch-line flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-crunch-ink-dim">
                  Notas Fiscais Recebidas
                </h3>
              </div>
              <span className="text-xs font-mono bg-crunch-panel-2 border border-crunch-line-2 px-3 py-1 rounded-full text-crunch-accent">
                {historicoNFs.length}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-crunch-ink-mute border-b border-crunch-line">
                    <th className="text-left px-6 py-3 font-semibold">NF</th>
                    <th className="text-left px-4 py-3 font-semibold">Fornecedor</th>
                    <th className="text-left px-4 py-3 font-semibold">Faturamento</th>
                    <th className="text-left px-4 py-3 font-semibold">Transportadora</th>
                    <th className="text-left px-4 py-3 font-semibold">Entregue</th>
                    <th className="text-center px-4 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {historicoNFs.map((nf) => (
                    <tr key={nf.id} className="border-b border-crunch-line/50 hover:bg-crunch-panel-2/50 transition-colors">
                      <td className="px-6 py-4 font-mono text-crunch-ink-dim">{nf.numero_nf}</td>
                      <td className="px-4 py-4 font-medium">{nf.fornecedor}</td>
                      <td className="px-4 py-4 text-crunch-ink-dim">
                        {nf.data_emissao ? new Date(nf.data_emissao + 'T00:00:00').toLocaleDateString('pt-BR') : '\u2014'}
                      </td>
                      <td className="px-4 py-4 text-crunch-ink-dim text-xs">{nf.transportadora || '\u2014'}</td>
                      <td className="px-4 py-4 text-crunch-ink-dim">
                        {nf.data_recebimento ? new Date(nf.data_recebimento).toLocaleDateString('pt-BR') : '\u2014'}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          nf.status === 'ENTREGUE'
                            ? 'bg-green-900/30 text-green-400'
                            : 'bg-yellow-900/30 text-yellow-400'
                        }`}>
                          {nf.status === 'ENTREGUE' ? 'Entregue' : 'Em Trânsito'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-crunch-panel-2 border border-crunch-line-2 rounded-lg p-3">
      <span className="text-[10px] uppercase tracking-wider text-crunch-ink-mute block mb-1">{label}</span>
      <span className="text-sm font-medium">{value || '—'}</span>
    </div>
  )
}
