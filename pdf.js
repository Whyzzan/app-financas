// Gerador de PDF mínimo (sem bibliotecas): A4, Helvetica, texto e retângulos.
// Funciona offline e gera um arquivo real que pode ser compartilhado/salvo no iPhone.
const PDF = (() => {
  const W = 595.28, H = 841.89, M = 44;

  // Larguras da Helvetica (por 1000) para os caracteres ASCII 32..126
  const WR = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584];
  const WB = [278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584];

  // Troca caracteres fora do WinAnsi por equivalentes simples
  const limpa = s => String(s).replace(/[−–—]/g, '-').replace(/[“”]/g, '"').replace(/[‘’]/g, "'")
    .replace(/\u00a0|\u202f/g, ' ').replace(/[^\x20-\x7e\u00a1-\u00ff]/g, '?');

  const larg = (s, tam, neg) => {
    const t = neg ? WB : WR;
    let w = 0;
    for (const ch of limpa(s)) {
      const c = ch.charCodeAt(0);
      w += c >= 32 && c <= 126 ? t[c - 32] : 556; // acentuadas ~ largura média
    }
    return w * tam / 1000;
  };

  const esc = s => limpa(s).replace(/[\\()]/g, '\\$&');
  const n2 = n => (Math.round(n * 100) / 100).toString();
  const cor = hex => {
    const v = parseInt(hex.slice(1), 16);
    return [(v >> 16) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255].map(n2).join(' ');
  };

  class Doc {
    constructor(rodape) {
      this.pags = []; this.rodape = rodape || '';
      this.nova();
    }
    nova() {
      this.ops = []; this.pags.push(this.ops); this.y = H - M;
    }
    // garante espaço; senão abre nova página
    cabe(h) { if (this.y - h < M + 24) this.nova(); }
    texto(s, x, y, { tam = 10, neg = false, cor: c = '#16231F', dir = false, centro = false } = {}) {
      let px = x;
      if (dir) px = x - larg(s, tam, neg);
      else if (centro) px = x - larg(s, tam, neg) / 2;
      this.ops.push(`BT /${neg ? 'F2' : 'F1'} ${tam} Tf ${cor(c)} rg ${n2(px)} ${n2(y)} Td (${esc(s)}) Tj ET`);
    }
    ret(x, y, w, h, c) { this.ops.push(`${cor(c)} rg ${n2(x)} ${n2(y)} ${n2(w)} ${n2(h)} re f`); }
    linha(x1, y, x2, c = '#DDE4DF', esp = 0.6) {
      this.ops.push(`${cor(c)} RG ${esp} w ${n2(x1)} ${n2(y)} m ${n2(x2)} ${n2(y)} l S`);
    }
    espaco(h) { this.y -= h; }

    // Corta texto longo para caber em "max" pontos
    ajusta(s, tam, max, neg) {
      s = String(s);
      if (larg(s, tam, neg) <= max) return s;
      while (s.length > 1 && larg(s + '...', tam, neg) > max) s = s.slice(0, -1);
      return s.trimEnd() + '...';
    }

    titulo(s) {
      this.cabe(40);
      this.espaco(14);
      this.texto(s, M, this.y, { tam: 12, neg: true, cor: '#0F7B6C' });
      this.espaco(6);
      this.linha(M, this.y, W - M, '#0F7B6C', 1);
      this.espaco(6);
    }
    // linha com colunas: cols = [{t, x?, dir?, neg?, cor?, max?}]
    linhaTab(cols, { tam = 10, h = 18, fundo, borda = true } = {}) {
      this.cabe(h);
      if (fundo) this.ret(M, this.y - h + 4, W - 2 * M, h - 1, fundo);
      const base = this.y - h + 9;
      for (const c of cols) {
        const t = c.max ? this.ajusta(c.t, tam, c.max, c.neg) : c.t;
        this.texto(t, c.dir ? W - M - 6 : c.x != null ? c.x : M + 6, base, { tam, neg: c.neg, cor: c.cor, dir: c.dir && !c.xdir ? true : false });
      }
      this.y -= h;
      if (borda) this.linha(M, this.y + 4, W - M);
    }

    montar() {
      const total = this.pags.length, objs = [];
      const add = s => { objs.push(s); return objs.length; };
      add('<< /Type /Catalog /Pages 2 0 R >>');
      add(''); // Pages (preenchido depois)
      add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
      add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
      const kids = [];
      this.pags.forEach((ops, i) => {
        const rod = [
          `BT /F1 8 Tf ${cor('#66736E')} rg ${n2(M)} ${n2(M - 14)} Td (${esc(this.rodape)}) Tj ET`,
          `BT /F1 8 Tf ${cor('#66736E')} rg ${n2(W - M - larg('Página ' + (i + 1) + ' de ' + total, 8))} ${n2(M - 14)} Td (${esc('Página ' + (i + 1) + ' de ' + total)}) Tj ET`
        ];
        const corpo = ops.concat(rod).join('\n');
        const c = add(`<< /Length ${corpo.length} >>\nstream\n${corpo}\nendstream`);
        const p = add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${n2(W)} ${n2(H)}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${c} 0 R >>`);
        kids.push(p + ' 0 R');
      });
      objs[1] = `<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${kids.length} >>`;
      let out = '%PDF-1.4\n';
      const pos = [];
      objs.forEach((o, i) => { pos.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
      const xref = out.length;
      out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + pos.map(p => String(p).padStart(10, '0') + ' 00000 n \n').join('');
      out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
      // string -> bytes (cada caractere já é Latin-1 / ASCII)
      const bytes = new Uint8Array(out.length);
      for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 255;
      return new Blob([bytes], { type: 'application/pdf' });
    }
  }
  return { Doc, W, H, M, larg };
})();

// Monta o relatório do mês atualmente selecionado
function relatorioMes() {
  const c = calc();
  const maius = s => s.charAt(0).toUpperCase() + s.slice(1);
  const tit = maius(mnome());
  const dinheiro = n => brl(n).replace(/\u00a0/g, ' ');
  const d = new PDF.Doc('Finanças - ' + tit);
  const { W, M } = PDF;
  const dir = W - M - 6;

  // Cabeçalho
  d.ret(0, PDF.H - 92, W, 92, '#0F7B6C');
  d.texto('RELATÓRIO FINANCEIRO', M, PDF.H - 38, { tam: 9, neg: true, cor: '#BFE6DF' });
  d.texto(tit, M, PDF.H - 66, { tam: 26, neg: true, cor: '#FFFFFF' });
  const agora = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  d.texto('Gerado em ' + agora, W - M, PDF.H - 38, { tam: 9, cor: '#BFE6DF', dir: true });
  d.y = PDF.H - 92 - 28;

  // Resumo em 3 caixas
  const bw = (W - 2 * M - 20) / 3, by = d.y - 56;
  [['ENTROU', c.ent, '#0F7B6C'], ['SAIU', c.sai, '#C4472F'], [c.livre < 0 ? 'FALTAM' : 'DISPONÍVEL', Math.abs(c.livre), c.livre < 0 ? '#C4472F' : '#16231F']]
    .forEach(([t, v, cor], i) => {
      const x = M + i * (bw + 10);
      d.ret(x, by, bw, 56, '#F3F5F2');
      d.texto(t, x + 12, by + 38, { tam: 8, neg: true, cor: '#66736E' });
      d.texto(dinheiro(v), x + 12, by + 14, { tam: 15, neg: true, cor });
    });
  d.y = by - 6;
  if (c.ent > 0) {
    const pct = Math.round(c.sai / c.ent * 100);
    d.espaco(10);
    d.texto(pct + '% da renda do mês foi comprometida.', M, d.y, { tam: 9, cor: '#66736E' });
    d.espaco(4);
  }

  if (!c.plano && !c.tx.length) {
    d.espaco(30);
    d.texto('Nenhum dado cadastrado neste mês.', M, d.y, { tam: 11, cor: '#66736E' });
    return { blob: d.montar(), tit };
  }

  // Renda
  d.titulo('Entradas');
  if (c.plano) d.linhaTab([{ t: 'Renda do mês' }, { t: dinheiro(c.plano.renda), dir: true, neg: true, cor: '#0F7B6C' }]);
  const rec = c.tx.filter(t => t.tipo == 'r');
  rec.forEach(t => d.linhaTab([
    { t: t.date.slice(8) + '/' + t.date.slice(5, 7), x: M + 6 },
    { t: t.desc + (t.cat ? '  ·  ' + t.cat : ''), x: M + 52, max: 330 },
    { t: '+' + dinheiro(t.valor), dir: true, cor: '#0F7B6C' }]));
  if (!c.plano && !rec.length) d.linhaTab([{ t: 'Sem entradas lançadas', cor: '#66736E' }], { borda: false });

  // Gastos planejados por grupo
  const grupos = Object.keys(GRUPOS).filter(g => c.itens.some(i => i.grupo == g));
  if (grupos.length) {
    d.titulo('Gastos planejados');
    grupos.forEach(g => {
      const its = c.itens.filter(i => i.grupo == g);
      d.linhaTab([{ t: GRUPOS[g].t, neg: true }, { t: dinheiro(soma(its, i => i.valor)), dir: true, neg: true }], { fundo: '#F3F5F2', borda: false });
      its.forEach(i => d.linhaTab([{ t: i.nome, x: M + 16, max: 340 }, { t: dinheiro(i.valor), dir: true }]));
    });
    d.linhaTab([{ t: 'Total planejado', neg: true }, { t: dinheiro(soma(c.itens, i => i.valor)), dir: true, neg: true }], { borda: false });
  }

  // Gastos do dia a dia
  const desp = c.tx.filter(t => t.tipo == 'd');
  if (desp.length) {
    d.titulo('Gastos do dia a dia');
    desp.forEach(t => d.linhaTab([
      { t: t.date.slice(8) + '/' + t.date.slice(5, 7), x: M + 6 },
      { t: t.desc, x: M + 52, max: 250 },
      { t: t.cat, x: M + 320, max: 100, cor: '#66736E' },
      { t: dinheiro(t.valor), dir: true }]));
    d.linhaTab([{ t: 'Total do dia a dia', neg: true }, { t: dinheiro(c.gasto), dir: true, neg: true }], { borda: false });

    // Por categoria
    const porCat = {};
    desp.forEach(t => { porCat[t.cat] = (porCat[t.cat] || 0) + t.valor; });
    d.titulo('Dia a dia por categoria');
    const maxCat = Math.max(...Object.values(porCat));
    Object.entries(porCat).sort((a, b) => b[1] - a[1]).forEach(([cat, v]) => {
      d.cabe(18);
      const pct = c.gasto > 0 ? v / c.gasto : 0;
      d.linhaTab([
        { t: cat, x: M + 6 },
        { t: Math.round(pct * 100) + '%', x: M + 300, cor: '#66736E' },
        { t: dinheiro(v), dir: true }], { borda: false });
      d.ret(M + 100, d.y + 9, 170 * v / maxCat, 5, '#0F7B6C');
    });
  }
  // Guardado
  const gua = c.tx.filter(t => t.tipo == 'g');
  if (gua.length) {
    d.titulo('Guardado e investido');
    gua.forEach(t => d.linhaTab([
      { t: t.date.slice(8) + '/' + t.date.slice(5, 7), x: M + 6 },
      { t: t.desc + '  ·  ' + t.cat, x: M + 52, max: 330 },
      { t: dinheiro(t.valor), dir: true, cor: '#3B6FD4' }]));
    d.linhaTab([{ t: 'Total guardado', neg: true }, { t: dinheiro(c.guard), dir: true, neg: true }], { borda: false });
  }
  
  // Fechamento
  d.titulo('Fechamento');
  d.linhaTab([{ t: 'Entrou' }, { t: dinheiro(c.ent), dir: true, cor: '#0F7B6C' }]);
  d.linhaTab([{ t: 'Saiu (planejado + dia a dia)' }, { t: dinheiro(c.sai), dir: true, cor: '#C4472F' }]);
    if (c.guard) d.linhaTab([{ t: 'Guardado / investido' }, { t: dinheiro(c.guard), dir: true, cor: '#3B6FD4' }]);
  d.linhaTab([{ t: c.livre < 0 ? 'Faltaram' : 'Sobrou', neg: true }, { t: dinheiro(Math.abs(c.livre)), dir: true, neg: true, cor: c.livre < 0 ? '#C4472F' : '#0F7B6C' }], { fundo: '#F3F5F2', borda: false });

  return { blob: d.montar(), tit };
}

