/**
 * ✅ frontend/src/pages/InteracoesApresentacao.jsx — v2.0
 * Atualizado em: 19/05/2026
 * Plataforma Escola da Saúde
 *
 * Página de apresentação das interações em modo telão/projetor.
 *
 * Responsabilidades:
 * - Exibir interação em tela limpa para apresentação.
 * - Suportar votação, quiz e nuvem de palavras.
 * - Exibir QR Code/link de participação quando disponível.
 * - Atualizar dados automaticamente.
 * - Permitir fullscreen.
 * - Exibir estados de rascunho, publicada, em andamento, encerrada e arquivada.
 *
 * Contratos aplicados:
 * - Service oficial futuro: api.interacao.*
 * - Backend oficial: /api/interacao
 * - Tipos oficiais:
 *   - votacao
 *   - quiz
 *   - nuvem_palavras
 * - Status oficiais:
 *   - rascunho
 *   - publicada
 *   - em_andamento
 *   - encerrada
 *   - arquivada
 * - Sem montagem direta de /api
 * - Sem aliases
 * - Sem legado
 *
 * Observação:
 * - Esta tela foi pensada para uso administrativo em telão.
 * - App.jsx, api.js e SidebarNav.jsx serão fechados no bloco consolidado.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  Clock3,
  Cloud,
  Copy,
  ExternalLink,
  Eye,
  Fullscreen,
  HelpCircle,
  Loader2,
  Maximize2,
  Minimize2,
  PartyPopper,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Trophy,
  Vote,
  Wifi,
  WifiOff,
} from "lucide-react";

import api from "../services/api";
import { notifyError, notifySuccess, notifyWarning } from "../components/ui/AppToast";

const AUTO_REFRESH_MS = 3000;

const TIPOS = {
  votacao: {
    label: "Votação",
    icon: Vote,
  },
  quiz: {
    label: "Quiz",
    icon: Trophy,
  },
  nuvem_palavras: {
    label: "Nuvem de palavras",
    icon: Cloud,
  },
};

const STATUS = {
  rascunho: "Rascunho",
  publicada: "Publicada",
  em_andamento: "Em andamento",
  encerrada: "Encerrada",
  arquivada: "Arquivada",
};

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function textoOuTraco(valor) {
  const texto = String(valor ?? "").trim();
  return texto || "—";
}

function formatarDataHora(valor) {
  if (!valor) return "—";

  try {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "medium",
    }).format(new Date(valor));
  } catch {
    return "—";
  }
}

function copiarTexto(texto, mensagem = "Conteúdo copiado.") {
  if (!texto) {
    notifyWarning("Não há conteúdo disponível para copiar.");
    return;
  }

  navigator.clipboard
    .writeText(String(texto))
    .then(() => notifySuccess(mensagem))
    .catch(() =>
      notifyError("Não foi possível copiar automaticamente. Selecione manualmente.")
    );
}

function normalizarData(data) {
  if (!data) {
    return {
      interacao: null,
      resultado: null,
      perguntas: [],
      pergunta_ativa: null,
      ranking: [],
      qr: null,
      participacao_url: null,
      execucao: null,
    };
  }

  return {
    interacao: data.interacao || data,
    resultado: data.resultado || data.resultados || null,
    perguntas: Array.isArray(data.perguntas) ? data.perguntas : [],
    pergunta_ativa:
      data.pergunta_ativa ||
      data.perguntaAtiva ||
      data.pergunta_aberta ||
      null,
    ranking: Array.isArray(data.ranking) ? data.ranking : [],
    qr: data.qr || data.qrcode || data.qr_code || null,
    participacao_url:
      data.participacao_url ||
      data.url_participacao ||
      data.link_participacao ||
      data.link_publico ||
      null,
    execucao: data.execucao || data.execucao_atual || null,
  };
}

function obterOpcoesVotacao(resultado, perguntas) {
  if (Array.isArray(resultado?.opcoes)) return resultado.opcoes;
  if (Array.isArray(resultado?.resultado?.opcoes)) return resultado.resultado.opcoes;
  if (Array.isArray(resultado?.itens)) return resultado.itens;

  const primeiraPergunta = perguntas?.[0];

  if (Array.isArray(primeiraPergunta?.opcoes)) {
    return primeiraPergunta.opcoes.map((opcao) => ({
      ...opcao,
      total: Number(opcao.total || opcao.votos || opcao.respostas || 0),
    }));
  }

  return [];
}

function obterPalavras(resultado) {
  if (Array.isArray(resultado?.palavras)) return resultado.palavras;
  if (Array.isArray(resultado?.resultado)) return resultado.resultado;
  if (Array.isArray(resultado?.itens)) return resultado.itens;
  return [];
}

function calcularTotalOpcoes(opcoes) {
  return opcoes.reduce((acc, item) => {
    const total = Number(item.total || item.votos || item.respostas || 0);
    return acc + total;
  }, 0);
}

function BadgeStatus({ status }) {
  const mapa = {
    rascunho:
      "border-slate-300 bg-slate-100 text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100",
    publicada:
      "border-blue-300 bg-blue-100 text-blue-800 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-100",
    em_andamento:
      "border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100",
    encerrada:
      "border-purple-300 bg-purple-100 text-purple-800 dark:border-purple-800 dark:bg-purple-950/50 dark:text-purple-100",
    arquivada:
      "border-zinc-300 bg-zinc-100 text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100",
  };

  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full border px-4 py-2 text-sm font-black",
        mapa[status] || mapa.rascunho
      )}
    >
      {STATUS[status] || status || "—"}
    </span>
  );
}

function HeaderApresentacao({
  interacao,
  online,
  atualizando,
  fullscreen,
  onVoltar,
  onAtualizar,
  onFullscreen,
}) {
  const tipo = TIPOS[interacao?.tipo] || {
    label: textoOuTraco(interacao?.tipo),
    icon: HelpCircle,
  };

  const Icone = tipo.icon;

  return (
    <header className="flex flex-col gap-4 border-b border-white/10 bg-slate-950/90 px-5 py-4 text-white backdrop-blur lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onVoltar}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/40"
          aria-label="Voltar"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10">
          <Icone className="h-6 w-6" />
        </div>

        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-slate-400">
            Modo apresentação · {tipo.label}
          </p>

          <h1 className="truncate text-xl font-black tracking-tight sm:text-2xl">
            {textoOuTraco(interacao?.titulo)}
          </h1>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <BadgeStatus status={interacao?.status} />

        <span
          className={cx(
            "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-black",
            online
              ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-100"
              : "border-red-400/30 bg-red-400/10 text-red-100"
          )}
        >
          {online ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
          {online ? "Atualização ativa" : "Sem atualização"}
        </span>

        <button
          type="button"
          onClick={onAtualizar}
          disabled={atualizando}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-white/40"
        >
          <RefreshCw className={cx("h-4 w-4", atualizando && "animate-spin")} />
          Atualizar
        </button>

        <button
          type="button"
          onClick={onFullscreen}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-white transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/40"
        >
          {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          {fullscreen ? "Sair" : "Tela cheia"}
        </button>
      </div>
    </header>
  );
}

function PainelParticipacao({ participacaoUrl, qr }) {
  const qrValor = qr?.url || qr?.imagem || qr?.data_url || qr;
  const textoUrl = participacaoUrl || qr?.participacao_url || qr?.url_publica || null;

  if (!textoUrl && !qrValor) {
    return (
      <section className="rounded-3xl border border-white/10 bg-white/5 p-6 text-white shadow-2xl">
        <div className="flex items-center gap-3">
          <QrCode className="h-7 w-7 text-slate-300" />
          <div>
            <p className="text-lg font-black">Participação</p>
            <p className="mt-1 text-sm text-slate-300">
              Link ou QR Code ainda não disponível para esta interação.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-6 text-white shadow-2xl">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
          <QrCode className="h-7 w-7" />
        </div>
        <div>
          <p className="text-lg font-black">Participe agora</p>
          <p className="text-sm text-slate-300">Aponte a câmera para o QR Code.</p>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)] lg:items-center">
        <div className="flex aspect-square items-center justify-center rounded-3xl bg-white p-4">
          {typeof qrValor === "string" && qrValor.startsWith("data:image") ? (
            <img
              src={qrValor}
              alt="QR Code de participação"
              className="h-full w-full object-contain"
            />
          ) : typeof qrValor === "string" && qrValor.startsWith("http") ? (
            <img
              src={qrValor}
              alt="QR Code de participação"
              className="h-full w-full object-contain"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 text-slate-700">
              <QrCode className="mb-3 h-16 w-16" />
              <p className="text-center text-sm font-bold">QR Code indisponível</p>
            </div>
          )}
        </div>

        <div className="min-w-0">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400">
            Link de acesso
          </p>

          <p className="mt-3 break-all rounded-2xl border border-white/10 bg-black/20 p-4 text-lg font-black text-white">
            {textoUrl || "Link não informado"}
          </p>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => copiarTexto(textoUrl, "Link de participação copiado.")}
              disabled={!textoUrl}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-black text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Copy className="h-4 w-4" />
              Copiar link
            </button>

            {textoUrl ? (
              <a
                href={textoUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-black text-white transition hover:bg-white/15"
              >
                <ExternalLink className="h-4 w-4" />
                Abrir
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function EstadoInteracao({ interacao }) {
  const status = interacao?.status;

  if (status === "publicada" || status === "em_andamento") return null;

  const mapa = {
    rascunho: {
      icon: AlertTriangle,
      titulo: "Interação em rascunho",
      texto: "Esta interação ainda não foi publicada. O público não deve visualizar resultados.",
      classe:
        "border-amber-300/30 bg-amber-300/10 text-amber-100",
    },
    encerrada: {
      icon: CheckCircle2,
      titulo: "Interação encerrada",
      texto: "Os resultados exibidos representam o estado final registrado.",
      classe:
        "border-purple-300/30 bg-purple-300/10 text-purple-100",
    },
    arquivada: {
      icon: AlertTriangle,
      titulo: "Interação arquivada",
      texto: "Esta interação está arquivada e deve ser usada apenas para consulta.",
      classe:
        "border-slate-300/30 bg-slate-300/10 text-slate-100",
    },
  };

  const config = mapa[status] || mapa.rascunho;
  const Icone = config.icon;

  return (
    <section className={cx("rounded-3xl border p-5", config.classe)}>
      <div className="flex items-start gap-3">
        <Icone className="mt-0.5 h-6 w-6 shrink-0" />
        <div>
          <p className="text-lg font-black">{config.titulo}</p>
          <p className="mt-1 text-sm opacity-90">{config.texto}</p>
        </div>
      </div>
    </section>
  );
}

function VotacaoView({ interacao, resultado, perguntas }) {
  const opcoes = obterOpcoesVotacao(resultado, perguntas);
  const total = calcularTotalOpcoes(opcoes);
  const pergunta = perguntas?.[0]?.enunciado || interacao?.pergunta || interacao?.descricao;

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 text-white shadow-2xl lg:p-8">
      <div className="mb-8 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-blue-300/30 bg-blue-300/10 px-3 py-1 text-xs font-black uppercase tracking-[0.2em] text-blue-100">
            <Vote className="h-3.5 w-3.5" />
            Votação ao vivo
          </p>

          <h2 className="text-3xl font-black leading-tight tracking-tight lg:text-5xl">
            {textoOuTraco(pergunta)}
          </h2>
        </div>

        <div className="rounded-3xl border border-white/10 bg-black/20 px-6 py-4 text-center">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
            Total
          </p>
          <p className="mt-1 text-4xl font-black">{total}</p>
        </div>
      </div>

      {opcoes.length === 0 ? (
        <div className="rounded-3xl border border-white/10 bg-black/20 p-8 text-center">
          <BarChart3 className="mx-auto mb-3 h-12 w-12 text-slate-300" />
          <p className="text-xl font-black">Sem resultados disponíveis</p>
          <p className="mt-2 text-sm text-slate-300">
            Quando os votos forem registrados, os resultados aparecerão aqui.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {opcoes.map((opcao, index) => {
            const votos = Number(opcao.total || opcao.votos || opcao.respostas || 0);
            const percentual = total > 0 ? Math.round((votos / total) * 100) : 0;
            const texto = opcao.texto || opcao.label || opcao.opcao || `Opção ${index + 1}`;

            return (
              <article
                key={opcao.id || texto || index}
                className="rounded-3xl border border-white/10 bg-black/20 p-5"
              >
                <div className="mb-3 flex items-center justify-between gap-4">
                  <p className="min-w-0 text-xl font-black lg:text-2xl">{texto}</p>
                  <p className="shrink-0 text-2xl font-black lg:text-3xl">
                    {percentual}%
                  </p>
                </div>

                <div className="h-5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-white transition-all duration-700"
                    style={{ width: `${Math.max(percentual, votos > 0 ? 4 : 0)}%` }}
                  />
                </div>

                <p className="mt-2 text-sm font-bold text-slate-300">
                  {votos} voto(s)
                </p>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function QuizView({ interacao, perguntaAtiva, perguntas, ranking, execucao }) {
  const pergunta = perguntaAtiva || perguntas?.find((item) => item.status === "aberta") || perguntas?.[0];
  const opcoes = Array.isArray(pergunta?.opcoes) ? pergunta.opcoes : [];

  return (
    <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 text-white shadow-2xl lg:p-8">
        <div className="mb-8 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-xs font-black uppercase tracking-[0.2em] text-amber-100">
              <Trophy className="h-3.5 w-3.5" />
              Quiz ao vivo
            </p>

            <h2 className="text-3xl font-black leading-tight tracking-tight lg:text-5xl">
              {textoOuTraco(pergunta?.enunciado || pergunta?.pergunta || interacao?.descricao)}
            </h2>
          </div>

          <div className="rounded-3xl border border-white/10 bg-black/20 px-6 py-4 text-center">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
              Execução
            </p>
            <p className="mt-1 text-xl font-black">
              {execucao?.status || interacao?.status || "—"}
            </p>
          </div>
        </div>

        {opcoes.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-black/20 p-8 text-center">
            <HelpCircle className="mx-auto mb-3 h-12 w-12 text-slate-300" />
            <p className="text-xl font-black">Nenhuma alternativa aberta</p>
            <p className="mt-2 text-sm text-slate-300">
              Abra uma pergunta no painel administrativo para exibir as alternativas.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {opcoes.map((opcao, index) => {
              const letra = String.fromCharCode(65 + index);
              const texto = opcao.texto || opcao.label || opcao.opcao || `Alternativa ${letra}`;
              const correta = opcao.correta === true && pergunta?.mostrar_gabarito;

              return (
                <article
                  key={opcao.id || texto || index}
                  className={cx(
                    "rounded-3xl border p-5",
                    correta
                      ? "border-emerald-300/40 bg-emerald-300/15"
                      : "border-white/10 bg-black/20"
                  )}
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-xl font-black text-slate-950">
                      {letra}
                    </div>

                    <p className="text-xl font-black leading-snug">{texto}</p>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      <RankingQuiz ranking={ranking} />
    </section>
  );
}

function RankingQuiz({ ranking }) {
  return (
    <aside className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 text-white shadow-2xl">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
          <Trophy className="h-7 w-7" />
        </div>
        <div>
          <p className="text-lg font-black">Ranking</p>
          <p className="text-sm text-slate-300">Pontuação em tempo real</p>
        </div>
      </div>

      {ranking.length === 0 ? (
        <div className="rounded-3xl border border-white/10 bg-black/20 p-6 text-center">
          <PartyPopper className="mx-auto mb-3 h-10 w-10 text-slate-300" />
          <p className="font-black">Ranking vazio</p>
          <p className="mt-1 text-sm text-slate-300">
            As pontuações aparecerão após as respostas.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {ranking.slice(0, 10).map((item, index) => (
            <article
              key={item.usuario_id || item.nome || index}
              className="rounded-2xl border border-white/10 bg-black/20 p-4"
            >
              <div className="flex items-center gap-3">
                <div
                  className={cx(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-lg font-black",
                    index === 0
                      ? "bg-amber-300 text-amber-950"
                      : index === 1
                        ? "bg-slate-200 text-slate-950"
                        : index === 2
                          ? "bg-orange-300 text-orange-950"
                          : "bg-white/10 text-white"
                  )}
                >
                  {index + 1}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-black">
                    {item.nome_curto || item.nome || item.usuario_nome || "Participante"}
                  </p>
                  <p className="text-xs text-slate-400">
                    {Number(item.acertos || 0)} acerto(s)
                  </p>
                </div>

                <p className="text-xl font-black">
                  {Number(item.pontuacao || item.pontos || 0)}
                </p>
              </div>
            </article>
          ))}
        </div>
      )}
    </aside>
  );
}

function NuvemPalavrasView({ interacao, resultado }) {
  const palavras = obterPalavras(resultado);
  const maior = palavras.reduce((acc, item) => {
    const total = Number(item.total || item.quantidade || item.count || 0);
    return Math.max(acc, total);
  }, 0);

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 text-white shadow-2xl lg:p-8">
      <div className="mb-8 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-xs font-black uppercase tracking-[0.2em] text-cyan-100">
            <Cloud className="h-3.5 w-3.5" />
            Nuvem de palavras
          </p>

          <h2 className="text-3xl font-black leading-tight tracking-tight lg:text-5xl">
            {textoOuTraco(interacao?.pergunta || interacao?.descricao || interacao?.titulo)}
          </h2>
        </div>

        <div className="rounded-3xl border border-white/10 bg-black/20 px-6 py-4 text-center">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
            Palavras
          </p>
          <p className="mt-1 text-4xl font-black">{palavras.length}</p>
        </div>
      </div>

      {palavras.length === 0 ? (
        <div className="rounded-3xl border border-white/10 bg-black/20 p-8 text-center">
          <Cloud className="mx-auto mb-3 h-12 w-12 text-slate-300" />
          <p className="text-xl font-black">Aguardando respostas</p>
          <p className="mt-2 text-sm text-slate-300">
            As palavras aparecerão aqui conforme os participantes responderem.
          </p>
        </div>
      ) : (
        <div className="flex min-h-[420px] flex-wrap items-center justify-center gap-4 rounded-3xl border border-white/10 bg-black/20 p-6">
          {palavras.slice(0, 80).map((item, index) => {
            const palavra =
              item.resposta_normalizada ||
              item.palavra ||
              item.texto ||
              item.resposta ||
              `palavra-${index + 1}`;

            const total = Number(item.total || item.quantidade || item.count || 0);
            const peso = maior > 0 ? total / maior : 0;
            const tamanho = 18 + Math.round(peso * 46);

            return (
              <span
                key={`${palavra}-${index}`}
                className="rounded-full border border-white/10 bg-white/10 px-4 py-2 font-black text-white shadow-lg"
                style={{ fontSize: `${tamanho}px` }}
                title={`${palavra}: ${total}`}
              >
                {palavra}
              </span>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default function InteracoesApresentacao() {
  const { id } = useParams();
  const navigate = useNavigate();
  const rootRef = useRef(null);

  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState("");
  const [online, setOnline] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState(null);

  const normalizado = useMemo(() => normalizarData(dados), [dados]);
  const { interacao, resultado, perguntas, pergunta_ativa, ranking, qr, participacao_url, execucao } =
    normalizado;

  const carregarDados = useCallback(
    async ({ silencioso = false } = {}) => {
      if (!id) {
        setErro("Interação não informada.");
        setCarregando(false);
        return;
      }

      try {
        if (silencioso) {
          setAtualizando(true);
        } else {
          setCarregando(true);
        }

        setErro("");

        let resposta;

        if (api?.interacao?.apresentacao) {
          resposta = await api.interacao.apresentacao(id);
        } else if (api?.interacao?.resultadoAdmin) {
          resposta = await api.interacao.resultadoAdmin(id);
        } else if (api?.interacao?.adminObterPorId) {
          resposta = await api.interacao.adminObterPorId(id);
        } else if (api?.interacao?.obterPorId) {
          resposta = await api.interacao.obterPorId(id);
        } else {
          throw new Error(
            "Service api.interacao.apresentacao ainda não foi registrado no api.js."
          );
        }

        setDados(resposta?.data || resposta || null);
        setOnline(true);
        setUltimaAtualizacao(new Date().toISOString());
      } catch (error) {
        console.error("[InteracoesApresentacao] Falha ao carregar dados:", error);

        setOnline(false);
        setErro(
          error?.response?.data?.message ||
            error?.message ||
            "Não foi possível carregar a apresentação da interação."
        );
      } finally {
        setCarregando(false);
        setAtualizando(false);
      }
    },
    [id]
  );

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      carregarDados({ silencioso: true });
    }, AUTO_REFRESH_MS);

    return () => window.clearInterval(timer);
  }, [carregarDados]);

  useEffect(() => {
    function onFullscreenChange() {
      setFullscreen(Boolean(document.fullscreenElement));
    }

    document.addEventListener("fullscreenchange", onFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, []);

  async function alternarFullscreen() {
    try {
      if (!document.fullscreenElement) {
        await rootRef.current?.requestFullscreen?.();
      } else {
        await document.exitFullscreen?.();
      }
    } catch {
      notifyWarning("Não foi possível alternar o modo tela cheia neste navegador.");
    }
  }

  function renderConteudoPrincipal() {
    if (!interacao) return null;

    if (interacao.tipo === "votacao") {
      return (
        <VotacaoView
          interacao={interacao}
          resultado={resultado}
          perguntas={perguntas}
        />
      );
    }

    if (interacao.tipo === "quiz") {
      return (
        <QuizView
          interacao={interacao}
          perguntaAtiva={pergunta_ativa}
          perguntas={perguntas}
          ranking={ranking}
          execucao={execucao}
        />
      );
    }

    if (interacao.tipo === "nuvem_palavras") {
      return <NuvemPalavrasView interacao={interacao} resultado={resultado} />;
    }

    return (
      <section className="rounded-3xl border border-white/10 bg-white/[0.06] p-8 text-center text-white shadow-2xl">
        <HelpCircle className="mx-auto mb-3 h-14 w-14 text-slate-300" />
        <h2 className="text-2xl font-black">Tipo de interação não suportado</h2>
        <p className="mt-2 text-slate-300">
          Tipo recebido: {textoOuTraco(interacao.tipo)}
        </p>
      </section>
    );
  }

  if (carregando) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-white">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-white" />
          <h1 className="text-2xl font-black">Carregando apresentação</h1>
          <p className="mt-2 text-slate-300">
            Buscando dados da interação para exibição em telão.
          </p>
        </div>
      </main>
    );
  }

  if (erro && !interacao) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-white">
        <section className="max-w-xl rounded-3xl border border-red-400/30 bg-red-400/10 p-8 text-center shadow-2xl">
          <AlertTriangle className="mx-auto mb-4 h-14 w-14 text-red-200" />
          <h1 className="text-2xl font-black">Apresentação indisponível</h1>
          <p className="mt-3 text-sm leading-6 text-red-100">{erro}</p>

          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => carregarDados()}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950"
            >
              <RefreshCw className="h-4 w-4" />
              Tentar novamente
            </button>

            <button
              type="button"
              onClick={() => navigate(-1)}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-black text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main
      ref={rootRef}
      className="min-h-screen bg-[radial-gradient(circle_at_top_right,#1d4ed8_0,#020617_34%,#020617_100%)] text-white"
    >
      <HeaderApresentacao
        interacao={interacao}
        online={online}
        atualizando={atualizando}
        fullscreen={fullscreen}
        onVoltar={() => navigate(-1)}
        onAtualizar={() => carregarDados({ silencioso: true })}
        onFullscreen={alternarFullscreen}
      />

      <div className="mx-auto grid w-full max-w-[1800px] gap-6 p-5 lg:p-8">
        <EstadoInteracao interacao={interacao} />

        <section className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="min-w-0">{renderConteudoPrincipal()}</div>

          <aside className="space-y-6">
            <PainelParticipacao participacaoUrl={participacao_url} qr={qr} />

            <section className="rounded-3xl border border-white/10 bg-white/5 p-6 text-white shadow-2xl">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
                  <Eye className="h-7 w-7" />
                </div>

                <div>
                  <p className="text-lg font-black">Estado da apresentação</p>
                  <p className="text-sm text-slate-300">
                    Atualização automática a cada {AUTO_REFRESH_MS / 1000}s
                  </p>
                </div>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between gap-4 rounded-2xl bg-black/20 p-3">
                  <span className="text-slate-300">Interação ID</span>
                  <span className="font-black">{id}</span>
                </div>

                <div className="flex items-center justify-between gap-4 rounded-2xl bg-black/20 p-3">
                  <span className="text-slate-300">Tipo</span>
                  <span className="font-black">
                    {TIPOS[interacao?.tipo]?.label || textoOuTraco(interacao?.tipo)}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-4 rounded-2xl bg-black/20 p-3">
                  <span className="text-slate-300">Status</span>
                  <span className="font-black">
                    {STATUS[interacao?.status] || textoOuTraco(interacao?.status)}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-4 rounded-2xl bg-black/20 p-3">
                  <span className="text-slate-300">Última atualização</span>
                  <span className="font-black">{formatarDataHora(ultimaAtualizacao)}</span>
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-emerald-300/20 bg-emerald-300/10 p-6 text-emerald-100 shadow-2xl">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-6 w-6 shrink-0" />
                <div>
                  <p className="text-lg font-black">Uso em evento</p>
                  <p className="mt-1 text-sm leading-6">
                    Esta tela é somente exibição. A criação, abertura de perguntas,
                    encerramento e gabarito continuam no painel administrativo da
                    interação.
                  </p>
                </div>
              </div>
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
}