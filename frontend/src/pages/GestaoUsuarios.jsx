// 📁 src/pages/GestaoUsuarios.jsx
import { useEffect, useMemo, useRef, useState, Suspense, lazy } from "react";
import { toast } from "react-toastify";
import Skeleton from "react-loading-skeleton";
import { Users, RefreshCcw } from "lucide-react";

import { apiGet, apiPut } from "../services/api";
import Footer from "../components/Footer";
import TabelaUsuarios from "../components/TabelaUsuarios";

const ModalEditarPerfil = lazy(() => import("../components/ModalEditarPerfil"));

const PERFIS_PERMITIDOS = ["usuario", "instrutor", "administrador"];

/* ---------------- HeaderHero (roxo/azulado, título central, altura média) ---------------- */
function HeaderHero({ onAtualizar, atualizando, total }) {
  return (
    <header
      className="relative isolate overflow-hidden bg-gradient-to-br from-indigo-900 via-violet-800 to-fuchsia-700 text-white"
      role="banner"
    >
      {/* glow sutil */}
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
            <Users className="w-6 h-6" />
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
              <RefreshCcw className="w-4 h-4" />
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
  const liveRef = useRef(null);

  const setLive = (msg) => {
    if (liveRef.current) liveRef.current.textContent = msg;
  };

  useEffect(() => {
    carregarUsuarios();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function carregarUsuarios() {
    try {
      setCarregandoUsuarios(true);
      setErro("");
      setLive("Carregando usuários…");
      const data = await apiGet("/api/usuarios", { on403: "silent" });

      const lista =
        Array.isArray(data) ? data :
        Array.isArray(data?.lista) ? data.lista :
        Array.isArray(data?.usuarios) ? data.usuarios :
        [];

      setUsuarios(lista);
      setLive(`Usuários carregados: ${lista.length}.`);
    } catch (e) {
      const msg = e?.message || "Erro ao carregar usuários.";
      console.error("❌ /api/usuarios falhou:", e);
      setErro(msg);
      toast.error(msg);
      setUsuarios([]);
      setLive("Falha ao carregar usuários.");
    } finally {
      setCarregandoUsuarios(false);
    }
  }

  async function salvarPerfil(id, perfil) {
    let perfilStr = Array.isArray(perfil) ? perfil[0] : perfil;
    perfilStr = String(perfilStr ?? "").trim().toLowerCase();

    if (!PERFIS_PERMITIDOS.includes(perfilStr)) {
      toast.error("Perfil inválido.");
      return;
    }

    try {
      const resp = await apiPut(`/api/usuarios/${id}/perfil`, { perfil: perfilStr });

      if (resp === true || resp?.ok) {
        toast.success("✅ Perfil atualizado com sucesso!");
      } else {
        toast.success("✅ Perfil atualizado com sucesso!");
      }

      setUsuarioSelecionado(null);
      await carregarUsuarios();
    } catch (err) {
      const msg = err?.message || err?.erro || "❌ Erro ao atualizar perfil.";
      console.error("❌ Erro ao atualizar perfil:", err);
      toast.error(msg);
    }
  }

  const usuariosFiltrados = useMemo(() => {
    const q = (busca || "").toLowerCase();
    return (usuarios || []).filter(
      (u) =>
        (u?.nome || "").toLowerCase().includes(q) ||
        (u?.email || "").toLowerCase().includes(q)
    );
  }, [usuarios, busca]);

  const anyLoading = carregandoUsuarios;

  return (
    <div className="flex flex-col min-h-screen bg-gelo dark:bg-zinc-900 text-black dark:text-white">
      {/* live region acessível */}
      <p ref={liveRef} className="sr-only" aria-live="polite" />

      {/* Header Hero */}
      <HeaderHero
        onAtualizar={carregarUsuarios}
        atualizando={carregandoUsuarios}
        total={usuarios?.length || 0}
      />

      {/* barra de progresso fina quando carregando */}
      {anyLoading && (
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

      <main className="flex-1 max-w-6xl mx-auto px-3 sm:px-4 py-6">
        {/* Barra de busca acessível */}
        <section className="mb-5" aria-label="Busca de usuários">
          <div className="relative">
            <input
              type="text"
              placeholder="🔍 Buscar por nome ou e-mail..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-violet-700 focus:outline-none dark:bg-gray-800 dark:text-white"
              aria-label="Buscar por nome ou e-mail"
            />
            <p className="sr-only" aria-live="polite">
              {usuariosFiltrados.length} resultado(s).
            </p>
          </div>
        </section>

        {/* Lista/Tabela */}
        {carregandoUsuarios ? (
          <div className="space-y-4" aria-busy="true" aria-live="polite">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} height={72} className="rounded-lg" />
            ))}
          </div>
        ) : erro ? (
          <p className="text-red-500 text-center" role="alert">{erro}</p>
        ) : (
          <TabelaUsuarios
            usuarios={Array.isArray(usuariosFiltrados) ? usuariosFiltrados : []}
            onEditar={(usuario) => setUsuarioSelecionado(usuario)}
          />
        )}

        {/* Modal (lazy) */}
        <Suspense fallback={null}>
          {usuarioSelecionado && (
            <ModalEditarPerfil
              usuario={usuarioSelecionado}
              onFechar={() => setUsuarioSelecionado(null)}
              onSalvar={salvarPerfil}
            />
          )}
        </Suspense>
      </main>

      <Footer />
    </div>
  );
}
