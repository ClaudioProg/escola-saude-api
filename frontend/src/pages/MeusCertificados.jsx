// MeusCertificados
import { useEffect, useState } from "react";
import Skeleton from "react-loading-skeleton";
import { toast } from "react-toastify";
import { formatarDataBrasileira } from "../utils/data";

import Breadcrumbs from "../components/Breadcrumbs";
import CabecalhoPainel from "../components/CabecalhoPainel";
import NadaEncontrado from "../components/NadaEncontrado";

export default function MeusCertificados() {
  const [nome, setNome] = useState("");
  const [certificados, setCertificados] = useState([]);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [gerando, setGerando] = useState(null);

  const token = localStorage.getItem("token");

  const rawUsuario = localStorage.getItem("usuario");
  const usuario = (() => {
    try {
      const parsed = JSON.parse(rawUsuario || "{}");
      return {
        ...parsed,
        imagem_base64:
          typeof parsed.imagem_base64 === "string" &&
          parsed.imagem_base64.startsWith("data:image/")
            ? parsed.imagem_base64
            : null,
      };
    } catch {
      return {};
    }
  })();

  const possuiAssinatura = !!usuario.imagem_base64;

  console.log(
    possuiAssinatura
      ? "🖊️ Assinatura base64 carregada"
      : "🚫 Usuário sem assinatura (não é instrutor ou administrador)"
  );

  useEffect(() => {
    if (usuario?.nome) setNome(usuario.nome);
  }, []);

  async function carregarCertificados() {
    console.info("🔍 Buscando certificados elegíveis...");
    setCarregando(true);
  
    try {
      const headers = { Authorization: `Bearer ${token}` };
  
      // 🔄 Busca participante
      const resUsuario = await fetch("http://localhost:3000/api/certificados/elegiveis", {
        headers,
      });
  
      // 🔄 Busca instrutor
      const resInstrutor = await fetch("http://localhost:3000/api/certificados/elegiveis-instrutor", {
        headers,
      });
  
      if (!resUsuario.ok || !resInstrutor.ok)
        throw new Error("Erro ao buscar certificados");
  
      const dadosUsuario = await resUsuario.json();
      const dadosInstrutor = await resInstrutor.json();
  
      // 🧩 Adiciona campo identificador de tipo
      const certificadosComTipo = [
        ...dadosUsuario.map((c) => ({ ...c, tipo: "usuario" })),
        ...dadosInstrutor.map((c) => ({ ...c, tipo: "instrutor" })),
      ];
      
      // ✅ Evita duplicação do mesmo certificado por tipo
      const certificadosUnicos = certificadosComTipo.filter(
        (item, index, self) =>
          index ===
          self.findIndex(
            (c) =>
              c.turma_id === item.turma_id &&
              c.evento_id === item.evento_id &&
              c.tipo === item.tipo
          )
      );
      
      setCertificados(certificadosUnicos);
      setErro("");
    } catch (erro) {
      console.error("❌ Erro ao carregar certificados:", erro);
      setErro("Erro ao carregar certificados");
      toast.error("Erro ao carregar certificados");
    } finally {
      console.info("✅ Finalizado o carregamento dos certificados.");
      setCarregando(false);
    }
  }
  
  useEffect(() => {
    carregarCertificados();
  }, [token]);

  async function gerarCertificado(cert) {
    try {
      console.log(`🖱️ Clique para gerar certificado da turma ${cert.turma_id}`);
      setGerando(cert.turma_id);

      const tipo = cert.tipo;

      const body = {
        usuario_id: usuario.id,
        evento_id: cert.evento_id,
        turma_id: cert.turma_id,
        tipo,
      };
      
      // Só adiciona assinatura se for tipo "usuario" e assinatura estiver presente
      if (tipo === "usuario" && usuario.imagem_base64) {
        body.assinaturaBase64 = usuario.imagem_base64;
      }

      console.log("🚀 Iniciando geração do certificado para:", body);

      const res = await fetch("http://localhost:3000/api/certificados/gerar", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      console.log("📥 Status da resposta:", res.status);
      const resultado = await res.json();
      console.log("📄 Corpo da resposta:", resultado);

      if (!res.ok) throw new Error(resultado.erro || "Erro ao gerar certificado");

      toast.success("🎉 Certificado gerado com sucesso!");

      setCertificados((prev) =>
        prev.map((c) =>
          c.turma_id === cert.turma_id && c.evento_id === cert.evento_id
            ? {
                ...c,
                ja_gerado: true,
                arquivo_pdf: resultado.arquivo,
                certificado_id: resultado.certificado_id ?? c.certificado_id ?? Date.now(),
              }
            : c
        )
      );
    } catch (err) {
      console.error("❌ Erro ao gerar certificado:", err);
      toast.error("Erro ao gerar certificado");
    } finally {
      console.log(`🏁 Finalizada tentativa de geração (${cert.turma_id})`);
      setGerando(null);
    }
  }

  function renderizarCartao(cert) {
    const isinstrutor = cert.tipo === "instrutor";

    return (
      <div
        key={`${cert.evento_id}-${cert.turma_id}-${cert.tipo}`}
        className={`rounded-2xl shadow p-4 flex flex-col justify-between border transition 
          focus:outline-none focus:ring-2 focus:ring-lousa
          ${isinstrutor ? "bg-yellow-100 border-yellow-400" : "bg-white dark:bg-gray-800"}`}
      >
        <div>
          <h2
            className={`text-xl font-bold mb-1 ${
              isinstrutor ? "text-yellow-900" : "text-lousa dark:text-white"
            }`}
          >
            {cert.evento}
          </h2>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Turma: {cert.nome_turma}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Período: {formatarDataBrasileira(cert.data_inicio)} até{" "}
            {formatarDataBrasileira(cert.data_fim)}
          </p>
          {isinstrutor && (
            <span className="inline-block mt-2 px-2 py-1 bg-yellow-400 text-xs font-semibold text-yellow-900 rounded">
              📣 Instrutor
            </span>
          )}
        </div>

        <div className="mt-4 flex justify-center">
          {cert.ja_gerado && cert.arquivo_pdf && cert.certificado_id ? (
            <a
              href={`http://localhost:3000/api/certificados/${cert.certificado_id}/download`}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-green-900 hover:bg-green-800 text-white text-sm font-medium py-2 px-4 rounded text-center"
            >
              Baixar Certificado
            </a>
          ) : (
            <button
              onClick={() => gerarCertificado(cert)}
              disabled={gerando === cert.turma_id}
              className={`${
                isinstrutor ? "bg-yellow-500 hover:bg-yellow-600" : "bg-blue-700 hover:bg-blue-800"
              } text-white text-sm font-medium py-2 px-4 rounded text-center disabled:opacity-60`}
            >
              {gerando === cert.turma_id ? "Gerando..." : "Gerar Certificado"}
            </button>
          )}
        </div>
      </div>
    );
  }

  // ✅ Return principal do componente
  return (
    <main className="max-w-4xl mx-auto px-4 py-6">
      <Breadcrumbs
        links={[{ href: "/dashboard", rotulo: "Início" }]}
        atual="Meus Certificados"
      />
      <CabecalhoPainel titulo="Meus Certificados" subtitulo={nome ? `Olá, ${nome}` : ""} />

      {carregando ? (
        <Skeleton count={5} height={100} className="mb-4" />
      ) : erro ? (
        <NadaEncontrado mensagem="Não foi possível carregar os certificados." />
      ) : certificados.length === 0 ? (
        <NadaEncontrado mensagem="Você ainda não possui certificados disponíveis." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {certificados.map((cert) => renderizarCartao(cert))}
        </div>
      )}
    </main>
  );
}
