/* =============================================================
   PRODUCTION FOUNDATION (10.D) · storage + parsers
   Upload real de XLSX/CSV (ZIP/PDF aceitos como referência):
   validação de extensão e MIME, limite de tamanho, rejeição de
   executável, sha256 persistente, conteúdo endereçado por hash
   (nunca sobrescreve), URL assinada em vez de caminho público.
   Parser CSV nativo + leitor XLSX mínimo (zip + sharedStrings),
   sem dependências externas.
   ============================================================= */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const { uid, sha256 } = require('./core.js');

const EXT_OK = { '.xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/zip'],
  '.csv': ['text/csv', 'application/csv', 'text/plain'], '.zip': ['application/zip'], '.pdf': ['application/pdf'] };
const MAX_BYTES = 25 * 1024 * 1024;

function createStorage(db, cfg, audit) {
  return {
    save({ buffer, filename, mime, userId, escopo }) {
      const ext = path.extname(String(filename)).toLowerCase();
      if (!EXT_OK[ext]) throw new Error('extensão não permitida: ' + (ext || '(sem extensão)') + ' — aceitos: xlsx, csv, zip, pdf');
      if (!EXT_OK[ext].includes(mime)) throw new Error('MIME não corresponde à extensão: ' + mime);
      if (buffer.length > MAX_BYTES) throw new Error('arquivo acima do limite de 25MB');
      if (buffer.slice(0, 2).toString() === 'MZ') throw new Error('executável rejeitado');
      if (ext === '.xlsx' && buffer.slice(0, 2).toString() !== 'PK') throw new Error('xlsx inválido (não é um pacote zip)');
      const hash = sha256(buffer);
      const dir = path.join(cfg.storageDir, hash.slice(0, 2));
      fs.mkdirSync(dir, { recursive: true });
      const storagePath = path.join(dir, hash + ext);
      if (!fs.existsSync(storagePath)) fs.writeFileSync(storagePath, buffer); /* conteúdo-endereçado: nunca sobrescreve */
      const f = { id: uid('file'), sha256: hash, storagePath };
      db.prepare(`INSERT INTO files(id, original_filename, mime_type, size, sha256, uploaded_by, uploaded_at,
        group_id, company_id, store_id, account_id, storage_path)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(sha256) DO UPDATE SET id = files.id`).run(
        f.id, filename, mime, buffer.length, hash, userId || null, new Date().toISOString(),
        escopo.groupId || null, escopo.companyId || null, escopo.storeId || null, escopo.accountId || null, storagePath);
      const row = db.prepare('SELECT id FROM files WHERE sha256 = ?').get(hash);
      audit.record({ userId, ...escopo, action: 'arquivo_armazenado', detalhe: `${filename} (${hash.slice(0, 12)}…)` });
      return { fileId: row.id, sha256: hash, storagePath, duplicado: row.id !== f.id };
    },
    /* URL assinada com expiração — arquivo privado nunca sai por caminho público */
    signedUrl(fileId, minutos) {
      const exp = Date.now() + (minutos || 15) * 60000;
      const sig = crypto.createHmac('sha256', cfg.secret).update(fileId + '|' + exp).digest('base64url');
      return `/files/${fileId}?exp=${exp}&sig=${sig}`;
    },
    verifySignedUrl(fileId, exp, sig) {
      if (Date.now() > +exp) return false;
      const esperado = crypto.createHmac('sha256', cfg.secret).update(fileId + '|' + exp).digest('base64url');
      return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(esperado));
    },
    read(fileId) {
      const f = db.prepare('SELECT * FROM files WHERE id = ?').get(fileId);
      if (!f) throw new Error('arquivo não encontrado');
      return { meta: f, buffer: fs.readFileSync(f.storage_path) };
    },
  };
}

/* ---------------- CSV parser (RFC-ish, sem dependências) ---------------- */
function parseCsv(text) {
  const rows = []; let row = [], cell = '', q = false;
  const s = String(text).replace(/^﻿/, '');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { if (c === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === ',' || c === ';') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && s[i + 1] === '\n') i++; row.push(cell); cell = ''; if (row.some(x => x !== '')) rows.push(row); row = []; }
    else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); if (row.some(x => x !== '')) rows.push(row); }
  if (!rows.length) return { headers: [], rows: [] };
  const headers = rows[0].map(h => h.trim());
  return { headers, rows: rows.slice(1).map(r => Object.fromEntries(headers.map((h, i) => [h, r[i] !== undefined ? r[i] : '']))) };
}

/* ---------------- leitor XLSX mínimo (ZIP + sharedStrings + sheet1) ---------------- */
function unzipEntries(buf) {
  const out = {};
  /* varre assinaturas de entrada local PK\x03\x04 */
  let i = 0;
  while ((i = buf.indexOf('PK\x03\x04', i)) !== -1) {
    const method = buf.readUInt16LE(i + 8);
    const compSize = buf.readUInt32LE(i + 18);
    const nameLen = buf.readUInt16LE(i + 26);
    const extraLen = buf.readUInt16LE(i + 28);
    const name = buf.slice(i + 30, i + 30 + nameLen).toString();
    const dataStart = i + 30 + nameLen + extraLen;
    const data = buf.slice(dataStart, dataStart + compSize);
    try { out[name] = method === 8 ? zlib.inflateRawSync(data) : data; } catch (e) { /* streaming entry — ignora */ }
    i = dataStart + compSize;
  }
  return out;
}
function parseXlsx(buf) {
  const entries = unzipEntries(buf);
  const shared = [];
  if (entries['xl/sharedStrings.xml'])
    for (const m of entries['xl/sharedStrings.xml'].toString().matchAll(/<si>(?:<t[^>]*>([\s\S]*?)<\/t>|([\s\S]*?))<\/si>/g))
      shared.push((m[1] !== undefined ? m[1] : (m[2] || '').replace(/<[^>]+>/g, '')).replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'));
  const sheetName = Object.keys(entries).find(k => /^xl\/worksheets\/sheet1\.xml$/.test(k)) ||
    Object.keys(entries).find(k => /^xl\/worksheets\/sheet\d+\.xml$/.test(k));
  if (!sheetName) throw new Error('xlsx sem planilha legível');
  const xml = entries[sheetName].toString();
  const linhas = [];
  for (const rm of xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells = {};
    for (const cm of rm[1].matchAll(/<c r="([A-Z]+)\d+"(?:[^>]*t="(\w+)")?[^>]*>(?:<v>([\s\S]*?)<\/v>|<is><t[^>]*>([\s\S]*?)<\/t><\/is>)?/g)) {
      const col = cm[1];
      let val = cm[4] !== undefined ? cm[4] : cm[3];
      if (cm[2] === 's' && val !== undefined) val = shared[+val];
      cells[col] = val !== undefined ? val : '';
    }
    linhas.push(cells);
  }
  if (!linhas.length) return { headers: [], rows: [] };
  const cols = [...new Set(linhas.flatMap(l => Object.keys(l)))].sort((a, b) => a.length - b.length || (a < b ? -1 : 1));
  const headers = cols.map(c => String(linhas[0][c] ?? '').trim()).filter(h => h !== '');
  const colByHeader = cols.slice(0, headers.length);
  return { headers, rows: linhas.slice(1).map(l => Object.fromEntries(headers.map((h, i) => [h, l[colByHeader[i]] ?? '']))) };
}

/* escreve um XLSX mínimo (para testes e modelos de arquivo) */
function buildXlsx(headers, rows) {
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const rowXml = (vals, r) => `<row r="${r}">` + vals.map((v, i) => {
    const col = String.fromCharCode(65 + i);
    return typeof v === 'number' ? `<c r="${col}${r}"><v>${v}</v></c>` : `<c r="${col}${r}" t="inlineStr"><is><t>${esc(v)}</t></is></c>`;
  }).join('') + '</row>';
  const sheet = `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>` +
    rowXml(headers, 1) + rows.map((r, i) => rowXml(headers.map(h => r[h] ?? ''), i + 2)).join('') + '</sheetData></worksheet>';
  const files = {
    '[Content_Types].xml': `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`,
    '_rels/.rels': `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    'xl/workbook.xml': `<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
    'xl/worksheets/sheet1.xml': sheet,
  };
  /* zip STORED (sem compressão) — suficiente e determinístico */
  const chunks = []; const central = []; let offset = 0;
  const crcTable = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = b => { let c = 0xFFFFFFFF; for (const x of b) c = crcTable[(c ^ x) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  for (const [name, content] of Object.entries(files)) {
    const data = Buffer.from(content);
    const nameB = Buffer.from(name);
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.write('PK\x03\x04'); local.writeUInt16LE(20, 4); local.writeUInt16LE(0, 8);
    local.writeUInt32LE(crc, 14); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameB.length, 26);
    chunks.push(local, nameB, data);
    const cen = Buffer.alloc(46);
    cen.write('PK\x01\x02'); cen.writeUInt16LE(20, 4); cen.writeUInt16LE(20, 6);
    cen.writeUInt32LE(crc, 16); cen.writeUInt32LE(data.length, 20); cen.writeUInt32LE(data.length, 24);
    cen.writeUInt16LE(nameB.length, 28); cen.writeUInt32LE(offset, 42);
    central.push(Buffer.concat([cen, nameB]));
    offset += local.length + nameB.length + data.length;
  }
  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.write('PK\x05\x06'); end.writeUInt16LE(central.length, 8); end.writeUInt16LE(central.length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...chunks, cd, end]);
}

module.exports = { createStorage, parseCsv, parseXlsx, buildXlsx, EXT_OK, MAX_BYTES };
