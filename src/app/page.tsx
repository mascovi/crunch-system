'use client'

import { useState } from 'react'
import Link from 'next/link'
import NotasEmTransito from '@/components/NotasEmTransito'
import { useAuth } from '@/contexts/AuthContext'

const CNPJ_CRUNCH = '50.288.627/0001-68'

export default function HubPage() {
  const { usuario, logout } = useAuth()
  const [copiado, setCopiado] = useState(false)

  const copiarCNPJ = async () => {
    try {
      await navigator.clipboard.writeText(CNPJ_CRUNCH)
    } catch {
      // Fallback para navegadores sem permissão de clipboard
      const el = document.createElement('textarea')
      el.value = CNPJ_CRUNCH
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    }
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  return (
    <div className="max-w-[1080px] mx-auto px-8 py-20">
      {/* ============================================ */}
      {/* HERO — mantido idêntico ao design original   */}
      {/* ============================================ */}
      <header className="flex items-end justify-between gap-8 border-b border-crunch-line pb-8 mb-12">
        <div className="flex items-center gap-5">
          <div className="w-[52px] h-[52px] rounded-xl overflow-hidden">
            <img
              src="/crunch-logo.png"
              alt="Crunch Online"
              className="w-full h-full object-contain"
            />
          </div>
          <div>
            <h1 className="text-4xl font-semibold tracking-tight leading-none">CRUNCH</h1>
            <p className="mt-2 text-crunch-ink-dim text-sm">
              Hub operacional — recebimento, estoque e FULL.
            </p>
            {/* CNPJ sempre à mão — clique para copiar */}
            <button
              onClick={copiarCNPJ}
              title="Clique para copiar o CNPJ"
              className="mt-2 inline-flex items-center gap-2 px-2.5 py-1 rounded-lg border border-crunch-line bg-crunch-panel hover:border-crunch-accent hover:bg-crunch-panel-2 transition-colors group"
            >
              <span className="text-[10px] font-semibold uppercase tracking-widest text-crunch-ink-mute">
                CNPJ
              </span>
              <span className="font-mono text-xs text-crunch-ink-dim group-hover:text-crunch-ink">
                {CNPJ_CRUNCH}
              </span>
              <span
                className={`text-[10px] font-semibold ${
                  copiado ? 'text-green-400' : 'text-crunch-ink-mute'
                }`}
              >
                {copiado ? 'copiado' : 'copiar'}
              </span>
            </button>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right text-xs text-crunch-ink-mute leading-relaxed">
            <div>Operador: <b className="text-crunch-ink-dim font-medium">{usuario?.nome}</b></div>
            <div>Sistema: <b className="text-crunch-ink-dim font-medium">v1.0</b></div>
          </div>
          <button
            onClick={logout}
            className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider border border-crunch-line rounded-lg text-crunch-ink-mute hover:text-red-400 hover:border-red-400/50 transition-colors"
          >
            Sair
          </button>
        </div>
      </header>

      {/* ============================================ */}
      {/* AÇÕES RÁPIDAS                                */}
      {/* ============================================ */}
      <div className="text-xs font-semibold uppercase tracking-widest text-crunch-ink-dim mb-5">
        Ações Rápidas
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-12">
        {/* Botão Subir XML */}
        <Link
          href="/upload-xml"
          className="group bg-crunch-panel border border-crunch-line rounded-2xl p-6 hover:border-crunch-accent hover:bg-crunch-panel-2 transition-all hover:-translate-y-0.5"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-crunch-accent bg-crunch-accent/10 border border-crunch-accent/30 px-2 py-1 rounded">
              Upload
            </span>
            <span className="text-lg text-crunch-ink-mute group-hover:text-crunch-accent group-hover:translate-x-1 transition-all">
              &uarr;
            </span>
          </div>
          <h2 className="text-lg font-semibold mb-1">Subir XML</h2>
          <p className="text-xs text-crunch-ink-dim leading-relaxed">
            Enviar XML de nota fiscal para o sistema.
          </p>
        </Link>

        {/* Botão Acessar Estoque */}
        <Link
          href="/estoque"
          className="group bg-crunch-panel border border-crunch-line rounded-2xl p-6 hover:border-crunch-accent hover:bg-crunch-panel-2 transition-all hover:-translate-y-0.5"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-crunch-accent bg-crunch-accent/10 border border-crunch-accent/30 px-2 py-1 rounded">
              Estoque
            </span>
            <span className="text-lg text-crunch-ink-mute group-hover:text-crunch-accent group-hover:translate-x-1 transition-all">
              &rarr;
            </span>
          </div>
          <h2 className="text-lg font-semibold mb-1">Acessar Estoque</h2>
          <p className="text-xs text-crunch-ink-dim leading-relaxed">
            Visualizar saldo, movimentações e enviar FULL.
          </p>
        </Link>

        {/* Card Etiquetas (link original) */}
        <a
          href="/etiquetas/index.html"
          className="group bg-crunch-panel border border-crunch-line rounded-2xl p-6 hover:border-crunch-accent hover:bg-crunch-panel-2 transition-all hover:-translate-y-0.5"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-crunch-accent bg-crunch-accent/10 border border-crunch-accent/30 px-2 py-1 rounded">
              ZPL
            </span>
            <span className="text-lg text-crunch-ink-mute group-hover:text-crunch-accent group-hover:translate-x-1 transition-all">
              &rarr;
            </span>
          </div>
          <h2 className="text-lg font-semibold mb-1">Etiquetas</h2>
          <p className="text-xs text-crunch-ink-dim leading-relaxed">
            Gerador de etiquetas ZPL para caixas e produtos.
          </p>
        </a>
      </div>

      {/* ============================================ */}
      {/* PAINEL — NOTAS FISCAIS EM TRÂNSITO           */}
      {/* ============================================ */}
      <div className="text-xs font-semibold uppercase tracking-widest text-crunch-ink-dim mb-5">
        Notas Fiscais
      </div>

      <NotasEmTransito />

      {/* ============================================ */}
      {/* FOOTER                                       */}
      {/* ============================================ */}
      <footer className="mt-14 pt-6 border-t border-crunch-line text-xs text-crunch-ink-mute leading-relaxed">
        <b className="text-crunch-ink-dim font-medium">Crunch Online</b> &mdash; Hub Operacional v1.0
      </footer>

      {/* Logo flutuante */}
      <div className="fixed bottom-5 right-5 w-16 h-16 rounded-xl overflow-hidden opacity-90 hover:opacity-100 hover:scale-105 transition-all z-50">
        <img
          src="/crunch-logo.png"
          alt="Crunch Online"
          className="w-full h-full object-contain"
        />
      </div>
    </div>
  )
}
