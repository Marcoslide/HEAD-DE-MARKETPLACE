/* Kernel · IDs — identificadores ordenáveis no tempo (estilo ULID).
   Prefixo por entidade para legibilidade em logs e debugging. */
'use strict';

let counter = 0;
function newId(prefix) {
  const t = Date.now().toString(36);
  const c = (++counter % 1296).toString(36).padStart(2, '0');
  const r = Math.floor(Math.random() * 1679616).toString(36).padStart(4, '0');
  return `${prefix}_${t}${c}${r}`;
}

module.exports = { newId };
