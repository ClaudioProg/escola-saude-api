// 📁 src/utils/score.js
/** 
 * avaliacoes: Array<{
 *   criterios: Array<{ nota: number | null | undefined }>
 *   // ou flatten: { nota1, nota2, ... } -> também suportado
 * }>
 * criteriosEsperados: number (ex.: 4)
 * avaliadoresEsperados: number (ex.: 2)
 */
export function computeMedia10(avaliacoes = [], criteriosEsperados = 4, avaliadoresEsperados = 2) {
    // coleta todas as notas válidas de todos os avaliadores
    const notas = [];
    for (const av of avaliacoes || []) {
      if (Array.isArray(av?.criterios)) {
        for (const c of av.criterios) {
          const n = Number(c?.nota);
          if (!Number.isNaN(n)) notas.push(Math.max(0, Math.min(5, n)));
        }
      } else {
        // fallback: campos soltos nota1..notaN
        Object.keys(av || {}).forEach((k) => {
          if (/^nota\d+$/i.test(k)) {
            const n = Number(av[k]);
            if (!Number.isNaN(n)) notas.push(Math.max(0, Math.min(5, n)));
          }
        });
      }
    }
  
    const recebidas = Math.max(
      ...avaliacoes.map((av) => {
        // considera "entregue" se há ao menos 1 nota válida neste avaliador
        if (!av) return 0;
        const temNota = Array.isArray(av?.criterios)
          ? av.criterios.some((c) => c && Number(c.nota) >= 0)
          : Object.keys(av).some((k) => /^nota\d+$/i.test(k) && Number(av[k]) >= 0);
        return temNota ? 1 : 0;
      }),
      0
    );
  
    // soma total das notas obtidas (cada nota é 1..5)
    const soma = notas.reduce((acc, n) => acc + n, 0);
  
    // denominador: qtdCritérios * avaliadoresQueEntregaram
    const critCount = criteriosEsperados > 0 ? criteriosEsperados : 4;
    const denom = critCount * (recebidas || 1); // evita div/0 quando for tudo vazio
  
    // média em 0..5 e escala para 0..10
    const media5 = denom > 0 ? soma / denom : 0;
    const media10 = Math.round(media5 * 10 * 10) / 10; // 1 casa (ex.: 8.7)
  
    // status da avaliação
    const status =
      recebidas === 0
        ? "sem-avaliacao"
        : recebidas < (avaliadoresEsperados || 2)
        ? "parcial"
        : "completa";
  
    return {
      media10,
      recebidas,
      esperadas: avaliadoresEsperados || 2,
      criterios: critCount,
      status,
      soma, // soma bruta (1..5 * crit * avaliadores)
    };
  }
  