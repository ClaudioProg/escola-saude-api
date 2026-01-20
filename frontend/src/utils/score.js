// 📁 src/utils/score.js

/**
 * Tipo esperado (flexível):
 * avaliacao: Array<{
 *   criterios?: Array<{ nota: number | null | undefined }>
 *   // OU flatten: { nota1?: number, nota2?: number, ... }
 * }>
 *
 * @param {Array<object>} avaliacao
 * @param {number} criteriosEsperados - ex.: 4
 * @param {number} avaliadoresEsperados - ex.: 2
 * @param {object} [opts]
 * @param {number[]} [opts.pesos]        - pesos por critério (mesmo length de criteriosEsperados). Default: todos = 1
 * @param {number}   [opts.escalamax=10] - escala final (10 mantém compat)
 * @param {number}   [opts.casas=1]      - casas decimais na média final
 * @param {boolean}  [opts.clamp=true]   - força notas para intervalo [0,5]
 * @returns {{
*   media10: number,              // média na escala 'escalamax' (default 10)
*   recebidas: number,            // avaliadores com ao menos 1 nota válida
*   esperadas: number,            // avaliadoresEsperados
*   criterios: number,            // criteriosEsperados efetivo
*   status: 'sem-avaliacao'|'parcial'|'completa',
*   soma: number,                 // soma bruta na escala 0..5 aplicada a pesos
*   denom: number,                // denominador efetivo (∑pesos * recebidas)
*   detalhes: {                   // útil para dashboards
*     porAvaliador: Array<{ idx: number, notasValidas: number, soma5: number }>,
*     porCriterio:  Array<{ idx: number, soma5: number, count: number }>
*   }
* }}
*/
export function computeMedia10(
 avaliacao = [],
 criteriosEsperados = 4,
 avaliadoresEsperados = 2,
 opts = {}
) {
 const {
   pesos: pesosOpt,
   escalamax = 10,  // mantém nome “media10”, mas permite outra escala
   casas = 1,
   clamp = true,
 } = opts || {};

 const critCount = Number.isFinite(criteriosEsperados) && criteriosEsperados > 0
   ? Math.floor(criteriosEsperados)
   : 4;

 // monta pesos (default = 1)
 const pesos = Array.isArray(pesosOpt) && pesosOpt.length > 0
   ? Array.from({ length: critCount }, (_, i) => {
       const w = Number(pesosOpt[i] ?? 1);
       return Number.isFinite(w) && w > 0 ? w : 1;
     })
   : Array.from({ length: critCount }, () => 1);

 const somaPesos = pesos.reduce((a, b) => a + b, 0);

 // helper de clamp 0..5
 const toScore5 = (n) => {
   const num = Number(n);
   if (!Number.isFinite(num)) return null;
   const val = clamp ? Math.max(0, Math.min(5, num)) : num;
   // ainda assim rejeita fora da faixa se clamp=false mas veio inválido
   return Number.isFinite(val) ? val : null;
 };

 // extrai notas de um avaliador, devolvendo array length = critCount (com null onde não veio)
 function notasDeAvaliador(av) {
   const arr = new Array(critCount).fill(null);
   if (!av) return arr;

   if (Array.isArray(av.criterios)) {
     for (let i = 0; i < Math.min(critCount, av.criterios.length); i++) {
       arr[i] = toScore5(av.criterios[i]?.nota);
     }
     return arr;
   }

   // flatten: nota1..notaN
   for (let i = 0; i < critCount; i++) {
     const k = `nota${i + 1}`;
     if (k in av) arr[i] = toScore5(av[k]);
   }
   return arr;
 }

 // agrega
 const detalhesPorAvaliador = [];
 const detalhesPorCriterio = Array.from({ length: critCount }, () => ({ soma5: 0, count: 0 }));

 let recebidas = 0;   // avaliadores que entregaram ao menos 1 nota válida
 let soma5Total = 0;  // soma ponderada (0..5) de TUDO

 for (let idx = 0; idx < (avaliacao?.length || 0); idx++) {
   const notas = notasDeAvaliador(avaliacao[idx]);

   // checa se entregou algo válido
   const temValida = notas.some((n) => n !== null);
   if (!temValida) {
     detalhesPorAvaliador.push({ idx, notasValidas: 0, soma5: 0 });
     continue;
   }

   recebidas++;

   // soma ponderada deste avaliador
   let somaAv5 = 0;
   let notasValidas = 0;

   for (let c = 0; c < critCount; c++) {
     const n = notas[c];
     if (n === null) continue;
     const w = pesos[c];
     const add = n * w;
     somaAv5 += add;
     soma5Total += add;

     detalhesPorCriterio[c].soma5 += n;
     detalhesPorCriterio[c].count += 1;
     notasValidas++;
   }

   detalhesPorAvaliador.push({ idx, notasValidas, soma5: somaAv5 });
 }

 // denominador: somaPesos * recebidas (mantém compat; em pesos uniformes vira critCount * recebidas)
 const denom = somaPesos * (recebidas || 1); // evita div/0 → assume 1 avaliador p/ média = 0

 // média na escala 0..5
 const media5 = denom > 0 ? (soma5Total / denom) : 0;

 // converte para escala solicitada (default 10) e arredonda
 const fator = escalamax / 5; // 10/5 = 2 mantém legado
 const pow = Math.pow(10, casas);
 const mediaEscala = Math.round(media5 * fator * pow) / pow;

 // status
 const esperadas = Number.isFinite(avaliadoresEsperados) && avaliadoresEsperados > 0
   ? Math.floor(avaliadoresEsperados)
   : 2;

 const status =
   recebidas === 0
     ? "sem-avaliacao"
     : recebidas < esperadas
     ? "parcial"
     : "completa";

 return {
   media10: mediaEscala,           // mantém o nome para compat (é a média na escala pedida)
   recebidas,
   esperadas,
   criterios: critCount,
   status,
   soma: soma5Total,               // soma bruta (já ponderada) na escala 0..5
   denom,                          // denominador efetivo
   detalhes: {
     porAvaliador: detalhesPorAvaliador,
     porCriterio: detalhesPorCriterio.map((x, c) => ({
       idx: c,
       soma5: x.soma5,
       count: x.count,
     })),
   },
 };
}

/* ------------------------------------------------------------------
* Azucar sintático: mesmas entradas, mas retorna a média em 0..5
* (útil para estrelas, gauges etc.)
* ------------------------------------------------------------------ */
export function computeMedia5(
 avaliacao = [],
 criteriosEsperados = 4,
 avaliadoresEsperados = 2,
 opts = {}
) {
 const r = computeMedia10(avaliacao, criteriosEsperados, avaliadoresEsperados, {
   ...opts,
   escalamax: 5,
 });
 return r;
}
