// 📁 src/utils/tempo.js
// Datas-only (“YYYY-MM-DD”) e horas “HH:mm” — sem fuso/Date.
const ymd = (s) => (typeof s === "string" ? s.slice(0,10) : "");
const hhmm = (s) => (typeof s === "string" ? s.slice(0,5) : "");

export function rangesDeDatasSobrepoem(aIni, aFim, bIni, bFim) {
  const ai = ymd(aIni), af = ymd(aFim), bi = ymd(bIni), bf = ymd(bFim);
  if (!ai || !af || !bi || !bf) return false;
  return !(af < bi || bf < ai);
}
export function horasSobrepoem(h1i, h1f, h2i, h2f) {
  const A = hhmm(h1i), B = hhmm(h1f), C = hhmm(h2i), D = hhmm(h2f);
  if (!A || !B || !C || !D) return false;
  // Regra: (A < D) && (C < B)
  return A < D && C < B;
}
export function turmasConflitam(t1, t2) {
  return (
    rangesDeDatasSobrepoem(t1.data_inicio, t1.data_fim, t2.data_inicio, t2.data_fim) &&
    horasSobrepoem(t1.horario_inicio, t1.horario_fim, t2.horario_inicio, t2.horario_fim)
  );
}
