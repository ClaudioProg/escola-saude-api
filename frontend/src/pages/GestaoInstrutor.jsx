// 📁 src/pages/GestaoInstrutor.jsx
import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import Skeleton from "react-loading-skeleton";
import Modal from "react-modal";

import { apiGet } from "../services/api";
import Breadcrumbs from "../components/Breadcrumbs";
import TabelaInstrutor from "../components/TabelaInstrutor";
import CabecalhoPainel from "../components/CabecalhoPainel";
// (Rota já protegida por <PrivateRoute permitido={["administrador"]}> no App.jsx)

Modal.setAppElement("#root");

// ---------- helpers anti-fuso ----------
function ymd(input) {
  if (!input) return "";
  const m = String(input).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : "";
}
function ymdToBR(s) {
  const m = ymd(s).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "—";
}
// --------------------------------------

export default function GestaoInstrutor() {
  const [instrutores, setInstrutores] = useState([]);
  const [carregandoDados, setCarregandoDados] = useState(true);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");

  const [historico, setHistorico] = useState([]);
  const [modalHistoricoAberto, setModalHistoricoAberto] = useState(false);
  const [instrutorSelecionado, setInstrutorSelecionado] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        setCarregandoDados(true);
        setErro("");
        console.log("👩‍🏫 [GestaoInstrutor] GET /api/instrutor ...");
        const data = await apiGet("/api/instrutor");
        console.log("✅ Payload /api/instrutor:", data);

        const lista =
          Array.isArray(data) ? data :
          Array.isArray(data?.lista) ? data.lista :
          Array.isArray(data?.instrutores) ? data.instrutores :
          [];

        setInstrutores(lista);
      } catch (err) {
        const msg = err?.message || "Erro ao carregar instrutores.";
        console.error("❌ /api/instrutor falhou:", err);
        setErro(msg);
        setInstrutores([]);
        toast.error(`❌ ${msg}`);
      } finally {
        setCarregandoDados(false);
      }
    })();
  }, []);

  const normaliza = (s) => (typeof s === "string" ? s.toLowerCase() : "");
  const filtrados = useMemo(() => {
    const alvo = normaliza(busca);
    return (instrutores || []).filter(
      (p) => normaliza(p?.nome).includes(alvo) || normaliza(p?.email).includes(alvo)
    );
  }, [instrutores, busca]);

  async function abrirModalVisualizar(instrutor) {
    setInstrutorSelecionado(instrutor);
    setModalHistoricoAberto(true);
    try {
      console.log(`🗂️ [GestaoInstrutor] GET /api/instrutor/${instrutor.id}/eventos-avaliacoes`);
      const data = await apiGet(`/api/instrutor/${instrutor.id}/eventos-avaliacoes`);

      // ⚠️ Não usamos new Date() aqui; guardamos YMD para render anti-fuso
      const eventos = (Array.isArray(data) ? data : []).map((ev) => ({
        id: ev.evento_id,
        titulo: ev.evento,
        data_inicio_ymd: ymd(ev.data_inicio),
        data_fim_ymd: ymd(ev.data_fim),
        nota_media: ev.nota_media !== null && ev.nota_media !== undefined
          ? Number(ev.nota_media)
          : null,
      }));
      setHistorico(eventos);
    } catch (e) {
      console.error("❌ histórico do instrutor:", e);
      toast.error("❌ Erro ao buscar histórico do instrutor.");
      setHistorico([]);
    }
  }

  return (
    <main className="min-h-screen bg-gelo dark:bg-zinc-900 px-4 py-6 max-w-screen-lg mx-auto">
      <Breadcrumbs trilha={[{ label: "Painel administrador" }, { label: "Gestão de instrutor" }]} />
      <CabecalhoPainel titulo="👩‍🏫 Gestão de instrutor" />

      <div className="mb-6 mt-4">
        <input
          type="text"
          placeholder="🔍 Buscar por nome ou e-mail..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="w-full px-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-lousa dark:bg-gray-800 dark:text-white"
        />
      </div>

      {carregandoDados ? (
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} height={70} className="rounded-lg" />
          ))}
        </div>
      ) : erro ? (
        <p className="text-red-500 text-center">{erro}</p>
      ) : (
        <TabelaInstrutor
          instrutor={Array.isArray(filtrados) ? filtrados : []}
          onVisualizar={abrirModalVisualizar}
        />
      )}

      {/* Modal Histórico */}
      <Modal
        isOpen={modalHistoricoAberto}
        onRequestClose={() => setModalHistoricoAberto(false)}
        className="bg-white dark:bg-gray-800 max-w-xl mx-auto mt-20 p-6 rounded-xl shadow-lg outline-none"
        overlayClassName="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-start z-50"
        contentLabel="Histórico do instrutor"
      >
        <h2 className="text-xl font-bold mb-4 text-black dark:text-white">
          Histórico de {instrutorSelecionado?.nome}
        </h2>

        {historico.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-300">Nenhum evento encontrado.</p>
        ) : (
          <div className="mt-4 max-h-[65vh] overflow-y-auto pr-2">
            <ul className="space-y-3">
              {historico.map((evento) => (
                <li
                  key={evento.id}
                  className="border p-3 rounded-md bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-100 shadow-sm"
                >
                  <p className="font-semibold">{evento.titulo}</p>
                  <p className="text-sm">
                    Data: {ymdToBR(evento.data_inicio_ymd)} até {ymdToBR(evento.data_fim_ymd)}
                  </p>
                  <p className="text-sm">
                    Média de avaliação:{" "}
                    <strong>
                      {evento.nota_media !== null ? evento.nota_media.toFixed(1) : "N/A"}
                    </strong>
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}

        <button
          onClick={() => setModalHistoricoAberto(false)}
          className="mt-6 px-4 py-2 rounded-md bg-zinc-700 hover:bg-zinc-800 text-white font-medium shadow transition-all"
        >
          ❌ Fechar
        </button>
      </Modal>
    </main>
  );
}
