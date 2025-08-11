// ✅ src/pages/RelatoriosCustomizados.jsx
import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { saveAs } from "file-saver";

import { apiGet, apiPostFile } from "../services/api";
import Breadcrumbs from "../components/Breadcrumbs";
import Select from "../components/Select";
import DateRangePicker from "../components/DateRangePicker";
import RelatoriosTabela from "../components/RelatoriosTabela";
import CabecalhoPainel from "../components/CabecalhoPainel";
import CarregandoSkeleton from "../components/CarregandoSkeleton";
import ErroCarregamento from "../components/ErroCarregamento";

function startOfDayISO(d) {
  const dt = new Date(d);
  dt.setHours(0, 0, 0, 0);
  return dt.toISOString();
}
function endOfDayISO(d) {
  const dt = new Date(d);
  dt.setHours(23, 59, 59, 999);
  return dt.toISOString();
}

export default function RelatoriosCustomizados() {
  const perfilRaw = (localStorage.getItem("perfil") || "").toLowerCase();
  const usuarioObj = (() => {
    try {
      return JSON.parse(localStorage.getItem("usuario") || "{}");
    } catch {
      return {};
    }
  })();
  const usuarioId = usuarioObj?.id ?? null;

  const [filtros, setFiltros] = useState({
    eventoId: "",
    instrutorId: "",
    unidadeId: "",
    periodo: ["", ""], // [inicio, fim]
  });

  const [opcoes, setOpcoes] = useState({
    eventos: [],
    instrutor: [],
    unidades: [],
  });

  const [dados, setDados] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [erroCarregamento, setErroCarregamento] = useState(false);

  const podeAutoFiltrarInstrutor = useMemo(
    () => perfilRaw.includes("instrutor") || perfilRaw.includes("administrador"),
    [perfilRaw]
  );

  // Carrega opções (eventos/instrutor/unidades)
  useEffect(() => {
    let cancelado = false;

    async function loadOpts() {
      try {
        setErroCarregamento(false);
        const data = await apiGet("/api/relatorios/opcoes", { on403: "silent" });
        if (cancelado) return;

        setOpcoes({
          eventos: (data?.eventos || []).map((e) => ({
            value: String(e.id),
            label: e.titulo || e.nome || "Sem título",
          })),
          instrutor: (data?.instrutor || []).map((i) => ({
            value: String(i.id),
            label: i.nome,
          })),
          unidades: (data?.unidades || []).map((u) => ({
            value: String(u.id),
            label: u.nome,
          })),
        });

        if (podeAutoFiltrarInstrutor && usuarioId) {
          setFiltros((f) => ({ ...f, instrutorId: String(usuarioId) }));
        }
      } catch (err) {
        setErroCarregamento(true);
        toast.error("Erro ao carregar filtros.");
      }
    }

    loadOpts();
    return () => {
      cancelado = true;
    };
  }, [podeAutoFiltrarInstrutor, usuarioId]);

  const validarPeriodo = () => {
    const [ini, fim] = filtros.periodo || [];
    if ((ini && !fim) || (!ini && fim)) {
      toast.warning("Informe as duas datas do período.");
      return false;
    }
    if (ini && fim) {
      const dIni = new Date(ini);
      const dFim = new Date(fim);
      if (Number.isNaN(dIni.getTime()) || Number.isNaN(dFim.getTime())) {
        toast.warning("Período inválido.");
        return false;
      }
      if (dIni > dFim) {
        toast.warning("Data inicial não pode ser maior que a final.");
        return false;
      }
    }
    return true;
  };

  const buscar = async () => {
    if (!validarPeriodo()) return;

    const qs = new URLSearchParams();
    if (filtros.eventoId) qs.append("evento", filtros.eventoId);
    if (filtros.instrutorId) qs.append("instrutor", filtros.instrutorId);
    if (filtros.unidadeId) qs.append("unidade", filtros.unidadeId);

    const [ini, fim] = filtros.periodo;
    if (ini && fim) {
      qs.append("from", startOfDayISO(ini));
      qs.append("to", endOfDayISO(fim));
    }

    setCarregando(true);
    try {
      const res = await apiGet(`/api/relatorios?${qs.toString()}`, { on403: "silent" });
      setDados(Array.isArray(res) ? res : []);
    } catch (e) {
      toast.error("❌ Não foi possível gerar relatório.");
      setDados([]);
    } finally {
      setCarregando(false);
    }
  };

  const exportar = async (tipo) => {
    if (!dados.length) {
      toast.info("Sem dados para exportar.");
      return;
    }
    if (!["pdf", "excel"].includes(tipo)) {
      toast.error("Formato inválido.");
      return;
    }
    if (!validarPeriodo()) return;

    const payload = {
      filtros: {
        eventoId: filtros.eventoId || null,
        instrutorId: filtros.instrutorId || null,
        unidadeId: filtros.unidadeId || null,
        periodo:
          filtros.periodo[0] && filtros.periodo[1]
            ? [startOfDayISO(filtros.periodo[0]), endOfDayISO(filtros.periodo[1])]
            : null,
      },
      formato: tipo,
    };

    try {
      const { blob, filename } = await apiPostFile("/api/relatorios/exportar", payload, {
        on403: "silent",
      });
      const ext = tipo === "pdf" ? "pdf" : "xlsx";
      saveAs(blob, filename || `relatorio_custom.${ext}`);
    } catch {
      toast.error("Falha no download.");
    }
  };

  const limparFiltros = () => {
    setFiltros({
      eventoId: "",
      instrutorId: podeAutoFiltrarInstrutor && usuarioId ? String(usuarioId) : "",
      unidadeId: "",
      periodo: ["", ""],
    });
    setDados([]);
  };

  return (
    <main className="p-6 bg-gelo dark:bg-zinc-900 min-h-screen text-black dark:text-white">
      <Breadcrumbs trilha={[{ label: "Painel administrador" }, { label: "Relatórios" }]} />
      <CabecalhoPainel titulo="📄 Relatórios Customizados" />

      {erroCarregamento ? (
        <ErroCarregamento mensagem="Falha ao carregar os filtros disponíveis." />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <Select
              label="Evento"
              options={opcoes.eventos}
              value={filtros.eventoId}
              onChange={(v) => setFiltros((f) => ({ ...f, eventoId: v }))}
              placeholder="Selecione..."
            />
            <Select
              label="Instrutor"
              options={opcoes.instrutor}
              value={filtros.instrutorId}
              onChange={(v) => setFiltros((f) => ({ ...f, instrutorId: v }))}
              placeholder="Selecione..."
            />
            <Select
              label="Unidade"
              options={opcoes.unidades}
              value={filtros.unidadeId}
              onChange={(v) => setFiltros((f) => ({ ...f, unidadeId: v }))}
              placeholder="Selecione..."
            />
            <DateRangePicker
              label="Período"
              value={filtros.periodo}
              onChange={(r) => setFiltros((f) => ({ ...f, periodo: r }))}
            />
          </div>

          <div className="flex flex-wrap gap-3 my-6 items-center">
            <button
              onClick={buscar}
              disabled={carregando}
              className={`bg-orange-200 hover:bg-orange-300 text-orange-900 font-semibold py-2 px-4 rounded transition ${
                carregando ? "opacity-70 cursor-not-allowed" : ""
              }`}
              aria-label="Buscar relatórios"
            >
              🔎 {carregando ? "Buscando..." : "Buscar"}
            </button>

            <button
              onClick={() => exportar("pdf")}
              disabled={!dados.length || carregando}
              className={`bg-orange-200 hover:bg-orange-300 text-orange-900 font-semibold py-2 px-4 rounded transition ${
                !dados.length || carregando ? "opacity-60 cursor-not-allowed" : ""
              }`}
              aria-label="Exportar relatório em PDF"
            >
              📄 Exportar PDF
            </button>

            <button
              onClick={() => exportar("excel")}
              disabled={!dados.length || carregando}
              className={`bg-orange-200 hover:bg-orange-300 text-orange-900 font-semibold py-2 px-4 rounded transition ${
                !dados.length || carregando ? "opacity-60 cursor-not-allowed" : ""
              }`}
              aria-label="Exportar relatório em Excel"
            >
              📊 Exportar Excel
            </button>

            <button
              onClick={limparFiltros}
              disabled={carregando}
              className="ml-auto bg-gray-200 hover:bg-gray-300 text-gray-900 font-medium py-2 px-4 rounded transition"
              aria-label="Limpar filtros"
            >
              Limpar filtros
            </button>
          </div>

          {carregando ? (
            <CarregandoSkeleton height="220px" />
          ) : (
            <>
              {dados?.length ? (
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                  {dados.length} registro{dados.length > 1 ? "s" : ""} encontrado{dados.length > 1 ? "s" : ""}.
                </p>
              ) : null}
              <RelatoriosTabela data={dados} />
            </>
          )}
        </>
      )}
    </main>
  );
}
