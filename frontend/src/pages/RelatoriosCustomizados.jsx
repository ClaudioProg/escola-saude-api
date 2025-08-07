import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { saveAs } from "file-saver";

import Breadcrumbs from "../components/Breadcrumbs";
import Select from "../components/Select";
import DateRangePicker from "../components/DateRangePicker";
import RelatoriosTabela from "../components/RelatoriosTabela";
import CabecalhoPainel from "../components/CabecalhoPainel";
import CarregandoSkeleton from "../components/CarregandoSkeleton";
import ErroCarregamento from "../components/ErroCarregamento";

export default function RelatoriosCustomizados() {
  const token = localStorage.getItem("token");
  const perfil = (localStorage.getItem("perfil") || "").toLowerCase();
  const usuarioId = localStorage.getItem("usuario_id");

  const [filtros, setFiltros] = useState({
    eventoId: "",
    instrutorId: "",
    unidadeId: "",
    periodo: ["", ""],
  });

  const [opcoes, setOpcoes] = useState({
    eventos: [],
    instrutor: [],
    unidades: [],
  });

  const [dados, setDados] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [erroCarregamento, setErroCarregamento] = useState(false);

  useEffect(() => {
    async function loadOpts() {
      try {
        const res = await fetch("/api/relatorios/opcoes", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setOpcoes({
          eventos: data.eventos.map((e) => ({
            value: e.id,
            label: e.titulo || "Sem título"
          })),
          instrutor: data.instrutor.map((i) => ({
            value: i.id,
            label: i.nome
          })),
          unidades: data.unidades.map((u) => ({
            value: u.id,
            label: u.nome
          })),
        });

        if (perfil.includes("instrutor") || perfil.includes("administrador")) {
          setFiltros((f) => ({ ...f, instrutorId: usuarioId ?? "" }));
        }

        setErroCarregamento(false);
      } catch {
        setErroCarregamento(true);
        toast.error("Erro ao carregar filtros.");
      }
    }

    loadOpts();
  }, [token, perfil, usuarioId]);

  const buscar = async () => {
    try {
      const qs = new URLSearchParams();
      if (filtros.eventoId) qs.append("evento", filtros.eventoId);
      if (filtros.instrutorId) qs.append("instrutor", filtros.instrutorId);
      if (filtros.unidadeId) qs.append("unidade", filtros.unidadeId);
      if (filtros.periodo[0] && filtros.periodo[1]) {
        qs.append("from", new Date(filtros.periodo[0]).toISOString());
        qs.append("to", new Date(filtros.periodo[1]).toISOString());
      }

      setCarregando(true);
      const res = await fetch(`/api/relatorios?${qs.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("Não foi possível gerar relatório");
      setDados(await res.json());
    } catch (e) {
      toast.error("❌ " + e.message);
    } finally {
      setCarregando(false);
    }
  };

  const exportar = (tipo) => {
    if (!dados.length) return toast.info("Sem dados para exportar");

    const payload = { filtros, formato: tipo };

    fetch(`/api/relatorios/exportar`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.blob();
      })
      .then((blob) => {
        const ext = tipo === "pdf" ? "pdf" : "xlsx";
        saveAs(blob, `relatorio_custom.${ext}`);
      })
      .catch(() => {
        toast.error("Falha no download");
      });
  };

  return (
    <main className="p-6">
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
            />
            <Select
              label="instrutor"
              options={opcoes.instrutor}
              value={filtros.instrutorId}
              onChange={(v) => setFiltros((f) => ({ ...f, instrutorId: v }))}
            />
            <Select
              label="Unidade"
              options={opcoes.unidades}
              value={filtros.unidadeId}
              onChange={(v) => setFiltros((f) => ({ ...f, unidadeId: v }))}
            />
            <DateRangePicker
              label="Período"
              value={filtros.periodo}
              onChange={(r) => setFiltros((f) => ({ ...f, periodo: r }))}
            />
          </div>

          <div className="flex flex-wrap justify-center gap-4 my-6">
            <button
              onClick={buscar}
              className="bg-orange-200 hover:bg-orange-300 text-orange-900 font-semibold py-2 px-4 rounded transition"
              aria-label="Buscar relatórios"
              role="button"
            >
              🔎 Buscar
            </button>
            <button
              onClick={() => exportar("pdf")}
              className="bg-orange-200 hover:bg-orange-300 text-orange-900 font-semibold py-2 px-4 rounded transition"
              aria-label="Exportar relatório em PDF"
              role="button"
            >
              📄 Exportar PDF
            </button>
            <button
              onClick={() => exportar("excel")}
              className="bg-orange-200 hover:bg-orange-300 text-orange-900 font-semibold py-2 px-4 rounded transition"
              aria-label="Exportar relatório em Excel"
              role="button"
            >
              📊 Exportar Excel
            </button>
          </div>

          {carregando ? (
            <CarregandoSkeleton height="220px" />
          ) : (
            <RelatoriosTabela data={dados} />
          )}
        </>
      )}
    </main>
  );
}
