/* eslint-disable no-console */
"use strict";

/**
 * ✅ backend/src/controllers/eventoAdminController.js — v2.1
 * Atualizado em: 18/05/2026
 * Plataforma Escola da Saúde
 *
 * Controller administrativo de eventos.
 *
 * Responsabilidades:
 * - listar eventos para administração;
 * - criar evento;
 * - atualizar evento;
 * - excluir evento sem apagar histórico operacional;
 * - publicar/despublicar evento;
 * - atualizar folder e programação;
 * - vincular turmas, datas, organizadores, palestrantes e assinantes;
 * - preservar integridade documental e operacional.
 *
 * Contratos oficiais:
 * - req.user.perfil === "administrador";
 * - folder persistido em eventos.folder_blob;
 * - programação PDF persistida em eventos.programacao_pdf_blob;
 * - upload oficial:
 *   - folder
 *   - programacao
 * - tabela oficial de datas: datas_turma;
 * - tabela oficial de responsáveis: turma_responsavel;
 * - tabela oficial de palestrantes: turma_palestrante;
 * - tabela oficial de assinantes: turma_certificado_assinante;
 * - organizador obrigatório: turma_responsavel.papel = 'organizador';
 * - palestrante opcional: turma_palestrante.nome;
 * - assinante obrigatório: Rafaella Pitol, ID 17;
 * - Fábio Lopez, ID 2474, opcional e último quando selecionado;
 * - sem organizador_assinante_id;
 * - sem is_assinante;
 * - sem ordem_assinatura em vínculo de responsável;
 * - sem upload legado pelo campo "file";
 * - sem fallback de schema;
 * - sem aliases de payload;
 * - sem exclusão automática de inscrições/presenças/certificados em edição comum.
 */

const path = require("path");
const multer = require("multer");

const db = require("../db");
const { normalizeListaRegistros } = require("../utils/registro");

if (
  !db ||
  typeof db.query !== "function" ||
  typeof db.getClient !== "function"
) {
  throw new Error(
    "[eventoAdminController] Contrato inválido: ../db deve exportar db.query e db.getClient."
  );
}

const IS_DEV = process.env.NODE_ENV !== "production";

/* ───────────────────────────────────────────────────────────────
   Constantes
─────────────────────────────────────────────────────────────── */

const PERFIL_ADMINISTRADOR = "administrador";

const MODO_TODOS = "todos_servidores";
const MODO_LISTA = "lista_registros";

const PAPEL_ORGANIZADOR = "organizador";

const RAFAELLA_PITOL_ID = 17;
const FABIO_LOPEZ_ID = 2474;
const MAX_ASSINANTES_TURMA = 3;

const PERFIS_RESPONSAVEIS_VALIDOS = new Set(["organizador", "administrador"]);

const MAX_FOLDER_MB = 2;
const MAX_FOLDER_BYTES = MAX_FOLDER_MB * 1024 * 1024;

const MAX_PDF_MB = 15;
const MAX_PDF_BYTES = MAX_PDF_MB * 1024 * 1024;

const allowedFolderExt = new Set([".png", ".jpg", ".jpeg"]);
const allowedFolderMime = new Set(["image/png", "image/jpeg"]);

const allowedPdfExt = new Set([".pdf"]);
const allowedPdfMime = new Set(["application/pdf"]);

/* ───────────────────────────────────────────────────────────────
   Logs
─────────────────────────────────────────────────────────────── */

function mkRid() {
  return `${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function log(rid, level, msg, extra) {
  const prefix = `[EVT:ADMIN][RID=${rid}]`;
  const hasExtra = extra && Object.keys(extra).length;

  if (level === "error") {
    return console.error(
      `${prefix} ✖ ${msg}`,
      extra?.stack || extra?.message || extra
    );
  }

  if (level === "warn") {
    return console.warn(`${prefix} ⚠ ${msg}`, hasExtra ? extra : "");
  }

  if (level === "info") {
    return console.log(`${prefix} • ${msg}`, hasExtra ? extra : "");
  }

  return console.log(`${prefix} ▶ ${msg}`, hasExtra ? extra : "");
}

const logStart = (rid, msg, extra) => log(rid, "start", msg, extra);
const logInfo = (rid, msg, extra) => log(rid, "info", msg, extra);
const logWarn = (rid, msg, extra) => log(rid, "warn", msg, extra);
const logError = (rid, msg, err) => log(rid, "error", msg, err);

/* ───────────────────────────────────────────────────────────────
   Respostas
─────────────────────────────────────────────────────────────── */

function sendOk(
  res,
  { status = 200, message = "Operação realizada.", data = null, meta = null }
) {
  return res.status(status).json({
    ok: true,
    message,
    ...(data !== null ? { data } : {}),
    ...(meta !== null ? { meta } : {}),
  });
}

function sendError(
  res,
  {
    status = 500,
    code = "ERRO_INTERNO",
    message = "Erro interno.",
    rid = null,
    details = null,
    adminHint = null,
    error = null,
  }
) {
  return res.status(status).json({
    ok: false,
    code,
    message,
    ...(rid ? { rid } : {}),
    ...(adminHint ? { adminHint } : {}),
    ...(details ? { details } : {}),
    ...(IS_DEV && error
      ? {
          debug: {
            message: error?.message,
            code: error?.code,
            constraint: error?.constraint,
            detail: error?.detail,
          },
        }
      : {}),
  });
}

function badRequest(res, message, extra = {}) {
  return sendError(res, {
    status: 400,
    code: extra.code || "REQUISICAO_INVALIDA",
    message,
    ...extra,
  });
}

function forbidden(res) {
  return sendError(res, {
    status: 403,
    code: "PERMISSAO_NEGADA",
    message: "Você não tem permissão para executar esta ação.",
  });
}

/* ───────────────────────────────────────────────────────────────
   Helpers gerais
─────────────────────────────────────────────────────────────── */

function isAdmin(req) {
  return req.user?.perfil === PERFIL_ADMINISTRADOR;
}

function hhmm(value, fallback = "") {
  if (!value) return fallback;

  const str = String(value).trim().slice(0, 5);
  return /^\d{2}:\d{2}$/.test(str) ? str : fallback;
}

function normalizeDateOnly(value) {
  if (value == null) return null;
  if (typeof value !== "string") return null;

  const s = value.trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.slice(0, 10);

  return null;
}

function toPositiveIntOrNull(value) {
  const n = Number(value);

  if (!Number.isInteger(n) || n <= 0) return null;

  return n;
}

function toIntArray(value) {
  if (!Array.isArray(value)) return [];

  return [
    ...new Set(
      value
        .map((item) => {
          if (typeof item === "object" && item !== null) {
            return item.usuario_id || item.id;
          }

          return item;
        })
        .map((n) => Number(n))
        .filter((n) => Number.isInteger(n) && n > 0)
    ),
  ];
}

function parseMaybeJson(value, fallback) {
  if (value == null) return fallback;

  if (typeof value !== "string") {
    return value;
  }

  const s = value.trim();

  if (!s) return fallback;

  const looksJson =
    (s.startsWith("{") && s.endsWith("}")) ||
    (s.startsWith("[") && s.endsWith("]"));

  if (!looksJson) return fallback;

  try {
    return JSON.parse(s);
  } catch {
    return fallback;
  }
}

function parseBoolean(value) {
  if (typeof value === "boolean") return value;

  const s = String(value).trim().toLowerCase();

  if (s === "true") return true;
  if (s === "false") return false;

  return value;
}

function normalizeBodyMultipart(body = {}) {
  const out = { ...body };

  out.turmas = parseMaybeJson(body.turmas, body.turmas);

  if (Array.isArray(out.turmas)) {
    out.turmas = out.turmas.map((turma) => ({
      ...turma,
      organizadores: parseMaybeJson(turma?.organizadores, turma?.organizadores),
      palestrantes: parseMaybeJson(turma?.palestrantes, turma?.palestrantes),
      assinantes: parseMaybeJson(turma?.assinantes, turma?.assinantes),
      datas: parseMaybeJson(turma?.datas, turma?.datas),
    }));
  }

  out.registros_permitidos = parseMaybeJson(
    body.registros_permitidos,
    body.registros_permitidos
  );

  out.cargos_permitidos = parseMaybeJson(
    body.cargos_permitidos,
    body.cargos_permitidos
  );

  out.unidades_permitidas = parseMaybeJson(
    body.unidades_permitidas,
    body.unidades_permitidas
  );

  out.restrito = parseBoolean(body.restrito);
  out.remover_folder = parseBoolean(body.remover_folder);
  out.remover_programacao = parseBoolean(body.remover_programacao);

  return out;
}

function extrairDatasDaTurma(turma) {
  if (!Array.isArray(turma?.datas) || !turma.datas.length) {
    return [];
  }

  return turma.datas
    .map((d) => ({
      data: normalizeDateOnly(d?.data),
      horario_inicio: hhmm(d?.horario_inicio || ""),
      horario_fim: hhmm(d?.horario_fim || ""),
    }))
    .filter((d) => d.data);
}

function normalizarPalestrantesTurma(value = []) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (typeof item === "string") {
        return {
          nome: String(item || "").trim(),
          usuario_id: null,
        };
      }

      return {
        nome: String(item?.nome || "").trim(),
        usuario_id: toPositiveIntOrNull(item?.usuario_id || item?.id),
      };
    })
    .filter((item) => item.nome || item.usuario_id);
}

function normalizarAssinantesTurma(value = []) {
  const ids = toIntArray(value);
  const temFabio = ids.includes(FABIO_LOPEZ_ID);

  const extras = ids.filter(
    (id) => id !== RAFAELLA_PITOL_ID && id !== FABIO_LOPEZ_ID
  );

  const base = extras.slice(0, temFabio ? 1 : 2);

  if (temFabio) {
    return [...base, RAFAELLA_PITOL_ID, FABIO_LOPEZ_ID];
  }

  return [...base, RAFAELLA_PITOL_ID];
}

function validarTurmaPayload(turma, index) {
  const nome = String(turma?.nome || "").trim();

  if (!nome) {
    return `Turma ${index + 1}: informe o nome da turma.`;
  }

  const vagasRaw = turma?.vagas_total;

  if (vagasRaw !== undefined && vagasRaw !== null && vagasRaw !== "") {
    const vagas = Number(vagasRaw);

    if (!Number.isInteger(vagas) || vagas <= 0) {
      return `Turma ${index + 1}: vagas_total inválido.`;
    }
  }

  const cargaRaw = turma?.carga_horaria;

  if (cargaRaw !== undefined && cargaRaw !== null && cargaRaw !== "") {
    const carga = Number(cargaRaw);

    if (!Number.isInteger(carga) || carga <= 0) {
      return `Turma ${index + 1}: carga_horaria inválida.`;
    }
  }

  const datas = extrairDatasDaTurma(turma);

  if (!datas.length) {
    return `Turma ${index + 1}: informe ao menos uma data.`;
  }

  const dataInvalida = datas.find(
    (d) => !d.data || !d.horario_inicio || !d.horario_fim
  );

  if (dataInvalida) {
    return `Turma ${index + 1}: data e horários são obrigatórios.`;
  }

  const horarioInvalido = datas.find(
    (d) => d.horario_inicio && d.horario_fim && d.horario_fim <= d.horario_inicio
  );

  if (horarioInvalido) {
    return `Turma ${index + 1}: horário final deve ser maior que o horário inicial.`;
  }

  const organizadores = toIntArray(turma?.organizadores);

  if (!organizadores.length) {
    return `Turma ${index + 1}: informe ao menos um organizador.`;
  }

  const assinantes = normalizarAssinantesTurma(turma?.assinantes || []);

  if (!assinantes.includes(RAFAELLA_PITOL_ID)) {
    return `Turma ${index + 1}: a assinatura da Rafaella Pitol é obrigatória.`;
  }

  if (assinantes.length < 1 || assinantes.length > MAX_ASSINANTES_TURMA) {
    return `Turma ${index + 1}: informe de 1 a 3 assinantes.`;
  }

  return null;
}

function sanitizeOriginalName(name = "arquivo") {
  const ext = path.extname(name || "").toLowerCase();
  const base = path.basename(name || "arquivo", ext);

  const safeBase =
    base.replace(/[^a-z0-9._-]+/gi, "_").replace(/_+/g, "_").slice(0, 100) ||
    "arquivo";

  return `${safeBase}${ext}`;
}

function toPostgresIntArray(value) {
  return toIntArray(value);
}

/* ───────────────────────────────────────────────────────────────
   Upload em memória
─────────────────────────────────────────────────────────────── */

const uploadEventosMem = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_PDF_BYTES,
    files: 2,
  },
  fileFilter(_req, file, cb) {
    const fieldname = String(file.fieldname || "");
    const ext = path.extname(file.originalname || "").toLowerCase();
    const mime = String(file.mimetype || "").toLowerCase();

    if (fieldname === "folder") {
      if (!allowedFolderExt.has(ext) || !allowedFolderMime.has(mime)) {
        return cb(new Error("Folder deve ser imagem PNG/JPG."));
      }

      return cb(null, true);
    }

    if (fieldname === "programacao") {
      if (!allowedPdfExt.has(ext) || !allowedPdfMime.has(mime)) {
        return cb(new Error("Programação deve ser arquivo PDF."));
      }

      return cb(null, true);
    }

    return cb(new Error(`Campo de upload inválido: ${fieldname}.`));
  },
});

const uploadEventos = (req, res, next) => {
  const rid = mkRid();

  const handler = uploadEventosMem.fields([
    { name: "folder", maxCount: 1 },
    { name: "programacao", maxCount: 1 },
  ]);

  handler(req, res, (err) => {
    if (err) {
      const msg =
        err.code === "LIMIT_FILE_SIZE"
          ? `Arquivo excede o limite máximo de ${MAX_PDF_MB}MB.`
          : err.message || "Falha no upload dos arquivos do evento.";

      logWarn(rid, "uploadEventos erro", { msg, code: err.code });

      return sendError(res, {
        status: 400,
        code: "UPLOAD_EVENTO_INVALIDO",
        message: msg,
        rid,
      });
    }

    const folder = req.files?.folder?.[0] || null;
    const programacao = req.files?.programacao?.[0] || null;

    if (folder && folder.size > MAX_FOLDER_BYTES) {
      return sendError(res, {
        status: 400,
        code: "FOLDER_ACIMA_DO_LIMITE",
        message: `Folder excede o limite de ${MAX_FOLDER_MB}MB.`,
        rid,
      });
    }

    if (programacao && programacao.size > MAX_PDF_BYTES) {
      return sendError(res, {
        status: 400,
        code: "PROGRAMACAO_ACIMA_DO_LIMITE",
        message: `PDF excede o limite de ${MAX_PDF_MB}MB.`,
        rid,
      });
    }

    req._folderFile = folder;
    req._programacaoFile = programacao;

    return next();
  });
};

const uploadFolderOnly = (req, res, next) => {
  const rid = mkRid();

  const handler = uploadEventosMem.fields([{ name: "folder", maxCount: 1 }]);

  handler(req, res, (err) => {
    if (err) {
      const msg =
        err.code === "LIMIT_FILE_SIZE"
          ? `Folder excede o limite de ${MAX_FOLDER_MB}MB.`
          : err.message || "Falha no upload do folder.";

      logWarn(rid, "uploadFolderOnly erro", { msg, code: err.code });

      return sendError(res, {
        status: 400,
        code: "UPLOAD_FOLDER_INVALIDO",
        message: msg,
        rid,
      });
    }

    const folder = req.files?.folder?.[0] || null;

    if (folder && folder.size > MAX_FOLDER_BYTES) {
      return sendError(res, {
        status: 400,
        code: "FOLDER_ACIMA_DO_LIMITE",
        message: `Folder excede o limite de ${MAX_FOLDER_MB}MB.`,
        rid,
      });
    }

    req._folderFile = folder;

    return next();
  });
};

const uploadProgramacaoOnly = (req, res, next) => {
  const rid = mkRid();

  const handler = uploadEventosMem.fields([{ name: "programacao", maxCount: 1 }]);

  handler(req, res, (err) => {
    if (err) {
      const msg =
        err.code === "LIMIT_FILE_SIZE"
          ? `PDF excede o limite de ${MAX_PDF_MB}MB.`
          : err.message || "Falha no upload da programação.";

      logWarn(rid, "uploadProgramacaoOnly erro", { msg, code: err.code });

      return sendError(res, {
        status: 400,
        code: "UPLOAD_PROGRAMACAO_INVALIDO",
        message: msg,
        rid,
      });
    }

    req._programacaoFile = req.files?.programacao?.[0] || null;

    return next();
  });
};

/* ───────────────────────────────────────────────────────────────
   Persistência de arquivos
─────────────────────────────────────────────────────────────── */

async function salvarFolderNoEvento(client, eventoId, file) {
  if (!file?.buffer?.length) return;

  const mime = String(file.mimetype || "").toLowerCase();

  if (!allowedFolderMime.has(mime)) {
    throw Object.assign(new Error("MIME inválido para folder."), {
      status: 400,
      code: "FOLDER_MIME_INVALIDO",
    });
  }

  if (file.size > MAX_FOLDER_BYTES) {
    throw Object.assign(new Error(`Folder excede ${MAX_FOLDER_MB}MB.`), {
      status: 400,
      code: "FOLDER_ACIMA_DO_LIMITE",
    });
  }

  await client.query(
    `
    UPDATE eventos
    SET folder_blob = $2,
        folder_mime = $3,
        folder_size = $4,
        folder_updated_at = NOW()
    WHERE id = $1
    `,
    [eventoId, file.buffer, mime, Number(file.size || 0)]
  );
}

async function limparFolderDoEvento(client, eventoId) {
  await client.query(
    `
    UPDATE eventos
    SET folder_blob = NULL,
        folder_mime = NULL,
        folder_size = NULL,
        folder_updated_at = NOW()
    WHERE id = $1
    `,
    [eventoId]
  );
}

async function salvarProgramacaoNoEvento(client, eventoId, file) {
  if (!file?.buffer?.length) return;

  const mime = String(file.mimetype || "").toLowerCase();

  if (!allowedPdfMime.has(mime)) {
    throw Object.assign(new Error("MIME inválido para programação."), {
      status: 400,
      code: "PROGRAMACAO_MIME_INVALIDO",
    });
  }

  if (file.size > MAX_PDF_BYTES) {
    throw Object.assign(new Error(`PDF excede ${MAX_PDF_MB}MB.`), {
      status: 400,
      code: "PROGRAMACAO_ACIMA_DO_LIMITE",
    });
  }

  await client.query(
    `
    UPDATE eventos
    SET programacao_pdf_blob = $2,
        programacao_pdf_mime = $3,
        programacao_pdf_size = $4,
        programacao_pdf_nome_original = $5,
        programacao_pdf_updated_at = NOW()
    WHERE id = $1
    `,
    [
      eventoId,
      file.buffer,
      mime,
      Number(file.size || 0),
      sanitizeOriginalName(file.originalname || "programacao.pdf"),
    ]
  );
}

async function limparProgramacaoDoEvento(client, eventoId) {
  await client.query(
    `
    UPDATE eventos
    SET programacao_pdf_blob = NULL,
        programacao_pdf_mime = NULL,
        programacao_pdf_size = NULL,
        programacao_pdf_nome_original = NULL,
        programacao_pdf_updated_at = NOW()
    WHERE id = $1
    `,
    [eventoId]
  );
}

/* ───────────────────────────────────────────────────────────────
   Restrições
─────────────────────────────────────────────────────────────── */

async function sincronizarRestricoesEvento(client, eventoId, payload) {
  const {
    restrito,
    restrito_modo,
    registros_permitidos,
    cargos_permitidos,
    unidades_permitidas,
  } = payload;

  if (!restrito) {
    await client.query(`DELETE FROM evento_registros WHERE evento_id = $1`, [
      eventoId,
    ]);
    await client.query(`DELETE FROM evento_cargos WHERE evento_id = $1`, [
      eventoId,
    ]);
    await client.query(`DELETE FROM evento_unidades WHERE evento_id = $1`, [
      eventoId,
    ]);
    return;
  }

  if (restrito_modo === MODO_LISTA) {
    const registrosNormalizados = normalizeListaRegistros(registros_permitidos);

    await client.query(`DELETE FROM evento_registros WHERE evento_id = $1`, [
      eventoId,
    ]);

    for (const registro of registrosNormalizados) {
      await client.query(
        `
        INSERT INTO evento_registros (evento_id, registro_norm)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
        `,
        [eventoId, registro]
      );
    }
  }

  if (typeof cargos_permitidos !== "undefined") {
    const cargoIds = toPostgresIntArray(cargos_permitidos);

    await client.query(`DELETE FROM evento_cargos WHERE evento_id = $1`, [
      eventoId,
    ]);

    for (const cargoId of cargoIds) {
      await client.query(
        `
        INSERT INTO evento_cargos (evento_id, cargo)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
        `,
        [eventoId, String(cargoId)]
      );
    }
  }

  if (typeof unidades_permitidas !== "undefined") {
    const unidadeIds = toPostgresIntArray(unidades_permitidas);

    await client.query(`DELETE FROM evento_unidades WHERE evento_id = $1`, [
      eventoId,
    ]);

    for (const unidadeId of unidadeIds) {
      await client.query(
        `
        INSERT INTO evento_unidades (evento_id, unidade_id)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
        `,
        [eventoId, unidadeId]
      );
    }
  }
}

/* ───────────────────────────────────────────────────────────────
   Turmas
─────────────────────────────────────────────────────────────── */

async function validarUsuariosOrganizadorOuAdministrador(client, usuarioIds = []) {
  const ids = toIntArray(usuarioIds);

  if (!ids.length) return [];

  const result = await client.query(
    `
    SELECT id, nome, email, perfil
    FROM usuarios
    WHERE id = ANY($1::int[])
    ORDER BY nome ASC
    `,
    [ids]
  );

  const encontrados = result.rows || [];
  const encontradosIds = new Set(encontrados.map((row) => Number(row.id)));

  const ausentes = ids.filter((id) => !encontradosIds.has(Number(id)));

  if (ausentes.length) {
    throw Object.assign(
      new Error(`Usuário(s) não encontrado(s): ${ausentes.join(", ")}.`),
      {
        status: 400,
        code: "USUARIO_RESPONSAVEL_NAO_ENCONTRADO",
      }
    );
  }

  const invalidos = encontrados.filter(
    (row) => !PERFIS_RESPONSAVEIS_VALIDOS.has(String(row.perfil || ""))
  );

  if (invalidos.length) {
    throw Object.assign(
      new Error(
        "Organizadores, palestrantes vinculados e assinantes devem ser usuários com perfil organizador ou administrador."
      ),
      {
        status: 400,
        code: "USUARIO_RESPONSAVEL_PERFIL_INVALIDO",
      }
    );
  }

  return encontrados;
}

async function salvarDatasTurma(client, turmaId, turma) {
  const datas = extrairDatasDaTurma(turma);

  await client.query(`DELETE FROM datas_turma WHERE turma_id = $1`, [turmaId]);

  for (const d of datas) {
    const inicio = d.horario_inicio || "08:00";
    const fim = d.horario_fim || "17:00";

    await client.query(
      `
      INSERT INTO datas_turma (turma_id, data, horario_inicio, horario_fim)
      VALUES ($1, $2, $3, $4)
      `,
      [turmaId, d.data, inicio, fim]
    );
  }
}

async function salvarResponsaveisTurma(client, turmaId, turma) {
  const organizadores = toIntArray(turma?.organizadores);

  if (!organizadores.length) {
    throw Object.assign(new Error("Informe ao menos um organizador para a turma."), {
      status: 400,
      code: "TURMA_SEM_ORGANIZADOR",
    });
  }

  await validarUsuariosOrganizadorOuAdministrador(client, organizadores);

  await client.query(
    `
    DELETE FROM turma_responsavel
    WHERE turma_id = $1
      AND papel = $2
    `,
    [turmaId, PAPEL_ORGANIZADOR]
  );

  for (const organizadorId of organizadores) {
    await client.query(
      `
      INSERT INTO turma_responsavel (
        turma_id,
        usuario_id,
        papel
      )
      VALUES ($1, $2, $3)
      ON CONFLICT (turma_id, usuario_id, papel)
      DO NOTHING
      `,
      [turmaId, organizadorId, PAPEL_ORGANIZADOR]
    );
  }
}

async function salvarPalestrantesTurma(client, turmaId, turma) {
  const palestrantes = normalizarPalestrantesTurma(turma?.palestrantes || []);

  const usuariosVinculados = palestrantes
    .map((item) => item.usuario_id)
    .filter(Boolean);

  if (usuariosVinculados.length) {
    await validarUsuariosOrganizadorOuAdministrador(client, usuariosVinculados);
  }

  await client.query(`DELETE FROM turma_palestrante WHERE turma_id = $1`, [
    turmaId,
  ]);

  for (const item of palestrantes) {
    let nome = item.nome;

    if (!nome && item.usuario_id) {
      const usuario = await client.query(
        `
        SELECT nome
        FROM usuarios
        WHERE id = $1
        LIMIT 1
        `,
        [item.usuario_id]
      );

      nome = usuario.rows?.[0]?.nome || null;
    }

    if (!nome) continue;

    await client.query(
      `
      INSERT INTO turma_palestrante (
        turma_id,
        nome,
        usuario_id
      )
      VALUES ($1, $2, $3)
      `,
      [turmaId, nome, item.usuario_id || null]
    );
  }
}

async function salvarAssinantesTurma(client, turmaId, turma) {
  const assinantes = normalizarAssinantesTurma(turma?.assinantes || []);

  if (!assinantes.includes(RAFAELLA_PITOL_ID)) {
    throw Object.assign(
      new Error("Rafaella Pitol deve compor obrigatoriamente a lista de assinantes."),
      {
        status: 400,
        code: "RAFAELLA_ASSINATURA_OBRIGATORIA",
      }
    );
  }

  if (assinantes.length < 1 || assinantes.length > MAX_ASSINANTES_TURMA) {
    throw Object.assign(new Error("A turma deve ter de 1 a 3 assinantes."), {
      status: 400,
      code: "TURMA_ASSINANTES_QUANTIDADE_INVALIDA",
    });
  }

  await validarUsuariosOrganizadorOuAdministrador(client, assinantes);

  await client.query(`DELETE FROM turma_certificado_assinante WHERE turma_id = $1`, [
    turmaId,
  ]);

  for (let index = 0; index < assinantes.length; index += 1) {
    await client.query(
      `
      INSERT INTO turma_certificado_assinante (
        turma_id,
        usuario_id,
        ordem
      )
      VALUES ($1, $2, $3)
      `,
      [turmaId, assinantes[index], index + 1]
    );
  }
}

function montarDadosTurma(turma) {
  const datas = extrairDatasDaTurma(turma).sort((a, b) =>
    a.data.localeCompare(b.data)
  );

  const dataInicio = datas[0]?.data || null;
  const dataFim = datas.at(-1)?.data || dataInicio || null;

  const vagasRaw = turma?.vagas_total;
  const cargaRaw = turma?.carga_horaria;

  return {
    nome: String(turma?.nome || "").trim(),
    vagas_total:
      vagasRaw === undefined || vagasRaw === null || vagasRaw === ""
        ? null
        : Number(vagasRaw),
    carga_horaria:
      cargaRaw === undefined || cargaRaw === null || cargaRaw === ""
        ? null
        : Number(cargaRaw),
    data_inicio: dataInicio,
    data_fim: dataFim,
    horario_inicio: datas[0]?.horario_inicio || null,
    horario_fim: datas[0]?.horario_fim || null,
  };
}

async function criarTurma(client, eventoId, turma) {
  const dados = montarDadosTurma(turma);

  const result = await client.query(
    `
    INSERT INTO turmas (
      evento_id,
      nome,
      vagas_total,
      carga_horaria,
      data_inicio,
      data_fim,
      horario_inicio,
      horario_fim
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    RETURNING id
    `,
    [
      eventoId,
      dados.nome,
      dados.vagas_total,
      dados.carga_horaria,
      dados.data_inicio,
      dados.data_fim,
      dados.horario_inicio,
      dados.horario_fim,
    ]
  );

  const turmaId = Number(result.rows[0].id);

  await salvarDatasTurma(client, turmaId, turma);
  await salvarResponsaveisTurma(client, turmaId, turma);
  await salvarPalestrantesTurma(client, turmaId, turma);
  await salvarAssinantesTurma(client, turmaId, turma);

  return turmaId;
}

async function atualizarTurma(client, eventoId, turma) {
  const turmaId = Number(turma.id);

  if (!Number.isInteger(turmaId) || turmaId <= 0) {
    return criarTurma(client, eventoId, turma);
  }

  const pertence = await client.query(
    `
    SELECT id
    FROM turmas
    WHERE id = $1 AND evento_id = $2
    `,
    [turmaId, eventoId]
  );

  if (!pertence.rowCount) {
    throw Object.assign(
      new Error(`Turma ${turmaId} não pertence ao evento ${eventoId}.`),
      {
        status: 400,
        code: "TURMA_NAO_PERTENCE_AO_EVENTO",
      }
    );
  }

  const dados = montarDadosTurma(turma);

  await client.query(
    `
    UPDATE turmas
    SET nome = $2,
        vagas_total = $3,
        carga_horaria = $4,
        data_inicio = $5,
        data_fim = $6,
        horario_inicio = $7,
        horario_fim = $8
    WHERE id = $1
    `,
    [
      turmaId,
      dados.nome,
      dados.vagas_total,
      dados.carga_horaria,
      dados.data_inicio,
      dados.data_fim,
      dados.horario_inicio,
      dados.horario_fim,
    ]
  );

  await salvarDatasTurma(client, turmaId, turma);
  await salvarResponsaveisTurma(client, turmaId, turma);
  await salvarPalestrantesTurma(client, turmaId, turma);
  await salvarAssinantesTurma(client, turmaId, turma);

  return turmaId;
}

async function turmaTemUsoOperacional(client, turmaId) {
  const result = await client.query(
    `
    SELECT
      EXISTS (SELECT 1 FROM inscricoes WHERE turma_id = $1 LIMIT 1) AS tem_inscricao,
      EXISTS (SELECT 1 FROM presencas WHERE turma_id = $1 LIMIT 1) AS tem_presenca,
      EXISTS (SELECT 1 FROM certificados WHERE turma_id = $1 LIMIT 1) AS tem_certificado
    `,
    [turmaId]
  );

  const row = result.rows[0] || {};

  return Boolean(row.tem_inscricao || row.tem_presenca || row.tem_certificado);
}

async function excluirTurmaSemUso(client, turmaId) {
  await client.query(`DELETE FROM turma_certificado_assinante WHERE turma_id = $1`, [
    turmaId,
  ]);
  await client.query(`DELETE FROM turma_palestrante WHERE turma_id = $1`, [
    turmaId,
  ]);
  await client.query(`DELETE FROM turma_responsavel WHERE turma_id = $1`, [
    turmaId,
  ]);
  await client.query(`DELETE FROM datas_turma WHERE turma_id = $1`, [turmaId]);
  await client.query(`DELETE FROM turmas WHERE id = $1`, [turmaId]);
}

async function sincronizarTurmasEvento(client, eventoId, turmas) {
  if (!Array.isArray(turmas)) return;

  for (let i = 0; i < turmas.length; i += 1) {
    const erro = validarTurmaPayload(turmas[i], i);

    if (erro) {
      throw Object.assign(new Error(erro), {
        status: 400,
        code: "TURMA_INVALIDA",
      });
    }
  }

  const { rows: turmasAtuais } = await client.query(
    `
    SELECT id
    FROM turmas
    WHERE evento_id = $1
    `,
    [eventoId]
  );

  const payloadIds = new Set(
    turmas
      .map((turma) => Number(turma.id))
      .filter((id) => Number.isInteger(id) && id > 0)
  );

  for (const atual of turmasAtuais) {
    const turmaId = Number(atual.id);

    if (!payloadIds.has(turmaId)) {
      const temUso = await turmaTemUsoOperacional(client, turmaId);

      if (temUso) {
        throw Object.assign(
          new Error(
            `A turma ${turmaId} possui inscrições, presenças ou certificados e não pode ser removida pela edição do evento.`
          ),
          {
            status: 409,
            code: "TURMA_COM_HISTORICO",
          }
        );
      }

      await excluirTurmaSemUso(client, turmaId);
    }
  }

  for (const turma of turmas) {
    await atualizarTurma(client, eventoId, turma);
  }
}

/* ───────────────────────────────────────────────────────────────
   Listagem administrativa
─────────────────────────────────────────────────────────────── */

async function listarEventosAdmin(req, res) {
  const rid = mkRid();

  if (!isAdmin(req)) {
    return forbidden(res);
  }

  logStart(rid, "listarEventosAdmin");

  try {
    const { rows } = await db.query(
      `
      WITH agg_turmas AS (
        SELECT
          t.evento_id,
          MIN(t.data_inicio) AS data_inicio_geral,
          MAX(t.data_fim) AS data_fim_geral,
          MIN(t.horario_inicio) AS horario_inicio_geral,
          MAX(t.horario_fim) AS horario_fim_geral
        FROM turmas t
        GROUP BY t.evento_id
      ),
      agg_datas AS (
        SELECT
          t.evento_id,
          MIN(dt.data::date + COALESCE(dt.horario_inicio, '00:00'::time)) AS inicio_real,
          MAX(dt.data::date + COALESCE(dt.horario_fim, '23:59'::time)) AS fim_real
        FROM turmas t
        JOIN datas_turma dt ON dt.turma_id = t.id
        GROUP BY t.evento_id
      ),
      agora AS (
        SELECT NOW() AT TIME ZONE 'America/Sao_Paulo' AS br_now
      )
      SELECT
        e.id,
        e.titulo,
        e.descricao,
        e.local,
        e.tipo,
        e.unidade_id,
        e.publico_alvo,
        e.publicado,
        e.restrito,
        e.restrito_modo,
        e.visibilidade,
        e.criado_em,

        ('/api/evento/' || e.id || '/folder') AS folder_blob_url,
        CASE
          WHEN e.folder_blob IS NOT NULL THEN 'blob'
          ELSE 'none'
        END AS folder_kind,

        ('/api/evento/' || e.id || '/programacao') AS programacao_pdf_blob_url,
        CASE
          WHEN e.programacao_pdf_blob IS NOT NULL THEN 'blob'
          ELSE 'none'
        END AS programacao_kind,

        e.folder_size,
        e.folder_updated_at,
        e.programacao_pdf_size,
        e.programacao_pdf_nome_original,
        e.programacao_pdf_updated_at,

        at.data_inicio_geral,
        at.data_fim_geral,
        at.horario_inicio_geral,
        at.horario_fim_geral,

        CASE
          WHEN COALESCE(ad.inicio_real, at.data_inicio_geral::date + COALESCE(at.horario_inicio_geral, '00:00'::time)) IS NULL
            THEN 'sem_datas'
          WHEN a.br_now < COALESCE(
            ad.inicio_real,
            at.data_inicio_geral::date + COALESCE(at.horario_inicio_geral, '00:00'::time)
          ) THEN 'programado'
          WHEN a.br_now <= COALESCE(
            ad.fim_real,
            at.data_fim_geral::date + COALESCE(at.horario_fim_geral, '23:59'::time)
          ) THEN 'andamento'
          ELSE 'encerrado'
        END AS status
      FROM eventos e
      CROSS JOIN agora a
      LEFT JOIN agg_turmas at ON at.evento_id = e.id
      LEFT JOIN agg_datas ad ON ad.evento_id = e.id
      ORDER BY COALESCE(
        ad.fim_real,
        at.data_fim_geral::date + COALESCE(at.horario_fim_geral, '23:59'::time)
      ) DESC NULLS LAST,
      e.id DESC
      `
    );

    logInfo(rid, "listarEventosAdmin OK", { count: rows.length });

    return sendOk(res, {
      message: "Eventos administrativos carregados.",
      data: rows,
      meta: {
        total: rows.length,
      },
    });
  } catch (err) {
    logError(rid, "listarEventosAdmin erro", err);

    return sendError(res, {
      status: 500,
      code: "EVENTO_ADMIN_LISTAR_ERRO",
      message: "Erro ao listar eventos administrativos.",
      rid,
      error: err,
    });
  }
}

/* ───────────────────────────────────────────────────────────────
   Criar evento
─────────────────────────────────────────────────────────────── */

async function criarEvento(req, res) {
  const rid = mkRid();

  if (!isAdmin(req)) {
    return forbidden(res);
  }

  const body = normalizeBodyMultipart(req.body || {});

  const {
    titulo,
    descricao,
    local,
    tipo,
    unidade_id,
    publico_alvo,
    turmas = [],
    restrito = false,
    restrito_modo = null,
    cargos_permitidos,
    unidades_permitidas,
    registros_permitidos,
  } = body;

  logStart(rid, "criarEvento", {
    titulo,
    tipo,
    unidade_id,
    restrito,
    restrito_modo,
    turmas_count: Array.isArray(turmas) ? turmas.length : 0,
  });

  if (!String(titulo || "").trim()) {
    return badRequest(res, "Campo 'titulo' é obrigatório.", { rid });
  }

  if (!String(local || "").trim()) {
    return badRequest(res, "Campo 'local' é obrigatório.", { rid });
  }

  if (!String(tipo || "").trim()) {
    return badRequest(res, "Campo 'tipo' é obrigatório.", { rid });
  }

  if (!Number.isInteger(Number(unidade_id)) || Number(unidade_id) <= 0) {
    return badRequest(res, "Campo 'unidade_id' é obrigatório e deve ser válido.", {
      rid,
    });
  }

  if (!Array.isArray(turmas) || !turmas.length) {
    return badRequest(res, "Informe ao menos uma turma para criar o evento.", {
      rid,
    });
  }

  if (restrito === true && restrito_modo === MODO_LISTA) {
    const registros = normalizeListaRegistros(registros_permitidos);

    if (!registros.length) {
      return badRequest(
        res,
        "Evento restrito por lista precisa ter ao menos um registro autorizado.",
        { rid }
      );
    }
  }

  for (let i = 0; i < turmas.length; i += 1) {
    const erro = validarTurmaPayload(turmas[i], i);
    if (erro) return badRequest(res, erro, { rid });
  }

  const client = await db.getClient();

  try {
    await client.query("BEGIN");

    const cargoIds = toPostgresIntArray(cargos_permitidos);
    const unidadeIds = toPostgresIntArray(unidades_permitidas);

    const result = await client.query(
      `
      INSERT INTO eventos (
        titulo,
        descricao,
        local,
        tipo,
        unidade_id,
        publico_alvo,
        restrito,
        restrito_modo,
        publicado,
        cargos_permitidos_ids,
        unidades_permitidas_ids
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,FALSE,$9,$10)
      RETURNING *
      `,
      [
        String(titulo).trim(),
        String(descricao || "").trim(),
        String(local).trim(),
        String(tipo).trim(),
        Number(unidade_id),
        String(publico_alvo || "").trim(),
        Boolean(restrito),
        restrito ? restrito_modo || null : null,
        cargoIds,
        unidadeIds,
      ]
    );

    const evento = result.rows[0];
    const eventoId = Number(evento.id);

    if (req._folderFile?.buffer?.length) {
      await salvarFolderNoEvento(client, eventoId, req._folderFile);
    }

    if (req._programacaoFile?.buffer?.length) {
      await salvarProgramacaoNoEvento(client, eventoId, req._programacaoFile);
    }

    await sincronizarRestricoesEvento(client, eventoId, {
      ...body,
      cargos_permitidos,
      unidades_permitidas,
      registros_permitidos,
    });

    for (const turma of turmas) {
      await criarTurma(client, eventoId, turma);
    }

    await client.query("COMMIT");

    logInfo(rid, "criarEvento OK", { eventoId });

    return sendOk(res, {
      status: 201,
      message: "Evento criado com sucesso.",
      data: {
        ...evento,
        id: eventoId,
      },
    });
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {}

    logError(rid, "criarEvento erro", err);

    return sendError(res, {
      status: err.status || 500,
      code: err.code || "EVENTO_CRIAR_ERRO",
      message: err.status ? err.message : "Erro ao criar evento.",
      rid,
      error: err,
    });
  } finally {
    client.release();
  }
}

/* ───────────────────────────────────────────────────────────────
   Atualizar evento
─────────────────────────────────────────────────────────────── */

async function atualizarEvento(req, res) {
  const rid = mkRid();

  if (!isAdmin(req)) {
    return forbidden(res);
  }

  const eventoId = Number(req.params.id);

  if (!Number.isInteger(eventoId) || eventoId <= 0) {
    return badRequest(res, "evento_id inválido.", {
      rid,
      code: "EVENTO_ID_INVALIDO",
    });
  }

  const body = normalizeBodyMultipart(req.body || {});

  const {
    titulo,
    descricao,
    local,
    tipo,
    unidade_id,
    publico_alvo,
    turmas,
    restrito,
    restrito_modo,
    cargos_permitidos,
    unidades_permitidas,
    registros_permitidos,
  } = body;

  logStart(rid, "atualizarEvento", {
    eventoId,
    hasTurmas: Array.isArray(turmas),
    restrito,
    restrito_modo,
  });

  const client = await db.getClient();

  try {
    await client.query("BEGIN");

    const existe = await client.query(`SELECT id FROM eventos WHERE id = $1`, [
      eventoId,
    ]);

    if (!existe.rowCount) {
      await client.query("ROLLBACK");

      return sendError(res, {
        status: 404,
        code: "EVENTO_NAO_ENCONTRADO",
        message: "Evento não encontrado.",
        rid,
      });
    }

    const setCols = [];
    const params = [eventoId];

    function pushSet(sql, value) {
      params.push(value);
      setCols.push(`${sql} = $${params.length}`);
    }

    if (typeof titulo !== "undefined") {
      if (!String(titulo || "").trim()) {
        throw Object.assign(new Error("Campo 'titulo' não pode ficar vazio."), {
          status: 400,
          code: "EVENTO_TITULO_INVALIDO",
        });
      }

      pushSet("titulo", String(titulo).trim());
    }

    if (typeof descricao !== "undefined") {
      pushSet("descricao", String(descricao || "").trim());
    }

    if (typeof local !== "undefined") {
      if (!String(local || "").trim()) {
        throw Object.assign(new Error("Campo 'local' não pode ficar vazio."), {
          status: 400,
          code: "EVENTO_LOCAL_INVALIDO",
        });
      }

      pushSet("local", String(local).trim());
    }

    if (typeof tipo !== "undefined") {
      if (!String(tipo || "").trim()) {
        throw Object.assign(new Error("Campo 'tipo' não pode ficar vazio."), {
          status: 400,
          code: "EVENTO_TIPO_INVALIDO",
        });
      }

      pushSet("tipo", String(tipo).trim());
    }

    if (typeof unidade_id !== "undefined") {
      if (!Number.isInteger(Number(unidade_id)) || Number(unidade_id) <= 0) {
        throw Object.assign(new Error("Campo 'unidade_id' inválido."), {
          status: 400,
          code: "EVENTO_UNIDADE_INVALIDA",
        });
      }

      pushSet("unidade_id", Number(unidade_id));
    }

    if (typeof publico_alvo !== "undefined") {
      pushSet("publico_alvo", String(publico_alvo || "").trim());
    }

    if (typeof restrito !== "undefined") {
      pushSet("restrito", Boolean(restrito));
    }

    if (typeof restrito_modo !== "undefined") {
      pushSet("restrito_modo", restrito ? restrito_modo || null : null);
    }

    if (typeof cargos_permitidos !== "undefined") {
      pushSet("cargos_permitidos_ids", toPostgresIntArray(cargos_permitidos));
    }

    if (typeof unidades_permitidas !== "undefined") {
      pushSet("unidades_permitidas_ids", toPostgresIntArray(unidades_permitidas));
    }

    if (body.remover_folder === true) {
      await limparFolderDoEvento(client, eventoId);
    }

    if (body.remover_programacao === true) {
      await limparProgramacaoDoEvento(client, eventoId);
    }

    if (req._folderFile?.buffer?.length) {
      await salvarFolderNoEvento(client, eventoId, req._folderFile);
    }

    if (req._programacaoFile?.buffer?.length) {
      await salvarProgramacaoNoEvento(client, eventoId, req._programacaoFile);
    }

    if (setCols.length) {
      await client.query(
        `
        UPDATE eventos
        SET ${setCols.join(", ")}
        WHERE id = $1
        `,
        params
      );
    }

    if (
      typeof restrito !== "undefined" ||
      typeof restrito_modo !== "undefined" ||
      typeof registros_permitidos !== "undefined" ||
      typeof cargos_permitidos !== "undefined" ||
      typeof unidades_permitidas !== "undefined"
    ) {
      await sincronizarRestricoesEvento(client, eventoId, body);
    }

    if (Array.isArray(turmas)) {
      await sincronizarTurmasEvento(client, eventoId, turmas);
    }

    await client.query("COMMIT");

    logInfo(rid, "atualizarEvento OK", { eventoId });

    return sendOk(res, {
      message: "Evento atualizado com sucesso.",
      data: {
        id: eventoId,
      },
    });
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {}

    logError(rid, "atualizarEvento erro", err);

    return sendError(res, {
      status: err.status || 500,
      code: err.code || "EVENTO_ATUALIZAR_ERRO",
      message: err.status ? err.message : "Erro ao atualizar evento.",
      rid,
      error: err,
    });
  } finally {
    client.release();
  }
}

/* ───────────────────────────────────────────────────────────────
   Validação de publicação
─────────────────────────────────────────────────────────────── */

async function validarEventoParaPublicacao(eventoId) {
  const result = await db.query(
    `
    SELECT
      e.id,
      e.titulo,
      e.local,
      e.tipo,
      e.unidade_id,
      e.restrito,
      e.restrito_modo,
      COUNT(DISTINCT t.id)::int AS total_turmas,
      COUNT(DISTINCT dt.id)::int AS total_datas,
      COUNT(DISTINCT tr.id)::int AS total_organizadores
    FROM eventos e
    LEFT JOIN turmas t ON t.evento_id = e.id
    LEFT JOIN datas_turma dt ON dt.turma_id = t.id
    LEFT JOIN turma_responsavel tr
      ON tr.turma_id = t.id
     AND tr.papel = 'organizador'
    WHERE e.id = $1
    GROUP BY e.id
    `,
    [eventoId]
  );

  if (!result.rowCount) {
    return {
      ok: false,
      status: 404,
      code: "EVENTO_NAO_ENCONTRADO",
      message: "Evento não encontrado.",
    };
  }

  const e = result.rows[0];

  if (!String(e.titulo || "").trim()) {
    return {
      ok: false,
      status: 400,
      code: "EVENTO_SEM_TITULO",
      message: "Evento sem título.",
    };
  }

  if (!String(e.local || "").trim()) {
    return {
      ok: false,
      status: 400,
      code: "EVENTO_SEM_LOCAL",
      message: "Evento sem local.",
    };
  }

  if (!String(e.tipo || "").trim()) {
    return {
      ok: false,
      status: 400,
      code: "EVENTO_SEM_TIPO",
      message: "Evento sem tipo.",
    };
  }

  if (!Number.isInteger(Number(e.unidade_id)) || Number(e.unidade_id) <= 0) {
    return {
      ok: false,
      status: 400,
      code: "EVENTO_SEM_UNIDADE",
      message: "Evento sem unidade vinculada.",
    };
  }

  if (Number(e.total_turmas) <= 0) {
    return {
      ok: false,
      status: 400,
      code: "EVENTO_SEM_TURMA",
      message: "Evento sem turma cadastrada.",
    };
  }

  if (Number(e.total_datas) <= 0) {
    return {
      ok: false,
      status: 400,
      code: "EVENTO_SEM_DATA",
      message: "Evento sem datas de turma cadastradas.",
    };
  }

  if (Number(e.total_organizadores) <= 0) {
    return {
      ok: false,
      status: 400,
      code: "EVENTO_SEM_ORGANIZADOR",
      message: "Evento possui turma sem organizador vinculado.",
    };
  }

  if (e.restrito && ![MODO_TODOS, MODO_LISTA, null].includes(e.restrito_modo)) {
    return {
      ok: false,
      status: 400,
      code: "EVENTO_RESTRICAO_INVALIDA",
      message: "Modo de restrição inválido.",
    };
  }

  return { ok: true };
}

/* ───────────────────────────────────────────────────────────────
   Publicar / Despublicar
─────────────────────────────────────────────────────────────── */

async function publicarEvento(req, res) {
  const rid = mkRid();

  if (!isAdmin(req)) {
    return forbidden(res);
  }

  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return badRequest(res, "evento_id inválido.", {
      rid,
      code: "EVENTO_ID_INVALIDO",
    });
  }

  try {
    const validacao = await validarEventoParaPublicacao(id);

    if (!validacao.ok) {
      return sendError(res, {
        status: validacao.status || 400,
        code: validacao.code || "EVENTO_PUBLICACAO_INVALIDA",
        message: validacao.message,
        rid,
      });
    }

    const result = await db.query(
      `
      UPDATE eventos
      SET publicado = TRUE
      WHERE id = $1
      RETURNING id, publicado
      `,
      [id]
    );

    return sendOk(res, {
      message: "Evento publicado.",
      data: result.rows[0],
    });
  } catch (err) {
    logError(rid, "publicarEvento erro", err);

    return sendError(res, {
      status: 500,
      code: "EVENTO_PUBLICAR_ERRO",
      message: "Erro ao publicar evento.",
      rid,
      error: err,
    });
  }
}

async function despublicarEvento(req, res) {
  const rid = mkRid();

  if (!isAdmin(req)) {
    return forbidden(res);
  }

  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return badRequest(res, "evento_id inválido.", {
      rid,
      code: "EVENTO_ID_INVALIDO",
    });
  }

  try {
    const result = await db.query(
      `
      UPDATE eventos
      SET publicado = FALSE
      WHERE id = $1
      RETURNING id, publicado
      `,
      [id]
    );

    if (!result.rowCount) {
      return sendError(res, {
        status: 404,
        code: "EVENTO_NAO_ENCONTRADO",
        message: "Evento não encontrado.",
        rid,
      });
    }

    return sendOk(res, {
      message: "Evento despublicado.",
      data: result.rows[0],
    });
  } catch (err) {
    logError(rid, "despublicarEvento erro", err);

    return sendError(res, {
      status: 500,
      code: "EVENTO_DESPUBLICAR_ERRO",
      message: "Erro ao despublicar evento.",
      rid,
      error: err,
    });
  }
}

/* ───────────────────────────────────────────────────────────────
   Excluir evento
─────────────────────────────────────────────────────────────── */

async function excluirEvento(req, res) {
  const rid = mkRid();

  if (!isAdmin(req)) {
    return forbidden(res);
  }

  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return badRequest(res, "evento_id inválido.", {
      rid,
      code: "EVENTO_ID_INVALIDO",
    });
  }

  logStart(rid, "excluirEvento", { id });

  const client = await db.getClient();

  try {
    await client.query("BEGIN");

    const uso = await client.query(
      `
      SELECT
        EXISTS (
          SELECT 1
          FROM inscricoes i
          JOIN turmas t ON t.id = i.turma_id
          WHERE t.evento_id = $1
          LIMIT 1
        ) AS tem_inscricao,
        EXISTS (
          SELECT 1
          FROM presencas p
          JOIN turmas t ON t.id = p.turma_id
          WHERE t.evento_id = $1
          LIMIT 1
        ) AS tem_presenca,
        EXISTS (
          SELECT 1
          FROM certificados c
          WHERE c.evento_id = $1
          LIMIT 1
        ) AS tem_certificado
      `,
      [id]
    );

    const row = uso.rows[0] || {};

    if (row.tem_inscricao || row.tem_presenca || row.tem_certificado) {
      await client.query("ROLLBACK");

      return sendError(res, {
        status: 409,
        code: "EVENTO_COM_HISTORICO",
        message:
          "Evento possui inscrições, presenças ou certificados e não pode ser excluído fisicamente.",
        adminHint:
          "Despublique o evento ou implemente fluxo próprio de arquivamento/cancelamento.",
        rid,
      });
    }

    const existe = await client.query(`SELECT id FROM eventos WHERE id = $1`, [
      id,
    ]);

    if (!existe.rowCount) {
      await client.query("ROLLBACK");

      return sendError(res, {
        status: 404,
        code: "EVENTO_NAO_ENCONTRADO",
        message: "Evento não encontrado.",
        rid,
      });
    }

    const { rows: turmas } = await client.query(
      `
      SELECT id
      FROM turmas
      WHERE evento_id = $1
      `,
      [id]
    );

    for (const turma of turmas) {
      await excluirTurmaSemUso(client, Number(turma.id));
    }

    await client.query(`DELETE FROM evento_registros WHERE evento_id = $1`, [id]);
    await client.query(`DELETE FROM evento_cargos WHERE evento_id = $1`, [id]);
    await client.query(`DELETE FROM evento_unidades WHERE evento_id = $1`, [id]);

    const deleted = await client.query(
      `
      DELETE FROM eventos
      WHERE id = $1
      RETURNING id, titulo
      `,
      [id]
    );

    await client.query("COMMIT");

    logInfo(rid, "excluirEvento OK", { id });

    return sendOk(res, {
      message: "Evento excluído com sucesso.",
      data: deleted.rows[0],
    });
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {}

    logError(rid, "excluirEvento erro", err);

    return sendError(res, {
      status: 500,
      code: "EVENTO_EXCLUIR_ERRO",
      message: "Erro ao excluir evento.",
      rid,
      error: err,
    });
  } finally {
    client.release();
  }
}

/* ───────────────────────────────────────────────────────────────
   Atualizar somente arquivos
─────────────────────────────────────────────────────────────── */

async function atualizarArquivosDoEvento(req, res) {
  const rid = mkRid();

  if (!isAdmin(req)) {
    return forbidden(res);
  }

  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return badRequest(res, "evento_id inválido.", {
      rid,
      code: "EVENTO_ID_INVALIDO",
    });
  }

  const body = normalizeBodyMultipart(req.body || {});

  if (
    !req._folderFile?.buffer?.length &&
    !req._programacaoFile?.buffer?.length &&
    body.remover_folder !== true &&
    body.remover_programacao !== true
  ) {
    return badRequest(res, "Nenhum arquivo enviado.", {
      rid,
      code: "EVENTO_ARQUIVO_AUSENTE",
    });
  }

  const client = await db.getClient();

  try {
    await client.query("BEGIN");

    const existe = await client.query(`SELECT id FROM eventos WHERE id = $1`, [
      id,
    ]);

    if (!existe.rowCount) {
      await client.query("ROLLBACK");

      return sendError(res, {
        status: 404,
        code: "EVENTO_NAO_ENCONTRADO",
        message: "Evento não encontrado.",
        rid,
      });
    }

    if (body.remover_folder === true) {
      await limparFolderDoEvento(client, id);
    }

    if (body.remover_programacao === true) {
      await limparProgramacaoDoEvento(client, id);
    }

    if (req._folderFile?.buffer?.length) {
      await salvarFolderNoEvento(client, id, req._folderFile);
    }

    if (req._programacaoFile?.buffer?.length) {
      await salvarProgramacaoNoEvento(client, id, req._programacaoFile);
    }

    const updated = await client.query(
      `
      SELECT
        id,
        folder_mime,
        folder_size,
        folder_updated_at,
        programacao_pdf_mime,
        programacao_pdf_size,
        programacao_pdf_nome_original,
        programacao_pdf_updated_at
      FROM eventos
      WHERE id = $1
      `,
      [id]
    );

    await client.query("COMMIT");

    logInfo(rid, "atualizarArquivosDoEvento OK", { id });

    return sendOk(res, {
      message: "Arquivos do evento atualizados.",
      data: updated.rows[0],
    });
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {}

    logError(rid, "atualizarArquivosDoEvento erro", err);

    return sendError(res, {
      status: err.status || 500,
      code: err.code || "EVENTO_ARQUIVO_ATUALIZAR_ERRO",
      message: err.status ? err.message : "Erro ao atualizar arquivos do evento.",
      rid,
      error: err,
    });
  } finally {
    client.release();
  }
}

/* ───────────────────────────────────────────────────────────────
   Organizadores disponíveis
─────────────────────────────────────────────────────────────── */

async function listarOrganizadoresDisponiveis(req, res) {
  const rid = mkRid();

  if (!isAdmin(req)) {
    return forbidden(res);
  }

  logStart(rid, "listarOrganizadoresDisponiveis");

  try {
    const { rows } = await db.query(
      `
      SELECT id, nome, email
      FROM usuarios
      WHERE perfil IN ('organizador', 'administrador')
      ORDER BY nome ASC
      `
    );

    logInfo(rid, "listarOrganizadoresDisponiveis OK", {
      count: rows.length,
    });

    return sendOk(res, {
      message: "Organizadores disponíveis carregados.",
      data: rows,
      meta: {
        total: rows.length,
      },
    });
  } catch (err) {
    logError(rid, "listarOrganizadoresDisponiveis erro", err);

    return sendError(res, {
      status: 500,
      code: "ORGANIZADOR_DISPONIVEL_LISTAR_ERRO",
      message: "Erro ao listar organizadores disponíveis.",
      rid,
      error: err,
    });
  }
}

/* ───────────────────────────────────────────────────────────────
   Exports
─────────────────────────────────────────────────────────────── */

module.exports = {
  uploadEventos,
  uploadFolderOnly,
  uploadProgramacaoOnly,

  listarEventosAdmin,
  criarEvento,
  atualizarEvento,
  excluirEvento,
  publicarEvento,
  despublicarEvento,
  atualizarArquivosDoEvento,
  listarOrganizadoresDisponiveis,

  normalizeBodyMultipart,
  salvarFolderNoEvento,
  limparFolderDoEvento,
  salvarProgramacaoNoEvento,
  limparProgramacaoDoEvento,
};