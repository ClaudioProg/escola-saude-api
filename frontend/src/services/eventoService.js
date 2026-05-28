// ✅ frontend/src/services/eventoService.js — v2.1
// Atualizado em: 18/05/2026
// Plataforma Escola da Saúde
//
// Service específico do domínio de eventos.
//
// Responsabilidades:
// - centralizar chamadas do módulo de eventos;
// - remover chamadas espalhadas nas páginas;
// - eliminar fallback de rotas antigas;
// - padronizar payload de criação/edição;
// - padronizar folder/programação em banco;
// - centralizar inscrições vinculadas aos eventos;
// - centralizar consultas administrativas de inscritos por turma;
// - manter date-only seguro em YYYY-MM-DD;
// - operar somente com contrato oficial singular.
//
// Contratos oficiais:
// - api.js é o único cliente HTTP;
// - API base oficial: VITE_API_BASE_URL;
// - token oficial: localStorage["token"], tratado pelo api.js;
// - módulo oficial backend de evento: /evento;
// - módulo oficial backend de turma: /turma;
// - folder: campo multipart "folder";
// - programação: campo multipart "programacao";
// - inscrição: /inscricao;
// - turma vinculada ao evento: /turma/evento/:evento_id;
// - turma simples vinculada ao evento: /turma/evento/:evento_id/simples;
// - inscritos por turma: /inscricao/turma/:turma_id;
// - conflito de inscrição: /inscricao/conflito/:turma_id;
// - cancelamento por inscrição: DELETE /inscricao/:inscricao_id;
// - cancelamento próprio por turma: DELETE /inscricao/minha/turma/:turma_id;
// - questionário/configuração pós-curso: pos_curso;
// - sem "file" como alias de folder;
// - sem folder_url/programacao_pdf_url como fonte funcional;
// - sem rotas /eventos;
// - sem authFetch manual;
// - sem authToken/access_token;
// - sem aliases de payload;
// - sem organizador_assinante_id;
// - sem assinante único legado;
// - turmas usam organizadores, palestrantes e assinantes;
// - Rafaella Pitol, ID 17, é assinante obrigatória;
// - Fábio Lopez, ID 2474, é opcional e fica por último quando selecionado.

import {
  apiGet,
  apiPost,
  apiPut,
  apiDelete,
  apiUpload,
  apiEventoFolderResponse,
  apiEventoProgramacaoResponse,
  apiEventoProgramacaoFile,
  makeApiUrl,
} from "./api";

/* ─────────────────────────────────────────────────────────────
   Constantes
────────────────────────────────────────────────────────────── */

export const EVENTO_RESTRITO_MODO = Object.freeze({
  TODOS_SERVIDORES: "todos_servidores",
  LISTA_REGISTROS: "lista_registros",
});

export const EVENTO_STATUS = Object.freeze({
  PROGRAMADO: "programado",
  ANDAMENTO: "andamento",
  ENCERRADO: "encerrado",
  SEM_DATAS: "sem_datas",
});

const EVENTO_BASE = "/evento";
const TURMA_BASE = "/turma";
const INSCRICAO_BASE = "/inscricao";

const RAFAELLA_PITOL_ID = 17;
const FABIO_LOPEZ_ID = 2474;
const MAX_ASSINANTES_TURMA = 3;

/* ─────────────────────────────────────────────────────────────
   Helpers básicos
────────────────────────────────────────────────────────────── */

export function cleanObject(obj = {}) {
  return Object.fromEntries(
    Object.entries(obj || {}).filter(([, value]) => {
      if (value === undefined || value === null) return false;
      if (typeof value === "string" && value.trim() === "") return false;
      return true;
    })
  );
}

export function ymd(value) {
  if (typeof value !== "string") return "";

  const s = value.trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.slice(0, 10);

  return "";
}

export function hhmm(value, fallback = "") {
  if (typeof value !== "string") return fallback;

  const s = value.trim();

  if (!s) return fallback;
  if (/^\d{2}:\d{2}$/.test(s)) return s;
  if (/^\d{2}:\d{2}:\d{2}$/.test(s)) return s.slice(0, 5);

  return fallback;
}

export function onlyDigits(value) {
  return String(value ?? "").replace(/\D/g, "");
}

export function toPositiveIntOrNull(value) {
  const n = Number(value);

  if (!Number.isInteger(n) || n <= 0) return null;

  return n;
}

export function extractIds(value) {
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
        .map((item) => Number(String(item).trim()))
        .filter((n) => Number.isInteger(n) && n > 0)
    ),
  ];
}

export function extractRegistros(value) {
  if (!Array.isArray(value)) return [];

  return [
    ...new Set(
      value
        .map((item) => {
          if (typeof item === "object" && item !== null) {
            return item.registro || "";
          }

          return item;
        })
        .map((item) => onlyDigits(item))
        .filter(Boolean)
    ),
  ];
}

export function extractCargoIds(value) {
  return extractIds(value);
}

export function extractUnidadeIds(value) {
  return extractIds(value);
}

export function normalizeTitleSort(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export function isAbortLike(error) {
  if (!error) return false;

  const name = String(error?.name || "");
  const message = String(error?.message || error || "");
  const dataMessage = String(error?.data?.message || "");
  const full = `${name} ${message} ${dataMessage}`.toLowerCase();
  const status = Number(error?.status ?? error?.response?.status ?? 0);

  return (
    name === "AbortError" ||
    status === 0 ||
    full.includes("abort") ||
    full.includes("unmount") ||
    full.includes("canceled") ||
    full.includes("cancelled") ||
    full.includes("failed to fetch") ||
    full.includes("falha de rede") ||
    full.includes("cors") ||
    full.includes("timeout") ||
    full.includes("tempo de resposta excedido")
  );
}

function unwrapData(response) {
  if (response?.data !== undefined) return response.data;
  return response;
}

function unwrapDataArray(response) {
  const data = unwrapData(response);
  return Array.isArray(data) ? data : [];
}

function unwrapDataObject(response) {
  const data = unwrapData(response);
  return data && typeof data === "object" && !Array.isArray(data) ? data : null;
}

function isUploadFile(value) {
  const hasFile = typeof File !== "undefined";
  const hasBlob = typeof Blob !== "undefined";

  return Boolean(
    (hasFile && value instanceof File) || (hasBlob && value instanceof Blob)
  );
}

function fileName(value, fallback) {
  return typeof value?.name === "string" && value.name.trim()
    ? value.name.trim()
    : fallback;
}

/* ─────────────────────────────────────────────────────────────
   Datas/status
────────────────────────────────────────────────────────────── */

export function yearFromYmd(value) {
  const date = ymd(value);

  if (!date) return null;

  const year = Number(date.slice(0, 4));

  return Number.isInteger(year) ? year : null;
}

export function getEventYear(evento) {
  const direct =
    yearFromYmd(evento?.data_inicio) ||
    yearFromYmd(evento?.data_inicio_geral) ||
    yearFromYmd(evento?.data_fim) ||
    yearFromYmd(evento?.data_fim_geral);

  if (direct) return direct;

  const turmas = Array.isArray(evento?.turmas) ? evento.turmas : [];

  for (const turma of turmas) {
    const turmaYear =
      yearFromYmd(turma?.data_inicio) ||
      yearFromYmd(turma?.data_fim) ||
      yearFromYmd(turma?.data);

    if (turmaYear) return turmaYear;

    const datas = Array.isArray(turma?.datas) ? turma.datas : [];

    for (const d of datas) {
      const dataYear = yearFromYmd(d?.data);
      if (dataYear) return dataYear;
    }
  }

  return yearFromYmd(evento?.criado_em) || yearFromYmd(evento?.atualizado_em);
}

export function getEventStartDate(evento) {
  const candidates = [];

  const push = (value) => {
    const d = ymd(value);
    if (d) candidates.push(d);
  };

  push(evento?.data_inicio);
  push(evento?.data_inicio_geral);

  const turmas = Array.isArray(evento?.turmas) ? evento.turmas : [];

  for (const turma of turmas) {
    push(turma?.data_inicio);

    const datas = Array.isArray(turma?.datas) ? turma.datas : [];
    for (const d of datas) push(d?.data);
  }

  if (!candidates.length) return "9999-12-31";

  return [...candidates].sort()[0];
}

export function deduzStatusEvento(evento) {
  const raw = String(evento?.status || "").trim().toLowerCase();

  if (raw === EVENTO_STATUS.ANDAMENTO) return EVENTO_STATUS.ANDAMENTO;
  if (raw === EVENTO_STATUS.PROGRAMADO) return EVENTO_STATUS.PROGRAMADO;
  if (raw === EVENTO_STATUS.ENCERRADO) return EVENTO_STATUS.ENCERRADO;
  if (raw === EVENTO_STATUS.SEM_DATAS) return EVENTO_STATUS.SEM_DATAS;

  return EVENTO_STATUS.PROGRAMADO;
}

export function isEventoAtivo(evento) {
  const status = deduzStatusEvento(evento);

  return (
    status === EVENTO_STATUS.PROGRAMADO || status === EVENTO_STATUS.ANDAMENTO
  );
}

export function sortEventosAdmin(a, b) {
  const da = getEventStartDate(a);
  const db = getEventStartDate(b);

  if (da !== db) return da.localeCompare(db);

  return normalizeTitleSort(a?.titulo).localeCompare(
    normalizeTitleSort(b?.titulo),
    "pt-BR"
  );
}

export function sortEventosPublicos(a, b) {
  const da = ymd(a?.data_inicio_geral || a?.data_inicio || getEventStartDate(a));
  const db = ymd(b?.data_inicio_geral || b?.data_inicio || getEventStartDate(b));

  if (da && db && da !== db) return da.localeCompare(db);
  if (da && !db) return -1;
  if (!da && db) return 1;

  return normalizeTitleSort(a?.titulo).localeCompare(
    normalizeTitleSort(b?.titulo),
    "pt-BR"
  );
}

/* ─────────────────────────────────────────────────────────────
   Turmas / payload
────────────────────────────────────────────────────────────── */

export function calcularCargaHorariaPorDatas(datas = []) {
  let total = 0;

  for (const item of datas || []) {
    const inicio = hhmm(item?.horario_inicio || "00:00");
    const fim = hhmm(item?.horario_fim || "00:00");

    const [h1, m1] = inicio.split(":").map(Number);
    const [h2, m2] = fim.split(":").map(Number);

    if (!Number.isFinite(h1) || !Number.isFinite(h2)) continue;

    const minutosInicio = h1 * 60 + (Number.isFinite(m1) ? m1 : 0);
    const minutosFim = h2 * 60 + (Number.isFinite(m2) ? m2 : 0);

    const horas = Math.max(0, (minutosFim - minutosInicio) / 60);

    total += horas >= 8 ? horas - 1 : horas;
  }

  return Math.max(1, Math.round(total));
}

export function normalizeDatasTurma(turma = {}) {
  const datas = Array.isArray(turma?.datas) ? turma.datas : [];

  const horarioInicioBase = hhmm(turma?.horario_inicio || "08:00", "08:00");
  const horarioFimBase = hhmm(turma?.horario_fim || "17:00", "17:00");

  return (datas || [])
    .map((d) => ({
      data: ymd(d?.data),
      horario_inicio: hhmm(d?.horario_inicio || horarioInicioBase),
      horario_fim: hhmm(d?.horario_fim || horarioFimBase),
    }))
    .filter((d) => d.data && d.horario_inicio && d.horario_fim)
    .sort((a, b) => a.data.localeCompare(b.data));
}

export function normalizePalestrantesTurma(value = []) {
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
        usuario_id: toPositiveIntOrNull(item?.usuario_id),
      };
    })
    .filter((item) => item.nome || item.usuario_id);
}

export function normalizeAssinantesTurma(value = []) {
  const ids = extractIds(value);
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

export function normalizeTurmas(turmas = []) {
  return (Array.isArray(turmas) ? turmas : [])
    .map((turma) => {
      const datas = normalizeDatasTurma(turma);

      const nome = String(turma?.nome || "Turma Única").trim();

      const vagas = Number(turma?.vagas_total);
      const vagasTotal = Number.isInteger(vagas) && vagas > 0 ? vagas : 1;

      const cargaRaw = Number(turma?.carga_horaria);
      const cargaHoraria =
        Number.isInteger(cargaRaw) && cargaRaw > 0
          ? cargaRaw
          : calcularCargaHorariaPorDatas(datas);

      const organizadores = extractIds(turma?.organizadores || []);
      const palestrantes = normalizePalestrantesTurma(turma?.palestrantes || []);
      const assinantes = normalizeAssinantesTurma(turma?.assinantes || []);

      return cleanObject({
        ...(toPositiveIntOrNull(turma?.id) ? { id: Number(turma.id) } : {}),

        nome,
        vagas_total: vagasTotal,
        carga_horaria: cargaHoraria,
        datas,
        organizadores,
        palestrantes,
        assinantes,
      });
    })
    .filter(
      (turma) =>
        turma.nome && Array.isArray(turma.datas) && turma.datas.length
    );
}

export function validarTurmasComorganizadores(turmas = []) {
  const lista = Array.isArray(turmas) ? turmas : [];

  if (!lista.length) {
    return "Informe ao menos uma turma.";
  }

  for (let i = 0; i < lista.length; i += 1) {
    const turma = lista[i];
    const label = turma?.nome || `Turma ${i + 1}`;

    if (!String(turma?.nome || "").trim()) {
      return `${label}: informe o nome da turma.`;
    }

    if (!Array.isArray(turma?.datas) || !turma.datas.length) {
      return `${label}: informe ao menos uma data.`;
    }

    const organizadores = extractIds(turma?.organizadores);

    if (!organizadores.length) {
      return `${label}: informe ao menos um organizador.`;
    }

    const assinantes = normalizeAssinantesTurma(turma?.assinantes || []);

    if (!assinantes.includes(RAFAELLA_PITOL_ID)) {
      return `${label}: a assinatura da Rafaella Pitol é obrigatória.`;
    }

    if (assinantes.length < 1 || assinantes.length > MAX_ASSINANTES_TURMA) {
      return `${label}: informe de 1 a 3 assinantes.`;
    }
  }

  return "";
}

function normalizePosCurso(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const obrigatorio = value.obrigatorio === true;
  const questionarioId = toPositiveIntOrNull(value.questionario_id);
  const tentativas = toPositiveIntOrNull(value.tentativas);
  const tempoMinutos = toPositiveIntOrNull(value.tempo_minutos);
  const notaMinima = Number(value.nota_minima);

  return cleanObject({
    obrigatorio,
    titulo: String(value.titulo || "").trim(),
    nota_minima: Number.isFinite(notaMinima) ? notaMinima : undefined,
    tentativas: tentativas || undefined,
    tempo_minutos: tempoMinutos || undefined,
    questionario_id: questionarioId || undefined,
  });
}

export function buildEventoPayload(dados = {}, baseServidor = null) {
  const source = dados || {};
  const base = baseServidor || {};

  const titulo = String(source?.titulo ?? base?.titulo ?? "").trim();
  const descricao = String(source?.descricao ?? base?.descricao ?? "").trim();
  const local = String(source?.local ?? base?.local ?? "").trim();
  const tipo = String(source?.tipo ?? base?.tipo ?? "").trim();
  const publicoAlvo = String(
    source?.publico_alvo ?? base?.publico_alvo ?? ""
  ).trim();

  const unidadeId = toPositiveIntOrNull(source?.unidade_id ?? base?.unidade_id);

  const restrito = Boolean(
    source?.restrito ??
      (typeof base?.restrito === "boolean" ? base.restrito : false)
  );

  const restritoModo = restrito
    ? source?.restrito_modo ?? base?.restrito_modo ?? null
    : null;

  const cargosPermitidos =
    restrito && typeof source?.cargos_permitidos !== "undefined"
      ? extractCargoIds(source.cargos_permitidos)
      : restrito
        ? extractCargoIds(base?.cargos_permitidos)
        : [];

  const unidadesPermitidas =
    restrito && typeof source?.unidades_permitidas !== "undefined"
      ? extractUnidadeIds(source.unidades_permitidas)
      : restrito
        ? extractUnidadeIds(base?.unidades_permitidas)
        : [];

  const registrosPermitidos =
    restrito && restritoModo === EVENTO_RESTRITO_MODO.LISTA_REGISTROS
      ? extractRegistros(
          Array.isArray(source?.registros_permitidos)
            ? source.registros_permitidos
            : Array.isArray(base?.registros_permitidos)
              ? base.registros_permitidos
              : []
        )
      : [];

  const turmasFonte =
    Array.isArray(source?.turmas) && source.turmas.length
      ? source.turmas
      : Array.isArray(base?.turmas) && base.turmas.length
        ? base.turmas
        : [];

  const turmas = normalizeTurmas(turmasFonte);

  const posCurso = normalizePosCurso(source?.pos_curso ?? base?.pos_curso);

  const payload = cleanObject({
    titulo,
    descricao,
    local,
    tipo,
    unidade_id: unidadeId,
    publico_alvo: publicoAlvo,

    restrito,
    restrito_modo: restrito ? restritoModo : null,

    ...(restrito && cargosPermitidos.length
      ? { cargos_permitidos: cargosPermitidos }
      : {}),

    ...(restrito && unidadesPermitidas.length
      ? { unidades_permitidas: unidadesPermitidas }
      : {}),

    ...(restrito &&
    restritoModo === EVENTO_RESTRITO_MODO.LISTA_REGISTROS &&
    registrosPermitidos.length
      ? { registros_permitidos: registrosPermitidos }
      : {}),

    ...(turmas.length ? { turmas } : {}),

    ...(source?.remover_folder === true ? { remover_folder: true } : {}),
    ...(source?.remover_programacao === true
      ? { remover_programacao: true }
      : {}),

    ...(posCurso ? { pos_curso: posCurso } : {}),
  });

  return payload;
}

export function validateEventoPayload(payload = {}) {
  if (!String(payload?.titulo || "").trim()) return "Informe o título do evento.";
  if (!String(payload?.local || "").trim()) return "Informe o local do evento.";
  if (!String(payload?.tipo || "").trim()) return "Informe o tipo do evento.";
  if (!toPositiveIntOrNull(payload?.unidade_id)) {
    return "Informe a unidade do evento.";
  }

  if (!Array.isArray(payload?.turmas) || !payload.turmas.length) {
    return "Informe ao menos uma turma para o evento.";
  }

  const erroTurmas = validarTurmasComorganizadores(payload.turmas);
  if (erroTurmas) return erroTurmas;

  if (
    payload?.restrito === true &&
    payload?.restrito_modo === EVENTO_RESTRITO_MODO.LISTA_REGISTROS &&
    (!Array.isArray(payload?.registros_permitidos) ||
      !payload.registros_permitidos.length)
  ) {
    return "Evento restrito por lista precisa ter ao menos um registro autorizado.";
  }

  return "";
}

function appendJsonField(formData, key, value) {
  if (value === undefined || value === null) return;

  if (typeof value === "object") {
    formData.append(key, JSON.stringify(value));
    return;
  }

  formData.append(key, String(value));
}

export function buildEventoFormData(payload = {}, arquivos = {}) {
  const formData = new FormData();

  Object.entries(payload || {}).forEach(([key, value]) => {
    appendJsonField(formData, key, value);
  });

  if (isUploadFile(arquivos?.folder)) {
    formData.append(
      "folder",
      arquivos.folder,
      fileName(arquivos.folder, "folder.jpg")
    );
  }

  if (isUploadFile(arquivos?.programacao)) {
    formData.append(
      "programacao",
      arquivos.programacao,
      fileName(arquivos.programacao, "programacao.pdf")
    );
  }

  return formData;
}

export function shouldUseMultipart(payload = {}, arquivos = {}) {
  return Boolean(
    isUploadFile(arquivos?.folder) ||
      isUploadFile(arquivos?.programacao) ||
      payload?.remover_folder === true ||
      payload?.remover_programacao === true
  );
}

/* ─────────────────────────────────────────────────────────────
   URLs oficiais de arquivos
────────────────────────────────────────────────────────────── */

export function getEventoFolderPath(eventoId) {
  const id = toPositiveIntOrNull(eventoId);
  return id ? `${EVENTO_BASE}/${id}/folder` : "";
}

export function getEventoProgramacaoPath(eventoId) {
  const id = toPositiveIntOrNull(eventoId);
  return id ? `${EVENTO_BASE}/${id}/programacao` : "";
}

export function getEventoFolderUrl(evento) {
  const id = toPositiveIntOrNull(evento?.id ?? evento);

  if (!id) return "";

  const version =
    evento?.folder_updated_at || evento?.atualizado_em || evento?.criado_em || "";

  const path = getEventoFolderPath(id);
  const url = makeApiUrl(path);

  if (!version) return url;

  return `${url}${url.includes("?") ? "&" : "?"}v=${encodeURIComponent(
    String(version)
  )}`;
}

export function getEventoProgramacaoUrl(evento) {
  const id = toPositiveIntOrNull(evento?.id ?? evento);

  if (!id) return "";

  const version =
    evento?.programacao_pdf_updated_at ||
    evento?.atualizado_em ||
    evento?.criado_em ||
    "";

  const path = getEventoProgramacaoPath(id);
  const url = makeApiUrl(path);

  if (!version) return url;

  return `${url}${url.includes("?") ? "&" : "?"}v=${encodeURIComponent(
    String(version)
  )}`;
}

/* ─────────────────────────────────────────────────────────────
   API — eventos administrativos
────────────────────────────────────────────────────────────── */

export async function listarEventosAdmin(opts = {}) {
  const response = await apiGet(`${EVENTO_BASE}/administrador`, {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });

  return unwrapDataArray(response);
}

export async function buscarEvento(eventoId, opts = {}) {
  const id = toPositiveIntOrNull(eventoId);

  if (!id) throw new Error("evento_id é obrigatório.");

  const response = await apiGet(`${EVENTO_BASE}/${id}`, {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });

  return unwrapDataObject(response);
}

export async function listarTurmasDoEvento(eventoId, opts = {}) {
  const id = toPositiveIntOrNull(eventoId);

  if (!id) throw new Error("evento_id é obrigatório.");

  const response = await apiGet(`${TURMA_BASE}/evento/${id}`, {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });

  return unwrapDataArray(response);
}

export async function listarTurmasSimplesDoEvento(eventoId, opts = {}) {
  const id = toPositiveIntOrNull(eventoId);

  if (!id) throw new Error("evento_id é obrigatório.");

  const response = await apiGet(`${TURMA_BASE}/evento/${id}/simples`, {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });

  return unwrapDataArray(response);
}

export async function buscarEventoCompleto(eventoId, opts = {}) {
  const evento = await buscarEvento(eventoId, opts);

  if (!evento?.id) return null;

  let turmas = [];

  try {
    turmas = await listarTurmasDoEvento(evento.id, {
      on401: "redirect",
      on403: "silent",
      ...opts,
    });
  } catch (error) {
    if (!isAbortLike(error)) {
      console.warn("[eventoService.buscarEventoCompleto] falha ao carregar turmas completas", {
        evento_id: evento.id,
        message: error?.message,
        status: error?.status,
      });
    }

    turmas = Array.isArray(evento?.turmas) ? evento.turmas : [];
  }

  return {
    ...evento,
    turmas,
  };
}

function normalizeEventoArquivos(dados = {}, arquivos = {}) {
  return {
    folder: arquivos?.folder || dados?.folderFile || null,
    programacao: arquivos?.programacao || dados?.programacaoFile || null,
  };
}

export async function criarEvento(dados, arquivos = {}, opts = {}) {
  const payload = buildEventoPayload(dados);
  const arquivosNormalizados = normalizeEventoArquivos(dados, arquivos);

  const erro = validateEventoPayload(payload);

  if (erro) throw new Error(erro);

  if (shouldUseMultipart(payload, arquivosNormalizados)) {
    const formData = buildEventoFormData(payload, arquivosNormalizados);

    return apiUpload(EVENTO_BASE, formData, {
      auth: true,
      on401: "redirect",
      on403: "silent",
      ...opts,
    });
  }

  return apiPost(EVENTO_BASE, payload, {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function atualizarEvento(eventoId, dados, arquivos = {}, opts = {}) {
  const id = toPositiveIntOrNull(eventoId);

  if (!id) throw new Error("evento_id é obrigatório.");

  const payload = buildEventoPayload(dados, dados?.baseServidor || null);
  const arquivosNormalizados = normalizeEventoArquivos(dados, arquivos);

  const erro = validateEventoPayload(payload);

  if (erro) throw new Error(erro);

  if (shouldUseMultipart(payload, arquivosNormalizados)) {
    const formData = buildEventoFormData(payload, arquivosNormalizados);

    return apiUpload(`${EVENTO_BASE}/${id}`, formData, {
      method: "PUT",
      auth: true,
      on401: "redirect",
      on403: "silent",
      ...opts,
    });
  }

  return apiPut(`${EVENTO_BASE}/${id}`, payload, {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function excluirEvento(eventoId, opts = {}) {
  const id = toPositiveIntOrNull(eventoId);

  if (!id) throw new Error("evento_id é obrigatório.");

  return apiDelete(`${EVENTO_BASE}/${id}`, {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function publicarEvento(eventoId, opts = {}) {
  const id = toPositiveIntOrNull(eventoId);

  if (!id) throw new Error("evento_id é obrigatório.");

  return apiPost(`${EVENTO_BASE}/${id}/publicar`, null, {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function despublicarEvento(eventoId, opts = {}) {
  const id = toPositiveIntOrNull(eventoId);

  if (!id) throw new Error("evento_id é obrigatório.");

  return apiPost(`${EVENTO_BASE}/${id}/despublicar`, null, {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function alternarPublicacaoEvento(evento, opts = {}) {
  const id = toPositiveIntOrNull(evento?.id ?? evento);

  if (!id) throw new Error("evento_id é obrigatório.");

  if (evento?.publicado) {
    return despublicarEvento(id, opts);
  }

  return publicarEvento(id, opts);
}

export async function atualizarArquivosEvento(eventoId, arquivos = {}, opts = {}) {
  const id = toPositiveIntOrNull(eventoId);

  if (!id) throw new Error("evento_id é obrigatório.");

  const formData = buildEventoFormData(
    {
      ...(arquivos?.remover_folder === true ? { remover_folder: true } : {}),
      ...(arquivos?.remover_programacao === true
        ? { remover_programacao: true }
        : {}),
    },
    {
      folder: arquivos?.folder || null,
      programacao: arquivos?.programacao || null,
    }
  );

  return apiUpload(`${EVENTO_BASE}/${id}/arquivo`, formData, {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function atualizarFolderEvento(eventoId, folder, opts = {}) {
  const id = toPositiveIntOrNull(eventoId);

  if (!id) throw new Error("evento_id é obrigatório.");
  if (!isUploadFile(folder)) {
    throw new Error("folder é obrigatório.");
  }

  const formData = new FormData();
  formData.append("folder", folder, fileName(folder, "folder.jpg"));

  return apiUpload(`${EVENTO_BASE}/${id}/folder`, formData, {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function atualizarProgramacaoEvento(eventoId, programacao, opts = {}) {
  const id = toPositiveIntOrNull(eventoId);

  if (!id) throw new Error("evento_id é obrigatório.");
  if (!isUploadFile(programacao)) {
    throw new Error("programacao é obrigatória.");
  }

  const formData = new FormData();
  formData.append(
    "programacao",
    programacao,
    fileName(programacao, "programacao.pdf")
  );

  return apiUpload(`${EVENTO_BASE}/${id}/programacao`, formData, {
  auth: true,
  on401: "redirect",
  on403: "silent",
  ...opts,
});
}

/* ─────────────────────────────────────────────────────────────
   API — eventos públicos/usuário
────────────────────────────────────────────────────────────── */

export async function listarEventosPublicos(opts = {}) {
  const response = await apiGet(EVENTO_BASE, {
    auth: true,
    on401: "silent",
    on403: "silent",
    ...opts,
  });

  return unwrapDataArray(response);
}

export async function listarEventosParaMim(opts = {}) {
  const response = await apiGet(`${EVENTO_BASE}/para-mim`, {
    auth: true,
    on401: "silent",
    on403: "silent",
    ...opts,
  });

  return unwrapDataArray(response);
}

export async function obterFolderEventoResponse(eventoId, opts = {}) {
  const id = toPositiveIntOrNull(eventoId);

  if (!id) throw new Error("evento_id é obrigatório.");

  return apiEventoFolderResponse(id, opts);
}

export async function obterProgramacaoEventoResponse(eventoId, opts = {}) {
  const id = toPositiveIntOrNull(eventoId);

  if (!id) throw new Error("evento_id é obrigatório.");

  return apiEventoProgramacaoResponse(id, opts);
}

export async function obterProgramacaoEventoFile(eventoId, opts = {}) {
  const id = toPositiveIntOrNull(eventoId);

  if (!id) throw new Error("evento_id é obrigatório.");

  return apiEventoProgramacaoFile(id, opts);
}

export async function baixarProgramacaoEvento(eventoId, opts = {}) {
  const { blob, filename } = await obterProgramacaoEventoFile(eventoId, opts);

  return {
    blob,
    filename: filename || "programacao.pdf",
  };
}

/* ─────────────────────────────────────────────────────────────
   API — inscrições
────────────────────────────────────────────────────────────── */

export async function listarMinhasInscricoes(opts = {}) {
  const response = await apiGet(`${INSCRICAO_BASE}/minha`, {
    auth: true,
    on401: "silent",
    on403: "silent",
    ...opts,
  });

  return unwrapDataArray(response);
}

export async function listarInscritosDaTurma(turmaId, opts = {}) {
  const id = toPositiveIntOrNull(turmaId);

  if (!id) throw new Error("turma_id é obrigatório.");

  const response = await apiGet(`${INSCRICAO_BASE}/turma/${id}`, {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });

  return unwrapDataArray(response);
}

export async function inscreverNaTurma(turmaId, opts = {}) {
  const id = toPositiveIntOrNull(turmaId);

  if (!id) throw new Error("turma_id é obrigatório.");

  return apiPost(
    INSCRICAO_BASE,
    { turma_id: id },
    {
      auth: true,
      on401: "redirect",
      on403: "silent",
      ...opts,
    }
  );
}

export async function cancelarInscricao(inscricaoId, opts = {}) {
  const id = toPositiveIntOrNull(inscricaoId);

  if (!id) throw new Error("inscricao_id é obrigatório.");

  return apiDelete(`${INSCRICAO_BASE}/${id}`, {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function cancelarMinhaInscricaoPorTurma(turmaId, opts = {}) {
  const id = toPositiveIntOrNull(turmaId);

  if (!id) throw new Error("turma_id é obrigatório.");

  return apiDelete(`${INSCRICAO_BASE}/minha/turma/${id}`, {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function verificarConflitoTurma(turmaId, opts = {}) {
  const id = toPositiveIntOrNull(turmaId);

  if (!id) throw new Error("turma_id é obrigatório.");

  const response = await apiGet(`${INSCRICAO_BASE}/conflito/${id}`, {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });

  return unwrapDataObject(response);
}

export function getInscricaoPorTurmaId(inscricoes = [], turmaId) {
  const id = toPositiveIntOrNull(turmaId);

  if (!id) return null;

  return (
    (Array.isArray(inscricoes) ? inscricoes : []).find(
      (item) => Number(item?.turma_id) === id
    ) || null
  );
}

/* ─────────────────────────────────────────────────────────────
   Facade
────────────────────────────────────────────────────────────── */

export const EventoService = {
  constants: {
    EVENTO_RESTRITO_MODO,
    EVENTO_STATUS,
    RAFAELLA_PITOL_ID,
    FABIO_LOPEZ_ID,
    MAX_ASSINANTES_TURMA,
  },

  helpers: {
    cleanObject,
    ymd,
    hhmm,
    onlyDigits,
    toPositiveIntOrNull,
    extractIds,
    extractRegistros,
    extractCargoIds,
    extractUnidadeIds,
    normalizeTitleSort,
    isAbortLike,
    yearFromYmd,
    getEventYear,
    getEventStartDate,
    deduzStatusEvento,
    isEventoAtivo,
    sortEventosAdmin,
    sortEventosPublicos,
    calcularCargaHorariaPorDatas,
    normalizeDatasTurma,
    normalizePalestrantesTurma,
    normalizeAssinantesTurma,
    normalizeTurmas,
    validarTurmasComorganizadores,
    buildEventoPayload,
    validateEventoPayload,
    buildEventoFormData,
    shouldUseMultipart,
    getEventoFolderPath,
    getEventoProgramacaoPath,
    getEventoFolderUrl,
    getEventoProgramacaoUrl,
    getInscricaoPorTurmaId,
  },

  admin: {
    listar: listarEventosAdmin,
    buscar: buscarEvento,
    buscarCompleto: buscarEventoCompleto,
    listarTurmas: listarTurmasDoEvento,
    listarTurmasSimples: listarTurmasSimplesDoEvento,
    criar: criarEvento,
    atualizar: atualizarEvento,
    excluir: excluirEvento,
    publicar: publicarEvento,
    despublicar: despublicarEvento,
    alternarPublicacao: alternarPublicacaoEvento,
    atualizarArquivos: atualizarArquivosEvento,
    atualizarFolder: atualizarFolderEvento,
    atualizarProgramacao: atualizarProgramacaoEvento,
  },

  publico: {
    listar: listarEventosPublicos,
    listarParaMim: listarEventosParaMim,
    buscar: buscarEvento,
    buscarCompleto: buscarEventoCompleto,
    listarTurmas: listarTurmasDoEvento,
    listarTurmasSimples: listarTurmasSimplesDoEvento,
    folderResponse: obterFolderEventoResponse,
    programacaoResponse: obterProgramacaoEventoResponse,
    programacaoFile: obterProgramacaoEventoFile,
    baixarProgramacao: baixarProgramacaoEvento,
  },

  inscricao: {
    minhas: listarMinhasInscricoes,
    listarInscritosDaTurma,
    inscrever: inscreverNaTurma,
    cancelar: cancelarInscricao,
    cancelarMinhaPorTurma: cancelarMinhaInscricaoPorTurma,
    verificarConflitoTurma,
    getPorTurmaId: getInscricaoPorTurmaId,
  },
};

export default EventoService;