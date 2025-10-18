// 📁 src/pages/GestaoUsuarios.jsx
import { useEffect, useMemo, useRef, useState, useCallback, Suspense, lazy } from "react";
import { toast } from "react-toastify";
import Skeleton from "react-loading-skeleton";
import { Users, RefreshCcw, ShieldCheck, Search } from "lucide-react";

import { apiGet, apiPut } from "../services/api";
import Footer from "../components/Footer";
import TabelaUsuarios from "../components/TabelaUsuarios";

const ModalEditarPerfil = lazy(() => import("../components/ModalEditarPerfil"));

const PERFIS_PERMITIDOS = ["usuario", "instrutor", "administrador"];

/* ============ helpers ============ */
const onlyDigits = (s) => String(s || "").replace(/\D+/g, "");
const maskCpf = (cpf, revealed = false) => {
  const d = onlyDigits(cpf).padStart(11, "0").slice(-11);
  if (!d || d.length !== 11) return "—";
  if (!revealed) return d.replace(/^(\d{3})\d{3}(\d{3})\d{2}$/, "$1.***.$2-**");
  return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
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

/* ============ HeaderHero (três cores) ============ */
function HeaderHero({ onAtualizar, atualizando, total }) {
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
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10 md:py-12 min-h-[150px] sm:min-h-[180px]">
        <div className="flex flex-col items-center text-center gap-3 sm:gap-4">
          <div className="inline-flex items-center justify-center gap-2">
            <Users className="w-6 h-6" aria-hidden="true" />
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Gestão de Usuários
            </h1>
          </div>

          <p className="text-sm sm:text-base text-white/90 max-w-2xl">
            Busque, visualize e atualize perfis com segurança.
          </p>

          <div className="mt-2 sm:mt-3 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={onAtualizar}
              disabled={atualizando}
              className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition
                ${atualizando ? "opacity-60 cursor-not-allowed bg-white/20" : "bg-white/15 hover:bg-white/25"} text-white`}
              aria-label="Atualizar lista de usuários"
              aria-busy={atualizando ? "true" : "false"}
            >
              <RefreshCcw className="w-4 h-4" aria-hidden="true" />
              {atualizando ? "Atualizando…" : "Atualizar"}
            </button>

            {typeof total === "number" && (
              <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-2 text-xs">
                {total} usuário{total === 1 ? "" : "s"}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-px bg-white/25" aria-hidden="true" />
    </header>
  );
}

export default function GestaoUsuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [carregandoUsuarios, setCarregandoUsuarios] = useState(true);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const [usuarioSelecionado, setUsuarioSelecionado] = useState(null);
  const [revealCpfIds, setRevealCpfIds] = useState(() => new Set());
  const [hydrating, setHydrating] = useState(false); // mantém a flag, mas não hidrata em massa
  const searchRef = useRef(null);
  const liveRef = useRef(null);

  // cache para o resumo por usuário (carregado sob demanda)
  const [resumoCache, setResumoCache] = useState(() => new Map());       // id -> { cursos_concluidos_75, certificados_emitidos }
  const [loadingResumo, setLoadingResumo] = useState(() => new Set());    // ids em carregamento

  const setLive = (msg) => { if (liveRef.current) liveRef.current.textContent = msg; };

  // atalho: "/" foca busca
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

  /* ---------- carregar (sem hidratação pesada) ---------- */
  const carregarUsuarios = useCallback(async () => {
    try {
      setCarregandoUsuarios(true);
      setErro("");
      setLive("Carregando usuários…");

      const data = await apiGet("/api/usuarios", { on403: "silent" });
      const base =
        Array.isArray(data) ? data :
        Array.isArray(data?.lista) ? data.lista :
        Array.isArray(data?.usuarios) ? data.usuarios : [];

      const enriched = base.map((u) => ({
        ...u,
        idade: idadeFrom(u?.data_nascimento) ?? undefined,
        cpf_masked: maskCpf(u?.cpf),
        unidade_nome: u?.unidade_nome || u?.unidade || u?.unidade_id || null,
        escolaridade_nome: u?.escolaridade_nome || u?.escolaridade || u?.escolaridade_id || null,
        cargo_nome: u?.cargo_nome || u?.cargo || u?.cargo_id || null,
        deficiencia_nome: u?.deficiencia_nome || u?.deficiencia || u?.deficiencia_id || null,
        // valores que só virão quando o usuário abrir o “detalhe”:
        cursos_concluidos_75: undefined,
        certificados_emitidos: undefined,
      }));

      setUsuarios(enriched);
      setResumoCache(new Map());     // limpa cache de resumos ao recarregar
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

  useEffect(() => { carregarUsuarios(); }, [carregarUsuarios]);

  /* ---------- carregar resumo de UM usuário, sob demanda ---------- */
  async function carregarResumoUsuario(id) {
    if (!id) return;
    if (resumoCache.has(id) || loadingResumo.has(id)) return; // já em cache ou em andamento

    setLoadingResumo((prev) => new Set(prev).add(id));
    try {
      const r = await apiGet(`/api/usuarios/${id}/resumo`, { on404: "silent" });
      const resumo = {
        cursos_concluidos_75: Number(r?.cursos_concluidos_75 ?? 0),
        certificados_emitidos: Number(r?.certificados_emitidos ?? 0),
      };
      setResumoCache((prev) => {
        const next = new Map(prev);
        next.set(id, resumo);
        return next;
      });
      // opcional: refletir no array principal (para aparecer no card imediatamente)
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
    perfilStr = String(perfilStr ?? "").trim().toLowerCase();
    if (!PERFIS_PERMITIDOS.includes(perfilStr)) {
      toast.error("Perfil inválido.");
      return;
    }

    try {
      await apiPut(`/api/usuarios/${id}/perfil`, { perfil: perfilStr });
      toast.success("✅ Perfil atualizado com sucesso!");
      setUsuarioSelecionado(null);
      carregarUsuarios(); // refresh leve
    } catch (err) {
      const msg = err?.message || err?.erro || "❌ Erro ao atualizar perfil.";
      console.error("❌ Erro ao atualizar perfil:", err);
      toast.error(msg);
    }
  }

  /* ---------- busca com debounce ---------- */
  const [debouncedQ, setDebouncedQ] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ((busca || "").toLowerCase().trim()), 250);
    return () => clearTimeout(t);
  }, [busca]);

  /* ---------- filtro ---------- */
  const usuariosFiltrados = useMemo(() => {
    const q = debouncedQ;
    if (!q) return usuarios;
    return (usuarios || []).filter((u) => {
      const nome = (u?.nome || "").toLowerCase();
      const email = (u?.email || "").toLowerCase();
      const cpf = (u?.cpf || "").toLowerCase();
      const registro = (u?.registro || "").toLowerCase();
      return nome.includes(q) || email.includes(q) || cpf.includes(q) || registro.includes(q);
    });
  }, [usuarios, debouncedQ]);

  /* ---------- CPF reveal/ocultar por item ---------- */
  const onToggleCpf = (id) => {
    setRevealCpfIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const anyLoading = carregandoUsuarios; // não hidratamos mais em massa

  return (
    <div className="flex flex-col min-h-screen bg-gelo dark:bg-zinc-900 text-black dark:text-white">
      {/* live region acessível */}
      <p ref={liveRef} className="sr-only" aria-live="polite" />

      {/* header */}
      <HeaderHero
        onAtualizar={carregarUsuarios}
        atualizando={carregandoUsuarios || hydrating}
        total={usuarios?.length || 0}
      />

      {/* progress bar fina */}
      {(anyLoading) && (
        <div
          className="sticky top-0 left-0 w-full h-1 bg-fuchsia-100 z-40"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Carregando dados"
        >
          <div className="h-full bg-fuchsia-700 animate-pulse w-1/3" />
        </div>
      )}

      <main id="conteudo" className="flex-1 max-w-6xl mx-auto px-3 sm:px-4 py-6">
        {/* 🔍 Busca (sem KPIs agregados) */}
        <section className="mb-5" aria-label="Busca">
          <label className="sr-only" htmlFor="busca-usuarios">
            Buscar por nome, e-mail, CPF ou registro
          </label>
          <div className="relative max-w-lg">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500"
              aria-hidden="true"
            />
            <input
              ref={searchRef}
              id="busca-usuarios"
              type="text"
              autoComplete="off"
              placeholder="Buscar por nome, e-mail, CPF ou registro…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-violet-700 focus:outline-none dark:bg-gray-800 dark:text-white"
              aria-describedby="resultados-count"
            />
            <p id="resultados-count" className="sr-only" aria-live="polite">
              {usuariosFiltrados.length} resultado(s).
            </p>
          </div>
        </section>

        {/* lista */}
        {carregandoUsuarios ? (
          <div className="space-y-4" aria-busy="true" aria-live="polite">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} height={96} className="rounded-lg" />
            ))}
          </div>
        ) : erro ? (
          <p className="text-red-500 text-center" role="alert">
            {erro}
          </p>
        ) : (
          <TabelaUsuarios
            usuarios={Array.isArray(usuariosFiltrados) ? usuariosFiltrados : []}
            onEditar={(usuario) => setUsuarioSelecionado(usuario)}
            onToggleCpf={onToggleCpf}
            isCpfRevealed={(id) => revealCpfIds.has(id)}
            maskCpfFn={maskCpf}
            /* 🔽 NOVO: carregamento sob demanda do resumo */
            onCarregarResumo={carregarResumoUsuario}
            isResumoLoading={(id) => loadingResumo.has(id)}
            hasResumo={(id) => resumoCache.has(id)}
          />
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
