// Seletor de etiquetas prontas — injeta ^PQ e ajusta espaçamento entre etiquetas.

let LABELS = [];
let CUSTOM_LABELS = [];
const STORAGE_KEY = 'etiqueta-caixa.custom-product-labels.v1';

const $ = id => document.getElementById(id);
const selForn = $('sel-fornecedor');
const selProd = $('sel-produto');
const fornCount = $('forn-count');
const prodCount = $('prod-count');
const qtyInput = $('qty-input');
const qtyMinus = $('qty-minus');
const qtyPlus  = $('qty-plus');
const qtyPairs = $('qty-pairs');
const qtyUnits = $('qty-units');
const gapInput = $('gap-input');
const gapMm    = $('gap-mm');
const marginInput = $('margin-input');
const marginMm   = $('margin-mm');
const summary = $('summary');
const zplOut = $('zpl-out');
const zplName = $('zpl-name');
const zplSpec = $('zpl-spec');
const zplDot  = $('zpl-dot');
const copyBtn = $('copy-btn');
const infoCard = $('info-card');

// 203 DPI: 8 dots/mm
const DOTS_PER_MM = 8;

// ── STORAGE ────────────────────────────────────────────────
function loadCustom() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}
function saveCustom() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(CUSTOM_LABELS)); }
  catch (e) { console.error('Falha ao salvar', e); }
}

function allLabels() {
  // Custom labels come marked with `custom: true`. They override bundled by code.
  const customCodes = new Set(CUSTOM_LABELS.map(l => l.code));
  const merged = [
    ...LABELS.filter(l => !customCodes.has(l.code)),
    ...CUSTOM_LABELS.map(l => ({ ...l, custom: true })),
  ];
  return merged;
}

// ── BOOT ──────────────────────────────────────────────────────
CUSTOM_LABELS = loadCustom();
fetch(window.__resources?.etiquetas || 'etiquetas-prontas.json')
  .then(r => r.json())
  .then(data => { LABELS = data; initFornecedores(); refreshCustomBadge(); })
  .catch(err => {
    console.error('Falha ao carregar etiquetas-prontas.json', err);
    LABELS = [];
    initFornecedores();
    refreshCustomBadge();
  });

function initFornecedores() {
  const labels = allLabels();
  const fornecedores = [...new Set(labels.map(l => l.fornecedor))].sort();
  const cur = selForn.value;
  selForn.innerHTML = '<option value="">— selecione —</option>' +
    fornecedores.map(f => `<option value="${f}">${f}</option>`).join('');
  if (fornecedores.includes(cur)) selForn.value = cur;
  fornCount.textContent = `${fornecedores.length} fornecedores · ${labels.length} etiquetas`;
  populateFornDatalist(fornecedores);
}

function populateFornDatalist(fornecedores) {
  const dl = $('forn-datalist');
  if (!dl) return;
  dl.innerHTML = fornecedores.map(f => `<option value="${f}">`).join('');
}

// ── EVENTS ────────────────────────────────────────────────────
selForn.addEventListener('change', () => {
  const f = selForn.value;
  if (!f) {
    selProd.innerHTML = '<option value="">—</option>';
    selProd.disabled = true;
    prodCount.textContent = 'selecione um fornecedor';
    clearSelection();
    return;
  }
  const list = allLabels().filter(l => l.fornecedor === f)
    .sort((a, b) => a.desc.localeCompare(b.desc, 'pt-BR'));
  selProd.innerHTML = '<option value="">— selecione —</option>' +
    list.map(l => `<option value="${l.code}">${l.custom ? '★ ' : ''}${escapeHtml(l.desc)}</option>`).join('');
  selProd.disabled = false;
  prodCount.textContent = `${list.length} etiqueta${list.length === 1 ? '' : 's'}`;
  clearSelection();
});

selProd.addEventListener('change', updateAll);

function snapToEven(v) {
  v = parseInt(v, 10);
  if (isNaN(v) || v < 2) v = 2;
  if (v > 998) v = 998;
  if (v % 2 !== 0) v += 1;
  return v;
}

qtyInput.addEventListener('change', () => {
  qtyInput.value = snapToEven(qtyInput.value);
  updateAll();
});
qtyInput.addEventListener('input', updateAll);
qtyMinus.addEventListener('click', () => {
  qtyInput.value = Math.max(2, snapToEven((parseInt(qtyInput.value,10) || 2) - 2));
  updateAll();
});
qtyPlus.addEventListener('click', () => {
  qtyInput.value = Math.min(998, snapToEven((parseInt(qtyInput.value,10) || 2) + 2));
  updateAll();
});
document.querySelectorAll('.preset').forEach(btn => {
  btn.addEventListener('click', () => {
    qtyInput.value = btn.dataset.q;
    updateAll();
  });
});
gapInput.addEventListener('input', updateAll);
marginInput.addEventListener('input', updateAll);

// ── HELPERS ───────────────────────────────────────────────────
function getCurrent() {
  const code = selProd.value;
  if (!code) return null;
  return allLabels().find(l => l.code === code) || null;
}

function getTotal() {
  let v = parseInt(qtyInput.value, 10);
  if (isNaN(v) || v < 2) v = 2;
  if (v > 998) v = 998;
  return v;
}

function getExtraGapDots() {
  const v = parseInt(gapInput.value, 10);
  return isNaN(v) ? 0 : v;
}

function getLeftMarginDots() {
  const v = parseInt(marginInput.value, 10);
  return isNaN(v) ? 0 : v;
}

function clearSelection() {
  summary.innerHTML = '<span class="summary-empty">Selecione uma etiqueta para ver o resumo.</span>';
  zplOut.innerHTML = '<div class="zpl-empty">O código ZPL aparece aqui após escolher o produto e definir a quantidade.</div>';
  zplName.textContent = 'aguardando seleção…';
  zplSpec.textContent = '';
  zplDot.classList.add('idle');
  copyBtn.disabled = true;
  infoCard.style.display = 'none';
  updateMeta();
}

function updateMeta() {
  const total = getTotal();
  qtyUnits.textContent = total;
  qtyPairs.textContent = total / 2;
  const dots = getExtraGapDots();
  gapMm.textContent = (dots / DOTS_PER_MM).toFixed(1).replace('.', ',');
  const md = getLeftMarginDots();
  marginMm.textContent = (md / DOTS_PER_MM).toFixed(1).replace('.', ',');
}

// ── ZPL TRANSFORM ─────────────────────────────────────────────
// Cada arquivo tem 2 blocos dentro de um único ^XA…^XZ, separados
// por uma linha "^CI28" + "^LH0,0" interna. O 2º bloco usa x≥~340.
// Para mais espaçamento, deslocamos todos os ^FOx,y do 2º bloco em +extra.
function shiftBlocks(zpl, leftMarginDots, extraDots) {
  const lines = zpl.split('\n');
  let ciCount = 0;
  let inSecond = false;
  return lines.map(line => {
    if (/\^CI28/.test(line)) {
      ciCount++;
      if (ciCount === 2) inSecond = true;
    }
    return line.replace(/\^FO(\d+),(\d+)/g, (_, x, y) => {
      const xi = parseInt(x, 10);
      if (inSecond && xi >= 200) {
        // Block 2: aplica margem esquerda + espaçamento extra
        return `^FO${xi + leftMarginDots + extraDots},${y}`;
      }
      // Block 1: aplica só a margem esquerda
      return `^FO${xi + leftMarginDots},${y}`;
    });
  }).join('\n');
}

function injectQuantity(zpl, pares) {
  const trimmed = zpl.trimEnd();
  const cleaned = trimmed.replace(/\^PQ[^\^\n]*/g, '');
  if (cleaned.endsWith('^XZ')) {
    return cleaned.slice(0, -3) + `^PQ${pares},0,0,Y\n^XZ\n`;
  }
  return cleaned + `\n^PQ${pares},0,0,Y\n^XZ\n`;
}

function buildZpl(it, total, extraDots, leftMarginDots) {
  const pares = total / 2;
  let z = shiftBlocks(it.zpl, leftMarginDots, extraDots);
  // Substitui qualquer ^LH0,0 ou ^LHx,y por ^LH0,8 (desce 1mm = corrige corte topo)
  z = z.replace(/\^LH\d+,\d+/g, '^LH0,8');
  z = injectQuantity(z, pares);
  return z;
}

// ── RENDER ────────────────────────────────────────────────────
function renderInfo(it) {
  $('i-produto').textContent = it.desc;
  $('i-codigo').textContent = it.code;
  $('i-forn').textContent = it.fornecedor;
  infoCard.style.display = '';
}

function renderSummary(it, total, extraDots) {
  const gapTxt = (extraDots / DOTS_PER_MM).toFixed(1).replace('.', ',');
  summary.innerHTML = `
    <div class="summary-num">${total}</div>
    <div class="summary-text">
      <div class="big">${escapeHtml(it.desc)}</div>
      <div class="small">${total} etiquetas · ${total/2} ${total/2 === 1 ? 'par' : 'pares'} · código <b>${it.code}</b> · espaçamento +${gapTxt} mm</div>
    </div>`;
}

function renderZpl(zplText, it, total) {
  const html = escapeHtml(zplText)
    .replace(/(\^PQ\d+,\d+,\d+,[A-Z])/g, '<span class="pq cmd">$1</span>')
    .replace(/(\^[A-Z]{1,3})/g, '<span class="cmd">$1</span>')
    .replace(/(\^FD)([^\^\n]*)/g, '$1<span class="data">$2</span>');
  zplOut.innerHTML = `<pre class="zpl">${html}</pre>`;
  zplName.textContent = `etiqueta_${it.code}_x${total}.zpl`;
  zplSpec.textContent = `· ${total} etiquetas (${total/2} pares)`;
  zplDot.classList.remove('idle');
  copyBtn.disabled = false;
  copyBtn.textContent = 'Copiar ZPL';
  copyBtn.classList.remove('copied');
  copyBtn.dataset.zpl = zplText;
}

copyBtn.addEventListener('click', async () => {
  const txt = copyBtn.dataset.zpl;
  if (!txt) return;
  try {
    await navigator.clipboard.writeText(txt);
  } catch {
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

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function updateAll() {
  updateMeta();
  const it = getCurrent();
  if (!it) { clearSelection(); return; }
  const total = getTotal();
  const extraDots = getExtraGapDots();
  const leftDots = getLeftMarginDots();
  const zpl = buildZpl(it, total, extraDots, leftDots);
  renderInfo(it);
  renderSummary(it, total, extraDots);
  renderZpl(zpl, it, total);
}

// ── MODAL: gerenciar etiquetas personalizadas ───────────────
const modal = $('manage-modal');
const openManageBtn = $('open-manage');
const closeManageBtn = $('close-manage');
const customBadge = $('custom-badge');
const formMsg = $('form-msg');
const fForn = $('f-forn');
const fCode = $('f-code');
const fDesc = $('f-desc');
const fZpl  = $('f-zpl');
const saveLabelBtn = $('save-label');
const clearFormBtn = $('clear-form');
const customListEl = $('custom-list');
const listCountEl = $('list-count');
const exportBtn = $('export-json');
const importBtn = $('import-json');
const importFile = $('import-file');
const fSku = $('f-sku');
const modeRadios = document.querySelectorAll('input[name="add-mode"]');
const modeTemplateEls = document.querySelectorAll('.mode-template');
const modePasteEls = document.querySelectorAll('.mode-paste');

function getMode() {
  const r = document.querySelector('input[name="add-mode"]:checked');
  return r ? r.value : 'template';
}
function applyMode() {
  const m = getMode();
  modeTemplateEls.forEach(el => el.style.display = (m === 'template') ? '' : 'none');
  modePasteEls.forEach(el => el.style.display = (m === 'paste') ? '' : 'none');
}
modeRadios.forEach(r => r.addEventListener('change', applyMode));

// ── ZPL template builder ─────────────────────────────────────
// Encode UTF-8 / non-printable / ZPL control chars as _XX hex sequences
// (compatible with ^FH field hex mode used by the existing templates).
function fhEncode(text) {
  const out = [];
  for (const ch of text) {
    const code = ch.codePointAt(0);
    if (code < 0x20 || code > 0x7E || ch === '^' || ch === '~' || ch === '_') {
      const bytes = new TextEncoder().encode(ch);
      for (const b of bytes) out.push('_' + b.toString(16).toUpperCase().padStart(2,'0'));
    } else {
      out.push(ch);
    }
  }
  return out.join('');
}

function buildLabelFromTemplate({ code, desc, sku }) {
  const c = (code || '').toUpperCase();
  const d = fhEncode(desc || '');
  const s = fhEncode(sku || '');
  const skuLine = s ? `^FO16,172^A0N,18,18^FH^FDSKU: ${s}\n^FS` : '';
  const skuLine2 = s ? `^FO346,172^A0N,18,18^FH^FDSKU: ${s}\n^FS` : '';
  return `^XA^CI28
^LH0,0
^FO30,15^BY2,,0^BCN,54,N,N^FD${c}^FS
^FO105,75^A0N,20,25^FH^FD${c}^FS
^FO105,76^A0N,20,25^FH^FD${c}^FS
^FO16,115^A0N,18,18^FB300,2,2,L^FH^FD${d}^FS
^FO16,153^A0N,18,18^FB300,1,0,L^FH^FD^FS
^FO15,153^A0N,18,18^FB300,1,0,L^FH^FD^FS
${skuLine}
^CI28
^LH0,0
^FO350,15^BY2,,0^BCN,54,N,N^FD${c}^FS
^FO425,75^A0N,20,25^FH^FD${c}^FS
^FO425,76^A0N,20,25^FH^FD${c}^FS
^FO346,115^A0N,18,18^FB300,2,2,L^FH^FD${d}^FS
^FO346,153^A0N,18,18^FB300,1,0,L^FH^FD^FS
^FO345,153^A0N,18,18^FB300,1,0,L^FH^FD^FS
${skuLine2}
^XZ
`;
}

function refreshCustomBadge() {
  const n = CUSTOM_LABELS.length;
  customBadge.textContent = n > 0 ? n : '';
  listCountEl.textContent = n > 0 ? `(${n})` : '';
}

function openModal() {
  modal.classList.add('open');
  switchTab('add');
  // sempre começa em "gerar a partir do modelo"
  const tplRadio = document.querySelector('input[name="add-mode"][value="template"]');
  if (tplRadio) tplRadio.checked = true;
  applyMode();
  renderCustomList();
  refreshCustomBadge();
  setTimeout(() => fForn.focus(), 50);
}
function closeModal() {
  modal.classList.remove('open');
  hideMsg();
}

openManageBtn.addEventListener('click', openModal);
closeManageBtn.addEventListener('click', closeModal);
modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && modal.classList.contains('open')) closeModal();
});

// Tabs
document.querySelectorAll('.modal-tab').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});
function switchTab(name) {
  document.querySelectorAll('.modal-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.dataset.tab === name));
  if (name === 'list') renderCustomList();
}

function showMsg(text, type = 'error') {
  formMsg.textContent = text;
  formMsg.className = `form-msg show ${type}`;
}
function hideMsg() { formMsg.className = 'form-msg'; }

function clearForm() {
  fForn.value = '';
  fCode.value = '';
  fDesc.value = '';
  if (fSku) fSku.value = '';
  fZpl.value = '';
  hideMsg();
  fForn.focus();
}
clearFormBtn.addEventListener('click', clearForm);

function validateZpl(z) {
  if (!z) return 'O código ZPL é obrigatório.';
  if (!/\^XA/.test(z)) return 'O ZPL deve começar com ^XA.';
  if (!/\^XZ/.test(z)) return 'O ZPL deve terminar com ^XZ.';
  return null;
}

saveLabelBtn.addEventListener('click', () => {
  const fornecedor = fForn.value.trim().toUpperCase();
  const code = fCode.value.trim().toUpperCase();
  const desc = fDesc.value.trim();
  const mode = getMode();

  if (!fornecedor) return showMsg('Informe o fornecedor.');
  if (!code) return showMsg('Informe o código (Part Number).');
  if (!desc) return showMsg('Informe a descrição do produto.');

  let zpl;
  if (mode === 'paste') {
    zpl = fZpl.value.trim();
    const zErr = validateZpl(zpl);
    if (zErr) return showMsg(zErr);
  } else {
    // Gerar a partir do modelo
    const sku = fSku.value.trim();
    zpl = buildLabelFromTemplate({ code, desc, sku });
  }

  // Verifica colisão com etiqueta empacotada (não-custom)
  const bundled = LABELS.find(l => l.code === code);
  const isOverride = !!bundled;

  // Substitui se já existir entre as custom
  const existingIdx = CUSTOM_LABELS.findIndex(l => l.code === code);
  const item = { code, desc, fornecedor, zpl };
  if (existingIdx >= 0) {
    CUSTOM_LABELS[existingIdx] = item;
  } else {
    CUSTOM_LABELS.push(item);
  }
  saveCustom();
  refreshCustomBadge();
  initFornecedores();

  const action = existingIdx >= 0 ? 'atualizada' : (isOverride ? 'salva (sobrescreve a original)' : 'salva');
  showMsg(`Etiqueta ${action} com sucesso.`, 'success');
  fCode.value = '';
  fDesc.value = '';
  if (fSku) fSku.value = '';
  fZpl.value = '';
  setTimeout(() => fDesc.focus(), 50);
});

function renderCustomList() {
  if (!CUSTOM_LABELS.length) {
    customListEl.innerHTML = '<div class="empty-list">Nenhuma etiqueta personalizada ainda.<br>Use a aba <b>Adicionar</b> para criar uma.</div>';
    return;
  }
  const sorted = [...CUSTOM_LABELS].sort((a,b) =>
    a.fornecedor.localeCompare(b.fornecedor) || a.desc.localeCompare(b.desc, 'pt-BR')
  );
  customListEl.innerHTML = sorted.map(l => `
    <div class="custom-item" data-code="${escapeAttr(l.code)}">
      <div class="ci-info">
        <div class="ci-desc">${escapeHtml(l.desc)}</div>
        <div class="ci-meta"><span class="ci-code">${escapeHtml(l.code)}</span> · ${escapeHtml(l.fornecedor)}</div>
      </div>
      <button class="icon-btn ci-edit" title="Editar" type="button">✎</button>
      <button class="icon-btn ci-del" title="Excluir" type="button">×</button>
    </div>`).join('');

  customListEl.querySelectorAll('.ci-del').forEach(btn => {
    btn.addEventListener('click', () => {
      const code = btn.closest('.custom-item').dataset.code;
      const it = CUSTOM_LABELS.find(l => l.code === code);
      if (!it) return;
      if (!confirm(`Excluir "${it.desc}" (${it.code}) das suas etiquetas personalizadas?`)) return;
      CUSTOM_LABELS = CUSTOM_LABELS.filter(l => l.code !== code);
      saveCustom();
      refreshCustomBadge();
      renderCustomList();
      initFornecedores();
      // limpa seleção se era o selecionado
      if (selProd.value === code) clearSelection();
    });
  });
  customListEl.querySelectorAll('.ci-edit').forEach(btn => {
    btn.addEventListener('click', () => {
      const code = btn.closest('.custom-item').dataset.code;
      const it = CUSTOM_LABELS.find(l => l.code === code);
      if (!it) return;
      fForn.value = it.fornecedor;
      fCode.value = it.code;
      fDesc.value = it.desc;
      fZpl.value  = it.zpl;
      // ao editar, mostra modo "colar" porque o ZPL pode ter sido gerado/customizado
      const pasteRadio = document.querySelector('input[name="add-mode"][value="paste"]');
      if (pasteRadio) { pasteRadio.checked = true; applyMode(); }
      switchTab('add');
      hideMsg();
      setTimeout(() => fDesc.focus(), 50);
    });
  });
}

// Export / Import
exportBtn.addEventListener('click', () => {
  const data = JSON.stringify(CUSTOM_LABELS, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const ts = new Date().toISOString().slice(0,10);
  a.href = url;
  a.download = `etiquetas-personalizadas-${ts}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 100);
});

importBtn.addEventListener('click', () => importFile.click());
importFile.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) throw new Error('formato inválido');
    let added = 0, updated = 0;
    for (const it of parsed) {
      if (!it.code || !it.desc || !it.fornecedor || !it.zpl) continue;
      const exists = CUSTOM_LABELS.findIndex(l => l.code === it.code);
      const clean = {
        code: String(it.code).trim().toUpperCase(),
        desc: String(it.desc).trim(),
        fornecedor: String(it.fornecedor).trim().toUpperCase(),
        zpl: String(it.zpl).trim(),
      };
      if (exists >= 0) { CUSTOM_LABELS[exists] = clean; updated++; }
      else { CUSTOM_LABELS.push(clean); added++; }
    }
    saveCustom();
    refreshCustomBadge();
    initFornecedores();
    renderCustomList();
    alert(`Importação concluída.\n${added} nova(s) · ${updated} atualizada(s)`);
  } catch (err) {
    alert('Falha ao importar: arquivo inválido.\n' + err.message);
  }
  importFile.value = '';
});

function escapeAttr(s) { return escapeHtml(s); }
