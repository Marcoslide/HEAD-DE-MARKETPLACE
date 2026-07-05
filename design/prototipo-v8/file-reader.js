/* =============================================================
   HEAD MARKETPLACE OS · v8 — LEITOR REAL DE ARQUIVOS LOCAIS (10.E.2)
   "Selecionar planilha do computador" de verdade: o arquivo é lido,
   validado (extensão + MIME + tamanho), aberto (CSV, XLSX, ZIP) e
   entregue ao motor de importação com TODAS as abas e colunas.
   XLS binário (BIFF antigo) não é fingido: o sistema declara que não
   entende e pede exportação como XLSX/CSV. Roda em navegador e Node
   (DecompressionStream — sem dependência externa).
   ============================================================= */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.V8FILE = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const MAX_BYTES = 25 * 1024 * 1024; /* mesmo teto do backend (storage.js) */
  const EXTS = ['.xlsx', '.xls', '.csv', '.zip'];
  const MIME_OK = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel',
    'text/csv', 'application/csv', 'application/zip', 'application/x-zip-compressed', 'application/octet-stream', '',
  ];

  function validateMeta(nome, tamanho, mime) {
    const ext = (String(nome).match(/\.[^.]+$/) || [''])[0].toLowerCase();
    if (!EXTS.includes(ext)) return { ok: false, motivo: `extensão "${ext || 'nenhuma'}" não aceita — envie XLSX, XLS, CSV ou ZIP` };
    if (tamanho > MAX_BYTES) return { ok: false, motivo: 'arquivo acima de 25MB — exporte um período menor' };
    if (mime != null && !MIME_OK.includes(String(mime))) return { ok: false, motivo: `tipo MIME "${mime}" não corresponde a planilha — arquivo recusado` };
    return { ok: true, ext };
  }

  /* ---------------- números brasileiros (10.E.2.3) ----------------
     335.392,51 → 335392.51 · 0,63% → 0.0063 · 1.375 → 1375
     Regra: se há vírgula, o ponto é separador de milhar; sem vírgula,
     pontos só são milhar quando o padrão é 1.375 / 12.345 / 1.234.567.
     Percentual vira fração (÷100). Mantém o texto bruto em outra camada. */
  function parseBrNumber(v) {
    if (v == null || v === '') return null;
    if (typeof v === 'number') return v;
    let s = String(v).trim();
    if (s === '-' || s === '—' || /^n\/?a$/i.test(s)) return null;
    const pct = /%\s*$/.test(s);
    s = s.replace(/%/g, '').replace(/R\$\s*/i, '').replace(/\s+/g, '');
    if (s === '' || s === '-') return null;
    if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
    else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    const n = Number(s);
    if (isNaN(n)) return null;
    return pct ? Math.round((n / 100) * 1e6) / 1e6 : n;
  }

  /* ---------------- segmentação de blocos (10.E.2.3) ----------------
     Uma aba pode conter vários blocos independentes: linha de título,
     cabeçalho real, linha consolidada, linhas diárias, tabelas por fonte
     ou por produto. Nunca assume "linha 1 = cabeçalho, linha 2 = dado".
     Recebe uma matriz (array de arrays de células) e devolve blocos. */
  const _vazia = row => !row || row.every(c => c === '' || c == null || String(c).trim() === '');
  const _naoVazias = row => (row || []).filter(c => !(c === '' || c == null || String(c).trim() === '')).length;
  const _txt = c => String(c == null ? '' : c).trim();
  function segmentBlocks(matriz) {
    const M = (matriz || []).map(r => (r || []).map(c => (c == null ? '' : c)));
    const blocos = []; let i = 0, tituloPend = null;
    while (i < M.length) {
      if (_vazia(M[i])) { i++; continue; }
      /* linha de título: uma única célula preenchida e a próxima linha não-vazia é um cabeçalho (2+ células) */
      if (_naoVazias(M[i]) === 1) {
        let j = i + 1; while (j < M.length && _vazia(M[j])) j++;
        if (j < M.length && _naoVazias(M[j]) >= 2) { tituloPend = _txt(M[i].find(c => _txt(c) !== '')); i++; continue; }
      }
      /* cabeçalho: primeira linha do bloco com 2+ células preenchidas */
      const header = M[i].map(_txt); i++;
      const rows = [];
      while (i < M.length && !_vazia(M[i])) {
        if (_naoVazias(M[i]) === 1) {  /* título do próximo bloco encostado sem linha em branco */
          let j = i + 1; while (j < M.length && _vazia(M[j])) j++;
          if (j < M.length && _naoVazias(M[j]) >= 2) break;
        }
        const linha = M[i].map(_txt);
        /* cabeçalho repetido dentro do mesmo bloco não vira dado */
        if (linha.join('') === header.join('')) { i++; continue; }
        const obj = {};
        header.forEach((h, k) => { if (h !== '') obj[h] = M[i][k] == null ? '' : M[i][k]; });
        rows.push(obj); i++;
      }
      blocos.push({ titulo: tituloPend, headers: header.filter(Boolean), rows });
      tituloPend = null;
    }
    return blocos;
  }

  /* ---------------- CSV ---------------- */
  function parseCsvText(text) {
    text = String(text).replace(/^﻿/, '');
    /* delimitador detectado nas primeiras linhas COM separador (o cabeçalho real pode não ser a linha 1) */
    const amostra = text.split(/\r?\n/).slice(0, 25);
    const delim = [',', ';', '\t'].map(d => [d, Math.max(0, ...amostra.map(l => l.split(d).length - 1))]).sort((a, b) => b[1] - a[1])[0][0];
    const rows = []; let cur = [''], inQ = false, row = cur;
    const pushRow = () => { if (row.length > 1 || row[0] !== '') rows.push(row); row = cur = ['']; };
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (inQ) {
        if (ch === '"') { if (text[i + 1] === '"') { cur[cur.length - 1] += '"'; i++; } else inQ = false; }
        else cur[cur.length - 1] += ch;
      } else if (ch === '"') inQ = true;
      else if (ch === delim) cur.push('');
      else if (ch === '\n') pushRow();
      else if (ch !== '\r') cur[cur.length - 1] += ch;
    }
    pushRow();
    if (!rows.length) return { headers: [], rows: [], meta: [] };
    /* 10.E.2.5 — CSV com METADADOS antes do cabeçalho (ex.: relatório de Ads Shopee):
       o cabeçalho real é a primeira linha "larga" (nº de colunas perto do máximo). */
    const janela = rows.slice(0, 20);
    const maxCols = Math.max(...janela.map(r => r.filter(c => String(c).trim() !== '').length));
    let hIdx = 0;
    if (maxCols >= 4) { hIdx = rows.findIndex(r => r.filter(c => String(c).trim() !== '').length >= Math.max(4, maxCols * 0.7)); if (hIdx < 0) hIdx = 0; }
    const meta = rows.slice(0, hIdx).filter(r => r.some(c => String(c).trim() !== '')).map(r => r.filter(c => String(c).trim() !== '').join(': '));
    const headers = rows[hIdx].map(h => h.trim());
    const num = v => (v !== '' && !isNaN(v) && String(v).trim() !== '') ? +v : v;
    const dataRows = rows.slice(hIdx + 1)
      .map(r => Object.fromEntries(headers.map((h, i) => [h, num((r[i] ?? '').trim())])))
      .filter(o => Object.values(o).some(v => v !== '' && v != null));
    return { headers: headers.filter(Boolean), rows: dataRows, meta };
  }

  /* ---------------- ZIP (leitor mínimo: central directory + deflate-raw) ---------------- */
  async function unzip(buf) {
    const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    let eocd = -1;
    for (let i = u8.length - 22; i >= 0 && i > u8.length - 22 - 65557; i--)
      if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error('ZIP inválido — fim de diretório central não encontrado');
    const count = dv.getUint16(eocd + 10, true);
    let p = dv.getUint32(eocd + 16, true);
    const dec = new TextDecoder();
    const out = {};
    for (let k = 0; k < count; k++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true);
      const nlen = dv.getUint16(p + 28, true), elen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true);
      const lho = dv.getUint32(p + 42, true);
      const name = dec.decode(u8.subarray(p + 46, p + 46 + nlen));
      p += 46 + nlen + elen + clen;
      if (name.endsWith('/')) continue;
      const lnlen = dv.getUint16(lho + 26, true), lelen = dv.getUint16(lho + 28, true);
      const start = lho + 30 + lnlen + lelen;
      const comp = u8.subarray(start, start + csize);
      if (method === 0) out[name] = comp.slice();
      else if (method === 8)
        out[name] = new Uint8Array(await new Response(
          new Blob([comp.slice()]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
      else throw new Error(`método de compressão ${method} não suportado em "${name}"`);
    }
    return out;
  }

  /* ---------------- XLSX (OpenXML dentro do ZIP) ---------------- */
  const unesc = s => String(s).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
  const colIdx = ref => { let c = 0; for (const ch of ref) { if (ch >= 'A' && ch <= 'Z') c = c * 26 + ch.charCodeAt(0) - 64; else break; } return c - 1; };

  async function parseXlsxBuffer(buf) {
    const files = await unzip(buf);
    const dec = new TextDecoder();
    const txt = n => files[n] ? dec.decode(files[n]) : '';
    /* strings compartilhadas */
    const shared = [...txt('xl/sharedStrings.xml').matchAll(/<si[^>]*>([\s\S]*?)<\/si>/g)]
      .map(m => unesc([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(t => t[1]).join('')));
    /* nomes das abas na ordem do workbook */
    const wb = txt('xl/workbook.xml');
    const nomes = [...wb.matchAll(/<sheet [^>]*name="([^"]*)"/g)].map(m => unesc(m[1]));
    const sheetFiles = Object.keys(files).filter(n => /^xl\/worksheets\/sheet\d+\.xml$/.test(n))
      .sort((a, b) => +a.match(/\d+/)[0] - +b.match(/\d+/)[0]);
    const abas = [];
    sheetFiles.forEach((sf, si) => {
      const xml = txt(sf);
      const linhas = [...xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)].map(rm => {
        const cells = [];
        for (const cm of rm[1].matchAll(/<c([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
          const attrs = cm[1] || '', inner = cm[2] || '';
          const ref = (attrs.match(/r="([A-Z]+)\d+"/) || [])[1];
          const t = (attrs.match(/t="(\w+)"/) || [])[1];
          const v = (inner.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
          const is = (inner.match(/<is>[\s\S]*?<t[^>]*>([\s\S]*?)<\/t>[\s\S]*?<\/is>/) || [])[1];
          let val = is != null ? unesc(is) : v == null ? '' : t === 's' ? (shared[+v] ?? '') : unesc(v);
          if (t !== 's' && is == null && val !== '' && !isNaN(val)) val = +val;
          cells[ref ? colIdx(ref) : cells.length] = val;
        }
        return cells;
      });
      const nomeAba = nomes[si] || 'Aba' + (si + 1);
      if (!linhas.length) { abas.push({ nome: nomeAba, headers: [], rows: [], blocos: [], matriz: [] }); return; }
      /* 10.E.2.3 — a aba inteira é segmentada em blocos (título, cabeçalho real,
         linha consolidada, linhas diárias, tabelas internas). O primeiro bloco
         alimenta headers/rows (compatível com o fluxo antigo); todos ficam em blocos. */
      const blocos = segmentBlocks(linhas);
      const b0 = blocos[0] || { headers: [], rows: [] };
      abas.push({ nome: nomeAba, headers: b0.headers.slice(), rows: b0.rows.slice(), blocos, matriz: linhas });
    });
    return abas;
  }

  /* ---------------- porta de entrada: um arquivo local → objeto do motor ---------------- */
  async function readLocalFile(fileLike) {
    const nome = fileLike.name, tamanho = fileLike.size;
    const meta = validateMeta(nome, tamanho, fileLike.type);
    if (!meta.ok) return { nome, tamanho, erro: meta.motivo, estado: 'RECUSADO' };
    const buf = new Uint8Array(await fileLike.arrayBuffer());

    if (meta.ext === '.csv') {
      const aba = parseCsvText(new TextDecoder().decode(buf));
      return { nome, tamanho, formato: 'csv', abas: [{ nome: 'csv', headers: aba.headers, rows: aba.rows }] };
    }
    if (meta.ext === '.xls') {
      /* BIFF binário: honestidade — o sistema não finge que entendeu */
      if (buf[0] === 0xD0 && buf[1] === 0xCF)
        return { nome, tamanho, formato: 'xls', erro: 'XLS binário (formato antigo) ainda não é lido — exporte como XLSX ou CSV. Nada foi importado.', estado: 'AGUARDANDO_MAPEAMENTO' };
      /* alguns exports "xls" são XLSX ou CSV renomeados — tentamos com transparência */
      if (buf[0] === 0x50 && buf[1] === 0x4B) return { nome, tamanho, formato: 'xlsx', abas: await parseXlsxBuffer(buf) };
      const aba = parseCsvText(new TextDecoder().decode(buf));
      if (aba.headers.length > 1) return { nome, tamanho, formato: 'csv', abas: [{ nome: 'csv', headers: aba.headers, rows: aba.rows }] };
      return { nome, tamanho, erro: 'conteúdo do .xls não reconhecido — exporte como XLSX ou CSV', estado: 'AGUARDANDO_MAPEAMENTO' };
    }
    if (meta.ext === '.xlsx') {
      if (!(buf[0] === 0x50 && buf[1] === 0x4B)) return { nome, tamanho, erro: 'arquivo não é um XLSX válido (assinatura ZIP ausente)', estado: 'RECUSADO' };
      return { nome, tamanho, formato: 'xlsx', abas: await parseXlsxBuffer(buf) };
    }
    /* .zip: cada entrada reconhecida (xlsx/csv) vira planilha; o resto é declarado */
    const files = await unzip(buf);
    const entries = [];
    for (const [en, data] of Object.entries(files)) {
      const low = en.toLowerCase();
      try {
        if (low.endsWith('.xlsx')) entries.push({ nome: en, abas: await parseXlsxBuffer(data) });
        else if (low.endsWith('.csv')) {
          const aba = parseCsvText(new TextDecoder().decode(data));
          entries.push({ nome: en, abas: [{ nome: 'csv', headers: aba.headers, rows: aba.rows }] });
        } else entries.push({ nome: en, motivo: 'não é planilha reconhecida (XLSX/CSV) — permanece no ZIP original, não importada' });
      } catch (e) { entries.push({ nome: en, motivo: 'falha ao abrir: ' + e.message }); }
    }
    return { nome, tamanho, formato: 'zip', zip: true, entries };
  }

  return { MAX_BYTES, EXTS, validateMeta, parseCsvText, unzip, parseXlsxBuffer, readLocalFile,
    /* 10.E.2.3 — leitura multiabas/multiblocos e números brasileiros */
    parseBrNumber, segmentBlocks };
}));
