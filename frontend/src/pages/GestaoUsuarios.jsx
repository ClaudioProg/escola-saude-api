// ✅ frontend/src/pages/GestaoUsuarios.jsx — v2.0
// Plataforma Escola da Saúde
// Gestão premium de usuários com paginação server-side, contrato único, filtros oficiais e UX mobile-first.

import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "react-toastify";
import Skeleton from "react-loading-skeleton";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
  RefreshCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";

import Footer from "../components/layout/Footer";
import TabelaUsuarios from "../components/usuarios/TabelaUsuarios";

import {
  apiPerfilOpcao,
  apiUsuarioAtualizarPerfil,
  apiUsuarioEstatisticaDetalhada,
  apiUsuarioListar,
  apiUsuarioResumo,
} from "../services/api";

const ModalEditarPerfil = lazy(() =>
  import("../components/usuarios/ModalEditarPerfil")
);

/* ─────────────────────────────────────────────────────────────
   Contratos oficiais
────────────────────────────────────────────────────────────── */

const PERFIS_OFICIAIS = ["usuario", "organizador", "administrador"];

const PERFIL_LABEL = {
  todos: "Todos os perfis",
  usuario: "Usuários",
  organizador: "organizadores",
  administrador: "Administradores",
};

const STORAGE_KEYS = {
  busca: "gestaoUsuarios:v2:busca",
  unidade: "gestaoUsuarios:v2:unidade",
  cargo: "gestaoUsuarios:v2:cargo",
  perfil: "gestaoUsuarios:v2:perfil",
  page: "gestaoUsuarios:v2:page",
  pageSize: "gestaoUsuarios:v2:pageSize",
};

/* ─────────────────────────────────────────────────────────────
   Helpers
────────────────────────────────────────────────────────────── */

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function onlyDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function perfilOficial(value) {
  const perfil = String(value || "").trim();

  return PERFIS_OFICIAIS.includes(perfil) ? perfil : "";
}

function getStorage(key, fallback = "") {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

function setStorage(key, value) {
  try {
    localStorage.setItem(key, String(value ?? ""));
  } catch {
    // noop
  }
}

function getStorageNumber(key, fallback) {
  const value = Number(getStorage(key, ""));

  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

function idadeFromYmd(value) {
  const ymd = String(value || "").slice(0, 10);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;

  const [anoRaw, mesRaw, diaRaw] = ymd.split("-");
  const ano = Number(anoRaw);
  const mes = Number(mesRaw);
  const dia = Number(diaRaw);

  if (!Number.isSafeInteger(ano) || !Number.isSafeInteger(mes) || !Number.isSafeInteger(dia)) {
    return null;
  }

  const hoje = new Date();
  let idade = hoje.getFullYear() - ano;
  const diffMes = hoje.getMonth() + 1 - mes;

  if (diffMes < 0 || (diffMes === 0 && hoje.getDate() < dia)) {
    idade -= 1;
  }

  return Number.isFinite(idade) && idade >= 0 ? idade : null;
}

function maskCpf(cpf, revealed = false) {
  const digits = onlyDigits(cpf);

  if (digits.length !== 11) return "—";

  if (!revealed) {
    return digits.replace(/^(\d{3})\d{3}(\d{3})\d{2}$/, "$1.***.$2-**");
  }

  return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
}

function csvEscape(value) {
  const text = String(value ?? "");

  return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;

  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}

function normalizeUsuario(row = {}, lookup = {}) {
  const unidadeId = Number(row.unidade_id) || null;
  const cargoId = Number(row.cargo_id) || null;

  const unidadeLookup = unidadeId ? lookup.unidadesMap.get(unidadeId) : null;
  const cargoLookup = cargoId ? lookup.cargosMap.get(cargoId) : null;

  return {
    ...row,
    perfil: perfilOficial(row.perfil),
    idade: idadeFromYmd(row.data_nascimento),
    cpf_masked: maskCpf(row.cpf),
    unidade_sigla: row.unidade_sigla || unidadeLookup?.sigla || null,
    unidade_nome: row.unidade_nome || unidadeLookup?.nome || null,
    cargo_nome: row.cargo_nome || cargoLookup?.nome || null,
  };
}

function getMensagemErro(error, fallback) {
  return (
    error?.data?.message ||
    error?.data?.erro ||
    error?.message ||
    fallback
  );
}

/* ─────────────────────────────────────────────────────────────
   Componentes locais
────────────────────────────────────────────────────────────── */

function MiniStat({ label, value = "—", accent = "indigo" }) {
  const map = {
    indigo: "from-indigo-500 to-indigo-300",
    emerald: "from-emerald-500 to-emerald-300",
    amber: "from-amber-500 to-amber-300",
    violet: "from-violet-500 to-violet-300",
    fuchsia: "from-fuchsia-500 to-fuchsia-300",
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/10 p-3 text-white backdrop-blur">
      <div
        className={cx(
          "inline-block rounded-lg bg-gradient-to-br px-2 py-1 text-xs font-semibold text-white",
          map[accent] || map.indigo
        )}
      >
        {label}
      </div>
      <div className="mt-1 text-2xl font-extrabold">{value}</div>
    </div>
  );
}

function PerfilChip({ active, value, onClick }) {
  return (
    <button
      type="button"
      onClick={() => onClick(value)}
      aria-pressed={active ? "true" : "false"}
      className={cx(
        "inline-flex min-h-[36px] items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500",
        active
          ? "bg-violet-700 text-white"
          : "bg-zinc-200 text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
      )}
    >
      {active ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> : null}
      {PERFIL_LABEL[value] || value}
    </button>
  );
}

function HeaderHero({ onAtualizar, atualizando, total, kpis }) {
  return (
    <header
      className="relative isolate overflow-hidden bg-gradient-to-br from-indigo-900 via-violet-800 to-fuchsia-700 text-white"
      role="banner"
    >
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 rounded-xl bg-white/20 px-4 py-2 text-sm font-semibold text-white shadow"
      >
        Ir para o conteúdo
      </a>

      <div
        className="pointer-events-none absolute inset-0 opacity-80"
        style={{
          background:
            "radial-gradient(55% 55% at 50% 0%, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.05) 34%, rgba(255,255,255,0) 60%)",
        }}
        aria-hidden="true"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 left-1/2 h-[320px] w-[900px] -translate-x-1/2 rounded-full bg-fuchsia-300 opacity-25 blur-3xl"
      />

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10 md:py-12">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="inline-flex items-center justify-center gap-2">
              <Users className="h-6 w-6" aria-hidden="true" />
              <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
                Gestão de Usuários
              </h1>
            </div>

            <p className="max-w-2xl text-sm text-white/90 sm:text-base">
              Busque, visualize e atualize perfis com segurança, rastreabilidade
              operacional e contrato único.
            </p>

            <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={onAtualizar}
                disabled={atualizando}
                className={cx(
                  "inline-flex min-h-[40px] items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white transition",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70",
                  atualizando
                    ? "cursor-not-allowed bg-white/20 opacity-60"
                    : "bg-white/15 hover:bg-white/25"
                )}
                aria-label="Atualizar lista de usuários"
                aria-busy={atualizando ? "true" : "false"}
              >
                <RefreshCcw
                  className={cx("h-4 w-4", atualizando ? "animate-spin" : "")}
                  aria-hidden="true"
                />
                {atualizando ? "Atualizando…" : "Atualizar"}
              </button>

              {typeof total === "number" ? (
                <span className="inline-flex min-h-[40px] items-center rounded-full border border-white/10 bg-white/10 px-3 py-2 text-xs">
                  {total} usuário{total === 1 ? "" : "s"}
                </span>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MiniStat label="Totais" value={kpis.total} accent="indigo" />
            <MiniStat label="Usuários" value={kpis.usuario} accent="emerald" />
            <MiniStat label="organizadores" value={kpis.organizador} accent="amber" />
            <MiniStat
              label="Administradores"
              value={kpis.administrador}
              accent="violet"
            />
          </div>
        </div>
      </div>

      <div
        className="absolute bottom-0 left-0 right-0 h-px bg-white/25"
        aria-hidden="true"
      />
    </header>
  );
}

/* ─────────────────────────────────────────────────────────────
   Página
────────────────────────────────────────────────────────────── */

export default function GestaoUsuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [meta, setMeta] = useState({
    total: 0,
    page: 1,
    pageSize: 25,
    pages: 1,
  });

  const [lookup, setlookup] = useState({
    unidades: [],
    cargos: [],
    unidadesMap: new Map(),
    cargosMap: new Map(),
  });

  const [estatistica, setEstatistica] = useState(null);

  const [carregandoUsuarios, setCarregandoUsuarios] = useState(true);
  const [carregandolookup, setCarregandolookup] = useState(true);
  const [erro, setErro] = useState("");

  const [busca, setBusca] = useState(() => getStorage(STORAGE_KEYS.busca, ""));
  const [perfilFiltro, setPerfilFiltro] = useState(() => {
    const stored = getStorage(STORAGE_KEYS.perfil, "todos");
    return stored === "todos" || PERFIS_OFICIAIS.includes(stored)
      ? stored
      : "todos";
  });
  const [unidadeFiltro, setUnidadeFiltro] = useState(() =>
    getStorage(STORAGE_KEYS.unidade, "todas")
  );
  const [cargoFiltro, setCargoFiltro] = useState(() =>
    getStorage(STORAGE_KEYS.cargo, "todos")
  );

  const [page, setPage] = useState(() => getStorageNumber(STORAGE_KEYS.page, 1));
  const [pageSize, setPageSize] = useState(() =>
    getStorageNumber(STORAGE_KEYS.pageSize, 25)
  );

  const [usuarioSelecionado, setUsuarioSelecionado] = useState(null);
  const [modalEditOpen, setModalEditOpen] = useState(false);

  const [revealCpfIds, setRevealCpfIds] = useState(() => new Set());
  const [resumoCache, setResumoCache] = useState(() => new Map());
  const [loadingResumo, setLoadingResumo] = useState(() => new Set());
  const [exportando, setExportando] = useState(false);

  const searchRef = useRef(null);
  const liveRef = useRef(null);
  const erroRef = useRef(null);
  const mountedRef = useRef(true);
  const requestSeqRef = useRef(0);

  const setLive = useCallback((message) => {
    if (liveRef.current) liveRef.current.textContent = message || "";
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    document.title = "Gestão de Usuários — Escola da Saúde";
  }, []);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "/" && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };

    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => setStorage(STORAGE_KEYS.busca, busca), [busca]);
  useEffect(() => setStorage(STORAGE_KEYS.perfil, perfilFiltro), [perfilFiltro]);
  useEffect(() => setStorage(STORAGE_KEYS.unidade, unidadeFiltro), [unidadeFiltro]);
  useEffect(() => setStorage(STORAGE_KEYS.cargo, cargoFiltro), [cargoFiltro]);
  useEffect(() => setStorage(STORAGE_KEYS.page, page), [page]);
  useEffect(() => setStorage(STORAGE_KEYS.pageSize, pageSize), [pageSize]);

  const [debouncedQ, setDebouncedQ] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQ(busca.trim()), 250);

    return () => clearTimeout(timer);
  }, [busca]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQ, perfilFiltro, unidadeFiltro, cargoFiltro, pageSize]);

  const carregarlookup = useCallback(async () => {
    try {
      setCarregandolookup(true);

      const data = await apiPerfilOpcao();

      const unidades = Array.isArray(data?.unidades) ? data.unidades : [];
      const cargos = Array.isArray(data?.cargos) ? data.cargos : [];

      const unidadesOrdenadas = [...unidades].sort((a, b) =>
        String(a.sigla || a.nome || "").localeCompare(
          String(b.sigla || b.nome || ""),
          "pt-BR",
          { sensitivity: "base" }
        )
      );

      const cargosOrdenados = [...cargos].sort((a, b) =>
        String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR", {
          sensitivity: "base",
        })
      );

      const unidadesMap = new Map();
      const cargosMap = new Map();

      unidadesOrdenadas.forEach((unidade) => {
        unidadesMap.set(Number(unidade.id), {
          id: Number(unidade.id),
          sigla: String(unidade.sigla || "").trim().toUpperCase(),
          nome: String(unidade.nome || "").trim(),
        });
      });

      cargosOrdenados.forEach((cargo) => {
        cargosMap.set(Number(cargo.id), {
          id: Number(cargo.id),
          nome: String(cargo.nome || "").trim(),
        });
      });

      if (!mountedRef.current) return;

      setlookup({
        unidades: unidadesOrdenadas,
        cargos: cargosOrdenados,
        unidadesMap,
        cargosMap,
      });
    } catch (error) {
      console.error("[GestaoUsuarios] falha ao carregar opções", error);

      if (!mountedRef.current) return;

      toast.error(
        "Não foi possível carregar os filtros de unidade e cargo. Tente atualizar a página."
      );

      setlookup({
        unidades: [],
        cargos: [],
        unidadesMap: new Map(),
        cargosMap: new Map(),
      });
    } finally {
      if (mountedRef.current) setCarregandolookup(false);
    }
  }, []);

  const carregarEstatisticas = useCallback(async () => {
    try {
      const response = await apiUsuarioEstatisticaDetalhada();
      const data = response?.data ?? response;

      if (!mountedRef.current) return;

      setEstatistica(data || null);
    } catch (error) {
      console.error("[GestaoUsuarios] falha ao carregar estatísticas", error);

      if (!mountedRef.current) return;

      setEstatistica(null);
    }
  }, []);

  const paramsUsuarios = useMemo(() => {
    const params = {
      page,
      pageSize,
    };

    if (debouncedQ) params.q = debouncedQ;
    if (perfilFiltro !== "todos") params.perfil = perfilFiltro;
    if (unidadeFiltro !== "todas") params.unidade_id = Number(unidadeFiltro);
    if (cargoFiltro !== "todos") params.cargo_id = Number(cargoFiltro);

    return params;
  }, [cargoFiltro, debouncedQ, page, pageSize, perfilFiltro, unidadeFiltro]);

  const carregarUsuarios = useCallback(async () => {
    const reqId = ++requestSeqRef.current;

    try {
      setCarregandoUsuarios(true);
      setErro("");
      setLive("Carregando usuários…");

      const response = await apiUsuarioListar(paramsUsuarios);

      if (!mountedRef.current || reqId !== requestSeqRef.current) return;

      const data = Array.isArray(response?.data) ? response.data : [];
      const metaResponse = response?.meta || {
        total: data.length,
        page,
        pageSize,
        pages: 1,
      };

      const normalizados = data.map((usuario) =>
        normalizeUsuario(usuario, lookup)
      );

      setUsuarios(normalizados);
      setMeta({
        total: Number(metaResponse.total || 0),
        page: Number(metaResponse.page || page),
        pageSize: Number(metaResponse.pageSize || pageSize),
        pages: Number(metaResponse.pages || 1),
      });
      setLive(`Usuários carregados: ${normalizados.length}.`);
    } catch (error) {
      console.error("[GestaoUsuarios] falha ao carregar usuários", error);

      if (!mountedRef.current || reqId !== requestSeqRef.current) return;

      const message = getMensagemErro(
        error,
        "Erro ao carregar usuários. Verifique sua conexão ou tente novamente."
      );

      setErro(message);
      setUsuarios([]);
      setMeta({ total: 0, page, pageSize, pages: 1 });
      setLive("Falha ao carregar usuários.");
      toast.error(message);

      window.setTimeout(() => erroRef.current?.focus?.(), 0);
    } finally {
      if (mountedRef.current && reqId === requestSeqRef.current) {
        setCarregandoUsuarios(false);
      }
    }
  }, [lookup, page, pageSize, paramsUsuarios, setLive]);

  useEffect(() => {
    carregarlookup();
    carregarEstatisticas();
  }, [carregarEstatisticas, carregarlookup]);

  useEffect(() => {
    if (carregandolookup) return;

    carregarUsuarios();
  }, [carregandolookup, carregarUsuarios]);

  const kpis = useMemo(() => {
    const porPerfil = Array.isArray(estatistica?.por_perfil)
      ? estatistica.por_perfil
      : [];

    const map = new Map(
      porPerfil.map((item) => [String(item.label || "").trim(), Number(item.value || 0)])
    );

    return {
      total: String(estatistica?.total_usuarios ?? meta.total ?? 0),
      usuario: String(map.get("usuario") ?? 0),
      organizador: String(map.get("organizador") ?? 0),
      administrador: String(map.get("administrador") ?? 0),
    };
  }, [estatistica, meta.total]);

  const abrirEdicao = useCallback((usuario) => {
    setUsuarioSelecionado(usuario);
    setModalEditOpen(true);
  }, []);

  const fecharEdicao = useCallback(() => {
    setModalEditOpen(false);
    setUsuarioSelecionado(null);
  }, []);

  async function carregarResumoUsuario(id) {
    if (!id) return;
    if (resumoCache.has(id) || loadingResumo.has(id)) return;

    setLoadingResumo((prev) => new Set(prev).add(id));

    try {
      const response = await apiUsuarioResumo(id);
      const payload = response?.data ?? response;

      const resumo = {
        cursos_concluidos_75: Number(payload?.cursos_concluidos_75 ?? 0),
        certificados_emitidos: Number(payload?.certificados_emitidos ?? 0),
      };

      setResumoCache((prev) => {
        const next = new Map(prev);
        next.set(id, resumo);
        return next;
      });

      setUsuarios((prev) =>
        prev.map((usuario) =>
          usuario.id === id ? { ...usuario, ...resumo } : usuario
        )
      );
    } catch (error) {
      console.error("[GestaoUsuarios] falha ao carregar resumo", {
        usuarioId: id,
        message: error?.message,
      });

      toast.error("Não foi possível carregar os detalhes do usuário.");
    } finally {
      setLoadingResumo((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  async function salvarPerfil(id, perfil) {
    const perfilNovo = perfilOficial(perfil);

    if (!perfilNovo) {
      toast.error("Perfil inválido. Use apenas usuário, organizador ou administrador.");
      return;
    }

    try {
      await apiUsuarioAtualizarPerfil(id, { perfil: perfilNovo });

      toast.success("Perfil atualizado com sucesso.");
      fecharEdicao();
      await carregarUsuarios();
      await carregarEstatisticas();
    } catch (error) {
      console.error("[GestaoUsuarios] falha ao atualizar perfil", {
        usuarioId: id,
        message: error?.message,
      });

      toast.error(
        getMensagemErro(
          error,
          "Não foi possível atualizar o perfil. Verifique as permissões e tente novamente."
        )
      );
    }
  }

  function onToggleCpf(id) {
    setRevealCpfIds((prev) => {
      const next = new Set(prev);

      if (next.has(id)) next.delete(id);
      else next.add(id);

      return next;
    });
  }

  async function onExportCsv() {
    const hardLimit = 20000;
    const total = Number(meta.total || 0);

    if (!total) {
      toast.info("Nada para exportar com os filtros atuais.");
      return;
    }

    if (total > hardLimit) {
      toast.error(
        `Exportação muito grande (${total}). Refine os filtros antes de exportar.`
      );
      return;
    }

    try {
      setExportando(true);

      const headers = [
        "id",
        "nome",
        "email",
        "perfil",
        "unidade_sigla",
        "cargo",
        "idade",
      ];

      const rows = [];
      const exportPageSize = 200;
      const totalPages = Math.max(1, Math.ceil(total / exportPageSize));

      for (let currentPage = 1; currentPage <= totalPages; currentPage += 1) {
        const response = await apiUsuarioListar({
          ...paramsUsuarios,
          page: currentPage,
          pageSize: exportPageSize,
        });

        const data = Array.isArray(response?.data) ? response.data : [];

        for (const usuario of data) {
          const normalizado = normalizeUsuario(usuario, lookup);

          rows.push([
            normalizado.id ?? "",
            normalizado.nome ?? "",
            normalizado.email ?? "",
            normalizado.perfil ?? "",
            normalizado.unidade_sigla ?? "",
            normalizado.cargo_nome ?? "",
            Number.isFinite(normalizado.idade) ? normalizado.idade : "",
          ]);
        }
      }

      const content = [headers, ...rows]
        .map((row) => row.map(csvEscape).join(";"))
        .join("\n");

      const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
      const filename = `usuarios_${new Date().toISOString().slice(0, 10)}.csv`;

      downloadBlob(filename, blob);
      toast.success("CSV exportado com o resultado filtrado.");
    } catch (error) {
      console.error("[GestaoUsuarios] falha ao exportar CSV", error);
      toast.error("Não foi possível exportar o CSV.");
    } finally {
      setExportando(false);
    }
  }

  const anyLoading = carregandoUsuarios || carregandolookup;
  const totalItems = Number(meta.total || 0);
  const totalPages = Math.max(1, Number(meta.pages || 1));
  const pageClamped = Math.min(Math.max(1, Number(meta.page || page)), totalPages);

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <p ref={liveRef} className="sr-only" aria-live="polite" aria-atomic="true" />

      <HeaderHero
        onAtualizar={() => {
          carregarUsuarios();
          carregarEstatisticas();
        }}
        atualizando={anyLoading}
        total={totalItems}
        kpis={kpis}
      />

      {anyLoading ? (
        <div
          className="sticky top-0 z-40 h-1 w-full bg-fuchsia-100 dark:bg-fuchsia-950"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Carregando dados"
        >
          <div className="h-full w-1/3 animate-pulse bg-fuchsia-700 dark:bg-fuchsia-600" />
        </div>
      ) : null}

      <main id="conteudo" className="mx-auto w-full max-w-6xl flex-1 px-3 py-6 sm:px-4">
        {erro && !anyLoading ? (
          <div
            ref={erroRef}
            tabIndex={-1}
            className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 outline-none dark:border-rose-900/40 dark:bg-rose-950/25"
            role="alert"
            aria-live="assertive"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle
                className="mt-0.5 h-5 w-5 text-rose-600 dark:text-rose-300"
                aria-hidden="true"
              />
              <div className="min-w-0">
                <p className="font-semibold text-rose-800 dark:text-rose-200">
                  Não foi possível carregar usuários
                </p>
                <p className="break-words text-sm text-rose-800/90 dark:text-rose-200/90">
                  {erro}
                </p>
                <button
                  type="button"
                  onClick={carregarUsuarios}
                  className="mt-3 inline-flex items-center gap-2 rounded-xl bg-rose-100 px-3 py-2 text-sm font-semibold hover:bg-rose-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 dark:bg-rose-900/40 dark:hover:bg-rose-900/60"
                >
                  <RefreshCcw className="h-4 w-4" aria-hidden="true" />
                  Tentar novamente
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <section
          aria-label="Ferramentas de busca e filtros"
          className="sticky top-1 z-30 mb-5 rounded-2xl border border-zinc-200 bg-white/85 p-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/85"
        >
          <div className="flex flex-col gap-3">
            <div className="relative w-full">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
                aria-hidden="true"
              />
              <input
                ref={searchRef}
                id="busca-usuarios"
                type="text"
                autoComplete="off"
                placeholder="Buscar por nome, e-mail, CPF, celular ou registro… (/)"
                value={busca}
                onChange={(event) => setBusca(event.target.value)}
                className="w-full rounded-xl border px-9 py-2 text-sm ring-offset-2 focus:outline-none focus:ring-2 focus:ring-violet-700 dark:border-zinc-700 dark:bg-zinc-800"
                aria-describedby="resultados-count"
              />
              <p id="resultados-count" className="sr-only" aria-live="polite">
                {totalItems} resultado(s).
              </p>
            </div>

            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
                  <Filter className="h-3.5 w-3.5" aria-hidden="true" /> Perfil:
                </span>

                {["todos", ...PERFIS_OFICIAIS].map((perfil) => (
                  <PerfilChip
                    key={perfil}
                    value={perfil}
                    active={perfilFiltro === perfil}
                    onClick={setPerfilFiltro}
                  />
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={unidadeFiltro}
                  onChange={(event) => setUnidadeFiltro(event.target.value)}
                  className="min-h-[36px] rounded-xl border px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-violet-700 dark:border-zinc-700 dark:bg-zinc-800"
                  aria-label="Filtrar por unidade"
                  title="Filtrar por unidade"
                >
                  <option value="todas">Todas as unidades</option>
                  {lookup.unidades.map((unidade) => (
                    <option key={unidade.id} value={String(unidade.id)}>
                      {unidade.sigla || unidade.nome}
                    </option>
                  ))}
                </select>

                <select
                  value={cargoFiltro}
                  onChange={(event) => setCargoFiltro(event.target.value)}
                  className="min-h-[36px] rounded-xl border px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-violet-700 dark:border-zinc-700 dark:bg-zinc-800"
                  aria-label="Filtrar por cargo"
                  title="Filtrar por cargo"
                >
                  <option value="todos">Todos os cargos</option>
                  {lookup.cargos.map((cargo) => (
                    <option key={cargo.id} value={String(cargo.id)}>
                      {cargo.nome}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={onExportCsv}
                  disabled={exportando || totalItems === 0}
                  className="inline-flex min-h-[36px] items-center gap-2 rounded-xl bg-violet-700 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-60"
                  title="Exportar CSV do resultado filtrado"
                >
                  <Download
                    className={cx("h-4 w-4", exportando ? "animate-pulse" : "")}
                    aria-hidden="true"
                  />
                  {exportando ? "Exportando…" : "Exportar CSV"}
                </button>
              </div>
            </div>
          </div>
        </section>

        {anyLoading ? (
          <div className="space-y-4" aria-busy="true" aria-live="polite">
            {[...Array(6)].map((_, index) => (
              <Skeleton key={index} height={96} className="rounded-2xl" />
            ))}
          </div>
        ) : erro ? (
          <p className="text-center text-rose-600 dark:text-rose-300" role="alert">
            {erro}
          </p>
        ) : (
          <>
            <TabelaUsuarios
              usuarios={Array.isArray(usuarios) ? usuarios : []}
              onEditar={abrirEdicao}
              onToggleCpf={onToggleCpf}
              isCpfRevealed={(id) => revealCpfIds.has(id)}
              maskCpfFn={maskCpf}
              onCarregarResumo={carregarResumoUsuario}
              isResumoLoading={(id) => loadingResumo.has(id)}
              hasResumo={(id) => resumoCache.has(id)}
            />

            <div className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
              <div className="text-xs text-zinc-600 dark:text-zinc-400">
                Mostrando <strong>{usuarios.length}</strong> de{" "}
                <strong>{totalItems}</strong> resultado(s) — página{" "}
                <strong>{pageClamped}</strong> de <strong>{totalPages}</strong>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2">
                <label className="text-xs text-zinc-600 dark:text-zinc-400">
                  Por página:
                </label>

                <select
                  value={pageSize}
                  onChange={(event) => setPageSize(Number(event.target.value) || 25)}
                  className="min-h-[34px] rounded-xl border px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-violet-700 dark:border-zinc-700 dark:bg-zinc-800"
                >
                  {[10, 25, 50, 100, 200].map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={pageClamped <= 1}
                  className="inline-flex min-h-[34px] items-center gap-1 rounded-xl border px-2 py-1.5 text-xs hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  Anterior
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setPage((current) => Math.min(totalPages, current + 1))
                  }
                  disabled={pageClamped >= totalPages}
                  className="inline-flex min-h-[34px] items-center gap-1 rounded-xl border px-2 py-1.5 text-xs hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                >
                  Próxima
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          </>
        )}

        <Suspense
          fallback={
            <div className="fixed inset-0 z-[9999] grid place-items-center bg-black/40 backdrop-blur-sm">
              <div className="rounded-2xl border border-zinc-200 bg-white px-5 py-4 text-sm font-extrabold dark:border-zinc-800 dark:bg-zinc-900">
                Carregando editor…
              </div>
            </div>
          }
        >
          {usuarioSelecionado ? (
            <ModalEditarPerfil
              usuario={usuarioSelecionado}
              isOpen={modalEditOpen}
              onFechar={fecharEdicao}
              onSalvar={salvarPerfil}
            />
          ) : null}
        </Suspense>

        <div className="mt-8 flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          <span>
            CPFs ficam ocultos por padrão. Revele apenas quando houver necessidade
            operacional real.
          </span>
        </div>
      </main>

      <Footer />
    </div>
  );
}