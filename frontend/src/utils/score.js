// 📁 src/utils/score.js — PREMIUM++

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
 * @param {number[]} [opts.pesos]         - pesos por critério (mesmo length de criteriosEsperados). Default: todos = 1
 * @param {number}   [opts.escalamax=10]  - escala final (10 mantém compat)
 * @param {number}   [opts.casas=1]       - casas decimais na média final
 * @param {boolean}  [opts.clamp=true]    - força notas para intervalo [0,5]
 * @returns {{
 *   media10: number,
 *   recebidas: number,
 *   esperadas: number,
 *   criterios: number,
 *   status: 'sem-avaliacao'|'parcial'|'completa',
 *   soma: number,
 *   denom: number,
 *   detalhes: {
 *     porAvaliador: Array<{ idx: number, notasValidas: number, soma5: number, denom: number }>,
 *     porCriterio: Array<{ idx: number, soma5: number, count: number }>
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
    escalamax = 10,
    casas = 1,
    clamp = true,
  } = opts || {};

  const critCount =
    Number.isFinite(criteriosEsperados) && criteriosEsperados > 0
      ? Math.floor(criteriosEsperados)
      : 4;

  const pesos =
    Array.isArray(pesosOpt) && pesosOpt.length > 0
      ? Array.from({ length: critCount }, (_, i) => {
          const w = Number(pesosOpt[i] ?? 1);
          return Number.isFinite(w) && w > 0 ? w : 1;
        })
      : Array.from({ length: critCount }, () => 1);

  const toScore5 = (n) => {
    const num = Number(n);
    if (!Number.isFinite(num)) return null;

    const val = clamp ? Math.max(0, Math.min(5, num)) : num;
    return Number.isFinite(val) ? val : null;
  };

  function notasDeAvaliador(av) {
    const arr = new Array(critCount).fill(null);
    if (!av) return arr;

    if (Array.isArray(av.criterios)) {
      for (let i = 0; i < Math.min(critCount, av.criterios.length); i++) {
        arr[i] = toScore5(av.criterios[i]?.nota);
      }
      return arr;
    }

    for (let i = 0; i < critCount; i++) {
      const k = `nota${i + 1}`;
      if (k in av) arr[i] = toScore5(av[k]);
    }

    return arr;
  }

  const detalhesPorAvaliador = [];
  const detalhesPorCriterio = Array.from({ length: critCount }, () => ({
    soma5: 0,
    count: 0,
  }));

  let recebidas = 0;
  let soma5Total = 0;
  let denomTotal = 0;

  const lista = Array.isArray(avaliacao) ? avaliacao : [];

  for (let idx = 0; idx < lista.length; idx++) {
    const notas = notasDeAvaliador(lista[idx]);
    const temValida = notas.some((n) => n !== null);

    if (!temValida) {
      detalhesPorAvaliador.push({
        idx,
        notasValidas: 0,
        soma5: 0,
        denom: 0,
      });
      continue;
    }

    recebidas++;

    let somaAv5 = 0;
    let notasValidas = 0;
    let denomAv = 0;

    for (let c = 0; c < critCount; c++) {
      const n = notas[c];
      if (n === null) continue;

      const w = pesos[c];
      const add = n * w;

      somaAv5 += add;
      soma5Total += add;
      denomAv += w;
      denomTotal += w;

      detalhesPorCriterio[c].soma5 += n;
      detalhesPorCriterio[c].count += 1;
      notasValidas++;
    }

    detalhesPorAvaliador.push({
      idx,
      notasValidas,
      soma5: somaAv5,
      denom: denomAv,
    });
  }

  const media5 = denomTotal > 0 ? soma5Total / denomTotal : 0;
  const fator = escalamax / 5;
  const pow = Math.pow(10, casas);
  const mediaEscala = Math.round(media5 * fator * pow) / pow;

  const esperadas =
    Number.isFinite(avaliadoresEsperados) && avaliadoresEsperados > 0
      ? Math.floor(avaliadoresEsperados)
      : 2;

  const status =
    recebidas === 0
      ? "sem-avaliacao"
      : recebidas < esperadas
      ? "parcial"
      : "completa";

  return {
    media10: mediaEscala,
    recebidas,
    esperadas,
    criterios: critCount,
    status,
    soma: soma5Total,
    denom: denomTotal,
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
 * Açúcar sintático: mesmas entradas, mas retorna a média em 0..5
 * ------------------------------------------------------------------ */
export function computeMedia5(
  avaliacao = [],
  criteriosEsperados = 4,
  avaliadoresEsperados = 2,
  opts = {}
) {
  return computeMedia10(avaliacao, criteriosEsperados, avaliadoresEsperados, {
    ...opts,
    escalamax: 5,
  });
}