// 📁 src/pages/GestaoUsuarios.jsx
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
  if (!revealed) {
    return d.replace(/^(\d{3})\d{3}(\d{3})\d{2}$/, "$1.***.$2-**");
  }
  return d.replace(
    /^(\d{3})(\d{3})(\d{3})(\d{2})$/,
    "$1.$2.$3-$4",
  );
};
const idadeFrom = (isoOrDate) => {
  const d = isoOrDate ? new Date(isoOrDate) : null;
  if (!d || Number.isNaN(+d)) return null;
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
  return age;
};

// Normaliza perfil vindo como array ou CSV -> array minúscula
const toPerfilArray = (p) => {
  if (Array.isArray(p)) return p.map((x) => sLower(x)).filter(Boolean);
  return String(p ?? "")
    .split(",")
    .map((x) => sLower(x.trim()))
    .filter(Boolean);
};

// Idade a partir de "YYYY-MM-DD" sem criar Date
const idadeFromISO = (iso) => {
  const s = String(iso || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [yy, mm, dd] = s.split("-").map((x) => parseInt(x, 10));
  const today = new Date();
  let age = today.getFullYear() - yy;
  const m = today.getMonth() + 1 - mm; // month 1-12
  if (m < 0 || (m === 0 && today.getDate() < dd)) age--;
  return Number.isFinite(age) ? age : null;
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
    <div className="rounded-2xl bg-white/10 p-3 text-white backdrop-blur">
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
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition
        ${
          active
            ? "bg-violet-700 text-white"
            : "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 hover:bg-zinc-300 dark:hover:bg-zinc-700"
        }`}
    >
      {active && <CheckCircle2 className="h-3.5 w-3.5" />}
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
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(55% 55% at 50% 0%, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.05) 32%, rgba(255,255,255,0) 60%)",
        }}
        aria-hidden="true"
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
                className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition
                ${
                  atualizando
                    ? "opacity-60 cursor-not-allowed bg-white/20"
                    : "bg-white/15 hover:bg-white/25"
                } text-white`}
                aria-label="Atualizar lista de usuários"
                aria-busy={atualizando ? "true" : "false"}
              >
                <RefreshCcw className="h-4 w-4" aria-hidden="true" />
                {atualizando ? "Atualizando…" : "Atualizar"}
              </button>

              {typeof total === "number" && (
                <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-2 text-xs">
                  {total} usuário{total === 1 ? "" : "s"}
                </span>
              )}
            </div>
          </div>

          {/* Ministats no próprio hero */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MiniStat label="Totais" value={kpis.total} accent="indigo" />
            <MiniStat
              label="Usuários"
              value={kpis.usuario}
              accent="emerald"
            />
            <MiniStat
              label="Instrutores"
              value={kpis.instrutor}
              accent="amber"
            />
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

/* ============ Página ============ */
export default function GestaoUsuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [carregandoUsuarios, setCarregandoUsuarios] = useState(true);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const [usuarioSelecionado, setUsuarioSelecionado] = useState(null);
  const [revealCpfIds, setRevealCpfIds] = useState(() => new Set());
  const [hydrating, setHydrating] = useState(false);

  const searchRef = useRef(null);
  const liveRef = useRef(null);

  // cache de resumo sob demanda
  const [resumoCache, setResumoCache] = useState(() => new Map()); // id -> { cursos_concluidos_75, certificados_emitidos }
  const [loadingResumo, setLoadingResumo] = useState(
    () => new Set(),
  ); // ids carregando

  // filtros + paginação
  const [fUnidade, setFUnidade] = useState("todas"); // agora guarda SIGLA (ou "todas")
  const [fCargo, setFCargo] = useState("todos");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const setLive = (msg) => {
    if (liveRef.current) liveRef.current.textContent = msg;
  };

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

  const [unidades, setUnidades] = useState([]);
  const [unidadesMap, setUnidadesMap] = useState(() => new Map()); // id -> {sigla,nome}

  const carregarUnidades = useCallback(async () => {
    try {
      const arr = await apiGet("/api/unidades", { on403: "silent" });
      const norm = (Array.isArray(arr) ? arr : []).map((u) => ({
        id: Number(u.id),
        sigla: String(u.sigla ?? "").trim(),
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

  /* ---------- carregar usuários ---------- */
  const carregarUsuarios = useCallback(async () => {
    try {
      setCarregandoUsuarios(true);
      setErro("");
      setLive("Carregando usuários…");

      const data = await apiGet("/api/usuarios", { on403: "silent" });

      const base = Array.isArray(data)
        ? data
        : Array.isArray(data?.lista)
        ? data.lista
        : Array.isArray(data?.usuarios)
        ? data.usuarios
        : [];

      const enriched = base.map((u) => {
        // tenta montar sigla e nome da unidade
        const unidade_sigla = (() => {
          const raw =
            u?.unidade_sigla ||
            u?.sigla_unidade ||
            u?.unidade_abrev ||
            u?.unidade_sigla_nome ||
            "";
          return String(raw).trim().toUpperCase() || null;
        })();

        const unidade_nome =
  u?.unidade_nome ||
  null;

        return {
          ...u,
          idade: idadeFromISO(u?.data_nascimento) ?? undefined,
          perfil: toPerfilArray(u?.perfil), // <-- mantém array uniforme
          cpf_masked: maskCpf(u?.cpf),
          unidade_sigla,
          unidade_nome,
          escolaridade_nome:
            u?.escolaridade_nome ||
            u?.escolaridade ||
            u?.escolaridade_id ||
            null,
          cargo_nome: u?.cargo_nome || u?.cargo || u?.cargo_id || null,
          deficiencia_nome:
            u?.deficiencia_nome ||
            u?.deficiencia ||
            u?.deficiencia_id ||
            null,
          cursos_concluidos_75: undefined,
          certificados_emitidos: undefined,
        };
      });

      setUsuarios(enriched);
      setResumoCache(new Map());
      setLive(`Usuários carregados: ${enriched.length}.`);
    } catch (e) {
      const msg = e?.message || "Erro ao carregar usuários.";
      console.error("❌ /api/usuarios falhou:", e);
      setErro(msg);
      toast.error(msg);
      setUsuarios([]);
      setLive("Falha ao carregar usuários.");
    } finally {
      setCarregandoUsuarios(false);
      setHydrating(false);
    }
  }, []);

  useEffect(() => {
    carregarUnidades();
    carregarUsuarios();
  }, [carregarUnidades, carregarUsuarios]);

  /* ---------- KPIs ---------- */
  const kpis = useMemo(() => {
    const total = usuarios.length;
  
    let usuario = 0;
    let instrutor = 0;
    let administrador = 0;
  
    for (const u of usuarios) {
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
  }, [usuarios]);

  /* ---------- carregar resumo POR usuário ---------- */
  async function carregarResumoUsuario(id) {
    if (!id) return;
    if (resumoCache.has(id) || loadingResumo.has(id)) return;

    setLoadingResumo((prev) => new Set(prev).add(id));
    try {
      const r = await apiGet(`/api/usuarios/${id}/resumo`, {
        on404: "silent",
      });
      const resumo = {
        cursos_concluidos_75: Number(
          r?.cursos_concluidos_75 ?? 0,
        ),
        certificados_emitidos: Number(
          r?.certificados_emitidos ?? 0,
        ),
      };
      setResumoCache((prev) => {
        const next = new Map(prev);
        next.set(id, resumo);
        return next;
      });
      setUsuarios((prev) =>
        prev.map((u) =>
          u.id === id ? { ...u, ...resumo } : u,
        ),
      );
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
      const msg =
        err?.message ||
        err?.erro ||
        "❌ Erro ao atualizar perfil.";
      console.error("❌ Erro ao atualizar perfil:", err);
      toast.error(msg);
    }
  }



  /* ---------- busca com debounce ---------- */
  const [debouncedQ, setDebouncedQ] = useState("");
  useEffect(() => {
    const t = setTimeout(
      () => setDebouncedQ(sLower(busca).trim()),
      250,
    );
    return () => clearTimeout(t);
  }, [busca]);

  /* ---------- filtros por perfil ---------- */
  const [fPerfis, setFPerfis] = useState(
    () => new Set(PERFIS_PERMITIDOS),
  );
  const togglePerfil = (p) => {
    const key = sLower(p);
    setFPerfis((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      if (next.size === 0)
        PERFIS_PERMITIDOS.forEach((x) => next.add(x));
      return next;
    });
  };
  const resetPerfis = () => setFPerfis(new Set(PERFIS_PERMITIDOS));

  /* ---------- opções únicas (Unidade / Cargo) ---------- */
  /* ---------- opções únicas (Unidade / Cargo) ---------- */
const { unidadesOpts, cargosOpts } = useMemo(() => {
  // SIGLAS realmente usadas na lista de usuários
  const siglasUsadas = new Set();

  (usuarios || []).forEach((u) => {
    const fromJoin = String(u?.unidade_sigla || "").trim();
    const fromId =
      u?.unidade_id ? String(unidadesMap.get(u.unidade_id)?.sigla || "").trim() : "";
    const s = (fromJoin || fromId).toUpperCase();
    if (s) siglasUsadas.add(s);
  });

  // ordena; se vazio, fallback para todas as unidades conhecidas
  let unidadesArr = Array.from(siglasUsadas).sort((a, b) => a.localeCompare(b, "pt-BR"));
  if (unidadesArr.length === 0) {
    unidadesArr = Array.from(
      new Set(
        (unidades || [])
          .map((u) => (u.sigla || u.nome || "").trim())
          .filter(Boolean)
          .map((s) => s.toUpperCase())
      )
    ).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }

  // CARGOS já vinha dos usuários (mantém)
  const cargosArr = Array.from(
    new Set(
      (usuarios || [])
        .map((u) => String(u?.cargo_nome || "").trim())
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b, "pt-BR"));

  return { unidadesOpts: unidadesArr, cargosOpts: cargosArr };
}, [usuarios, unidades, unidadesMap]);

  /* ---------- filtro final (usa sigla da unidade) ---------- */
  const usuariosFiltrados = useMemo(() => {
    const q = debouncedQ;
    const perfilOk = (p) => {
      const roles = toPerfilArray(p);
      return roles.some((r) => fPerfis.has(r));
    };
  
    return (usuarios || []).filter((u) => {
      if (!perfilOk(u?.perfil)) return false;

      /// Unidade (somente SIGLA)
      if (fUnidade !== "todas") {
        const siglaJoin = String(u?.unidade_sigla || "").trim(); // veio do /api/usuarios
        const siglaViaId = u?.unidade_id
          ? (unidadesMap.get(u.unidade_id)?.sigla || "")
          : "";
        const siglaUser = (siglaJoin || siglaViaId).toLowerCase();
        if (siglaUser !== fUnidade.toLowerCase()) return false;
      }

      // Cargo
      if (
        fCargo !== "todos" &&
        String(u?.cargo_nome ?? "").trim() !== fCargo
      ) {
        return false;
      }

      if (!q) return true;

    const nome = sLower(u?.nome);
    const email = sLower(u?.email);
    const cpf = sLower(u?.cpf);
    const registro = sLower(u?.registro);
    const perfTxt = toPerfilArray(u?.perfil).join(" ");
    const idStr = String(u?.id ?? "").toLowerCase();

    return (
      nome.includes(q) ||
      email.includes(q) ||
      cpf.includes(q) ||
      registro.includes(q) ||
      perfTxt.includes(q) ||
      idStr.includes(q)
    );
    });
  }, [usuarios, debouncedQ, fPerfis, fUnidade, fCargo]);

  /* ---------- paginação client-side ---------- */
  const totalItems = usuariosFiltrados.length;
  const totalPages = Math.max(
    1,
    Math.ceil(totalItems / pageSize),
  );

  useEffect(() => {
    setPage(1);
  }, [debouncedQ, fPerfis, fUnidade, fCargo, pageSize]);

  const pageClamped = Math.min(page, totalPages);
  const sliceStart = (pageClamped - 1) * pageSize;
  const sliceEnd = sliceStart + pageSize;
  const usuariosPaginados = useMemo(
    () => usuariosFiltrados.slice(sliceStart, sliceEnd),
    [usuariosFiltrados, sliceStart, sliceEnd],
  );

  /* ---------- CPF reveal/ocultar ---------- */
  const onToggleCpf = (id) => {
    setRevealCpfIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  /* ---------- export CSV ---------- */
  const onExportCsv = () => {
    try {
      const headers = [
        "id",
        "nome",
        "email",
        "perfil",
        "unidade_sigla",
        "cargo",
        "escolaridade",
        "idade",
      ];
      const rows = usuariosFiltrados.map((u) => {
        const siglaViaId = u?.unidade_id
          ? (unidadesMap.get(u.unidade_id)?.sigla || "")
          : "";
        const sigla = u?.unidade_sigla || siglaViaId || u?.unidade_nome || "";
        return [
          u?.id ?? "",
          u?.nome ?? "",
          u?.email ?? "",
          toPerfilArray(u?.perfil).join(", "),
          sigla,
          u?.cargo_nome ?? "",
          u?.escolaridade_nome ?? "",
          Number.isFinite(u?.idade) ? u.idade : "",
        ];
      });
      const content = [headers, ...rows]
        .map((r) => r.map(csvEscape).join(";"))
        .join("\n");
      const blob = new Blob([content], {
        type: "text/csv;charset=utf-8",
      });
      downloadBlob(
        `usuarios_${new Date().toISOString().slice(0, 10)}.csv`,
        blob,
      );
      toast.success("📄 CSV exportado da lista filtrada.");
    } catch (e) {
      console.error("CSV erro", e);
      toast.error("Não foi possível exportar o CSV.");
    }
  };

  const anyLoading = carregandoUsuarios;

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      {/* live region acessível */}
      <p
        ref={liveRef}
        className="sr-only"
        aria-live="polite"
      />

      {/* header */}
      <HeaderHero
        onAtualizar={carregarUsuarios}
        atualizando={carregandoUsuarios || hydrating}
        total={usuarios?.length || 0}
        kpis={kpis}
      />

      {/* progress bar fina */}
      {anyLoading && (
        <div
          className="sticky top-0 z-40 h-1 w-full bg-fuchsia-100"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Carregando dados"
        >
          <div className="h-full w-1/3 animate-pulse bg-fuchsia-700" />
        </div>
      )}

      <main
        id="conteudo"
        className="mx-auto w-full max-w-6xl flex-1 px-3 sm:px-4 py-6"
      >
        {/* Barra de ações sticky (mobile-first) */}
        <section
          aria-label="Ferramentas de busca e filtros"
          className="sticky top-1 z-30 mb-5 rounded-2xl border border-zinc-200 bg-white/80 p-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/80"
        >
          <div className="flex flex-col gap-3">
            {/* Linha 1: Busca */}
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
                placeholder="Buscar por nome, e-mail, CPF, registro ou ID… (/)"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="w-full rounded-xl border px-9 py-2 text-sm ring-offset-2 focus:outline-none focus:ring-2 focus:ring-violet-700 dark:border-zinc-700 dark:bg-zinc-800"
                aria-describedby="resultados-count"
              />
              <p
                id="resultados-count"
                className="sr-only"
                aria-live="polite"
              >
                {usuariosFiltrados.length} resultado(s).
              </p>
            </div>

            {/* Linha 2: filtros e ações */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              {/* Chips de perfil */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
                  <Filter className="h-3.5 w-3.5" /> Perfis:
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
                  className="text-xs underline decoration-dotted underline-offset-4 opacity-80 hover:opacity-100"
                >
                  limpar
                </button>
              </div>

              {/* Selects Unidade / Cargo + Export */}
              <div className="flex flex-wrap items-center gap-2">
                {/* UNIDADE agora mostra só a sigla visualmente */}
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
                  disabled={!usuariosFiltrados.length}
                  className="inline-flex items-center gap-2 rounded-xl bg-violet-700 px-3 py-2 text-xs font-medium text-white hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-60"
                  title="Exportar CSV da lista filtrada"
                >
                  <Download className="h-4 w-4" />
                  Exportar CSV
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* lista */}
        {carregandoUsuarios ? (
          <div
            className="space-y-4"
            aria-busy="true"
            aria-live="polite"
          >
            {[...Array(6)].map((_, i) => (
              <Skeleton
                key={i}
                height={96}
                className="rounded-2xl"
              />
            ))}
          </div>
        ) : erro ? (
          <p
            className="text-center text-red-500"
            role="alert"
          >
            {erro}
          </p>
        ) : (
          <>
            <TabelaUsuarios
              usuarios={
                Array.isArray(usuariosPaginados)
                  ? usuariosPaginados
                  : []
              }
              onEditar={(usuario) =>
                setUsuarioSelecionado(usuario)
              }
              onToggleCpf={onToggleCpf}
              isCpfRevealed={(id) =>
                revealCpfIds.has(id)
              }
              maskCpfFn={maskCpf}
              /* carregamento sob demanda do resumo */
              onCarregarResumo={carregarResumoUsuario}
              isResumoLoading={(id) =>
                loadingResumo.has(id)
              }
              hasResumo={(id) => resumoCache.has(id)}
            />

            {/* Paginação */}
            <div className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
              <div className="text-xs text-zinc-600 dark:text-zinc-400">
                Mostrando <strong>{usuariosPaginados.length}</strong>{" "}
                de <strong>{totalItems}</strong>{" "}
                resultado(s) — página {pageClamped} de{" "}
                {totalPages}
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-zinc-600 dark:text-zinc-400">
                  Por página:
                </label>
                <select
                  value={pageSize}
                  onChange={(e) =>
                    setPageSize(
                      Number(e.target.value) || 25,
                    )
                  }
                  className="rounded-xl border px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-violet-700 dark:border-zinc-700 dark:bg-zinc-800"
                >
                  {[10, 25, 50, 100].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() =>
                    setPage((p) => Math.max(1, p - 1))
                  }
                  disabled={pageClamped <= 1}
                  className="inline-flex items-center gap-1 rounded-xl border px-2 py-1.5 text-xs hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                >
                  <ChevronLeft className="h-4 w-4" />{" "}
                  Anterior
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setPage((p) =>
                      Math.min(totalPages, p + 1),
                    )
                  }
                  disabled={pageClamped >= totalPages}
                  className="inline-flex items-center gap-1 rounded-xl border px-2 py-1.5 text-xs hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                >
                  Próxima{" "}
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </>
        )}

        {/* modal (lazy) */}
        <Suspense fallback={null}>
          {usuarioSelecionado && (
            <ModalEditarPerfil
              usuario={usuarioSelecionado}
              onFechar={() => setUsuarioSelecionado(null)}
              onSalvar={salvarPerfil}
            />
          )}
        </Suspense>

        {/* rodapé de segurança */}
        <div className="mt-8 flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
          <ShieldCheck
            className="h-4 w-4"
            aria-hidden="true"
          />
          <span>
            CPFs ficam ocultos por padrão. Clique em
            “revelar” por usuário para exibir (não é
            persistido).
          </span>
        </div>
      </main>

      <Footer />
    </div>
  );
}
