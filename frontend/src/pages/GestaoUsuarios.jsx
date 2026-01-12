// ✅ src/pages/GestaoUsuarios.jsx — PREMIUM (server-side pagination + filtros no backend + export robusto)
// - Agora busca/paginação é SERVER-SIDE (não carrega 1300+ no cliente)
// - Envia: q, perfil(csv), unidade_id (via sigla->id), cargo_nome, page, pageSize
// - KPIs: usa meta.total e contagem por perfil vinda da própria página carregada (com fallback)
// - Mantém UX premium: sticky toolbar, chips, selects, persistência e a11y
// - Export CSV: exporta RESULTADO FILTRADO COMPLETO via paginação automática (lotes) (limite de segurança)

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
  Suspense,
  lazy,
} from "react";
import { toast } from "react-toastify";
import Skeleton from "react-loading-skeleton";
import {
  Users,
  RefreshCcw,
  ShieldCheck,
  Search,
  Filter,
  CheckCircle2,
  Download,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Sparkles,
} from "lucide-react";

import { apiGet, apiPut } from "../services/api";
import Footer from "../components/Footer";
import TabelaUsuarios from "../components/TabelaUsuarios";

const ModalEditarPerfil = lazy(() => import("../components/ModalEditarPerfil"));

const PERFIS_PERMITIDOS = ["usuario", "instrutor", "administrador"];

/* ================= helpers ================= */
const sLower = (v) => String(v ?? "").toLowerCase();
const onlyDigits = (s) => String(s || "").replace(/\D+/g, "");

const maskCpf = (cpf, revealed = false) => {
  const d = onlyDigits(cpf).padStart(11, "0").slice(-11);
  if (!d || d.length !== 11) return "—";
  if (!revealed) return d.replace(/^(\d{3})\d{3}(\d{3})\d{2}$/, "$1.***.$2-**");
  return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
};

// Idade a partir de "YYYY-MM-DD" sem criar Date (anti-fuso)
const idadeFromISO = (iso) => {
  const s = String(iso || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [yy, mm, dd] = s.split("-").map((x) => parseInt(x, 10));
  const today = new Date();
  let age = today.getFullYear() - yy;
  const m = today.getMonth() + 1 - mm;
  if (m < 0 || (m === 0 && today.getDate() < dd)) age--;
  return Number.isFinite(age) ? age : null;
};

// Normaliza perfil vindo como array ou CSV -> array minúscula
const toPerfilArray = (p) => {
  if (Array.isArray(p)) return p.map((x) => sLower(x)).filter(Boolean);
  return String(p ?? "")
    .split(",")
    .map((x) => sLower(x.trim()))
    .filter(Boolean);
};

// CSV helpers
const csvEscape = (v) => {
  const s = String(v ?? "");
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const downloadBlob = (filename, blob) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

/* ============ Mini components ============ */
function MiniStat({ label, value = "—", accent = "indigo" }) {
  const map = {
    indigo: "from-indigo-500 to-indigo-300",
    emerald: "from-emerald-500 to-emerald-300",
    amber: "from-amber-500 to-amber-300",
    violet: "from-violet-500 to-violet-300",
    fuchsia: "from-fuchsia-500 to-fuchsia-300",
  };
  return (
    <div className="rounded-2xl bg-white/10 border border-white/10 p-3 text-white backdrop-blur">
      <div
        className={`inline-block rounded-lg bg-gradient-to-br ${
          map[accent] ?? map.indigo
        } px-2 py-1 text-xs font-semibold text-white`}
      >
        {label}
      </div>
      <div className="mt-1 text-2xl font-extrabold">{value}</div>
    </div>
  );
}

function Chip({ active, onClick, children, ariaLabel }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active ? "true" : "false"}
      aria-label={ariaLabel}
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition
        ${
          active
            ? "bg-violet-700 text-white"
            : "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 hover:bg-zinc-300 dark:hover:bg-zinc-700"
        } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500`}
    >
      {active && <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />}
      {children}
    </button>
  );
}

/* ============ HeaderHero (3 cores + ministats) ============ */
function HeaderHero({ onAtualizar, atualizando, total, kpis }) {
  return (
    <header
      className="relative isolate overflow-hidden bg-gradient-to-br from-indigo-900 via-violet-800 to-fuchsia-700 text-white"
      role="banner"
    >
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:block focus:bg-white/20 focus:text-white text-sm px-3 py-2"
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
        className="pointer-events-none absolute -top-24 left-1/2 h-[320px] w-[900px] -translate-x-1/2 rounded-full blur-3xl opacity-25 bg-fuchsia-300"
      />

      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8 sm:py-10 md:py-12">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col items-center text-center gap-3">
            <div className="inline-flex items-center justify-center gap-2">
              <Users className="h-6 w-6" aria-hidden="true" />
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                Gestão de Usuários
              </h1>
            </div>

            <p className="text-sm sm:text-base text-white/90 max-w-2xl">
              Busque, visualize e atualize perfis com segurança.
            </p>

            <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={onAtualizar}
                disabled={atualizando}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition
                ${
                  atualizando
                    ? "opacity-60 cursor-not-allowed bg-white/20"
                    : "bg-white/15 hover:bg-white/25"
                } text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70`}
                aria-label="Atualizar lista de usuários"
                aria-busy={atualizando ? "true" : "false"}
              >
                <RefreshCcw className="h-4 w-4" aria-hidden="true" />
                {atualizando ? "Atualizando…" : "Atualizar"}
              </button>

              {typeof total === "number" && (
                <span className="inline-flex items-center rounded-full bg-white/10 border border-white/10 px-3 py-2 text-xs">
                  {total} usuário{total === 1 ? "" : "s"}
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MiniStat label="Totais" value={kpis.total} accent="indigo" />
            <MiniStat label="Usuários" value={kpis.usuario} accent="emerald" />
            <MiniStat label="Instrutores" value={kpis.instrutor} accent="amber" />
            <MiniStat label="Administradores" value={kpis.administrador} accent="violet" />
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-px bg-white/25" aria-hidden="true" />
    </header>
  );
}

/* ============ Página ============ */
export default function GestaoUsuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, pageSize: 25, pages: 1 });
  const [carregandoUsuarios, setCarregandoUsuarios] = useState(true);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState(() => localStorage.getItem("usuarios:busca") || "");
  const [usuarioSelecionado, setUsuarioSelecionado] = useState(null);
  const [revealCpfIds, setRevealCpfIds] = useState(() => new Set());
  const [hydrating, setHydrating] = useState(false);

  const searchRef = useRef(null);
  const liveRef = useRef(null);
  const erroRef = useRef(null);
  const abortRef = useRef(null);
  const mountedRef = useRef(true);

  // cache de resumo sob demanda
  const [resumoCache, setResumoCache] = useState(() => new Map());
  const [loadingResumo, setLoadingResumo] = useState(() => new Set());

  // filtros + paginação (persistidos)
  const [fUnidade, setFUnidade] = useState(() => localStorage.getItem("usuarios:fUnidade") || "todas"); // SIGLA ou "todas"
  const [fCargo, setFCargo] = useState(() => localStorage.getItem("usuarios:fCargo") || "todos");
  const [page, setPage] = useState(() => Number(localStorage.getItem("usuarios:page")) || 1);
  const [pageSize, setPageSize] = useState(() => Number(localStorage.getItem("usuarios:pageSize")) || 25);

  // perfis (persistido como CSV)
  const [fPerfis, setFPerfis] = useState(() => {
    const raw = localStorage.getItem("usuarios:fPerfis");
    const set = new Set(PERFIS_PERMITIDOS);
    if (!raw) return set;
    const parts = raw.split(",").map((x) => sLower(x.trim())).filter(Boolean);
    const next = new Set(parts.filter((p) => PERFIS_PERMITIDOS.includes(p)));
    return next.size ? next : set;
  });

  const setLive = (msg) => {
    if (liveRef.current) liveRef.current.textContent = msg;
  };

  // mounted/abort
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort?.("unmount");
    };
  }, []);

  // atalho "/"
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // persistências leves
  useEffect(() => {
    try { localStorage.setItem("usuarios:busca", busca); } catch { /* noop */ }
  }, [busca]);
  useEffect(() => {
    try { localStorage.setItem("usuarios:fUnidade", fUnidade); } catch { /* noop */ }
  }, [fUnidade]);
  useEffect(() => {
    try { localStorage.setItem("usuarios:fCargo", fCargo); } catch { /* noop */ }
  }, [fCargo]);
  useEffect(() => {
    try { localStorage.setItem("usuarios:pageSize", String(pageSize)); } catch { /* noop */ }
  }, [pageSize]);
  useEffect(() => {
    try { localStorage.setItem("usuarios:fPerfis", Array.from(fPerfis).join(",")); } catch { /* noop */ }
  }, [fPerfis]);
  useEffect(() => {
    try { localStorage.setItem("usuarios:page", String(page)); } catch { /* noop */ }
  }, [page]);

  const [unidades, setUnidades] = useState([]);
  const [unidadesMap, setUnidadesMap] = useState(() => new Map()); // id -> {sigla,nome}

  const carregarUnidades = useCallback(async () => {
    try {
      const arr = await apiGet("/api/unidades", { on403: "silent" });
      const norm = (Array.isArray(arr) ? arr : []).map((u) => ({
        id: Number(u.id),
        sigla: String(u.sigla ?? "").trim().toUpperCase(),
        nome: String(u.nome ?? "").trim(),
      }));
      setUnidades(norm);

      const m = new Map();
      norm.forEach((u) => m.set(u.id, { sigla: u.sigla, nome: u.nome }));
      setUnidadesMap(m);
    } catch (e) {
      console.error("❌ /api/unidades falhou:", e);
      setUnidades([]);
      setUnidadesMap(new Map());
      toast.error("Erro ao carregar unidades.");
    }
  }, []);

  // ✅ resolve SIGLA -> unidade_id (para mandar pro backend)
  const unidadeIdSelecionada = useMemo(() => {
    if (!fUnidade || fUnidade === "todas") return null;
    const s = String(fUnidade).trim().toUpperCase();
    const found = (unidades || []).find((u) => String(u.sigla || "").trim().toUpperCase() === s);
    return found?.id ? Number(found.id) : null;
  }, [fUnidade, unidades]);

  /* ---------- busca com debounce ---------- */
  const [debouncedQ, setDebouncedQ] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(sLower(busca).trim()), 250);
    return () => clearTimeout(t);
  }, [busca]);

  /* ---------- filtros por perfil ---------- */
  const togglePerfil = (p) => {
    const key = sLower(p);
    setFPerfis((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      if (next.size === 0) PERFIS_PERMITIDOS.forEach((x) => next.add(x));
      return next;
    });
  };
  const resetPerfis = () => setFPerfis(new Set(PERFIS_PERMITIDOS));

  // ✅ sempre que filtros mudarem, volta para página 1 (server-side)
  useEffect(() => {
    setPage(1);
  }, [debouncedQ, fUnidade, fCargo, fPerfis, pageSize]);

  /* ---------- carregar usuários (SERVER-SIDE) ---------- */
  const carregarUsuarios = useCallback(async () => {
    try {
      setCarregandoUsuarios(true);
      setErro("");
      setLive("Carregando usuários…");

      abortRef.current?.abort?.("new-request");
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      const params = new URLSearchParams();
      if (debouncedQ) params.set("q", debouncedQ);
      if (unidadeIdSelecionada != null) params.set("unidade_id", String(unidadeIdSelecionada));
      if (fCargo && fCargo !== "todos") params.set("cargo_nome", String(fCargo));
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));

      const perfisCsv = Array.from(fPerfis || []).filter(Boolean).join(",");
      if (perfisCsv) params.set("perfil", perfisCsv);

      const url = `/api/usuarios?${params.toString()}`;

      const resp = await apiGet(url, { on403: "silent", signal: ctrl.signal });

      const metaResp = resp?.meta || resp?.data?.meta || null;
      const dataResp =
        (Array.isArray(resp?.data) ? resp.data : null) ||
        (Array.isArray(resp?.usuarios) ? resp.usuarios : null) ||
        (Array.isArray(resp?.items) ? resp.items : null) ||
        (Array.isArray(resp?.rows) ? resp.rows : null) ||
        [];

      const enriched = (dataResp || []).map((u) => {
        const perfilArr = toPerfilArray(u?.perfil);

        const siglaJoin = String(u?.unidade_sigla || "").trim().toUpperCase() || "";
        const siglaViaId =
          u?.unidade_id && unidadesMap?.get?.(u.unidade_id)?.sigla
            ? String(unidadesMap.get(u.unidade_id).sigla).trim().toUpperCase()
            : "";
        const unidade_sigla = (siglaJoin || siglaViaId) || null;

        const unidade_nome =
          String(u?.unidade_nome || "").trim() ||
          (u?.unidade_id && unidadesMap?.get?.(u.unidade_id)?.nome
            ? String(unidadesMap.get(u.unidade_id).nome).trim()
            : null);

        return {
          ...u,
          idade: idadeFromISO(String(u?.data_nascimento || "").slice(0, 10)) ?? undefined,
          perfil: perfilArr,
          cpf_masked: maskCpf(u?.cpf),
          unidade_sigla,
          unidade_nome,
          escolaridade_nome: u?.escolaridade_nome || u?.escolaridade || u?.escolaridade_id || null,
          cargo_nome: u?.cargo_nome || u?.cargo || u?.cargo_id || null,
          deficiencia_nome: u?.deficiencia_nome || u?.deficiencia || u?.deficiencia_id || null,
          cursos_concluidos_75: undefined,
          certificados_emitidos: undefined,
        };
      });

      if (!mountedRef.current) return;

      setUsuarios(enriched);
      setResumoCache((prev) => (prev?.size ? prev : new Map())); // mantém cache quando navega páginas
      setMeta({
        total: Number(metaResp?.total ?? 0),
        page: Number(metaResp?.page ?? page),
        pageSize: Number(metaResp?.pageSize ?? pageSize),
        pages: Number(metaResp?.pages ?? 1),
      });

      setLive(`Usuários carregados: ${enriched.length}.`);
    } catch (e) {
      if (e?.name === "AbortError") return;

      const msg = e?.message || "Erro ao carregar usuários.";
      console.error("❌ /api/usuarios falhou:", e);

      if (!mountedRef.current) return;

      setErro(msg);
      toast.error(msg);
      setUsuarios([]);
      setMeta({ total: 0, page, pageSize, pages: 1 });
      setLive("Falha ao carregar usuários.");
      setTimeout(() => erroRef.current?.focus?.(), 0);
    } finally {
      if (mountedRef.current) {
        setCarregandoUsuarios(false);
        setHydrating(false);
      }
    }
  }, [debouncedQ, unidadeIdSelecionada, fCargo, fPerfis, page, pageSize, unidadesMap]);

  useEffect(() => {
    carregarUnidades();
  }, [carregarUnidades]);

  // ✅ carrega sempre que mudar page/filtros
  useEffect(() => {
    carregarUsuarios();
  }, [carregarUsuarios]);

  /* ---------- KPIs (melhor esforço) ---------- */
  const kpis = useMemo(() => {
    // total real do filtro (server meta.total)
    const total = Number(meta?.total ?? 0);

    // contagens por perfil: só da página atual (badge útil), com fallback
    let usuario = 0;
    let instrutor = 0;
    let administrador = 0;

    for (const u of usuarios || []) {
      const perfis = toPerfilArray(u?.perfil);
      if (perfis.includes("usuario")) usuario++;
      if (perfis.includes("instrutor")) instrutor++;
      if (perfis.includes("administrador")) administrador++;
    }

    return {
      total: String(total),
      usuario: String(usuario),
      instrutor: String(instrutor),
      administrador: String(administrador),
    };
  }, [usuarios, meta]);

  /* ---------- carregar resumo POR usuário ---------- */
  async function carregarResumoUsuario(id) {
    if (!id) return;
    if (resumoCache.has(id) || loadingResumo.has(id)) return;

    setLoadingResumo((prev) => new Set(prev).add(id));
    try {
      const r = await apiGet(`/api/usuarios/${id}/resumo`, { on404: "silent" });
      const payload = r?.data ?? r; // compat (ok/data)
      const resumo = {
        cursos_concluidos_75: Number(payload?.cursos_concluidos_75 ?? 0),
        certificados_emitidos: Number(payload?.certificados_emitidos ?? 0),
      };

      setResumoCache((prev) => {
        const next = new Map(prev);
        next.set(id, resumo);
        return next;
      });

      setUsuarios((prev) => prev.map((u) => (u.id === id ? { ...u, ...resumo } : u)));
    } catch (e) {
      console.error("❌ resumo usuário", id, e);
      toast.error("Erro ao carregar detalhes do usuário.");
    } finally {
      setLoadingResumo((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  /* ---------- salvar perfil ---------- */
  async function salvarPerfil(id, perfil) {
    let perfilStr = Array.isArray(perfil) ? perfil[0] : perfil;
    perfilStr = sLower(perfilStr).trim();
    if (!PERFIS_PERMITIDOS.includes(perfilStr)) {
      toast.error("Perfil inválido.");
      return;
    }

    try {
      await apiPut(`/api/usuarios/${id}/perfil`, { perfil: perfilStr });
      toast.success("✅ Perfil atualizado com sucesso!");
      setUsuarioSelecionado(null);
      carregarUsuarios();
    } catch (err) {
      const msg = err?.message || err?.erro || "❌ Erro ao atualizar perfil.";
      console.error("❌ Erro ao atualizar perfil:", err);
      toast.error(msg);
    }
  }

  /* ---------- CPF reveal/ocultar ---------- */
  const onToggleCpf = (id) => {
    setRevealCpfIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  /* ---------- opções únicas (Unidade / Cargo) ---------- */
  const { unidadesOpts, cargosOpts } = useMemo(() => {
    // Unidade por SIGLA: lista do endpoint /api/unidades (completa/estável)
    const unidadesArr = Array.from(
      new Set(
        (unidades || [])
          .map((u) => String(u?.sigla || "").trim())
          .filter(Boolean)
          .map((s) => s.toUpperCase())
      )
    ).sort((a, b) => a.localeCompare(b, "pt-BR"));

    // Cargo: como você tem 1300+, ideal seria um endpoint próprio.
    // Aqui: vamos montar com base na página atual + manter seleção persistida.
    const cargosSet = new Set(
      (usuarios || []).map((u) => String(u?.cargo_nome || "").trim()).filter(Boolean)
    );
    if (fCargo && fCargo !== "todos") cargosSet.add(fCargo);

    const cargosArr = Array.from(cargosSet).sort((a, b) => a.localeCompare(b, "pt-BR"));

    return { unidadesOpts: unidadesArr, cargosOpts: cargosArr };
  }, [unidades, usuarios, fCargo]);

  /* ---------- export CSV (server-side: pagina tudo do filtro) ---------- */
  const [exportando, setExportando] = useState(false);

  const onExportCsv = async () => {
    // limite de segurança pra não travar navegador (ajuste se quiser)
    const HARD_LIMIT = 20000;

    try {
      setExportando(true);

      const total = Number(meta?.total ?? 0);
      if (!total) {
        toast.info("Nada para exportar com os filtros atuais.");
        return;
      }
      if (total > HARD_LIMIT) {
        toast.error(`Exportação muito grande (${total}). Refinar filtros antes de exportar.`);
        return;
      }

      const headers = ["id", "nome", "email", "perfil", "unidade_sigla", "cargo", "escolaridade", "idade"];
      const rows = [];

      const perfisCsv = Array.from(fPerfis || []).filter(Boolean).join(",");

      // pagina em lotes grandes para export
      const exportPageSize = 200;
      const totalPages = Math.max(1, Math.ceil(total / exportPageSize));

      for (let p = 1; p <= totalPages; p++) {
        const params = new URLSearchParams();
        if (debouncedQ) params.set("q", debouncedQ);
        if (unidadeIdSelecionada != null) params.set("unidade_id", String(unidadeIdSelecionada));
        if (fCargo && fCargo !== "todos") params.set("cargo_nome", String(fCargo));
        if (perfisCsv) params.set("perfil", perfisCsv);
        params.set("page", String(p));
        params.set("pageSize", String(exportPageSize));

        const resp = await apiGet(`/api/usuarios?${params.toString()}`, { on403: "silent" });
        const dataResp =
          (Array.isArray(resp?.data) ? resp.data : null) ||
          (Array.isArray(resp?.usuarios) ? resp.usuarios : null) ||
          (Array.isArray(resp?.items) ? resp.items : null) ||
          (Array.isArray(resp?.rows) ? resp.rows : null) ||
          [];

        for (const u of dataResp) {
          const sigla = String(u?.unidade_sigla || "").trim()
            || (u?.unidade_id && unidadesMap.get(u.unidade_id)?.sigla ? String(unidadesMap.get(u.unidade_id).sigla).trim() : "");

          rows.push([
            u?.id ?? "",
            u?.nome ?? "",
            u?.email ?? "",
            toPerfilArray(u?.perfil).join(", "),
            sigla,
            u?.cargo_nome ?? "",
            u?.escolaridade_nome ?? "",
            Number.isFinite(idadeFromISO(String(u?.data_nascimento || "").slice(0, 10))) ? idadeFromISO(String(u?.data_nascimento || "").slice(0, 10)) : "",
          ]);
        }
      }

      const content = [headers, ...rows].map((r) => r.map(csvEscape).join(";")).join("\n");
      const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
      downloadBlob(`usuarios_${new Date().toISOString().slice(0, 10)}.csv`, blob);
      toast.success("📄 CSV exportado do resultado filtrado.");
    } catch (e) {
      console.error("CSV erro", e);
      toast.error("Não foi possível exportar o CSV.");
    } finally {
      setExportando(false);
    }
  };

  const anyLoading = carregandoUsuarios;

  const totalItems = Number(meta?.total ?? 0);
  const totalPages = Math.max(1, Number(meta?.pages ?? 1));
  const pageClamped = Math.min(Math.max(1, Number(meta?.page ?? page)), totalPages);

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <p ref={liveRef} className="sr-only" aria-live="polite" aria-atomic="true" />

      <HeaderHero
        onAtualizar={carregarUsuarios}
        atualizando={carregandoUsuarios || hydrating}
        total={totalItems}
        kpis={kpis}
      />

      {anyLoading && (
        <div
          className="sticky top-0 z-40 h-1 w-full bg-fuchsia-100 dark:bg-fuchsia-950"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Carregando dados"
        >
          <div className="h-full w-1/3 animate-pulse bg-fuchsia-700 dark:bg-fuchsia-600" />
        </div>
      )}

      <main id="conteudo" className="mx-auto w-full max-w-6xl flex-1 px-3 sm:px-4 py-6">
        {!!erro && !anyLoading && (
          <div
            ref={erroRef}
            tabIndex={-1}
            className="mb-4 rounded-2xl border border-rose-200 dark:border-rose-900/40 bg-rose-50 dark:bg-rose-950/25 p-4 outline-none"
            role="alert"
            aria-live="assertive"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 mt-0.5 text-rose-600 dark:text-rose-300" aria-hidden="true" />
              <div className="min-w-0">
                <p className="font-semibold text-rose-800 dark:text-rose-200">
                  Não foi possível carregar usuários
                </p>
                <p className="text-sm text-rose-800/90 dark:text-rose-200/90 break-words">{erro}</p>
                <button
                  type="button"
                  onClick={carregarUsuarios}
                  className="mt-3 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold bg-rose-100 hover:bg-rose-200 dark:bg-rose-900/40 dark:hover:bg-rose-900/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                >
                  <RefreshCcw className="w-4 h-4" aria-hidden="true" />
                  Tentar novamente
                </button>
              </div>
            </div>
          </div>
        )}

        <section
          aria-label="Ferramentas de busca e filtros"
          className="sticky top-1 z-30 mb-5 rounded-2xl border border-zinc-200 bg-white/80 p-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/80"
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
                placeholder="Buscar por nome, e-mail, CPF, registro ou ID… (/) "
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="w-full rounded-xl border px-9 py-2 text-sm ring-offset-2 focus:outline-none focus:ring-2 focus:ring-violet-700 dark:border-zinc-700 dark:bg-zinc-800"
                aria-describedby="resultados-count"
              />
              <p id="resultados-count" className="sr-only" aria-live="polite">
                {totalItems} resultado(s).
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
                  <Filter className="h-3.5 w-3.5" aria-hidden="true" /> Perfis:
                </span>
                {PERFIS_PERMITIDOS.map((p) => (
                  <Chip
                    key={p}
                    active={fPerfis.has(p)}
                    onClick={() => togglePerfil(p)}
                    ariaLabel={`Filtrar por perfil ${p}`}
                  >
                    {p}
                  </Chip>
                ))}
                <button
                  type="button"
                  onClick={resetPerfis}
                  className="inline-flex items-center gap-1 text-xs underline decoration-dotted underline-offset-4 opacity-80 hover:opacity-100"
                  title="Resetar perfis"
                >
                  <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                  limpar
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={fUnidade}
                  onChange={(e) => setFUnidade(e.target.value)}
                  className="rounded-xl border px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-violet-700 dark:border-zinc-700 dark:bg-zinc-800"
                  aria-label="Filtrar por unidade (sigla)"
                  title="Filtrar por unidade (sigla)"
                >
                  <option value="todas">Todas as Unidades</option>
                  {unidadesOpts.map((sigla) => (
                    <option key={sigla} value={sigla}>
                      {sigla}
                    </option>
                  ))}
                </select>

                <select
                  value={fCargo}
                  onChange={(e) => setFCargo(e.target.value)}
                  className="rounded-xl border px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-violet-700 dark:border-zinc-700 dark:bg-zinc-800"
                  aria-label="Filtrar por cargo"
                  title="Filtrar por cargo"
                >
                  <option value="todos">Todos os Cargos</option>
                  {cargosOpts.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={onExportCsv}
                  disabled={exportando || totalItems === 0}
                  className="inline-flex items-center gap-2 rounded-xl bg-violet-700 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-60"
                  title="Exportar CSV do resultado filtrado"
                >
                  <Download className={`h-4 w-4 ${exportando ? "animate-pulse" : ""}`} aria-hidden="true" />
                  {exportando ? "Exportando…" : "Exportar CSV"}
                </button>
              </div>
            </div>
          </div>
        </section>

        {carregandoUsuarios ? (
          <div className="space-y-4" aria-busy="true" aria-live="polite">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} height={96} className="rounded-2xl" />
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
              onEditar={(usuario) => setUsuarioSelecionado(usuario)}
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

              <div className="flex items-center gap-2">
                <label className="text-xs text-zinc-600 dark:text-zinc-400">Por página:</label>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value) || 25)}
                  className="rounded-xl border px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-violet-700 dark:border-zinc-700 dark:bg-zinc-800"
                >
                  {[10, 25, 50, 100, 200].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={pageClamped <= 1}
                  className="inline-flex items-center gap-1 rounded-xl border px-2 py-1.5 text-xs hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  Anterior
                </button>

                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={pageClamped >= totalPages}
                  className="inline-flex items-center gap-1 rounded-xl border px-2 py-1.5 text-xs hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                >
                  Próxima
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          </>
        )}

        <Suspense fallback={null}>
          {usuarioSelecionado && (
            <ModalEditarPerfil
              usuario={usuarioSelecionado}
              onFechar={() => setUsuarioSelecionado(null)}
              onSalvar={salvarPerfil}
            />
          )}
        </Suspense>

        <div className="mt-8 flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          <span>
            CPFs ficam ocultos por padrão. Clique em “revelar” por usuário para exibir (não é persistido).
          </span>
        </div>
      </main>

      <Footer />
    </div>
  );
}
