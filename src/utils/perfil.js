// src/utils/perfil.js
function isPerfilIncompleto(u) {
  // ⚠️ Regras obrigatórias (mantendo datas-only “YYYY-MM-DD”)
  const obrigatorios = [
    "cargo_id",
    "unidade_id",
    "data_nascimento",
    "genero_id",
    "orientacao_sexual_id",
    "cor_raca_id",
    "escolaridade_id",
    "deficiencia_id",
  ];
  for (const k of obrigatorios) {
    if (u?.[k] === null || u?.[k] === undefined) return true;
  }
  return false;
}

module.exports = { isPerfilIncompleto };
