// ✅ frontend/src/components/layout/SidebarNav.jsx — v2.5
// Atualizado em: 21/05/2026
//
// Plataforma Escola da Saúde
//
// Menu lateral oficial da aplicação.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Activity,
  Award,
  BarChart3,
  Bell,
  BookOpen,
  CalendarDays,
  CalendarX2,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  ClipboardCheck,
  ClipboardList,
  Cloud,
  FileQuestion,
  FileSearch,
  FileText,
  FolderOpenDot,
  HeartPulse,
  HelpCircle,
  History,
  LayoutDashboard,
  LifeBuoy,
  ListChecks,
  Megaphone,
  MessageSquareText,
  PencilLine,
  PlusCircle,
  Presentation,
  QrCode,
  School,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Telescope,
  Trophy,
  UserRound,
  Users,
  Vote,
  X,
} from "lucide-react";

import api from "../../services/api";
import { getCampanhaSaudeVisual } from "../../utils/campanhaSaudeVisual";

const STORAGE_PERFIL_KEY = "perfil";
const STORAGE_SIDEBAR_RECOLHIDA_KEY = "escola_sidebar_recolhida";

const PERFIL = {
  usuario: "usuario",
  organizador: "organizador",
  administrador: "administrador",
};

const ROTA = {
  painel: "/painel",
  evento: "/evento",
  presenca: "/minha-presenca",
  certificado: "/certificado",
  reserva: "/reserva",
  calendarioEPS: "/calendario-eps",
  cursoOnline: "/curso-online",
  pesquisa: "/pesquisa",
  interacao: "/interacao",
  mensagem: "/mensagem",
  submissao: "/submissao",
  trabalho: "/trabalho",
  manual: "/manual",
  scanner: "/scanner",
  perfil: "/perfil",
  ajuda: "/ajuda",

  organizador: "/organizador",
  organizadorAgenda: "/organizador/agenda",
  organizadorPresenca: "/organizador/presenca",
  organizadorCertificado: "/organizador/certificado",
  organizadorAvaliacao: "/organizador/avaliacao",
  organizadorSubmissao: "/organizador/submissao",

  administrador: "/administrador",
  dashboardAnalitico: "/dashboard-analitico",
  administradorAgenda: "/administrador/agenda",
  administradorReserva: "/administrador/reserva",
  administradorCalendarioEPS: "/administrador/calendario-eps",
  administradorCursoOnline: "/administrador/curso-online",
  administradorPesquisa: "/administrador/pesquisa",
  administradorInteracaoVotacao: "/administrador/interacao/votacao",
  administradorInteracaoQuiz: "/administrador/interacao/quiz",
  administradorInteracaoNuvemPalavras:
    "/administrador/interacao/nuvem-palavras",

  administradorAuditoria: "/administrador/auditoria",
  administradorMensagem: "/administrador/mensagem",
  administradorPendencia: "/administrador/pendencia",
  administradorSaudePlataforma: "/administrador/saude-plataforma",

  certificadoAvulso: "/certificado-avulso",
  chamadaNova: "/chamada/nova",
  relatorioCustomizado: "/relatorio-customizado",

  gestaoInformacao: "/gestao/informacao",
  gestaoUsuario: "/gestao/usuario",
  gestaoOrganizador: "/gestao/organizador",
  gestaoEvento: "/gestao/evento",
  gestaoPresenca: "/gestao/presenca",
  gestaoCertificado: "/gestao/certificado",
  gestaoAvaliacao: "/gestao/avaliacao",
  gestaoQrcode: "/gestao/qrcode",
  gestaoCancelamentoInscricao: "/gestao/cancelamento-inscricao",
  gestaoCalendarioBloqueio: "/gestao/calendario-bloqueio",
  gestaoListaPresencaTurma: "/gestao/lista-presenca-turma",
  gestaoSubmissao: "/gestao/submissao",
};

function classNames(...classes) {
  return classes.filter(Boolean).join(" ");
}

function isBrowser() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function getStoredPerfil() {
  if (!isBrowser()) return null;

  try {
    const raw = localStorage.getItem(STORAGE_PERFIL_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function getPerfilAtual() {
  const perfil = getStoredPerfil();

  if (
    perfil &&
    typeof perfil === "object" &&
    typeof perfil.perfil === "string" &&
    perfil.perfil.trim().length > 0
  ) {
    return perfil.perfil.trim();
  }

  return "";
}

function getStoredBoolean(key, fallback = false) {
  if (!isBrowser()) return fallback;

  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return fallback;
  }
}

function setStoredBoolean(key, value) {
  if (!isBrowser()) return;

  try {
    localStorage.setItem(key, value ? "1" : "0");
  } catch {
    // Sem persistência local quando storage estiver indisponível.
  }
}

function isActivePath(currentPath, itemPath) {
  if (!itemPath) return false;
  if (currentPath === itemPath) return true;
  return itemPath !== "/" && currentPath.startsWith(`${itemPath}/`);
}

function formatarContador(value) {
  const numero = Number(value);

  if (!Number.isFinite(numero) || numero <= 0) return "";

  return numero > 99 ? "99+" : String(numero);
}

function getContadorItem(item, resumoMenu) {
  if (!item?.resumo_chave) return "";
  return formatarContador(resumoMenu?.[item.resumo_chave]);
}

function temAcessoSecao(perfilAtual, secaoPerfil) {
  if (!perfilAtual) return false;

  if (perfilAtual === PERFIL.administrador) return true;

  if (secaoPerfil === PERFIL.usuario) {
    return perfilAtual === PERFIL.usuario || perfilAtual === PERFIL.organizador;
  }

  return perfilAtual === secaoPerfil;
}

function toggleArrayItem(lista, item) {
  if (!item) return lista;

  return lista.includes(item)
    ? lista.filter((valor) => valor !== item)
    : [...lista, item];
}

function BadgeMenu({ valor, recolhida = false, label, campanha }) {
  if (!valor) return null;

  if (recolhida) {
    return (
      <span
        className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-rose-600 px-1.5 py-0.5 text-[10px] font-black leading-none text-white ring-2 ring-white dark:ring-slate-950"
        aria-label={label}
        title={label}
      >
        {valor}
      </span>
    );
  }

  return (
    <span
      className={classNames(
        "ml-auto inline-flex min-w-6 shrink-0 items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-black ring-1",
        campanha.textoContraste === "escuro"
          ? "bg-white/75 text-slate-950 ring-white/70"
          : "bg-white/14 text-white ring-white/20"
      )}
      aria-label={label}
      title={label}
    >
      {valor}
    </span>
  );
}

function IconTile({ active, Icon, contador, recolhida, label, campanha }) {
  return (
    <span
      className={classNames(
        "relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border transition",
        active
          ? "border-white/20 bg-white/15 text-white shadow-[0_12px_30px_-18px_rgba(255,255,255,.45)]"
          : "border-slate-200 bg-white text-slate-700 shadow-sm group-hover:border-slate-300 group-hover:bg-slate-50 group-hover:text-slate-950 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-200 dark:group-hover:bg-white/10 dark:group-hover:text-white"
      )}
      aria-hidden="true"
    >
      <Icon className="h-5 w-5" />

      <BadgeMenu
        valor={contador}
        recolhida={recolhida}
        label={label}
        campanha={campanha}
      />
    </span>
  );
}

function MenuItem({ item, active, recolhida, contador, onClick, campanha }) {
  const badgeLabel = contador
    ? `${item.label}: ${contador} item(ns) relevante(s)`
    : undefined;

  return (
    <button
      type="button"
      onClick={onClick}
className={classNames(
  "group relative flex w-full items-center gap-2 rounded-2xl px-3 py-2 text-left text-[13px] font-black transition",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-950",
        campanha.foco,
        active
          ? classNames(
              "bg-gradient-to-r text-white shadow-[0_18px_46px_-34px_rgba(15,23,42,.95)]",
              campanha.topbar
            )
          : "text-slate-800 hover:bg-slate-100/80 dark:text-slate-200 dark:hover:bg-white/7",
        recolhida && "justify-center px-2"
      )}
      aria-current={active ? "page" : undefined}
      aria-label={contador ? `${item.label}. ${badgeLabel}` : item.label}
      title={recolhida ? item.label : undefined}
    >
      <span
        className={classNames(
          "absolute bottom-2 left-1 top-2 w-1 rounded-full transition",
          active ? "bg-white/85" : "bg-transparent"
        )}
        aria-hidden="true"
      />

      <IconTile
        active={active}
        Icon={item.icon}
        contador={contador}
        recolhida={recolhida}
        label={badgeLabel}
        campanha={campanha}
      />

      {!recolhida && (
        <>
          <span className="min-w-0 flex-1 truncate">{item.label}</span>

          <BadgeMenu
            valor={contador}
            recolhida={false}
            label={badgeLabel}
            campanha={campanha}
          />
        </>
      )}
    </button>
  );
}

function SectionHeader({ title, expanded, recolhida, onClick, campanha }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={classNames(
        "flex w-full items-center gap-2 rounded-2xl px-2 py-2 text-left transition",
        "hover:bg-slate-100/80 focus-visible:outline-none focus-visible:ring-2 dark:hover:bg-white/7",
        campanha.foco,
        recolhida && "justify-center"
      )}
      aria-expanded={expanded}
      title={recolhida ? title : undefined}
    >
      <span
        className={classNames(
          "text-[11px] font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400",
          recolhida && "sr-only"
        )}
      >
        {title}
      </span>

      {!recolhida && (
        <ChevronDown
          className={classNames(
            "ml-auto h-4 w-4 text-slate-400 transition dark:text-slate-500",
            !expanded && "-rotate-90"
          )}
          aria-hidden="true"
        />
      )}

      {recolhida && (
        <span
          className="grid h-9 w-9 place-items-center rounded-2xl border border-slate-200 bg-white text-[10px] font-black uppercase text-slate-600 shadow-sm dark:border-white/10 dark:bg-slate-900 dark:text-slate-300"
          aria-hidden="true"
        >
          {title.slice(0, 2)}
        </span>
      )}
    </button>
  );
}

function SectionBlock({
  section,
  expanded,
  recolhida,
  currentPath,
  resumoMenu,
  onToggle,
  onNavigate,
  campanha,
}) {
  return (
    <section className="rounded-3xl">
      {!recolhida && (
        <SectionHeader
          title={section.title}
          expanded={expanded}
          recolhida={false}
          onClick={onToggle}
          campanha={campanha}
        />
      )}

      {(expanded || recolhida) && (
        <div className={classNames("space-y-0.5", !recolhida && "mt-0.5")}>
          {section.items.map((item) => {
            const active = isActivePath(currentPath, item.path);
            const contador = getContadorItem(item, resumoMenu);

            return (
              <MenuItem
                key={`${section.title}-${item.label}-${item.path}`}
                item={item}
                active={active}
                recolhida={recolhida}
                contador={contador}
                onClick={() => onNavigate(item.path)}
                campanha={campanha}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}

function CaixaMensagemSidebar({
  recolhida,
  campanha,
  perfilAtual,
  mensagensRecentes = [],
  textoMensagem,
  setTextoMensagem,
  enviandoMensagem = false,
  onEnviarMensagem,
  onNavigate,
}) {
  const destino =
    perfilAtual === PERFIL.administrador
      ? ROTA.administradorMensagem
      : ROTA.mensagem;

if (recolhida) {
  return null;
}

const podeEnviar =
  typeof onEnviarMensagem === "function" &&
  String(textoMensagem || "").trim().length >= 3 &&
  !enviandoMensagem;

  return (
    <section
      className={classNames(
        "mt-3 rounded-[1.75rem] border p-3 shadow-sm ring-1",
        campanha.textoContraste === "escuro"
          ? "border-slate-200 bg-white/78 text-slate-900 ring-white/70"
          : "border-white/10 bg-white/[0.06] text-white ring-white/10"
      )}
      aria-label="Últimas mensagens institucionais"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-2.5 py-1 text-[10px] font-black text-slate-800 shadow-sm">
            <MessageSquareText className="h-3.5 w-3.5" aria-hidden="true" />
            Últimas mensagens
          </div>

          <p className="mt-2 text-xs font-semibold leading-relaxed text-slate-600 dark:text-slate-300">
            Canal rápido para dúvidas, sugestões e respostas.
          </p>
        </div>

        <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onNavigate(destino)}
          className={classNames(
            "rounded-xl px-2 py-1 text-[10px] font-black underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2",
            campanha.foco
          )}
        >
          Ver todas
        </button>
      </div>
      </div>

      <div className="mt-3 max-h-28 space-y-2 overflow-y-auto pr-1">
        {mensagensRecentes.length > 0 ? (
          mensagensRecentes.slice(0, 3).map((mensagem) => (
            <div
              key={mensagem.id}
              className="rounded-2xl border border-slate-200 bg-white/80 px-3 py-2 text-xs text-slate-700 shadow-sm dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200"
            >
              <p className="line-clamp-2 font-semibold">
                {mensagem.titulo || mensagem.assunto || "Mensagem"}
              </p>
              <p className="mt-0.5 line-clamp-1 text-[11px] text-slate-500 dark:text-slate-400">
                {mensagem.resumo || mensagem.mensagem || mensagem.texto || ""}
              </p>
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-400">
            Nenhuma mensagem recente.
          </div>
        )}
      </div>

      <form
        className="mt-3 space-y-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (podeEnviar) onEnviarMensagem(String(textoMensagem).trim());
        }}
      >
        <label className="sr-only" htmlFor="mensagem-sidebar-rapida">
          Escrever dúvida ou sugestão
        </label>

        <textarea
          id="mensagem-sidebar-rapida"
          value={textoMensagem}
          onChange={(event) => setTextoMensagem(event.target.value)}
          rows={3}
          maxLength={500}
          placeholder="Escreva uma dúvida ou sugestão..."
          className="min-h-20 w-full resize-none rounded-2xl border border-slate-200 bg-white/90 px-3 py-2 text-xs font-medium text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:ring-2 dark:border-white/10 dark:bg-slate-950/40 dark:text-white"
        />

        <button
          type="submit"
          disabled={!podeEnviar}
          className={classNames(
            "inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-2xl px-3 py-2 text-xs font-black transition focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-55",
            campanha.textoContraste === "escuro"
              ? "bg-slate-950 text-white hover:bg-slate-800"
              : "bg-white text-slate-950 hover:bg-white/90",
            campanha.foco
          )}
        >
          <MessageSquareText className="h-4 w-4" aria-hidden="true" />
          {enviandoMensagem ? "Enviando..." : "Enviar mensagem"}
        </button>
      </form>
    </section>
  );
}

function criarSecoes() {
  return [
    {
      title: "Usuário",
      perfil: PERFIL.usuario,
      items: [
        { label: "Início", path: ROTA.painel, icon: LayoutDashboard },
        {
          label: "Eventos",
          path: ROTA.evento,
          icon: CalendarDays,
          resumo_chave: "evento_disponivel",
        },
        {
          label: "Cursos Online",
          path: ROTA.cursoOnline,
          icon: BookOpen,
          resumo_chave: "curso_online_publicado",
        },
        { label: "Minhas presenças", path: ROTA.presenca, icon: ListChecks },
        {
          label: "Meus certificados",
          path: ROTA.certificado,
          icon: FileText,
          resumo_chave: "certificado_liberado",
        },
        {
          label: "Interações",
          path: ROTA.interacao,
          icon: Sparkles,
          resumo_chave: "interacao_publicada",
        },
        {
          label: "Submissão de trabalhos",
          path: ROTA.submissao,
          icon: Presentation,
        },
        {
          label: "Repositório de trabalhos",
          path: ROTA.trabalho,
          icon: FolderOpenDot,
        },
                { label: "Escanear QR Code", path: ROTA.scanner, icon: QrCode },
                {
          label: "Chat de Dúvidas",
          path: ROTA.mensagem,
          icon: MessageSquareText,
          resumo_chave: "mensagem_aberta",
        },
        { label: "Manual do usuário", path: ROTA.manual, icon: BookOpen },
        { label: "Ajuda", path: ROTA.ajuda, icon: HelpCircle },
      ],
    },
    {
      title: "Institucional",
      perfil: PERFIL.usuario,
      items: [
        {
          label: "Agenda de sala",
          path: ROTA.reserva,
          icon: CalendarDays,
          resumo_chave: "reserva_pendente",
        },
        {
          label: "Calendário Anual de EPS",
          path: ROTA.calendarioEPS,
          icon: School,
          resumo_chave: "calendario_eps_pendente",
        },
              ],
    },
        {
      title: "Organizador",
      perfil: PERFIL.organizador,
      items: [
        {
          label: "Painel do organizador",
          path: ROTA.organizador,
          icon: LayoutDashboard,
        },
        {
          label: "Agenda",
          path: ROTA.organizadorAgenda,
          icon: CalendarDays,
        },
        {
          label: "Presença",
          path: ROTA.organizadorPresenca,
          icon: QrCode,
        },
        {
          label: "Certificados",
          path: ROTA.organizadorCertificado,
          icon: Award,
        },
        {
          label: "Avaliações",
          path: ROTA.organizadorAvaliacao,
          icon: PencilLine,
          resumo_chave: "avaliacao_pendente",
        },
        {
          label: "Trabalhos atribuídos",
          path: ROTA.organizadorSubmissao,
          icon: FolderOpenDot,
          resumo_chave: "trabalho_pendente",
        },
                {
          label: "Quiz",
          path: ROTA.administradorInteracaoQuiz,
          icon: Trophy,
          resumo_chave: "interacao_quiz_publicada",
        },
        {
          label: "Nuvem de palavras",
          path: ROTA.administradorInteracaoNuvemPalavras,
          icon: Cloud,
          resumo_chave: "interacao_nuvem_publicada",
        },
      ],
    },
    {
      title: "Administrador",
      perfil: PERFIL.administrador,
      items: [
                {
          label: "Agenda de salas (ADM)",
          path: ROTA.administradorReserva,
          icon: CalendarDays,
          resumo_chave: "reserva_pendente",
        },
                 { label: "Criar Informativos", path: ROTA.gestaoInformacao, icon: Megaphone },
                         {
          label: "Certificados avulsos",
          path: ROTA.certificadoAvulso,
          icon: FileText,
        },
                         {
          label: "Caixa de mensagens",
          path: ROTA.administradorMensagem,
          icon: MessageSquareText,
          resumo_chave: "mensagem_pendente",
        },
        ],
    },
    {
      title: "Gestão",
      perfil: PERFIL.administrador,
      items: [
         {
          label: "Painel do administrador",
          path: ROTA.administrador,
          icon: LayoutDashboard,
        },
        { label: "Usuários", path: ROTA.gestaoUsuario, icon: Users },
        {
          label: "Organizadores",
          path: ROTA.gestaoOrganizador,
          icon: Presentation,
        },
              {
          label: "Dashboard analítico",
          path: ROTA.dashboardAnalitico,
          icon: BarChart3,
        },
        {
          label: "Agenda geral",
          path: ROTA.administradorAgenda,
          icon: ListChecks,
        },
        {
          label: "Eventos",
          path: ROTA.gestaoEvento,
          icon: CalendarDays,
          resumo_chave: "evento_disponivel",
        },
        {
          label: "Presenças",
          path: ROTA.gestaoPresenca,
          icon: ClipboardCheck,
          resumo_chave: "presenca_pendente",
        },
        {
          label: "Certificados",
          path: ROTA.gestaoCertificado,
          icon: Award,
          resumo_chave: "certificado_pendente",
        },
        {
          label: "Avaliações",
          path: ROTA.gestaoAvaliacao,
          icon: PencilLine,
          resumo_chave: "avaliacao_pendente",
        },
        { label: "QR Codes", path: ROTA.gestaoQrcode, icon: QrCode },
        {
          label: "Cancelar inscrição",
          path: ROTA.gestaoCancelamentoInscricao,
          icon: X,
        },
        {
          label: "Bloqueios de calendário",
          path: ROTA.gestaoCalendarioBloqueio,
          icon: CalendarX2,
        },
        {
          label: "Calendário Anual de EPS",
          path: ROTA.administradorCalendarioEPS,
          icon: School,
          resumo_chave: "calendario_eps_pendente",
        },
        {
          label: "Cursos Online",
          path: ROTA.administradorCursoOnline,
          icon: BookOpen,
          resumo_chave: "curso_online_publicado",
        },
        {
          label: "Pesquisas",
          path: ROTA.administradorPesquisa,
          icon: FileQuestion,
          resumo_chave: "pesquisa_publicada",
        },
        {
          label: "Votações",
          path: ROTA.administradorInteracaoVotacao,
          icon: Vote,
          resumo_chave: "interacao_votacao_publicada",
        },
        {
          label: "Criar chamada de trabalhos",
          path: ROTA.chamadaNova,
          icon: PlusCircle,
        },
        {
          label: "Lista de presença por turma",
          path: ROTA.gestaoListaPresencaTurma,
          icon: ListChecks,
        },
        {
          label: "Submissões",
          path: ROTA.gestaoSubmissao,
          icon: FolderOpenDot,
          resumo_chave: "trabalho_pendente",
        },
        {
          label: "Relatórios",
          path: ROTA.relatorioCustomizado,
          icon: History,
        },
      ],
    },
    {
      title: "Diagnóstico",
      perfil: PERFIL.administrador,
      items: [
        {
          label: "Saúde da Plataforma",
          path: ROTA.administradorSaudePlataforma,
          icon: Activity,
          resumo_chave: "saude_plataforma_alerta",
        },
        {
          label: "Pendências administrativas",
          path: ROTA.administradorPendencia,
          icon: FileSearch,
          resumo_chave: "pendencia_aberta",
        },
        {
          label: "Auditoria centralizada",
          path: ROTA.administradorAuditoria,
          icon: ShieldAlert,
          resumo_chave: "auditoria_erro",
        },
      ],
    },
  ];
}

export default function SidebarNav({
  variante = "desktop",
  recolhida,
  aoAlternarRecolhida,
  aoFechar,
  resumoMenu = {},
}) {
  const location = useLocation();
  const navigate = useNavigate();

  const campanha = getCampanhaSaudeVisual();
  const mobile = variante === "mobile";

  const [perfilAtual, setPerfilAtual] = useState(() => getPerfilAtual());
  const [secoesAbertas, setSecoesAbertas] = useState([]);
  const [recolhidaInterna, setRecolhidaInterna] = useState(() =>
   getStoredBoolean(STORAGE_SIDEBAR_RECOLHIDA_KEY, false)
  );
const [textoMensagemRapida, setTextoMensagemRapida] = useState("");
const [mensagensRecentes, setMensagensRecentes] = useState([]);
const [carregandoMensagens, setCarregandoMensagens] = useState(false);
const [enviandoMensagemRapida, setEnviandoMensagemRapida] = useState(false);
const rotaAnteriorMobileRef = useRef(location.pathname);

  const recolhidaFinal = mobile
    ? false
    : typeof recolhida === "boolean"
      ? recolhida
      : recolhidaInterna;

  const secoesBase = useMemo(() => criarSecoes(), []);

  const secoesVisiveis = useMemo(
    () =>
      secoesBase.filter((section) =>
        temAcessoSecao(perfilAtual, section.perfil)
      ),
    [perfilAtual, secoesBase]
  );

  const secaoAtiva = useMemo(
    () =>
      secoesVisiveis.find((section) =>
        section.items.some((item) => isActivePath(location.pathname, item.path))
      ),
    [location.pathname, secoesVisiveis]
  );

  const totalBadges = useMemo(() => {
    return Object.values(resumoMenu || {}).reduce((acc, value) => {
      const numero = Number(value);
      return acc + (Number.isFinite(numero) && numero > 0 ? numero : 0);
    }, 0);
  }, [resumoMenu]);

  const setRecolhida = useCallback(
    (next) => {
      const value = Boolean(next);

      if (typeof recolhida !== "boolean") {
        setRecolhidaInterna(value);
      }

      setStoredBoolean(STORAGE_SIDEBAR_RECOLHIDA_KEY, value);
      aoAlternarRecolhida?.(value);
    },
    [aoAlternarRecolhida, recolhida]
  );

const navegar = useCallback(
  (path) => {
    if (!path) return;

    if (mobile) {
      aoFechar?.();

      window.setTimeout(() => {
        if (location.pathname !== path) {
          navigate(path);
        }
      }, 0);

      return;
    }

    if (location.pathname !== path) {
      navigate(path);
    }
  },
  [aoFechar, location.pathname, mobile, navigate]
);

useEffect(() => {
  if (!mobile) {
    rotaAnteriorMobileRef.current = location.pathname;
    return;
  }

  if (rotaAnteriorMobileRef.current !== location.pathname) {
    rotaAnteriorMobileRef.current = location.pathname;
    aoFechar?.();
  }
}, [aoFechar, location.pathname, mobile]);

  const alternarSecao = useCallback(
    (title) => {
      if (!title) return;

      if (recolhidaFinal && !mobile) {
        setRecolhida(false);
        setSecoesAbertas((current) =>
          current.includes(title) ? current : [...current, title]
        );
        return;
      }

      setSecoesAbertas((current) => toggleArrayItem(current, title));
    },
    [mobile, recolhidaFinal, setRecolhida]
  );

  useEffect(() => {
    if (secaoAtiva?.title) {
      setSecoesAbertas((current) =>
        current.includes(secaoAtiva.title)
          ? current
          : [...current, secaoAtiva.title]
      );
      return;
    }

    if (secoesVisiveis.length > 0) {
      setSecoesAbertas((current) =>
        current.length > 0 ? current : [secoesVisiveis[0].title]
      );
    }
  }, [secaoAtiva, secoesVisiveis]);

  useEffect(() => {
    function handleStorage(event) {
      if (event.key === STORAGE_PERFIL_KEY) {
        setPerfilAtual(getPerfilAtual());
      }

      if (event.key === STORAGE_SIDEBAR_RECOLHIDA_KEY) {
        const value = event.newValue === "1";

        if (typeof recolhida !== "boolean") {
          setRecolhidaInterna(value);
        }

        aoAlternarRecolhida?.(value);
      }
    }

    function handleAuthChanged() {
      setPerfilAtual(getPerfilAtual());
    }

    window.addEventListener("storage", handleStorage);
    window.addEventListener("auth:changed", handleAuthChanged);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("auth:changed", handleAuthChanged);
    };
  }, [aoAlternarRecolhida, recolhida]);

  useEffect(() => {
  if (recolhidaFinal) return;

  let ativo = true;

  async function carregarMensagensRecentes() {
    try {
      setCarregandoMensagens(true);

      const respostaApi = await api.mensagem.minhas({
        pagina: 1,
        limite: 3,
      });

      if (!ativo) return;

      setMensagensRecentes(
        Array.isArray(respostaApi?.data) ? respostaApi.data : []
      );
    } catch {
      if (ativo) setMensagensRecentes([]);
    } finally {
      if (ativo) setCarregandoMensagens(false);
    }
  }

  carregarMensagensRecentes();

  return () => {
    ativo = false;
  };
}, [recolhidaFinal]);

  return (
  <aside
    className={classNames(
      "flex min-h-0 flex-col gap-3",
      mobile ? "h-full" : "self-start",
      recolhidaFinal && !mobile && "w-[96px]"
    )}
  >
    <nav
      className={classNames(
        "relative flex flex-col rounded-[2rem]",
        "border border-slate-200 bg-white/86 text-slate-950",
        "shadow-[0_24px_80px_-58px_rgba(15,23,42,.65)]",
        "ring-1 ring-black/5 backdrop-blur-xl",
        "dark:border-white/10 dark:bg-slate-900/62 dark:text-white dark:ring-white/10",
        mobile && "h-full rounded-none border-0 bg-transparent shadow-none ring-0"
      )}
      aria-label="Menu principal"
    >
      <div
        className={classNames(
          "pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-r blur-3xl",
          campanha.topbarGlow
        )}
        aria-hidden="true"
      />

      <div className="relative shrink-0 p-3">
        <div
          className={classNames(
            "mb-3 h-1.5 rounded-full bg-gradient-to-r",
            campanha.topbar
          )}
          aria-hidden="true"
        />

        <div className="flex items-center justify-between gap-2">
          {!recolhidaFinal && (
            <div className="min-w-0">
              <div
                className={classNames(
                  "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-black",
                  campanha.textoContraste === "escuro"
                    ? "border-white/70 bg-white/70 text-slate-900"
                    : "border-white/10 bg-white/10 text-white dark:text-white"
                )}
              >
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                Menu oficial
              </div>

              <h2 className="mt-2 truncate text-sm font-black">Navegação</h2>

              {totalBadges > 0 && (
                <p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                  {totalBadges} item(ns) exigem atenção.
                </p>
              )}
            </div>
          )}

          {!mobile ? (
            <button
              type="button"
              onClick={() => setRecolhida(!recolhidaFinal)}
              className={classNames(
                "grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 dark:border-white/10 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-white/10",
                campanha.foco
              )}
              aria-label={recolhidaFinal ? "Expandir menu" : "Recolher menu"}
              aria-expanded={!recolhidaFinal}
              title={recolhidaFinal ? "Expandir menu" : "Recolher menu"}
            >
              {recolhidaFinal ? (
                <ChevronsRight className="h-5 w-5" aria-hidden="true" />
              ) : (
                <ChevronsLeft className="h-5 w-5" aria-hidden="true" />
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={aoFechar}
              className={classNames(
                "ml-auto grid h-10 w-10 place-items-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 dark:border-white/10 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-white/10",
                campanha.foco
              )}
              aria-label="Fechar menu"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

<div
  className="relative px-3 pb-4"
>
  <div className="space-y-1.5">
    {secoesVisiveis.length === 0 ? (
      <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm font-medium text-slate-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300">
        Nenhum menu disponível para este perfil.
      </div>
    ) : recolhidaFinal && !mobile ? (
      <div className="space-y-1">
        {secoesVisiveis.flatMap((section) =>
          section.items.map((item) => {
            const active = isActivePath(location.pathname, item.path);
            const contador = getContadorItem(item, resumoMenu);

            return (
              <MenuItem
                key={`${section.title}-${item.label}-${item.path}`}
                item={item}
                active={active}
                recolhida
                contador={contador}
                onClick={() => navegar(item.path)}
                campanha={campanha}
              />
            );
          })
        )}
      </div>
    ) : (
      secoesVisiveis.map((section) => (
        <SectionBlock
          key={section.title}
          section={section}
          expanded={secoesAbertas.includes(section.title)}
          recolhida={false}
          currentPath={location.pathname}
          resumoMenu={resumoMenu}
          onToggle={() => alternarSecao(section.title)}
          onNavigate={navegar}
          campanha={campanha}
        />
      ))
    )}

 </div>
 {!mobile && !recolhidaFinal && (
  <CaixaMensagemSidebar
  recolhida={false}
  campanha={campanha}
  perfilAtual={perfilAtual}
  mensagensRecentes={mensagensRecentes}
  carregandoMensagens={carregandoMensagens}
  enviandoMensagem={enviandoMensagemRapida}
  textoMensagem={textoMensagemRapida}
  setTextoMensagem={setTextoMensagemRapida}
  onEnviarMensagem={async (texto) => {
    try {
      setEnviandoMensagemRapida(true);

      await api.mensagem.criar({
        assunto: texto.length > 80 ? `${texto.slice(0, 77)}...` : texto,
        categoria: "duvida",
        prioridade: "normal",
        mensagem: texto,
      });

      setTextoMensagemRapida("");
      navigate(ROTA.mensagem);
    } finally {
      setEnviandoMensagemRapida(false);
    }
  }}
  onNavigate={navegar}
/>
)}
</div>
    </nav>
  </aside>
);
}

BadgeMenu.propTypes = {
  valor: PropTypes.string,
  recolhida: PropTypes.bool,
  label: PropTypes.string,
  campanha: PropTypes.shape({
    textoContraste: PropTypes.string,
  }).isRequired,
};

IconTile.propTypes = {
  active: PropTypes.bool.isRequired,
  Icon: PropTypes.elementType.isRequired,
  contador: PropTypes.string,
  recolhida: PropTypes.bool,
  label: PropTypes.string,
  campanha: PropTypes.object.isRequired,
};

MenuItem.propTypes = {
  item: PropTypes.shape({
    label: PropTypes.string.isRequired,
    path: PropTypes.string.isRequired,
    icon: PropTypes.elementType.isRequired,
    resumo_chave: PropTypes.string,
  }).isRequired,
  active: PropTypes.bool.isRequired,
  recolhida: PropTypes.bool.isRequired,
  contador: PropTypes.string,
  onClick: PropTypes.func.isRequired,
  campanha: PropTypes.object.isRequired,
};

SectionHeader.propTypes = {
  title: PropTypes.string.isRequired,
  expanded: PropTypes.bool.isRequired,
  recolhida: PropTypes.bool,
  onClick: PropTypes.func.isRequired,
  campanha: PropTypes.object.isRequired,
};

SectionBlock.propTypes = {
  section: PropTypes.shape({
    title: PropTypes.string.isRequired,
    items: PropTypes.arrayOf(
      PropTypes.shape({
        label: PropTypes.string.isRequired,
        path: PropTypes.string.isRequired,
        icon: PropTypes.elementType.isRequired,
        resumo_chave: PropTypes.string,
      })
    ).isRequired,
  }).isRequired,
  expanded: PropTypes.bool.isRequired,
  recolhida: PropTypes.bool,
  currentPath: PropTypes.string.isRequired,
  resumoMenu: PropTypes.objectOf(
    PropTypes.oneOfType([PropTypes.string, PropTypes.number])
  ),
  onToggle: PropTypes.func.isRequired,
  onNavigate: PropTypes.func.isRequired,
  campanha: PropTypes.object.isRequired,
};

CaixaMensagemSidebar.propTypes = {
  recolhida: PropTypes.bool.isRequired,
  mensagemRecolhida: PropTypes.bool,
  onAlternarMensagem: PropTypes.func,
  campanha: PropTypes.object.isRequired,
  perfilAtual: PropTypes.string.isRequired,
  onNavigate: PropTypes.func.isRequired,
};

SidebarNav.propTypes = {
  variante: PropTypes.oneOf(["desktop", "mobile"]),
  recolhida: PropTypes.bool,
  aoAlternarRecolhida: PropTypes.func,
  aoFechar: PropTypes.func,
  resumoMenu: PropTypes.objectOf(
    PropTypes.oneOfType([PropTypes.string, PropTypes.number])
  ),
};