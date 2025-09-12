// 📁 src/pages/GestaoUsuarios.jsx
import { useEffect, useMemo, useState, Suspense, lazy } from "react";
import { toast } from "react-toastify";
import Skeleton from "react-loading-skeleton";

import { apiGet, apiPut } from "../services/api";
import Breadcrumbs from "../components/Breadcrumbs";
import PageHeader from "../components/PageHeader";
import Footer from "../components/Footer";
import TabelaUsuarios from "../components/TabelaUsuarios";

const ModalEditarPerfil = lazy(() => import("../components/ModalEditarPerfil"));

const PERFIS_PERMITIDOS = ["usuario", "instrutor", "administrador"];

export default function GestaoUsuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [carregandoUsuarios, setCarregandoUsuarios] = useState(true);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const [usuarioSelecionado, setUsuarioSelecionado] = useState(null);

  useEffect(() => {
    carregarUsuarios();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function carregarUsuarios() {
    try {
      setCarregandoUsuarios(true);
      setErro("");
      const data = await apiGet("/api/usuarios");

      const lista =
        Array.isArray(data) ? data :
        Array.isArray(data?.lista) ? data.lista :
        Array.isArray(data?.usuarios) ? data.usuarios :
        [];

      setUsuarios(lista);
    } catch (e) {
      const msg = e?.message || "Erro ao carregar usuários.";
      console.error("❌ /api/usuarios falhou:", e);
      setErro(msg);
      toast.error(msg);
      setUsuarios([]);
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

  return (
    <main className="min-h-screen bg-gelo dark:bg-zinc-900">
      <div className="px-2 sm:px-4 py-6 max-w-6xl mx-auto">
        <Breadcrumbs trilha={[{ label: "Painel administrador" }, { label: "Gestão de Usuários" }]} />

        {/* Page header com respiro */}
        <PageHeader
          title="👥 Gestão de Usuários"
          subtitle="Busque, visualize e atualize perfis com segurança."
          className="mb-5 sm:mb-6"
        />

        {/* Barra de busca acessível */}
        <section className="mb-5" aria-label="Busca de usuários">
          <div className="relative">
            <input
              type="text"
              placeholder="🔍 Buscar por nome ou e-mail..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-lousa focus:outline-none dark:bg-gray-800 dark:text-white"
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
          <p className="text-red-500 text-center">{erro}</p>
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
      </div>

      <Footer />
    </main>
  );
}
