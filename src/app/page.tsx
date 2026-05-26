'use client'

import Link from 'next/link'
import NotasEmTransito from '@/components/NotasEmTransito'

export default function HubPage() {
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
          </div>
        </div>
        <div className="text-right text-xs text-crunch-ink-mute leading-relaxed">
          <div>Sistema: <b className="text-crunch-ink-dim font-medium">v1.0</b></div>
          <div>Modo: <b className="text-crunch-ink-dim font-medium">Operacional</b></div>
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
        <Link
          href="/etiquetas"
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
        </Link>
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
