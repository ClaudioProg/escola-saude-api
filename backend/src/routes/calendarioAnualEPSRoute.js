"use strict";

/**
 * ✅ backend/src/routes/calendarioAnualEPSRoute.js — v2.0
 * Atualizado em: 18/05/2026
 *
 * Plataforma Escola da Saúde
 *
 * Módulo:
 * - Calendário Anual de EPS.
 *
 * Função:
 * - Rotas oficiais para cadastro, listagem, atualização e exclusão de programações de EPS.
 * - Listagem de departamentos oficiais.
 * - Listagem de tipos já cadastrados.
 * - Resumo mensal por departamento.
 * - Resumo anual por departamento.
 *
 * Importante:
 * - Este módulo NÃO é a nova página de cursos online.
 * - Este módulo substitui conceitualmente a antiga "Solicitação de Cursos".
 * - O departamento não é campo livre: deve vir da lista oficial.
 *
 * Mount oficial recomendado:
 * - app.use("/api/calendario-eps", calendarioAnualEPSRoute);
 *
 * Contratos oficiais:
 * - GET    /api/calendario-eps
 * - GET    /api/calendario-eps/departamentos
 * - GET    /api/calendario-eps/tipos
 * - GET    /api/calendario-eps/resumo-mensal?ano=2026&mes=5
 * - GET    /api/calendario-eps/resumo-anual?ano=2026
 * - POST   /api/calendario-eps
 * - PUT    /api/calendario-eps/:id
 * - DELETE /api/calendario-eps/:id
 *
 * Diretrizes v2.0:
 * - sem compatibilidade resiliente;
 * - sem aliases de middleware;
 * - sem resposta { erro };
 * - sem rota plural paralela;
 * - sem PATCH duplicando PUT;
 * - sem rota antiga paralela de solicitação de curso;
 * - autenticação obrigatória;
 * - cache no-store por tratar de programação institucional.
 */

const express = require("express");

const authMiddleware = require("../auth/authMiddleware");
const calendarioAnualEPSController = require("../controllers/calendarioAnualEPSController");

const router = express.Router();

const {
  listarProgramacao,
  listarDepartamentos,
  listarTipos,
  criarProgramacao,
  atualizarProgramacao,
  excluirProgramacao,
  resumoMensal,
  resumoAnual,
} = calendarioAnualEPSController;

/* =========================================================================
   Validação estrutural de imports
=========================================================================== */

if (typeof authMiddleware !== "function") {
  throw new Error(
    "[calendarioAnualEPSRoute] authMiddleware inválido. O export oficial de ../auth/authMiddleware deve ser uma função."
  );
}

for (const [nome, handler] of Object.entries({
  listarProgramacao,
  listarDepartamentos,
  listarTipos,
  criarProgramacao,
  atualizarProgramacao,
  excluirProgramacao,
  resumoMensal,
  resumoAnual,
})) {
  if (typeof handler !== "function") {
    throw new Error(
      `[calendarioAnualEPSRoute] Controller inválido. Função ausente: ${nome}.`
    );
  }
}

/* =========================================================================
   Helpers
=========================================================================== */

function wrap(handler) {
  return async function wrappedHandler(req, res, next) {
    try {
      await handler(req, res, next);
    } catch (error) {
      next(error);
    }
  };
}

function gerarRequestId() {
  return `cal-eps-route-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function validarIdParam(req, res, next) {
  const requestId = gerarRequestId();
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({
      ok: false,
      data: null,
      message: "ID inválido.",
      code: "ID_INVALIDO",
      adminHint: "O parâmetro :id deve ser um número inteiro positivo.",
      details: {
        param: "id",
        value: req.params.id,
      },
      requestId,
    });
  }

  req.params.id = String(id);
  return next();
}

function validarResumoMensalQuery(req, res, next) {
  const requestId = gerarRequestId();
  const ano = Number(req.query.ano);
  const mes = Number(req.query.mes);

  if (!Number.isInteger(ano) || ano < 2000 || ano > 2100) {
    return res.status(400).json({
      ok: false,
      data: null,
      message: "Informe um ano válido para o resumo mensal.",
      code: "ANO_INVALIDO",
      adminHint: "O parâmetro ano deve ser um número inteiro entre 2000 e 2100.",
      details: {
        param: "ano",
        value: req.query.ano,
      },
      requestId,
    });
  }

  if (!Number.isInteger(mes) || mes < 1 || mes > 12) {
    return res.status(400).json({
      ok: false,
      data: null,
      message: "Informe um mês válido para o resumo mensal.",
      code: "MES_INVALIDO",
      adminHint: "O parâmetro mes deve ser um número inteiro entre 1 e 12.",
      details: {
        param: "mes",
        value: req.query.mes,
      },
      requestId,
    });
  }

  return next();
}

function validarResumoAnualQuery(req, res, next) {
  const requestId = gerarRequestId();
  const ano = Number(req.query.ano);

  if (!Number.isInteger(ano) || ano < 2000 || ano > 2100) {
    return res.status(400).json({
      ok: false,
      data: null,
      message: "Informe um ano válido para o resumo anual.",
      code: "ANO_INVALIDO",
      adminHint: "O parâmetro ano deve ser um número inteiro entre 2000 e 2100.",
      details: {
        param: "ano",
        value: req.query.ano,
      },
      requestId,
    });
  }

  return next();
}

function noStore(_req, res, next) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
  return next();
}

/* =========================================================================
   Middlewares globais
=========================================================================== */

router.use(authMiddleware);
router.use(noStore);

/* =========================================================================
   Rotas oficiais
=========================================================================== */

/**
 * Lista programações do Calendário Anual de EPS visíveis ao usuário logado.
 *
 * Administrador:
 * - visualiza todas.
 *
 * Usuário comum:
 * - visualiza apenas as próprias programações.
 *
 * Filtros opcionais:
 * - ?departamento=DEAPS
 * - ?status=planejado
 */
router.get("/", wrap(listarProgramacao));

/**
 * Lista departamentos oficiais do Calendário Anual de EPS.
 *
 * Uso principal:
 * - popular lista suspensa/select no frontend.
 */
router.get("/departamentos", wrap(listarDepartamentos));

/**
 * Lista tipos já cadastrados para uso em select/autocomplete.
 */
router.get("/tipos", wrap(listarTipos));

/**
 * Gera resumo mensal por departamento.
 *
 * Exemplo:
 * - /api/calendario-eps/resumo-mensal?ano=2026&mes=5
 */
router.get(
  "/resumo-mensal",
  validarResumoMensalQuery,
  wrap(resumoMensal)
);

/**
 * Gera resumo anual por departamento.
 *
 * Exemplo:
 * - /api/calendario-eps/resumo-anual?ano=2026
 */
router.get(
  "/resumo-anual",
  validarResumoAnualQuery,
  wrap(resumoAnual)
);

/**
 * Cria nova programação de EPS.
 *
 * Regras principais:
 * - departamento obrigatório;
 * - departamento deve ser oficial;
 * - ao menos uma data obrigatória;
 * - título obrigatório.
 */
router.post("/", wrap(criarProgramacao));

/**
 * Atualiza programação existente.
 */
router.put("/:id", validarIdParam, wrap(atualizarProgramacao));

/**
 * Exclui programação existente.
 *
 * Observação:
 * - no controller atual ainda é exclusão física;
 * - se quisermos preservar histórico institucional depois, o próximo passo será
 *   transformar em cancelamento lógico/status, sem manter rota paralela.
 */
router.delete("/:id", validarIdParam, wrap(excluirProgramacao));

module.exports = router;