const $ = s => document.querySelector(s);
const KEY = 'fin.v1';
const brl = n => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const id = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const hoje = () => new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
const arred = n => Math.round(n * 100) / 100;
const soma = (l, f) => l.reduce((a, x) => a + f(x), 0);

const CATS = ['Moradia', 'Mercado', 'Transporte', 'Lazer', 'Saúde', 'Educação', 'Contas', 'Outros'];
const RCATS = ['Salário', 'Extra', 'Freelas', 'Outros'];
const GCATS = ['Reserva', 'Investimento', 'Poupança', 'Outros'];

// Passos do planejamento do mês (depois da renda, cada grupo vira uma tela)
const GRUPOS = {
  assinatura: { t: 'Assinaturas', q: 'Quais assinaturas você paga?', d: 'Streaming, apps, planos, academia...', ex: ['Netflix', 'Spotify', 'iCloud', 'Academia'] },
  conta: { t: 'Contas da casa', q: 'Quais contas fixas vão chegar?', d: 'O que se repete todo mês.', ex: ['Condomínio', 'Luz', 'Água', 'Internet', 'Celular'] },
  parcela: { t: 'Parcelas e cartão', q: 'Tem parcelas ou fatura de cartão?', d: 'Cartão, financiamentos, empréstimos.', ex: ['Cartão de crédito', 'Parcela'] },
  outro: { t: 'Outros gastos', q: 'Mais algum gasto previsto?', d: 'Qualquer coisa que não coube nas telas anteriores.', ex: [] }
};
const PASSOS = ['renda', 'assinatura', 'conta', 'parcela', 'outro', 'fim'];

// Dados: { tx: [lançamentos do dia a dia], meses: { 'AAAA-MM': { renda, itens: [{id, grupo, nome, valor}] } } }
function migrar(x) {
  x.tx = Array.isArray(x.tx) ? x.tx : [];
  x.meses = x.meses || {};
  delete x.subs;
  return x;
}
let db = { tx: [], meses: {} };
try { db = migrar(JSON.parse(localStorage.getItem(KEY)) || db); } catch (e) { }
const save = () => localStorage.setItem(KEY, JSON.stringify(db));

const now = new Date();
let ym = now.getFullYear() * 12 + now.getMonth(), tab = 'resumo', W = null;
const mkey = () => Math.floor(ym / 12) + '-' + String(ym % 12 + 1).padStart(2, '0');
const mnome = () => new Date(Math.floor(ym / 12), ym % 12, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
const mes1 = () => new Date(Math.floor(ym / 12), ym % 12, 1).toLocaleDateString('pt-BR', { month: 'long' });

function diasRestantes() {
  const total = new Date(Math.floor(ym / 12), ym % 12 + 1, 0).getDate();
  const h = hoje(), k = mkey();
  if (k == h.slice(0, 7)) return total - (+h.slice(8)) + 1;
  return k > h.slice(0, 7) ? total : 0;
}

function calc() {
  const k = mkey(), m = db.meses[k], plano = m && m.renda != null ? m : null;
  const tx = db.tx.filter(t => t.date.startsWith(k)).sort((a, b) => b.date.localeCompare(a.date));
  const itens = plano ? plano.itens : [];
  const ent = arred((plano ? plano.renda : 0) + soma(tx.filter(t => t.tipo == 'r'), t => t.valor));
  const gasto = soma(tx.filter(t => t.tipo == 'd'), t => t.valor);
  const guard = soma(tx.filter(t => t.tipo == 'g'), t => t.valor);
  const sai = arred(soma(itens, i => i.valor) + gasto);
  return { tx, plano, itens, ent, sai, gasto, guard, livre: arred(ent - sai - guard) };
}

const linhaTx = t => {
  const cls = t.tipo == 'r' ? 'pos' : t.tipo == 'g' ? 'sv' : 'neg';
  const sinal = t.tipo == 'r' ? '+' : t.tipo == 'g' ? '' : '−';
  return `<div class="item" data-a="editTx" data-id="${t.id}"><div><b>${esc(t.desc)}</b><small>${t.date.slice(8)}/${t.date.slice(5, 7)}</small><small>${esc(t.cat)}</small></div><span class="${cls}">${sinal}${brl(t.valor)}</span></div>`;
};

const V = {
    resumo: c => {
    if (!c.plano && !c.tx.length) {
      return `<section class="boas"><h2>Vamos montar ${mes1()}?</h2>
        <p>Em poucos passos: quanto entrou, o que vai sair e quanto sobra para viver o resto do mês.</p>
        <button class="add" data-a="wiz">Começar</button></section>`;
    }
    const livre = c.livre, dias = diasRestantes();
    const sobra = Math.max(livre, 0);
    const total = Math.max(c.ent, c.sai + c.guard);
    const pS = total > 0 ? c.sai / total * 100 : 0;
    const pG = total > 0 ? c.guard / total * 100 : 0;
    const pL = total > 0 ? sobra / total * 100 : 0;
    let legenda;
    if (c.ent <= 0) legenda = 'Sem renda neste mês';
    else if (livre < 0) legenda = 'Gastos acima da renda';
    else if (dias > 0) legenda = brl(livre / dias) + ' por dia';
    else legenda = Math.round(c.sai / c.ent * 100) + '% da renda gasta';
    // arcos empilhados: verde (tudo) por baixo, azul (gasto + guardado) no meio, vermelho (gasto) por cima
    const arco = (cls, fim) => fim > 0.01 ? `<circle class="prog ${cls}" cx="100" cy="100" r="88" pathLength="100"
          stroke-dasharray="100" stroke-dashoffset="100" transform="rotate(-90 100 100)"
          data-alvo="${100 - Math.min(fim, 100)}" data-pct="${fim}"/>` : '';
    const item = (cor, nome, v, p) => `<div><p><i style="background:var(${cor})"></i>${nome}</p><b data-n="${v}">${brl(v)}</b><small>${Math.round(p)}%</small></div>`;
    return `<section class="anel">
      <svg class="anel-svg" viewBox="0 0 200 200" aria-hidden="true">
        <circle class="trilho" cx="100" cy="100" r="88"/>
        ${arco('a-ok', pS + pG + pL)}${arco('a-sv', pS + pG)}${arco('a-gasto', pS)}
      </svg>
      <div class="centro">
        <p>Disponível</p>
        <strong class="${livre < 0 ? 'neg' : ''}" data-n="${livre}">${brl(livre)}</strong>
        <small>${legenda}</small>
      </div>
    </section>
    <section class="legenda">
      ${item('--neg', 'Gasto', c.sai, pS)}${item('--sv', 'Guardado', c.guard, pG)}${item('--ac', 'Sobrou', sobra, pL)}
    </section>
    <p class="entrou">Entrou ${brl(c.ent)} neste mês</p>
    <section class="rapido">
      <button class="add neg-b" data-a="novoGasto">− Gasto</button>
      <button class="add" data-a="novaEntrada">+ Extra</button>
      <button class="add sv-b" data-a="novoGuardado">Guardar</button>
    </section>
    ${c.tx.length ? `<h3 class="sub">Lançamentos do mês</h3>${c.tx.map(linhaTx).join('')}` : ''}
    <button class="danger suave" data-a="wiz">${c.plano ? 'Ajustar o mês completo' : 'Montar o mês'}</button>
    <button class="danger" data-a="resetTudo">Apagar tudo e recomeçar</button>`;
  },
   backup: c => {
    if (!c.plano && !c.tx.length) {
      return `<p class="txt">Nada cadastrado em ${mnome()} ainda. Monte o mês na tela Resumo para poder exportar o PDF.</p>`;
    }
    const nome = mnome().charAt(0).toUpperCase() + mnome().slice(1);
    const linha = (rot, v, cls) => `<div><span>${rot}</span><b class="${cls}">${brl(v)}</b></div>`;
    return `<section class="pdfcard">
      <p class="pdfmes">${nome}</p>
      ${linha('Entrou', c.ent, 'pos')}
      ${linha('Gasto', c.sai, 'neg')}
      ${linha('Guardado', c.guard, 'sv')}
      ${linha(c.livre < 0 ? 'Faltou' : 'Sobrou', Math.abs(c.livre), c.livre < 0 ? 'neg' : 'pos')}
    </section>
    <p class="txt">O PDF traz o detalhe de cada item deste mês.</p>
    <button class="add" data-a="pdf">Exportar para PDF</button>`;
  }
};

function contar(raiz) {
  const reduz = matchMedia('(prefers-reduced-motion: reduce)').matches;
  raiz.querySelectorAll('[data-n]').forEach(el => {
    if (reduz) return;
    const alvo = +el.dataset.n;
    el.textContent = brl(0);
    const t0 = performance.now(), dur = 1000;
    const passo = t => {
      const p = Math.min((t - t0) / dur, 1), e = 1 - Math.pow(1 - p, 3);
      el.textContent = brl(alvo * e);
      if (p < 1) requestAnimationFrame(passo);
    };
    requestAnimationFrame(passo);
  });
}

function animar() {
  const arcos = document.querySelectorAll('#view .prog');
  if (arcos.length) {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      arcos.forEach(a => { a.style.opacity = 1; a.style.strokeDashoffset = a.dataset.alvo; });
    }));
  }
  contar($('#view'));
}


function render() {
  $('#mes').textContent = mnome();
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.t == tab));
  $('#view').innerHTML = V[tab](calc());
  if (tab == 'resumo') animar();
  if (W && GRUPOS[PASSOS[W.passo]]) wizLista();
}

/* ---------- Passo a passo do mês ---------- */
function wizAbrir() {
  const k = mkey();
  const p = db.meses[k] || { renda: null, itens: [] };
  W = { k, passo: 0, renda: p.renda, itens: p.itens.map(i => ({ ...i })), copiado: false, pa: 0, cur: 0, raf: 0 };
  $('#wiz').hidden = false;
  wizRender();
}

function wizFechar() {
  $('#wiz').hidden = true;
  W = null; tab = 'resumo';
  render();
}

function wizSalvar() {
  db.meses[W.k] = { renda: W.renda, itens: W.itens };
  save();
}

function sobraWiz() {
  const tx = db.tx.filter(t => t.date.startsWith(W.k));
  const extra = soma(tx.filter(t => t.tipo == 'r'), t => t.valor);
  const gasto = soma(tx.filter(t => t.tipo == 'd'), t => t.valor);
  const guard = soma(tx.filter(t => t.tipo == 'g'), t => t.valor);
  return arred((W.renda || 0) + extra - soma(W.itens, i => i.valor) - gasto - guard);
}

function mostrarSobra() {
  const el = $('#wsobra');
  if (!el) return;
  const de = W.cur, para = sobraWiz();
  el.classList.toggle('neg', para < 0);
  cancelAnimationFrame(W.raf);
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || de === para) { W.cur = para; el.textContent = brl(para); return; }
  const t0 = performance.now();
  const passo = t => {
    if (!W) return;
    const p = Math.min((t - t0) / 600, 1), e = 1 - Math.pow(1 - p, 3);
    W.cur = de + (para - de) * e;
    el.textContent = brl(W.cur);
    if (p < 1) W.raf = requestAnimationFrame(passo);
  };
  W.raf = requestAnimationFrame(passo);
}

function wizOutro() {
  const n = $('#wn');
  n.value = ''; n.placeholder = 'Nome do gasto';
  n.focus();
}

function wizZerar() {
  if (!confirm('Apagar tudo o que você montou em ' + mes1() + ' (renda e gastos)? Os lançamentos do dia a dia continuam.')) return;
  delete db.meses[W.k];
  save();
  wizFechar();
}

function wizAdd() {
  const n = $('#wn').value.trim(), v = +$('#wv').value;
  if (!n || !(v > 0)) return false;
  W.itens.push({ id: id(), grupo: PASSOS[W.passo], nome: n, valor: v });
  $('#wn').value = ''; $('#wv').value = '';
  wizLista();
  $('#wn').focus();
  return true;
}

function wizLista() {
  const g = PASSOS[W.passo], its = W.itens.filter(i => i.grupo == g);
  $('#wlista').innerHTML = (W.copiado && its.length ? '<p class="wnota">Trouxe do mês passado. Toque num item para ajustar.</p>' : '') +
    its.map(i => `<div class="item" data-a="witem" data-id="${i.id}"><b>${esc(i.nome)}</b><span>${brl(i.valor)}</span></div>`).join('');
  $('#wtotal').textContent = its.length ? 'Total: ' + brl(soma(its, i => i.valor)) : '';
  const nomes = its.map(i => i.nome.toLowerCase());
  const G = GRUPOS[g];
  $('#chips').innerHTML = G.ex.filter(x => !nomes.includes(x.toLowerCase()))
    .map(x => `<button type="button" data-a="wchip" data-nome="${esc(x)}">${esc(x)}</button>`).join('') +
    (G.ex.length ? '<button type="button" class="outro" data-a="woutro">Outro</button>' : '');
  mostrarSobra();
}

function wizFim() {
  const c = calc(), dias = diasRestantes();
  const tot = g => soma(c.itens.filter(i => i.grupo == g), i => i.valor);
  const linhas = [['Entrou', c.ent]]
    .concat(Object.keys(GRUPOS).map(g => [GRUPOS[g].t, -tot(g)]))
        .concat([['Já gasto no dia a dia', -c.gasto], ['Guardado', -c.guard]])
    .filter((l, i) => i == 0 || l[1] != 0);
  const msg = c.livre < 0 ? 'Os gastos passam da renda. Volte e confira os valores.'
    : dias > 0 ? `Dá ${brl(c.livre / dias)} por dia nos ${dias} dias que faltam.` : 'Esse mês já acabou.';
  return `<p class="wpasso">Pronto</p><h2 class="wperg">Seu ${mes1()} em números</h2>
    ${linhas.map(([n, v]) => `<div class="linha"><span>${n}</span><b class="${v > 0 ? 'pos' : ''}">${v < 0 ? '−' : '+'}${brl(Math.abs(v))}</b></div>`).join('')}
    <div class="fimgrande"><p>${c.livre < 0 ? 'Faltam' : 'Sobram'}</p><strong class="${c.livre < 0 ? 'neg' : ''}" data-n="${Math.abs(c.livre)}">${brl(Math.abs(c.livre))}</strong></div>
    <p class="fimmsg">${msg}</p>
    <button class="danger" data-a="wzera">Refazer o mês do zero</button>`;
}

function wizRender() {
  const g = PASSOS[W.passo], n = PASSOS.length - 1, prog = W.passo / n * 100;
  let corpo;
  if (g == 'renda') {
    corpo = `<p class="wpasso">Passo 1 de ${n}</p><h2 class="wperg">Quanto você ganhou em ${mes1()}?</h2>
      <p>Some tudo o que entrou ou vai entrar neste mês.</p>
      <label class="grande"><span>R$</span><input id="wv" type="number" step="0.01" min="0" inputmode="decimal" placeholder="0,00" value="${W.renda ?? ''}"></label>`;
  } else if (g == 'fim') {
    corpo = wizFim();
  } else {
    const G = GRUPOS[g];
    corpo = `<p class="wpasso">Passo ${W.passo + 1} de ${n}</p><h2 class="wperg">${G.q}</h2><p>${G.d}</p>
      <div class="chips" id="chips"></div><div id="wlista"></div>
      <form class="wadd" id="wf"><input id="wn" placeholder="Nome" maxlength="40" autocomplete="off"><input id="wv" type="number" step="0.01" min="0.01" inputmode="decimal" placeholder="Valor"><button aria-label="Adicionar">+</button></form>
      <p class="wtotal" id="wtotal"></p>`;
  }
  $('#wiz').innerHTML = `<div class="wtop"><button class="wx" data-a="wsair" aria-label="Fechar">×</button><div class="wprog"><i style="width:${W.pa}%"></i></div></div>
    ${g == 'fim' ? '' : `<div class="wsobra"><span>Sobra no mês</span><strong id="wsobra">${brl(W.cur)}</strong></div>`}
    <div class="wcorpo">${corpo}</div>
    <div class="wbaixo">${W.passo ? '<button class="add alt" data-a="wvolta">Voltar</button>' : ''}<button class="add" data-a="wprox">${g == 'fim' ? 'Concluir' : 'Continuar'}</button></div>`;
  const barra = $('#wiz .wprog i');
  requestAnimationFrame(() => requestAnimationFrame(() => { barra.style.width = prog + '%'; }));
  W.pa = prog;
  if (g == 'renda') { $('#wv').focus(); mostrarSobra(); }
  else if (g == 'fim') contar($('#wiz'));
  else wizLista();
}

function wizProx() {
  const g = PASSOS[W.passo];
  if (g == 'renda') {
    const raw = $('#wv').value;
    if (raw === '') { $('#wv').focus(); return; }
    W.renda = +raw;
  } else if (g == 'fim') {
    wizFechar(); return;
  } else wizAdd();
  wizSalvar();
  W.passo++;
  wizRender();
}

function wizVolta() {
  if (GRUPOS[PASSOS[W.passo]]) wizAdd();
  W.passo--;
  wizRender();
}

/* ---------- Formulários ---------- */
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

function txForm(t, tipo) {
  const novo = !t, atual = mkey() == hoje().slice(0, 7);
  const ult = String(new Date(Math.floor(ym / 12), ym % 12 + 1, 0).getDate()).padStart(2, '0');
  const CAT0 = { d: 'Mercado', r: 'Extra', g: 'Investimento' };
  const TIT = { d: 'Novo gasto', r: 'Entrada extra', g: 'Guardar dinheiro' };
  t = t || { tipo: tipo || 'd', cat: CAT0[tipo || 'd'], date: atual ? hoje() : mkey() + '-01' };
  modal(novo ? (TIT[tipo] || 'Novo lançamento') : 'Editar lançamento',
    `<label>Tipo<select name="tipo"><option value="d">Gasto</option><option value="r">Extra</option><option value="g">Guardar / investir</option></select></label>
    <label>Descrição<input name="desc" required maxlength="60"></label>
    <label>Valor (R$)<input name="valor" type="number" step="0.01" min="0.01" inputmode="decimal" required></label>
    <label>Categoria<select name="cat"></select></label>
    <label>Data<input name="date" type="date" required min="${mkey()}-01" max="${mkey()}-${ult}"></label>`,
    f => {
      const fill = () => { f.cat.innerHTML = (f.tipo.value == 'r' ? RCATS : f.tipo.value == 'g' ? GCATS : CATS).map(x => `<option>${x}</option>`).join(''); };
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

function itemForm(i) {
  const it = W.itens.find(x => x.id == i);
  modal('Editar item',
    `<label>Nome<input name="nome" required maxlength="40"></label>
    <label>Valor (R$)<input name="valor" type="number" step="0.01" min="0.01" inputmode="decimal" required></label>`,
    f => { f.nome.value = it.nome; f.valor.value = it.valor; },
    f => { it.nome = f.nome.value.trim(); it.valor = +f.valor.value; },
    () => { W.itens = W.itens.filter(x => x.id != i); });
}

async function exportarPdf() {
  const { blob } = relatorioMes();
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
function resetTudo() {
  if (!confirm('Apagar TODOS os dados (todos os meses, gastos, extras e valores guardados) e voltar ao começo? Isso não pode ser desfeito.')) return;
  db = { tx: [], meses: {} };
  save();
  ym = now.getFullYear() * 12 + now.getMonth();
  tab = 'resumo';
  render();
}

const A = {
  editTx: i => txForm(db.tx.find(x => x.id == i)),
  novoGasto: () => txForm(null, 'd'), novaEntrada: () => txForm(null, 'r'), novoGuardado: () => txForm(null, 'g'),
  wiz: wizAbrir, wsair: wizFechar, wprox: wizProx, wvolta: wizVolta, witem: itemForm, wzera: wizZerar, woutro: wizOutro,
  wchip: (i, el) => { $('#wn').value = el.dataset.nome; $('#wv').focus(); },
    pdf: exportarPdf, resetTudo
};
document.addEventListener('click', e => { const a = e.target.closest('[data-a]'); if (a) A[a.dataset.a](a.dataset.id, a); });
document.addEventListener('submit', e => { if (e.target.id == 'wf') { e.preventDefault(); wizAdd(); } });
document.addEventListener('input', e => {
  if (W && e.target.id == 'wv' && PASSOS[W.passo] == 'renda') { W.renda = +e.target.value || 0; mostrarSobra(); }
});
$('#tabs').onclick = e => { const b = e.target.closest('button'); if (b) { tab = b.dataset.t; render(); } };
$('#prev').onclick = () => { ym--; render(); };
$('#next').onclick = () => { ym++; render(); };
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
render();
