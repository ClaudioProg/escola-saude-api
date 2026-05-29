// ✅ frontend/src/components/avaliacoes/ModalAvaliacoes.jsx — v2.0
// Atualizado em: 14/05/2026
// Plataforma Escola da Saúde

import PropTypes from "prop-types";
import {
  CalendarDays,
  Gauge,
  Info,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  Star,
  UserStar,
  X,
} from "lucide-react";

import Modal from "../ui/Modal";
import Botao from "../ui/Botao";

/* ─────────────────────────────────────────────
 * Contrato oficial de avaliação
 * ───────────────────────────────────────────── */

const NOTA_ENUM_OFICIAL = ["Ótimo", "Bom", "Regular", "Ruim", "Péssimo"];

const NOTA_PONTUACAO = {
  Ótimo: 10,
  Bom: 8,
  Regular: 6,
  Ruim: 4,
  Péssimo: 2,
};

const NOTA_STYLE = {
  Ótimo:
    "bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-800/60",
  Bom:
    "bg-lime-50 text-lime-800 ring-lime-200 dark:bg-lime-950/40 dark:text-lime-200 dark:ring-lime-800/60",
  Regular:
    "bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-800/60",
  Ruim:
    "bg-orange-50 text-orange-800 ring-orange-200 dark:bg-orange-950/40 dark:text-orange-200 dark:ring-orange-800/60",
  Péssimo:
    "bg-rose-50 text-rose-800 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-200 dark:ring-rose-800/60",
};

const CAMPOS_MEDIA = [
  { chave: "divulgacao_evento", rotulo: "Divulgação do evento" },
  { chave: "recepcao", rotulo: "Recepção" },
  { chave: "credenciamento", rotulo: "Credenciamento" },
  { chave: "material_apoio", rotulo: "Material de apoio" },
  { chave: "pontualidade", rotulo: "Pontualidade" },
  { chave: "sinalizacao_local", rotulo: "Sinalização do local" },
  { chave: "conteudo_temas", rotulo: "Conteúdo e temas" },
  { chave: "estrutura_local", rotulo: "Estrutura do local" },
  { chave: "acessibilidade", rotulo: "Acessibilidade" },
  { chave: "limpeza", rotulo: "Limpeza" },
  { chave: "inscricao_online", rotulo: "Inscrição on-line" },
];

const CAMPO_DESEMPENHO = {
  chave: "desempenho_organizador",
  rotulo: "Desempenho do organizador",
};

const CAMPOS_EXTRAS = [
  { chave: "exposicao_trabalhos", rotulo: "Exposição de trabalhos" },
  { chave: "apresentacao_oral_mostra", rotulo: "Apresentação oral/mostra" },
  { chave: "apresentacao_tcrs", rotulo: "Apresentação dos TCRs" },
  { chave: "oficinas", rotulo: "Oficinas" },
];

const CAMPOS_TEXTO = [
  { chave: "gostou_mais", rotulo: "O que mais gostou" },
  { chave: "sugestoes_melhoria", rotulo: "Sugestões de melhoria" },
  { chave: "comentarios_finais", rotulo: "Comentários finais" },
];

/* ─────────────────────────────────────────────
 * Helpers
 * ───────────────────────────────────────────── */

function cls(...parts) {
  return parts.filter(Boolean).join(" ");
}

function isNotaOficial(value) {
  return NOTA_ENUM_OFICIAL.includes(value);
}

function notaParaPontuacao(value) {
  return isNotaOficial(value) ? NOTA_PONTUACAO[value] : null;
}

function classificarMedia(media) {
  if (media == null) return "Sem dados";
  if (media >= 9) return "Excelente";
  if (media >= 8) return "Muito bom";
  if (media >= 6) return "Regular";
  if (media >= 4) return "Atenção";
  return "Crítico";
}

function calcularMedia(avaliacao, campos) {
  if (!avaliacao) return null;

  const valores = campos
    .map(({ chave }) => notaParaPontuacao(avaliacao[chave]))
    .filter((nota) => Number.isFinite(nota));

  if (!valores.length) return null;

  return Number(
    (valores.reduce((acc, value) => acc + value, 0) / valores.length).toFixed(2)
  );
}

function formatIsoToBR(input) {
  if (!input) return "—";

  const value = String(input).trim();

  const datetime = value.match(
    /^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::\d{2})?/
  );

  if (datetime) {
    return `${datetime[3]}/${datetime[2]}/${datetime[1]} ${datetime[4]}:${datetime[5]}`;
  }

  const date = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (date) {
    return `${date[3]}/${date[2]}/${date[1]}`;
  }

  return value;
}

function valorTextoPreenchido(value) {
  if (typeof value === "string") return value.trim().length > 0;
  return Boolean(value);
}

function contarNotasValidas(avaliacao, campos) {
  return campos.filter(({ chave }) => isNotaOficial(avaliacao?.[chave])).length;
}

/* ─────────────────────────────────────────────
 * Componentes locais
 * ───────────────────────────────────────────── */

function MiniCard({ icon: Icon, title, children, destaque = false }) {
  return (
    <div
      className={cls(
        "relative overflow-hidden rounded-3xl p-4 shadow-sm ring-1",
        destaque
          ? "bg-gradient-to-br from-violet-700 to-fuchsia-700 text-white ring-violet-400/40"
          : "bg-white text-slate-950 ring-slate-200 dark:bg-zinc-900 dark:text-white dark:ring-zinc-800"
      )}
    >
      <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-white/10 blur-2xl" />

      <div className="relative flex items-start gap-3">
        <div
          className={cls(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ring-1",
            destaque
              ? "bg-white/15 ring-white/20"
              : "bg-violet-50 text-violet-700 ring-violet-100 dark:bg-violet-950/50 dark:text-violet-200 dark:ring-violet-900"
          )}
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>

        <div className="min-w-0">
          <p
            className={cls(
              "text-xs font-black uppercase tracking-wide",
              destaque ? "text-white/75" : "text-slate-500 dark:text-zinc-400"
            )}
          >
            {title}
          </p>

          <div className="mt-1">{children}</div>
        </div>
      </div>
    </div>
  );
}

function NotaBadge({ nota }) {
  if (!isNotaOficial(nota)) {
    return (
      <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-500 ring-1 ring-slate-200 dark:bg-zinc-800 dark:text-zinc-400 dark:ring-zinc-700">
        —
      </span>
    );
  }

  return (
    <span
      className={cls(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-black ring-1",
        NOTA_STYLE[nota]
      )}
      aria-label={`Nota: ${nota}, ${NOTA_PONTUACAO[nota]} de 10`}
    >
      {nota}
      <span className="opacity-70">· {NOTA_PONTUACAO[nota]}/10</span>
    </span>
  );
}

function CampoNotaCard({ rotulo, valor, destaque = false }) {
  const pontuacao = notaParaPontuacao(valor);

  return (
    <div
      className={cls(
        "rounded-3xl p-4 shadow-sm ring-1",
        destaque
          ? "bg-violet-50 ring-violet-100 dark:bg-violet-950/30 dark:ring-violet-800/60"
          : "bg-white ring-slate-200 dark:bg-zinc-900 dark:ring-zinc-800"
      )}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black text-slate-950 dark:text-white">
            {rotulo}
          </p>

          <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
            {pontuacao != null ? `${pontuacao}/10` : "Não informado"}
          </p>
        </div>

        <NotaBadge nota={valor} />
      </div>

      <div
        className="h-2 overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200 dark:bg-zinc-800 dark:ring-zinc-700"
        aria-hidden="true"
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-violet-600 via-fuchsia-500 to-emerald-500"
          style={{ width: `${pontuacao != null ? pontuacao * 10 : 0}%` }}
        />
      </div>
    </div>
  );
}

function TextoCard({ rotulo, valor }) {
  return (
    <div>
      <strong className="mb-1 block text-sm font-black text-slate-950 dark:text-white">
        {rotulo}
      </strong>

      <p className="whitespace-pre-wrap rounded-3xl bg-white p-4 text-sm text-slate-700 shadow-sm ring-1 ring-slate-200 dark:bg-zinc-900 dark:text-zinc-200 dark:ring-zinc-800">
        {valor}
      </p>
    </div>
  );
}

/* ─────────────────────────────────────────────
 * Componente principal
 * ───────────────────────────────────────────── */

export default function ModalAvaliacoes({ isOpen, onClose, avaliacao }) {
  if (!isOpen || !avaliacao) return null;

  const dataAval =
    avaliacao.data_avaliacao ||
    avaliacao.criado_em ||
    avaliacao.atualizado_em ||
    null;

  const mediaEvento = calcularMedia(avaliacao, CAMPOS_MEDIA);
  const desempenhoValor = avaliacao?.[CAMPO_DESEMPENHO.chave] || "";
  const desempenhoPontuacao = notaParaPontuacao(desempenhoValor);

  const notasPrincipais = CAMPOS_MEDIA.filter(({ chave }) =>
    isNotaOficial(avaliacao[chave])
  );

  const extrasVisiveis = CAMPOS_EXTRAS.filter(({ chave }) =>
    isNotaOficial(avaliacao[chave])
  );

  const textosVisiveis = CAMPOS_TEXTO.filter(({ chave }) =>
    valorTextoPreenchido(avaliacao?.[chave])
  );

  const totalCrit = CAMPOS_MEDIA.length;
  const totalPreenchidos = contarNotasValidas(avaliacao, CAMPOS_MEDIA);
  const pctPreenchidos = Math.round((totalPreenchidos / totalCrit) * 100) || 0;

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      labelledBy="titulo-avaliacao-visualizacao"
      describedBy="descricao-avaliacao-visualizacao"
      className="w-[96%] max-w-4xl overflow-hidden p-0"
    >
      <header
        className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-violet-950 to-fuchsia-900 px-4 py-5 text-white sm:px-6"
        role="group"
        aria-label="Cabeçalho da avaliação"
      >
        <div className="absolute inset-0 opacity-30">
          <div className="absolute -left-24 -top-24 h-64 w-64 rounded-full bg-fuchsia-500 blur-3xl" />
          <div className="absolute right-0 top-10 h-64 w-64 rounded-full bg-indigo-500 blur-3xl" />
          <div className="absolute bottom-0 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full bg-cyan-400 blur-3xl" />
        </div>

        <div className="relative">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold ring-1 ring-white/20 backdrop-blur">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            Visualização institucional
          </div>

          <div className="mt-3 flex items-start justify-between gap-4">
            <div>
              <h2
                id="titulo-avaliacao-visualizacao"
                className="text-xl font-black tracking-tight sm:text-2xl"
              >
                Avaliação do Evento
              </h2>

              <p
                id="descricao-avaliacao-visualizacao"
                className="mt-1 max-w-2xl text-sm text-white/85"
              >
                Visualização das notas oficiais e comentários enviados pelo
                participante.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/20 transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              aria-label="Fechar avaliação"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          {dataAval ? (
            <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-sm text-white/90 ring-1 ring-white/15">
              <CalendarDays className="h-4 w-4" aria-hidden="true" />
              <span>
                Data da avaliação: <strong>{formatIsoToBR(dataAval)}</strong>
              </span>
            </div>
          ) : null}
        </div>
      </header>

      <div className="max-h-[75vh] overflow-y-auto bg-slate-50 px-4 pb-28 pt-4 dark:bg-zinc-950 sm:px-6">
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <MiniCard icon={Star} title="Média do evento" destaque>
            <div className="text-2xl font-black">
              {mediaEvento != null ? `${mediaEvento.toFixed(2)} / 10` : "— / 10"}
            </div>

            <div className="text-xs text-white/75">
              {classificarMedia(mediaEvento)}
            </div>
          </MiniCard>

          <MiniCard icon={Gauge} title="Cobertura dos critérios">
            <div className="mb-2 text-sm text-slate-600 dark:text-zinc-300">
              {totalPreenchidos}/{totalCrit} critérios preenchidos
            </div>

            <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-zinc-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-violet-700 to-fuchsia-600 transition-all"
                style={{ width: `${pctPreenchidos}%` }}
                aria-hidden="true"
              />
            </div>

            {extrasVisiveis.length > 0 ? (
              <div className="mt-2 text-xs text-slate-600 dark:text-zinc-300">
                Extras preenchidos: <strong>{extrasVisiveis.length}</strong>
              </div>
            ) : null}
          </MiniCard>

          <MiniCard icon={Info} title="Observações">
            <div className="text-sm text-slate-700 dark:text-zinc-200">
              Os extras aparecem somente quando informados.
            </div>

            <div className="mt-1 text-xs text-slate-600 dark:text-zinc-300">
              Desempenho do organizador é exibido à parte.
            </div>
          </MiniCard>
        </section>

        <div aria-live="polite" className="sr-only">
          {mediaEvento != null
            ? `Média do evento ${mediaEvento.toFixed(2)} de 10.`
            : "Sem média calculada."}
        </div>

        <section className="pt-6">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="text-lg font-black text-slate-950 dark:text-white">
                Critérios oficiais do evento
              </h3>

              <p className="text-sm text-slate-500 dark:text-zinc-400">
                Escala oficial: Ótimo 10, Bom 8, Regular 6, Ruim 4, Péssimo 2.
              </p>
            </div>

            <span className="inline-flex w-fit rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-800 ring-1 ring-violet-100 dark:bg-violet-950/40 dark:text-violet-100 dark:ring-violet-800/50">
              {notasPrincipais.length} nota(s) válida(s)
            </span>
          </div>

          {CAMPOS_MEDIA.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {CAMPOS_MEDIA.map(({ chave, rotulo }) => (
                <CampoNotaCard
                  key={chave}
                  rotulo={rotulo}
                  valor={avaliacao[chave]}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm italic text-slate-500">
              Sem notas registradas.
            </p>
          )}
        </section>

        {isNotaOficial(desempenhoValor) ? (
          <section className="pt-6">
            <h3 className="mb-3 flex items-center gap-2 text-lg font-black text-slate-950 dark:text-white">
              <UserStar className="h-5 w-5 text-violet-600" aria-hidden="true" />
              Desempenho do organizador
            </h3>

            <CampoNotaCard
              rotulo={`${CAMPO_DESEMPENHO.rotulo}${
                desempenhoPontuacao != null ? ` · ${desempenhoPontuacao}/10` : ""
              }`}
              valor={desempenhoValor}
              destaque
            />
          </section>
        ) : null}

        {extrasVisiveis.length > 0 ? (
          <section className="pt-6">
            <h3 className="mb-3 text-lg font-black text-slate-950 dark:text-white">
              Extras informados
            </h3>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {extrasVisiveis.map(({ chave, rotulo }) => (
                <CampoNotaCard
                  key={chave}
                  rotulo={rotulo}
                  valor={avaliacao[chave]}
                />
              ))}
            </div>
          </section>
        ) : null}

        {textosVisiveis.length > 0 ? (
          <section className="space-y-4 pt-6">
            <h3 className="flex items-center gap-2 text-lg font-black text-slate-950 dark:text-white">
              <MessageSquare className="h-5 w-5 text-violet-600" aria-hidden="true" />
              Comentários textuais
            </h3>

            {textosVisiveis.map(({ chave, rotulo }) => (
              <TextoCard key={chave} rotulo={rotulo} valor={avaliacao[chave]} />
            ))}
          </section>
        ) : (
          <section className="pt-6">
            <p className="rounded-3xl bg-white p-4 text-sm italic text-slate-500 ring-1 ring-slate-200 dark:bg-zinc-900 dark:text-zinc-400 dark:ring-zinc-800">
              Sem comentários textuais.
            </p>
          </section>
        )}
      </div>

      <div className="sticky bottom-0 left-0 right-0 flex justify-end border-t border-slate-200 bg-white/90 px-4 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90 sm:px-6">
        <Botao type="button" variant="contorno" onClick={onClose}>
  Fechar
</Botao>
      </div>
    </Modal>
  );
}

ModalAvaliacoes.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  avaliacao: PropTypes.object,
};