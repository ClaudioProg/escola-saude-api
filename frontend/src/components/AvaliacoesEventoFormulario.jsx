// 📁 src/pages/AvaliacaoEvento.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { motion } from "framer-motion";
import { apiGet, apiPost } from "../services/api";
import Botao from "../components/ui/Botao";
import Loader from "../components/ui/Loader";

/** Campos obrigatórios do projeto (12) */
const CAMPOS_OBRIGATORIOS = [
  "desempenho_instrutor",
  "divulgacao_evento",
  "recepcao",
  "credenciamento",
  "material_apoio",
  "pontualidade",
  "sinalizacao_local",
  "conteudo_temas",
  "estrutura_local",
  "acessibilidade",
  "limpeza",
  "inscricao_online",
];

/** Campos condicionais por tipo de evento */
const CAMPOS_CONDICIONAIS = {
  // aparece em congresso E simpósio
  ambos: ["exposicao_trabalhos"],
  // aparece só em congresso
  congresso: ["apresentacao_oral_mostra", "apresentacao_tcrs", "oficinas"],
};

const LABELS = {
  desempenho_instrutor: "Desempenho do Instrutor",
  divulgacao_evento: "Divulgação do Evento",
  recepcao: "Recepção",
  credenciamento: "Credenciamento",
  material_apoio: "Material de Apoio",
  pontualidade: "Pontualidade",
  sinalizacao_local: "Sinalização do Local",
  conteudo_temas: "Conteúdo dos Temas",
  estrutura_local: "Estrutura do Local",
  acessibilidade: "Acessibilidade",
  limpeza: "Limpeza",
  inscricao_online: "Inscrição Online",
  exposicao_trabalhos: "Exposição de Trabalhos",
  apresentacao_oral_mostra: "Apresentação Oral da Mostra",
  apresentacao_tcrs: "Apresentação de TCRs",
  oficinas: "Oficinas",
};

const OPCOES_NOTA = ["Ótimo", "Bom", "Regular", "Ruim", "Péssimo"];

export default function AvaliacaoEvento() {
  const { turma_id } = useParams();
  const navigate = useNavigate();

  const [form, setForm] = useState({});
  const [textos, setTextos] = useState({
    gostou_mais: "",
    sugestoes_melhoria: "",
    comentarios_finais: "",
  });
  const [carregandoMeta, setCarregandoMeta] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [meta, setMeta] = useState({
    evento_id: null,
    tipo_evento: "", // "curso", "palestra", "congresso", "simpósio", etc.
    titulo_evento: "",
    nome_turma: "",
  });

  const refsCampo = useRef({});

  const setCampoRef = useCallback((nome) => (el) => {
    if (el) refsCampo.current[nome] = el;
  }, []);

  // Busca metadata da turma → evento
  useEffect(() => {
    let ativo = true;
    async function loadMeta() {
      try {
        setCarregandoMeta(true);
        // endpoint principal (ajuste conforme seu backend)
        let t = await apiGet(`/api/turmas/${turma_id}`);
        // fallback se necessário
        if (!t?.evento_id && t?.evento?.id) {
          t = { ...t, evento_id: t.evento.id, evento: t.evento };
        }
        const tipo =
          (t?.evento?.tipo || t?.tipo_evento || "").toString().toLowerCase();

        if (ativo) {
          setMeta({
            evento_id: t?.evento_id ?? null,
            tipo_evento: tipo,
            titulo_evento: t?.evento?.titulo || t?.evento_titulo || "",
            nome_turma: t?.nome || "",
          });
        }
      } catch (err) {
        toast.error("❌ Falha ao carregar informações da turma.");
      } finally {
        if (ativo) setCarregandoMeta(false);
      }
    }
    loadMeta();
    return () => {
      ativo = false;
    };
  }, [turma_id]);

  /** Campos visíveis, conforme tipo de evento */
  const camposVisiveis = useMemo(() => {
    const base = [...CAMPOS_OBRIGATORIOS];
    const tipo = meta.tipo_evento;

    if (tipo === "congresso" || tipo === "simpósio" || tipo === "simposio") {
      base.push(...CAMPOS_CONDICIONAIS.ambos);
    }
    if (tipo === "congresso") {
      base.push(...CAMPOS_CONDICIONAIS.congresso);
    }
    return base;
  }, [meta.tipo_evento]);

  const handleSelect = useCallback((campo, valor) => {
    setForm((prev) => ({ ...prev, [campo]: valor }));
  }, []);

  const handleTexto = useCallback((nome) => (e) => {
    setTextos((prev) => ({ ...prev, [nome]: e.target.value }));
  }, []);

  const validarObrigatorios = useCallback(() => {
    const faltando = CAMPOS_OBRIGATORIOS.filter((c) => !form[c]);
    if (faltando.length) {
      const primeiro = faltando[0];
      toast.warn("⚠️ Preencha todos os campos obrigatórios antes de enviar.");
      // foca o primeiro obrigatório vazio
      const el = refsCampo.current[primeiro];
      el?.focus?.();
      return false;
    }
    return true;
  }, [form]);

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      if (enviando) return;

      if (!validarObrigatorios()) return;

      const corpo = {
        turma_id,
        evento_id: meta.evento_id ?? undefined, // backend pode inferir por turma_id
        ...form,
        // textos opcionais
        gostou_mais: textos.gostou_mais?.trim() || undefined,
        sugestoes_melhoria: textos.sugestoes_melhoria?.trim() || undefined,
        comentarios_finais: textos.comentarios_finais?.trim() || undefined,
      };

      try {
        setEnviando(true);
        await apiPost("/api/avaliacoes", corpo);
        toast.success("✅ Avaliação enviada com sucesso!");
        navigate("/painel");
      } catch (err) {
        toast.error(`❌ ${err?.message || "Erro ao enviar avaliação"}`);
      } finally {
        setEnviando(false);
      }
    },
    [enviando, validarObrigatorios, turma_id, meta.evento_id, form, textos, navigate]
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="max-w-3xl mx-auto p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-md mt-6"
    >
      <header className="mb-5">
        <h2 className="text-2xl font-bold text-verde-900 dark:text-verde-900/80">
          📝 Avaliação do Evento
        </h2>
        {carregandoMeta ? (
          <div className="mt-2"><Loader size="sm" /></div>
        ) : (
          <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
            {meta.titulo_evento && <><strong>Evento:</strong> {meta.titulo_evento} · </>}
            {meta.nome_turma && <><strong>Turma:</strong> {meta.nome_turma} · </>}
            {meta.tipo_evento && <><strong>Tipo:</strong> {meta.tipo_evento}</>}
          </p>
        )}
      </header>

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        {/* Campos de nota */}
        <fieldset className="space-y-4">
          <legend className="sr-only">Campos de avaliação</legend>

          {camposVisiveis.map((campo) => {
            const obrigatorio = CAMPOS_OBRIGATORIOS.includes(campo);
            return (
              <div key={campo} className="flex flex-col">
                <label htmlFor={campo} className="font-medium text-sm mb-1 dark:text-gray-100">
                  {LABELS[campo]}
                  {obrigatorio && <span className="text-red-600 ml-1" aria-hidden="true">*</span>}
                </label>
                <select
                  ref={setCampoRef(campo)}
                  id={campo}
                  required={obrigatorio}
                  aria-required={obrigatorio}
                  value={form[campo] || ""}
                  onChange={(e) => handleSelect(campo, e.target.value)}
                  className="p-2 rounded-xl border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-verde-900/60"
                >
                  <option value="">Selecione</option>
                  {OPCOES_NOTA.map((opcao) => (
                    <option key={opcao} value={opcao}>
                      {opcao}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}
        </fieldset>

        {/* Textos opcionais */}
        <div className="grid grid-cols-1 gap-4">
          <div className="flex flex-col">
            <label htmlFor="gostou_mais" className="font-medium text-sm mb-1 dark:text-gray-100">
              O que mais gostou (opcional):
            </label>
            <textarea
              id="gostou_mais"
              rows={3}
              value={textos.gostou_mais}
              onChange={handleTexto("gostou_mais")}
              placeholder="Conte brevemente o ponto alto da experiência…"
              className="p-2 rounded-xl border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white resize-y focus:outline-none focus-visible:ring-2 focus-visible:ring-verde-900/60"
            />
          </div>

          <div className="flex flex-col">
            <label htmlFor="sugestoes_melhoria" className="font-medium text-sm mb-1 dark:text-gray-100">
              Sugestões de melhoria (opcional):
            </label>
            <textarea
              id="sugestoes_melhoria"
              rows={3}
              value={textos.sugestoes_melhoria}
              onChange={handleTexto("sugestoes_melhoria")}
              placeholder="Deixe sugestões objetivas para evoluirmos o evento…"
              className="p-2 rounded-xl border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white resize-y focus:outline-none focus-visible:ring-2 focus-visible:ring-verde-900/60"
            />
          </div>

          <div className="flex flex-col">
            <label htmlFor="comentarios_finais" className="font-medium text-sm mb-1 dark:text-gray-100">
              Comentários finais (opcional):
            </label>
            <textarea
              id="comentarios_finais"
              rows={4}
              value={textos.comentarios_finais}
              onChange={handleTexto("comentarios_finais")}
              placeholder="Espaço livre para observações adicionais…"
              className="p-2 rounded-xl border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white resize-y focus:outline-none focus-visible:ring-2 focus-visible:ring-verde-900/60"
            />
          </div>
        </div>

        <div className="pt-2">
          <Botao
            type="submit"
            variant="primary"
            loading={enviando}
            disabled={enviando || carregandoMeta}
            leftIcon={!enviando ? "✅" : null}
            className="bg-verde-900 hover:bg-verde-900/90 dark:hover:bg-verde-900/80"
          >
            {enviando ? "Enviando..." : "Enviar Avaliação"}
          </Botao>
        </div>
      </form>
    </motion.div>
  );
}
