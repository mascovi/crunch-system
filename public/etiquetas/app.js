// ─────────────────────────────────────────────────────────────
// Gerador de Etiquetas — ZPL 40×25mm dupla (203 DPI)
// ─────────────────────────────────────────────────────────────

let PRODUCTS = [];

// ── ZPL CONFIG ────────────────────────────────────────────────
// 203 DPI: 1mm ≈ 8 dots
// Cada etiqueta: 40mm = 320 dots, 25mm = 200 dots
const DPI_DOTS_MM = 8;
const LABEL_W_MM = 40;
const LABEL_H_MM = 25;
const GAP_MM    = 2;          // gap entre as duas etiquetas no rolo
const LABEL_W   = LABEL_W_MM * DPI_DOTS_MM;     // 320
const LABEL_H   = LABEL_H_MM * DPI_DOTS_MM;     // 200
const GAP       = GAP_MM * DPI_DOTS_MM;         // 16
const PAIR_W    = LABEL_W * 2 + GAP;            // 656
const PAD       = 12;                           // padding interno em dots (~1.5mm)
const INNER_W   = LABEL_W - PAD * 2;            // 296

// ── BOOT ──────────────────────────────────────────────────────
fetch(window.__resources?.produtos || 'produtos.json')
  .then(r => r.json())
  .then(data => {
    PRODUCTS = data;
    initFornecedores();
  })
  .catch(err => {
    console.error('Falha ao carregar produtos.json', err);
  });

// ── DOM ───────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const selForn = $('sel-fornecedor');
const selProd = $('sel-produto');
const fornCount = $('forn-count');
const prodCount = $('prod-count');
const preview = $('preview');
const zplOut = $('zpl-out');
const zplName = $('zpl-name');
const zplSpec = $('zpl-spec');
const zplDot = $('zpl-dot');
const copyBtn = $('copy-btn');
const infoCard = $('info-card');
const twCopies = $('tw-copies');
const twMirror = $('tw-mirror');
const twFsize = $('tw-fsize');

// ── INIT ──────────────────────────────────────────────────────
function initFornecedores() {
  const fornecedores = [...new Set(PRODUCTS.map(p => p.fornecedor))].sort();
  selForn.innerHTML = '<option value="">— selecione —</option>' +
    fornecedores.map(f => `<option value="${f}">${f}</option>`).join('');
  fornCount.textContent = `${fornecedores.length} fornecedores · ${PRODUCTS.length} produtos`;
}

selForn.addEventListener('change', () => {
  const f = selForn.value;
  if (!f) {
    selProd.innerHTML = '<option value="">—</option>';
    selProd.disabled = true;
    prodCount.textContent = 'selecione um fornecedor';
    clearSelection();
    return;
  }
  const list = PRODUCTS.filter(p => p.fornecedor === f)
    .sort((a, b) => a.descricao.localeCompare(b.descricao, 'pt-BR'));
  selProd.innerHTML = '<option value="">— selecione —</option>' +
    list.map(p => `<option value="${p.item}">${p.descricao}</option>`).join('');
  selProd.disabled = false;
  prodCount.textContent = `${list.length} produto${list.length === 1 ? '' : 's'}`;
  clearSelection();
});

selProd.addEventListener('change', updateAll);
twCopies.addEventListener('input', updateAll);
twMirror.addEventListener('change', updateAll);
twFsize.addEventListener('change', updateAll);

// ── SELECTION HANDLING ────────────────────────────────────────
function getCurrentProduct() {
  const item = selProd.value;
  if (!item) return null;
  return PRODUCTS.find(p => p.item === item) || null;
}

function clearSelection() {
  preview.innerHTML = `
    <div class="etiqueta"><span class="etiqueta-empty">Selecione um produto</span></div>
    <div class="etiqueta"><span class="etiqueta-empty">Selecione um produto</span></div>`;
  zplOut.innerHTML = '<div class="zpl-empty">O código ZPL aparece aqui após escolher o produto.</div>';
  zplName.textContent = 'aguardando produto…';
  zplSpec.textContent = '';
  zplDot.classList.add('idle');
  copyBtn.disabled = true;
  infoCard.style.display = 'none';
}

// ── AUTO FONT SIZING ──────────────────────────────────────────
// Determina tamanho de fonte para o nome do PRODUTO no ZPL,
// considerando comprimento e largura disponível (296 dots).
function autoProductFontSize(text) {
  const t = text || '';
  const len = t.length;
  // Heurística: prioriza tamanho grande, encolhe só quando precisa
  if (len <= 12) return { size: 50, maxLines: 1 };
  if (len <= 18) return { size: 44, maxLines: 2 };
  if (len <= 24) return { size: 40, maxLines: 2 };
  if (len <= 32) return { size: 34, maxLines: 3 };
  if (len <= 42) return { size: 30, maxLines: 3 };
  if (len <= 54) return { size: 26, maxLines: 3 };
  return { size: 24, maxLines: 3 };
}

// ── ZPL BUILDER ───────────────────────────────────────────────
function escapeZpl(s) {
  // ^ e ~ são caracteres de controle ZPL; troca por ~ via ^FH ou simples remoção
  return (s || '').replace(/\^/g, '/').replace(/~/g, '-');
}

function buildLabelBlock(xOffset, p, fontProduto) {
  // Layout com moldura (label = 320 x 200 dots = 40 x 25mm):
  //
  //   +--------------------------------+
  //   |####### FORNECEDOR #############|  faixa preta, texto em negativo (^FR)
  //   |                                |
  //   |        NOME DO PRODUTO         |  fonte grande, centralizado
  //   |                                |
  //   |================================|  separador grosso
  //   |#COD ML#|      ABCD12345        |  caixa preta + codigo
  //   +--------------------------------+
  //
  // ^FR inverte o preenchimento: sobre uma area preta (^GB) o texto sai branco.
  const x = xOffset;
  const bx = xOffset + 3;          // borda interna
  const bw = LABEL_W - 6;          // largura util dentro da moldura
  const lines = [];

  lines.push(`; — etiqueta @ x=${xOffset} —`);

  // moldura externa
  lines.push(`^FO${x},0^GB${LABEL_W},${LABEL_H},3^FS`);

  // faixa do fornecedor, com o texto em negativo
  lines.push(`^FO${bx},3^GB${bw},36,36^FS`);
  lines.push(`^FO${bx},10^FR^FB${bw},1,0,C^A0N,22,22^FD${escapeZpl(p.fornecedor)}^FS`);

  // Nome do produto, centralizado na area entre a faixa e o separador.
  // Os valores de Y vem do layout aprovado: uma linha em 67, duas em 41 —
  // cada linha extra sobe 26 dots. Preferi a medida real a uma formula
  // aproximada, para a etiqueta gerada sair identica ao desenho validado.
  const charsPerLine = Math.max(1, Math.floor(bw / (fontProduto.size * 0.58)));
  const linhasReais = Math.min(
    fontProduto.maxLines,
    Math.max(1, Math.ceil((p.descricao || '').length / charsPerLine))
  );
  const nomeY = Math.max(8, 67 - (linhasReais - 1) * 26);

  lines.push(`^FO${bx},${nomeY}^FB${bw},${fontProduto.maxLines},0,C^A0N,${fontProduto.size},${fontProduto.size}^FD${escapeZpl(p.descricao)}^FS`);

  // separador grosso acima do rodape
  lines.push(`^FO${bx},146^GB${bw},4,4^FS`);

  // rodape: caixa preta "COD ML" + o codigo ao lado
  lines.push(`^FO${bx},150^GB92,47,47^FS`);
  lines.push(`^FO${bx},164^FR^FB92,1,0,C^A0N,17,17^FDCOD ML^FS`);
  lines.push(`^FO${bx + 92},159^FB${bw - 92},1,0,C^A0N,30,30^FD${escapeZpl(p.codigo)}^FS`);

  return lines.join('\n');
}

function buildZpl(p) {
  const userSize = twFsize.value;
  const fontProduto = userSize === 'auto'
    ? autoProductFontSize(p.descricao)
    : { size: parseInt(userSize, 10), maxLines: 3 };

  const copies = Math.max(1, Math.min(999, parseInt(twCopies.value, 10) || 1));
  const mirror = twMirror.value === 'duplo';

  const blocks = [];
  blocks.push(buildLabelBlock(0, p, fontProduto));
  if (mirror) {
    blocks.push(buildLabelBlock(LABEL_W + GAP, p, fontProduto));
  }

  const printWidth = mirror ? PAIR_W : LABEL_W;

  const zpl = [
    `^XA`,
    `^CI28                          ; encoding UTF-8 (acentos)`,
    `^PW${printWidth}                       ; largura ${mirror ? 'do par' : 'da etiqueta'} em dots`,
    `^LL${LABEL_H}                        ; altura da etiqueta (25mm)`,
    `^LH0,0                         ; origem do label home`,
    `^LS0`,
    ``,
    blocks.join('\n\n'),
    ``,
    `^PQ${copies},0,0,Y                  ; quantidade de impressões`,
    `^XZ`,
  ].join('\n');

  return { zpl, fontProduto, copies, mirror };
}

// ── PREVIEW ───────────────────────────────────────────────────
function renderPreview(p, fontProduto, mirror) {
  // Convertemos dot -> px da preview. Etiqueta = 200×125px (5px/mm)
  // Dots por mm = 8, então 1 dot = 0.625 px na preview.
  const dotToPx = (5 / DPI_DOTS_MM); // 0.625
  const fProdPx = fontProduto.size * dotToPx;
  const fCodPx = 30 * dotToPx;
  const fFornPx = 24 * dotToPx;

  // Espelha o layout com moldura do ZPL: faixa do fornecedor em negativo,
  // nome grande no meio, rodape com a caixa COD ML e o codigo.
  const labelHtml = `
    <div class="etiqueta" style="border:2px solid #111; display:flex; flex-direction:column; padding:0; overflow:hidden;">
      <div style="background:#111; color:#fff; font-size:${fFornPx}px; font-weight:700;
                  text-align:center; padding:3px 0; letter-spacing:.04em;">${escapeHtml(p.fornecedor)}</div>
      <div style="flex:1; display:flex; align-items:center; justify-content:center; padding:2px 6px;">
        <div style="font-size:${fProdPx}px; font-weight:700; line-height:1.05; text-align:center;">${escapeHtml(p.descricao)}</div>
      </div>
      <div style="display:flex; border-top:3px solid #111;">
        <div style="background:#111; color:#fff; font-size:${fFornPx * 0.72}px; font-weight:700;
                    padding:3px 6px; letter-spacing:.05em;">COD ML</div>
        <div style="flex:1; font-size:${fCodPx}px; font-weight:700; text-align:center; padding:2px 0;">${escapeHtml(p.codigo)}</div>
      </div>
    </div>`;

  preview.innerHTML = mirror ? labelHtml + labelHtml : labelHtml + `
    <div class="etiqueta" style="opacity:0.25; background:repeating-linear-gradient(45deg, #fff 0 6px, #f0f0f0 6px 12px);">
      <span class="etiqueta-empty">— em branco —</span>
    </div>`;
}

// ── INFO CARD ─────────────────────────────────────────────────
function renderInfo(p) {
  $('i-produto').textContent = p.descricao;
  $('i-codigo').textContent = p.codigo;
  $('i-forn').textContent = p.fornecedor;
  $('i-var').textContent = p.variacao || '—';
  infoCard.style.display = '';
}

// ── ZPL DISPLAY ───────────────────────────────────────────────
function renderZpl(zplText, p, copies) {
  // syntax highlight rudimentar
  const html = zplText
    .split('\n')
    .map(line => {
      if (line.trim().startsWith(';')) {
        return `<span class="cm">${escapeHtml(line)}</span>`;
      }
      return escapeHtml(line)
        .replace(/(\^[A-Z]{1,3})/g, '<span class="cmd">$1</span>')
        .replace(/(\^FD)([^\^]*)/g, '$1<span class="data">$2</span>')
        .replace(/(?<=\^[A-Z]{1,3})(\d+)/g, '<span class="num">$1</span>');
    })
    .join('\n');

  zplOut.innerHTML = `<pre class="zpl">${html}</pre>`;
  zplName.textContent = `etiqueta_${p.codigo}.zpl`;
  zplSpec.textContent = `· ${copies} ${copies === 1 ? 'cópia' : 'cópias'} · ${zplText.length} chars`;
  zplDot.classList.remove('idle');
  copyBtn.disabled = false;
  copyBtn.textContent = 'Copiar ZPL';
  copyBtn.classList.remove('copied');
  copyBtn.dataset.zpl = zplText;
}

// ── COPY ──────────────────────────────────────────────────────
copyBtn.addEventListener('click', async () => {
  const txt = copyBtn.dataset.zpl;
  if (!txt) return;
  try {
    await navigator.clipboard.writeText(txt);
  } catch {
    // fallback
    const ta = document.createElement('textarea');
    ta.value = txt;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }
  copyBtn.textContent = '✓ Copiado';
  copyBtn.classList.add('copied');
  setTimeout(() => {
    copyBtn.textContent = 'Copiar ZPL';
    copyBtn.classList.remove('copied');
  }, 1800);
});

// ── ESCAPE HTML ───────────────────────────────────────────────
function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── MAIN UPDATE ───────────────────────────────────────────────
function updateAll() {
  const p = getCurrentProduct();
  if (!p) {
    clearSelection();
    return;
  }
  const { zpl, fontProduto, copies, mirror } = buildZpl(p);
  renderInfo(p);
  renderPreview(p, fontProduto, mirror);
  renderZpl(zpl, p, copies);
}
