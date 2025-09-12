// ✅ src/pages/MeusCertificados.jsx
import { useEffect, useState, useMemo } from "react";
import Skeleton from "react-loading-skeleton";
import { toast } from "react-toastify";
import { Award } from "lucide-react";
import { formatarDataBrasileira, formatarParaISO } from "../utils/data";

import Breadcrumbs from "../components/Breadcrumbs";
import PageHeader from "../components/PageHeader";
import Footer from "../components/Footer";
import NadaEncontrado from "../components/NadaEncontrado";
import { apiGet, apiPost, makeApiUrl } from "../services/api";

export default function MeusCertificados() {
  const [nome, setNome] = useState("");
  const [certificados, setCertificados] = useState([]);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [gerandoKey, setGerandoKey] = useState(null);

  // usuário do localStorage, com imagem_base64 validada
  const usuario = useMemo(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem("usuario") || "{}");
      return {
        ...parsed,
        imagem_base64:
          typeof parsed?.imagem_base64 === "string" &&
          parsed.imagem_base64.startsWith("data:image/")
            ? parsed.imagem_base64
            : null,
      };
    } catch {
      return {};
    }
  }, []);

  useEffect(() => {
    if (usuario?.nome) setNome(usuario.nome);
  }, [usuario?.nome]);

  async function carregarCertificados() {
    setCarregando(true);
    try {
      // elegíveis como PARTICIPANTE
      const dadosUsuario = await apiGet("certificados/elegiveis");
      // elegíveis como INSTRUTOR
      const dadosInstrutor = await apiGet("certificados/elegiveis-instrutor");

      const comTipo = [
        ...(Array.isArray(dadosUsuario) ? dadosUsuario.map((c) => ({ ...c, tipo: "usuario" })) : []),
        ...(Array.isArray(dadosInstrutor) ? dadosInstrutor.map((c) => ({ ...c, tipo: "instrutor" })) : []),
      ];

      // remove duplicatas por (evento_id, turma_id, tipo)
      const unicos = comTipo.filter(
        (item, idx, arr) =>
          idx ===
          arr.findIndex(
            (c) =>
              String(c.evento_id) === String(item.evento_id) &&
              String(c.turma_id) === String(item.turma_id) &&
              c.tipo === item.tipo
          )
      );

      setCertificados(unicos);
      setErro("");
    } catch (e) {
      setErro("Erro ao carregar certificados");
      toast.error("❌ Erro ao carregar certificados.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregarCertificados();
  }, []);

  function keyDoCert(cert) {
    return `${cert.evento_id}-${cert.turma_id}-${cert.tipo}`;
  }

  async function gerarCertificado(cert) {
    const key = keyDoCert(cert);
    setGerandoKey(key);

    try {
      const body = {
        usuario_id: usuario.id,
        evento_id: cert.evento_id,
        turma_id: cert.turma_id,
        tipo: cert.tipo, // "usuario" | "instrutor"
      };

      // normalmente quem assina é o instrutor/adm
      if (cert.tipo === "instrutor" && usuario.imagem_base64) {
        body.assinaturaBase64 = usuario.imagem_base64;
      }

      const resultado = await apiPost("certificados/gerar", body);

      toast.success("🎉 Certificado gerado com sucesso!");

      setCertificados((prev) =>
        prev.map((c) =>
          c.evento_id === cert.evento_id &&
          c.turma_id === cert.turma_id &&
          c.tipo === cert.tipo
            ? {
                ...c,
                ja_gerado: true,
                arquivo_pdf: resultado?.arquivo,
                certificado_id: resultado?.certificado_id ?? c.certificado_id ?? Date.now(),
              }
            : c
        )
      );
    } catch (err) {
      toast.error("❌ Erro ao gerar certificado.");
    } finally {
      setGerandoKey(null);
    }
  }

  // 🔒 Formata datas com proteção total (converte p/ ISO date-only e exibe em pt-BR)
  function periodoSeguro(cert) {
    const iniRaw = cert.data_inicio ?? cert.di ?? cert.inicio;
    const fimRaw = cert.data_fim ?? cert.df ?? cert.fim;
    const iniISO = formatarParaISO(iniRaw);
    const fimISO = formatarParaISO(fimRaw);
    const ini = iniISO ? formatarDataBrasileira(iniISO) : "—";
    const fim = fimISO ? formatarDataBrasileira(fimISO) : "—";
    return `${ini} até ${fim}`;
  }

  function renderizarCartao(cert) {
    const eInstrutor = cert.tipo === "instrutor";
    const key = keyDoCert(cert);
    const gerando = gerandoKey === key;

    return (
      <div
        key={key}
        className={`rounded-2xl shadow p-4 flex flex-col justify-between border transition 
          focus:outline-none focus:ring-2 focus:ring-lousa
          ${eInstrutor ? "bg-yellow-100 border-yellow-400" : "bg-white dark:bg-gray-800"}`}
      >
        <div>
          <h2
            className={`text-xl font-bold mb-1 ${
              eInstrutor ? "text-yellow-900" : "text-lousa dark:text-white"
            }`}
          >
            {cert.evento || cert.evento_titulo || cert.nome_evento || "Evento"}
          </h2>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Turma: {cert.nome_turma || cert.turma_nome || `#${cert.turma_id}`}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Período: {periodoSeguro(cert)}
          </p>
          {eInstrutor && (
            <span className="inline-block mt-2 px-2 py-1 bg-yellow-400 text-xs font-semibold text-yellow-900 rounded">
              📣 Instrutor
            </span>
          )}
        </div>

        <div className="mt-4 flex justify-center">
          {cert.ja_gerado && cert.certificado_id ? (
            <a
              href={makeApiUrl(`certificados/${cert.certificado_id}/download`)}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-green-900 hover:bg-green-800 text-white text-sm font-medium py-2 px-4 rounded text-center"
            >
              Baixar Certificado
            </a>
          ) : (
            <button
              onClick={() => gerarCertificado(cert)}
              disabled={gerando}
              className={`${
                eInstrutor ? "bg-yellow-500 hover:bg-yellow-600" : "bg-blue-700 hover:bg-blue-800"
              } text-white text-sm font-medium py-2 px-4 rounded text-center disabled:opacity-60`}
            >
              {gerando ? "Gerando..." : "Gerar Certificado"}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gelo dark:bg-zinc-900 text-black dark:text-white">
      {/* 🟪 Faixa de título para Certificados */}
      <PageHeader title="Meus Certificados" icon={Award} variant="roxo" />

      <main role="main" className="flex-1 max-w-4xl mx-auto px-4 py-6">
        <Breadcrumbs trilha={[{ label: "Início", href: "/dashboard" }, { label: "Meus Certificados" }]} />

        {carregando ? (
          <div role="status" aria-live="polite">
            <Skeleton count={5} height={100} className="mb-4" />
          </div>
        ) : erro ? (
          <NadaEncontrado mensagem="Não foi possível carregar os certificados." />
        ) : certificados.length === 0 ? (
          <NadaEncontrado mensagem="Você ainda não possui certificados disponíveis." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {certificados.map(renderizarCartao)}
          </div>
        )}
      </main>

      {/* Rodapé institucional */}
      <Footer />
    </div>
  );
}
