/* Namespace compartilhado do MIE.
   Todos os módulos se registram aqui — funciona em Node (require) e no
   navegador (tags <script> em ordem), sem bundler e sem dependências. */
'use strict';
module.exports = globalThis.MIE = globalThis.MIE || {};
