// 📁 src/pages/UsuarioSubmissoes.jsx
import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  FileText,
  PlusCircle,
  BookOpen,
  Loader2,
  Pencil,
  Download,
  ExternalLink,
} from "lucide-react";
import api, { apiGetFile, downloadBlob, apiHead } from "../services/api";
import ModalVerEdital from "../components/ModalVerEdital";
import ModalInscreverTrabalho from "../components/ModalInscreverTrabalho";
import Footer from "../components/Footer";

function PosterCell({ id, nome }) {
  const [downloading, setDownloading] = useState(false);

  const baixar = async () => {
    try {
      setDownloading(true);
      const { blob, filename } = await apiGetFile(`/submissoes/${id}/poster`);
      downloadBlob(filename || nome || "poster.pptx", blob);
    } catch (e) {
      alert(e?.message || "Falha ao baixar o pôster.");
    } finally {
      setDownloading(false);
    }
  };

  if (!nome) return <span className="text-gray-400 italic">—</span>;

  return (
    <button
      onClick={baixar}
      className="inline-flex items-center gap-1 text-indigo-600 hover:underline disabled:opacity-60"
      title="Baixar pôster"
      disabled={downloading}
    >
      {downloading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Download className="w-4 h-4" />
      )}
      {nome}
    </button>
  );
}

const BLOQUEADOS = new Set([
  "em_avaliacao",
  "aprovado_exposicao",
  "aprovado_oral",
  "reprovado",
]);

export default function UsuarioSubmissoes() {
  const [chamadas, setChamadas] = useState([]);
  const [minhas, setMinhas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalEdital, setModalEdital] = useState(null);
  // modalInscricao aceita { chamadaId? , submissaoId? }
  const [modalInscricao, setModalInscricao] = useState(null);
  // cache: chamadaId -> bool (tem modelo de pôster?)
  const [modeloMap, setModeloMap] = useState({});
  // controle de spinner por chamada ao baixar modelo
  const [baixandoMap, setBaixandoMap] = useState({}); // { [chamadaId]: boolean }

  // ── download autenticado do modelo de pôster
  async function baixarModeloBanner(chId) {
    if (!chId) return;
    try {
      setBaixandoMap((m) => ({ ...m, [chId]: true }));
      const { blob, filename } = await apiGetFile(`/chamadas/${chId}/modelo-banner`);
      downloadBlob(filename || "modelo-poster.pptx", blob);
    } catch (e) {
      alert(e?.message || "Falha ao baixar o modelo de pôster.");
    } finally {
      setBaixandoMap((m) => ({ ...m, [chId]: false }));
    }
  }

  // ───────────── Fetch inicial ─────────────
  useEffect(() => {
    async function loadData() {
      try {
        const [c, s] = await Promise.all([
          api.get("/chamadas/ativas"),
          api.get("/submissoes/minhas"),
        ]);
        const chamadasArr = Array.isArray(c) ? c : c.data || [];
        setChamadas(chamadasArr);
        setMinhas(Array.isArray(s) ? s : s.data || []);

        // paraleliza verificação do modelo para cada chamada
        const checks = await Promise.all(
          chamadasArr.map(async (ch) => {
            try {
              const ok = await apiHead(`/chamadas/${ch.id}/modelo-banner`, {
                auth: true,
                on401: "silent",
                on403: "silent",
              });
              return [ch.id, !!ok];
            } catch {
              return [ch.id, false];
            }
          })
        );
        const map = Object.fromEntries(checks);
        setModeloMap(map);
      } catch (err) {
        console.error("Erro ao carregar dados:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleSucesso = async () => {
    const s = await api.get("/submissoes/minhas");
    setMinhas(Array.isArray(s) ? s : s.data || []);
  };

  const isDentroPrazo = (row) =>
    !!(row?.dentro_prazo ?? row?.dentroPrazo);

  const canEdit = (row) => {
    // pode editar se: dentro do prazo da chamada e status NÃO está nos bloqueados
    return isDentroPrazo(row) && !BLOQUEADOS.has(row.status);
  };

  const abertas = useMemo(
    () => chamadas.filter((c) => isDentroPrazo(c)).length,
    [chamadas]
  );

  const aprovadas = useMemo(
    () =>
      minhas.filter((m) =>
        ["aprovado_oral", "aprovado_exposicao"].includes(m.status)
      ).length,
    [minhas]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-violet-50 to-indigo-100">
        <Loader2 className="w-8 h-8 text-violet-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-violet-50 via-white to-indigo-100">
      {/* HeaderHero */}
      <header className="relative isolate overflow-hidden bg-gradient-to-r from-violet-800 via-indigo-700 to-blue-600 py-16 px-6 text-white text-center">
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-3xl sm:text-4xl font-bold mb-2"
        >
          Submissão de Trabalhos
        </motion.h1>
        <p className="text-violet-100 max-w-2xl mx-auto text-sm sm:text-base">
          Acompanhe suas submissões, edite rascunhos e inscreva novos trabalhos.
        </p>
      </header>

      {/* Conteúdo principal */}
      <main className="flex-1 px-4 sm:px-8 py-10 max-w-6xl mx-auto w-full space-y-10">
        {/* ────── Mini Cards ────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
          <div className="bg-white rounded-xl shadow p-4 border-t-4 border-violet-600">
            <p className="text-sm text-gray-500">Chamadas abertas</p>
            <p className="text-2xl font-semibold text-violet-700">{abertas}</p>
          </div>
          <div className="bg-white rounded-xl shadow p-4 border-t-4 border-indigo-600">
            <p className="text-sm text-gray-500">Minhas submissões</p>
            <p className="text-2xl font-semibold text-indigo-700">{minhas.length}</p>
          </div>
          <div className="bg-white rounded-xl shadow p-4 border-t-4 border-blue-600">
            <p className="text-sm text-gray-500">Aprovadas</p>
            <p className="text-2xl font-semibold text-blue-700">{aprovadas}</p>
          </div>
        </div>

        {/* ────── Chamadas Abertas ────── */}
        <section>
          <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-violet-600" />
            Chamadas abertas
          </h2>

          {chamadas.length === 0 ? (
            <p className="text-gray-600 italic">Nenhuma chamada disponível no momento.</p>
          ) : (
            <div className="grid md:grid-cols-2 gap-5">
              {chamadas.map((ch) => {
                const temModelo = !!modeloMap[ch.id];
                const prazoStr = ch.prazo_final_br || ch.prazo_final || ch.prazoFinal;
                const prazoFmt = prazoStr
                  ? /^\d{4}-\d{2}-\d{2}/.test(String(prazoStr))
                    ? new Date(prazoStr).toLocaleDateString("pt-BR")
                    : String(prazoStr)
                  : "—";
                const carregando = !!baixandoMap[ch.id];

                return (
                  <motion.div
                    key={ch.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white border rounded-xl shadow hover:shadow-md transition p-5 flex flex-col justify-between"
                  >
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800 mb-1">
                        {ch.titulo}
                      </h3>
                      <p className="text-sm text-gray-600 line-clamp-3 mb-3">
                        {ch.descricao_markdown?.slice(0, 200)}...
                      </p>
                      <p
                        className={`text-xs font-medium ${
                          isDentroPrazo(ch) ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        Prazo final: {prazoFmt}
                      </p>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-3 items-center">
                      <button
                        onClick={() => setModalEdital(ch.id)}
                        className="flex items-center gap-2 text-sm bg-violet-700 text-white px-3 py-2 rounded-md hover:bg-violet-800 transition"
                      >
                        <FileText className="w-4 h-4" /> Ver edital
                      </button>

                      {isDentroPrazo(ch) && (
                        <button
                          onClick={() => setModalInscricao({ chamadaId: ch.id })}
                          className="flex items-center gap-2 text-sm bg-indigo-600 text-white px-3 py-2 rounded-md hover:bg-indigo-700 transition"
                        >
                          <PlusCircle className="w-4 h-4" /> Submeter trabalho
                        </button>
                      )}

                      {temModelo && (
                        <button
                          type="button"
                          onClick={() => baixarModeloBanner(ch.id)}
                          className="ml-auto inline-flex items-center gap-1 text-sm text-indigo-700 hover:underline disabled:opacity-60"
                          disabled={carregando}
                          title="Baixar modelo de pôster"
                        >
                          {carregando ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <ExternalLink className="w-3.5 h-3.5" />
                          )}
                          Modelo de pôster
                        </button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </section>

        {/* ────── Minhas Submissões ────── */}
        <section>
          <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600" />
            Minhas submissões
          </h2>

          {minhas.length === 0 ? (
            <p className="text-gray-600 italic">
              Você ainda não submeteu nenhum trabalho.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse rounded-lg overflow-hidden shadow-sm">
                <thead className="bg-violet-700 text-white text-sm">
                  <tr>
                    <th className="p-3 text-left">Título</th>
                    <th className="p-3">Chamada</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Pôster</th>
                    <th className="p-3">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {minhas.map((m) => (
                    <tr key={m.id} className="border-b hover:bg-violet-50 transition text-sm">
                      <td className="p-3">{m.titulo}</td>
                      <td className="p-3">{m.chamada_titulo}</td>
                      <td className="p-3 text-center">
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            m.status === "submetido"
                              ? "bg-blue-100 text-blue-700"
                              : m.status === "em_avaliacao"
                              ? "bg-amber-100 text-amber-700"
                              : ["aprovado_exposicao", "aprovado_oral"].includes(m.status)
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {String(m.status).replaceAll("_", " ")}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <PosterCell id={m.id} nome={m.poster_nome} />
                      </td>
                      <td className="p-3 text-center">
                        {canEdit(m) ? (
                          <button
                            onClick={() => setModalInscricao({ submissaoId: m.id })}
                            className="inline-flex items-center gap-1 text-sm bg-indigo-600 text-white px-3 py-1.5 rounded-md hover:bg-indigo-700"
                            title="Editar submissão"
                          >
                            <Pencil className="w-4 h-4" />
                            Editar
                          </button>
                        ) : (
                          <span className="text-gray-400 text-xs">Edição indisponível</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      <Footer />

      {/* Modais */}
      {modalEdital && (
        <ModalVerEdital chamadaId={modalEdital} onClose={() => setModalEdital(null)} />
      )}
      {modalInscricao && (
        <ModalInscreverTrabalho
          chamadaId={modalInscricao.chamadaId || null}
          submissaoId={modalInscricao.submissaoId || null}
          onClose={() => setModalInscricao(null)}
          onSucesso={handleSucesso}
        />
      )}
    </div>
  );
}
