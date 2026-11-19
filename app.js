const $ = s => document.querySelector(s);
const KEY = 'fin.v1';
let db = { tx: [], subs: [] };
try { db = JSON.parse(localStorage.getItem(KEY)) || db; } catch (e) { }
const save = () => localStorage.setItem(KEY, JSON.stringify(db));
const brl = n => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const id = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const hoje = () => new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);

const CATS = ['Moradia', 'Mercado', 'Transporte', 'Lazer', 'Saúde', 'Educação', 'Contas', 'Outros'];
const RCATS = ['Salário', 'Extra', 'Freelas', 'Outros'];

const now = new Date();
let ym = now.getFullYear() * 12 + now.getMonth(), tab = 'resumo';
const mkey = () => Math.floor(ym / 12) + '-' + String(ym % 12 + 1).padStart(2, '0');
const mnome = () => new Date(Math.floor(ym / 12), ym % 12, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

function calc() {
  const k = mkey();
  const tx = db.tx.filter(t => t.date.startsWith(k)).sort((a, b) => b.date.localeCompare(a.date));
  const sub = db.subs.filter(s => s.desde <= k).reduce((a, s) => a + s.valor, 0);
  const ent = tx.filter(t => t.tipo == 'r').reduce((a, t) => a + t.valor, 0);
  const cat = {};
  tx.filter(t => t.tipo == 'd').forEach(t => cat[t.cat] = (cat[t.cat] || 0) + t.valor);
  if (sub) cat['Assinaturas'] = sub;
  const sai = Object.values(cat).reduce((a, v) => a + v, 0);
  return { tx, sub, ent, sai, cat };
}

const V = {
  resumo: c => {
    const sobra = c.ent - c.sai, max = Math.max(...Object.values(c.cat), 1);
    const rows = Object.entries(c.cat).sort((a, b) => b[1] - a[1]).map(([n, v]) =>
      `<div class="bar"><div><span>${esc(n)}</span><b>${brl(v)}</b></div><i style="width:${v / max * 100}%"></i></div>`).join('');
    return `<section class="hero"><p>Sobrou no mês</p><strong class="${sobra < 0 ? 'neg' : ''}">${brl(sobra)}</strong></section>
    <section class="duo"><div><p>Entrou</p><b class="pos">${brl(c.ent)}</b></div><div><p>Saiu</p><b class="neg">${brl(c.sai)}</b></div></section>
    <h2>Para onde foi</h2>${rows || '<p class="vazio">Sem gastos neste mês. Abra Lançamentos para começar.</p>'}`;
  },
  lanc: c => `<button class="add" data-a="novoTx">Novo lançamento</button>` +
    (c.tx.map(t => `<div class="item" data-a="editTx" data-id="${t.id}"><div><b>${esc(t.desc)}</b><small>${t.date.slice(8)}/${t.date.slice(5, 7)}</small><small>${esc(t.cat)}</small></div><span class="${t.tipo == 'r' ? 'pos' : 'neg'}">${t.tipo == 'r' ? '+' : '−'}${brl(t.valor)}</span></div>`).join('')
      || '<p class="vazio">Nenhum lançamento neste mês.</p>'),
  subs: c => `<section class="duo"><div><p>Por mês</p><b>${brl(c.sub)}</b></div><div><p>Por ano</p><b>${brl(c.sub * 12)}</b></div></section>
    <button class="add" data-a="novaSub">Nova assinatura</button>` +
    (db.subs.slice().sort((a, b) => a.dia - b.dia).map(s => `<div class="item" data-a="editSub" data-id="${s.id}"><div><b>${esc(s.nome)}</b><small>Cobra todo dia ${s.dia}</small></div><span>${brl(s.valor)}</span></div>`).join('')
      || '<p class="vazio">Nenhuma assinatura cadastrada.</p>'),
  backup: () => `<p class="txt">Seus dados ficam só neste aparelho. Exporte um backup de vez em quando e guarde o arquivo no iCloud ou no Drive.</p>
    <button class="add" data-a="export">Exportar backup</button>
    <button class="add alt" data-a="import">Importar backup</button>
    <input type="file" id="file" accept="application/json,.json" hidden>`
};

function render() {
  $('#mes').textContent = mnome();
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.t == tab));
  $('#view').innerHTML = V[tab](calc());
}

const dlg = $('#dlg');
function modal(titulo, campos, init, onSave, onDel) {
  dlg.innerHTML = `<form id="f"><h2>${titulo}</h2>${campos}
    <div class="row"><button type="button" class="alt" id="x">Cancelar</button><button>Salvar</button></div>
    ${onDel ? '<button type="button" class="danger" id="del">Excluir</button>' : ''}</form>`;
  const f = $('#f');
  init(f);
  $('#x').onclick = () => dlg.close();
  if (onDel) $('#del').onclick = () => { if (confirm('Excluir este item?')) { onDel(); save(); dlg.close(); render(); } };
  f.onsubmit = e => { e.preventDefault(); onSave(f); save(); dlg.close(); render(); };
  dlg.showModal();
}

function txForm(t) {
  const novo = !t, atual = mkey() == hoje().slice(0, 7);
  t = t || { tipo: 'd', cat: 'Mercado', date: atual ? hoje() : mkey() + '-01' };
  modal(novo ? 'Novo lançamento' : 'Editar lançamento',
    `<label>Tipo<select name="tipo"><option value="d">Despesa</option><option value="r">Receita</option></select></label>
    <label>Descrição<input name="desc" required maxlength="60"></label>
    <label>Valor (R$)<input name="valor" type="number" step="0.01" min="0.01" inputmode="decimal" required></label>
    <label>Categoria<select name="cat"></select></label>
    <label>Data<input name="date" type="date" required></label>`,
    f => {
      const fill = () => { f.cat.innerHTML = (f.tipo.value == 'r' ? RCATS : CATS).map(x => `<option>${x}</option>`).join(''); };
      f.tipo.value = t.tipo; fill(); f.cat.value = t.cat;
      f.desc.value = t.desc || ''; f.valor.value = t.valor || ''; f.date.value = t.date;
      f.tipo.onchange = fill;
    },
    f => {
      const o = { id: t.id || id(), tipo: f.tipo.value, desc: f.desc.value.trim(), valor: +f.valor.value, cat: f.cat.value, date: f.date.value };
      db.tx = db.tx.filter(x => x.id != o.id); db.tx.push(o);
    },
    novo ? null : () => { db.tx = db.tx.filter(x => x.id != t.id); });
}

function subForm(s) {
  const novo = !s; s = s || {};
  modal(novo ? 'Nova assinatura' : 'Editar assinatura',
    `<label>Nome<input name="nome" required maxlength="40"></label>
    <label>Valor por mês (R$)<input name="valor" type="number" step="0.01" min="0.01" inputmode="decimal" required></label>
    <label>Dia da cobrança<input name="dia" type="number" min="1" max="31" inputmode="numeric" required></label>`,
    f => { f.nome.value = s.nome || ''; f.valor.value = s.valor || ''; f.dia.value = s.dia || ''; },
    f => {
      const o = { id: s.id || id(), nome: f.nome.value.trim(), valor: +f.valor.value, dia: +f.dia.value, desde: s.desde || mkey() };
      db.subs = db.subs.filter(x => x.id != o.id); db.subs.push(o);
    },
    novo ? null : () => { db.subs = db.subs.filter(x => x.id != s.id); });
}

async function exportar() {
  const nome = 'backup-financas-' + hoje() + '.json';
  const blob = new Blob([JSON.stringify(db, null, 1)], { type: 'application/json' });
  const file = new File([blob], nome, { type: 'application/json' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file] }); return; } catch (e) { if (e.name == 'AbortError') return; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = nome; a.click();
}

const A = {
  novoTx: () => txForm(), editTx: i => txForm(db.tx.find(x => x.id == i)),
  novaSub: () => subForm(), editSub: i => subForm(db.subs.find(x => x.id == i)),
  export: exportar, import: () => $('#file').click()
};
document.addEventListener('click', e => { const a = e.target.closest('[data-a]'); if (a) A[a.dataset.a](a.dataset.id); });
$('#tabs').onclick = e => { const b = e.target.closest('button'); if (b) { tab = b.dataset.t; render(); } };
$('#prev').onclick = () => { ym--; render(); };
$('#next').onclick = () => { ym++; render(); };
$('#view').addEventListener('change', e => {
  if (e.target.id != 'file' || !e.target.files[0]) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const x = JSON.parse(r.result);
      if (!Array.isArray(x.tx) || !Array.isArray(x.subs)) throw 0;
      if (confirm('Isso substitui os dados atuais. Continuar?')) { db = x; save(); render(); }
    } catch (_) { alert('Arquivo inválido.'); }
  };
  r.readAsText(e.target.files[0]);
});

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
render();
