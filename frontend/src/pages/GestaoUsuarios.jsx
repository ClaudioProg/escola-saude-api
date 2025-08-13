// 📁 src/pages/GestaoUsuarios.jsx
import { useEffect, useMemo, useState, Suspense, lazy } from "react";
import { toast } from "react-toastify";
import Skeleton from "react-loading-skeleton";

import { apiGet, apiPut } from "../services/api";
import Breadcrumbs from "../components/Breadcrumbs";
import TabelaUsuarios from "../components/TabelaUsuarios";
import CabecalhoPainel from "../components/CabecalhoPainel";

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
    // normaliza o valor vindo do modal (string ou array)
    let perfilStr = Array.isArray(perfil) ? perfil[0] : perfil;
    perfilStr = String(perfilStr ?? "").trim().toLowerCase();

    if (!PERFIS_PERMITIDOS.includes(perfilStr)) {
      toast.error("Perfil inválido.");
      return;
    }

    try {
      const resp = await apiPut(`/api/usuarios/${id}/perfil`, { perfil: perfilStr });

      // se a API retornar 204 sem body, o wrapper pode devolver true; trate como sucesso
      if (resp === true || resp?.ok) {
        toast.success("✅ Perfil atualizado com sucesso!");
      } else {
        // quando vier um JSON com { ok: true, ... }
        toast.success("✅ Perfil atualizado com sucesso!");
      }

      setUsuarioSelecionado(null);
      await carregarUsuarios();
    } catch (err) {
      // mostra a mensagem real vinda da API se existir
      const msg =
        err?.message ||
        err?.erro ||
        "❌ Erro ao atualizar perfil.";
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
    <main className="min-h-screen bg-gelo dark:bg-zinc-900 px-4 py-6 max-w-screen-lg mx-auto">
      <Breadcrumbs trilha={[{ label: "Painel administrador" }, { label: "Gestão de Usuários" }]} />
      <CabecalhoPainel titulo="👥 Gestão de Usuários" />

      <div className="mb-6 mt-4">
        <input
          type="text"
          placeholder="🔍 Buscar por nome ou e-mail..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="w-full px-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-lousa dark:bg-gray-800 dark:text-white"
        />
      </div>

      {carregandoUsuarios ? (
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} height={70} className="rounded-lg" />
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
  );
}
