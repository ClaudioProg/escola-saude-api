// 📁 src/components/trabalhos/ModalAtribuirAvaliadores.jsx
// Atualizado em: 15/05/2026
//
// Plataforma Escola da Saúde — v2.0
//
// Modal administrativo para atribuir avaliadores a uma submissão.
//
// Contratos oficiais usados:
// - GET    /api/submissao/admin/:id/avaliador
// - POST   /api/submissao/admin/:id/avaliador
// - DELETE /api/submissao/admin/:id/avaliador
// - PATCH  /api/submissao/admin/:id/avaliador/restauracao
// - GET    /api/submissao/admin/avaliador/resumo
//
// Diretrizes v2.0:
// - sem service legado submissaoAvaliadores;
// - sem funções Flex;
// - sem Modal antigo;
// - sem toast direto;
// - sem aliases avaliadorId/modalidade/categoria;
// - contrato oficial: avaliador_id + tipo;
// - tipos oficiais: escrita | oral;
// - UX/UI premium real;
// - acessível;
// - mobile-first;
// - dark mode.

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  BadgeCheck,
  CheckCircle2,
  Loader2,
  PlusCircle,
  RotateCcw,
  Search,
  ShieldAlert,
  Trash2,
  Undo2,
  UserCheck,
  Users,
  X,
} from "lucide-react";

import api from "../../services/api";

/* =========================================================================
   Constantes
=========================================================================== */

const TIPOS = Object.freeze([
  { key: "escrita", label: "Escrita" },
  { key: "oral", label: "Oral" },
]);

/* =========================================================================
   Helpers
=========================================================================== */

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function unwrap(response, fallback = null) {
  if (response && typeof response === "object" && "ok" in response && "data" in response) {
    return response.data ?? fallback;
  }

  if (
    response?.data &&
    typeof response.data === "object" &&
    "ok" in response.data &&
    "data" in response.data
  ) {
    return response.data.data ?? fallback;
  }

  return response?.data ?? response ?? fallback;
}

function getMessage(error, fallback) {
  return (
    error?.response?.data?.message ||
    error?.data?.message ||
    error?.message ||
    fallback
  );
}

function normalizarTipo(value) {
  const tipo = String(value || "").trim().toLowerCase();
  return tipo === "oral" ? "oral" : "escrita";
}

function normalizarAvaliador(row) {
  return {
    id: Number(row?.id ?? row?.avaliador_id),
    nome: row?.nome || row?.avaliador_nome || `Avaliador #${row?.id ?? row?.avaliador_id}`,
    email: row?.email || row?.avaliador_email || "",
    total_atribuicoes: Number(row?.total_atribuicoes || row?.total || 0),
    pendentes: Number(row?.pendentes || 0),
    finalizadas: Number(row?.finalizadas || 0),
  };
}

function normalizarAtribuicao(row, avaliadoresMap = new Map()) {
  const avaliadorId = Number(row?.avaliador_id ?? row?.id);
  const avaliador = avaliadoresMap.get(avaliadorId);

  return {
    id: row?.id ?? `${normalizarTipo(row?.tipo)}-${avaliadorId}`,
    avaliador_id: avaliadorId,
    nome: row?.avaliador_nome || row?.nome || avaliador?.nome || `Avaliador #${avaliadorId}`,
    email: row?.avaliador_email || row?.email || avaliador?.email || "",
    tipo: normalizarTipo(row?.tipo),
    revogado: Boolean(row?.revogado),
    criado_em: row?.criado_em || null,
    revogado_em: row?.revogado_em || null,
  };
}

function normalizarListaElegiveis(payload) {
  const data = unwrap(payload, payload);

  const rows = Array.isArray(data)
    ? data
    : Array.isArray(data?.avaliadores)
      ? data.avaliadores
      : Array.isArray(data?.itens)
        ? data.itens
        : Array.isArray(data?.rows)
          ? data.rows
          : [];

  return rows
    .map(normalizarAvaliador)
    .filter((item) => Number.isInteger(item.id) && item.id > 0)
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" }));
}

function normalizarListaAtribuicao(payload, avaliadoresMap) {
  const data = unwrap(payload, payload);

  const rows = Array.isArray(data)
    ? data
    : Array.isArray(data?.avaliadores)
      ? data.avaliadores
      : Array.isArray(data?.itens)
        ? data.itens
        : Array.isArray(data?.rows)
          ? data.rows
          : [];

  return rows
    .map((item) => normalizarAtribuicao(item, avaliadoresMap))
    .filter((item) => Number.isInteger(item.avaliador_id) && item.avaliador_id > 0);
}

/* =========================================================================
   API
=========================================================================== */

async function listarElegiveis() {
  return normalizarListaElegiveis(await api.get("/submissao/admin/avaliador/resumo"));
}

async function listarAtribuicao(submissaoId, avaliadoresMap) {
  const [escrita, oral] = await Promise.all([
    api.get(`/submissao/admin/${submissaoId}/avaliador`, {
      params: { tipo: "escrita" },
    }),
    api.get(`/submissao/admin/${submissaoId}/avaliador`, {
      params: { tipo: "oral" },
    }),
  ]);

  return [
    ...normalizarListaAtribuicao(escrita, avaliadoresMap),
    ...normalizarListaAtribuicao(oral, avaliadoresMap),
  ];
}

async function incluirAvaliador(submissaoId, avaliadorId, tipo) {
  return api.post(`/submissao/admin/${submissaoId}/avaliador`, {
    itens: [
      {
        avaliador_id: Number(avaliadorId),
        tipo: normalizarTipo(tipo),
      },
    ],
  });
}

async function revogarAvaliador(submissaoId, avaliadorId, tipo) {
  return api.delete(`/submissao/admin/${submissaoId}/avaliador`, {
    data: {
      avaliador_id: Number(avaliadorId),
      tipo: normalizarTipo(tipo),
    },
  });
}

async function restaurarAvaliador(submissaoId, avaliadorId, tipo) {
  return api.patch(`/submissao/admin/${submissaoId}/avaliador/restauracao`, {
    avaliador_id: Number(avaliadorId),
    tipo: normalizarTipo(tipo),
  });
}

/* =========================================================================
   UI
=========================================================================== */

function Badge({ children, tone = "slate", icon: Icon }) {
  const tones = {
    slate:
      "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200",
    amber:
      "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
    emerald:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200",
    rose:
      "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200",
    violet:
      "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-200",
    blue:
      "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200",
  };

  return (
    <span
      className={cx(
        "inline-flex items-center justify-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold",
        tones[tone] || tones.slate
      )}
    >
      {Icon ? <Icon className="h-3.5 w-3.5" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

function Button({
  children,
  icon: Icon,
  tone = "slate",
  loading = false,
  className = "",
  ...props
}) {
  const tones = {
    primary:
      "bg-gradient-to-r from-amber-600 via-fuchsia-600 to-emerald-600 text-white shadow-lg shadow-amber-900/20 hover:brightness-110",
    slate:
      "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800",
    emerald:
      "bg-emerald-600 text-white shadow-lg shadow-emerald-900/20 hover:bg-emerald-700",
    rose:
      "bg-rose-600 text-white shadow-lg shadow-rose-900/20 hover:bg-rose-700",
    ghost:
      "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
  };

  return (
    <button
      type="button"
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold transition",
        "focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-60",
        tones[tone],
        className
      )}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : Icon ? (
        <Icon className="h-4 w-4" aria-hidden="true" />
      ) : null}
      {children}
    </button>
  );
}

function MiniStat({ icon: Icon, label, value, tone = "slate" }) {
  const tones = {
    slate: "border-slate-200 dark:border-slate-800",
    amber: "border-amber-200 dark:border-amber-900/50",
    emerald: "border-emerald-200 dark:border-emerald-900/50",
    rose: "border-rose-200 dark:border-rose-900/50",
    violet: "border-violet-200 dark:border-violet-900/50",
  };

  return (
    <div
      className={cx(
        "rounded-3xl border bg-white p-4 shadow-sm dark:bg-slate-900/70",
        tones[tone] || tones.slate
      )}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
            {label}
          </p>
          <p className="mt-1 text-xl font-black text-slate-900 dark:text-white">
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}

function AvaliadorRow({ item, busy, onRevogar, onRestaurar }) {
  return (
    <li className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate font-black text-slate-900 dark:text-white" title={item.nome}>
              {item.nome}
            </p>

            {item.revogado ? (
              <Badge tone="rose" icon={ShieldAlert}>
                Revogado
              </Badge>
            ) : (
              <Badge tone="emerald" icon={BadgeCheck}>
                Ativo
              </Badge>
            )}
          </div>

          <p className="mt-1 truncate text-sm text-slate-500 dark:text-slate-400" title={item.email}>
            {item.email || "E-mail não informado"}
          </p>
        </div>

        <div className="flex justify-end gap-2">
          {item.revogado ? (
            <Button
              tone="emerald"
              icon={Undo2}
              loading={busy}
              onClick={() => onRestaurar(item.avaliador_id, item.tipo)}
            >
              Restaurar
            </Button>
          ) : (
            <Button
              tone="rose"
              icon={Trash2}
              loading={busy}
              onClick={() => onRevogar(item.avaliador_id, item.tipo)}
            >
              Revogar
            </Button>
          )}
        </div>
      </div>
    </li>
  );
}

/* =========================================================================
   Component
=========================================================================== */

export default function ModalAtribuirAvaliadores({
  submissaoId,
  isOpen,
  open,
  onClose,
  onChanged,
}) {
  const modalOpen = Boolean(isOpen ?? open);
  const titleId = useId();
  const descId = useId();
  const closeRef = useRef(null);
  const searchRef = useRef(null);

  const [tipo, setTipo] = useState("escrita");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");

  const [elegiveis, setElegiveis] = useState([]);
  const [atribuicoes, setAtribuicoes] = useState([]);

  const [query, setQuery] = useState("");
  const [avaliadorSelecionado, setAvaliadorSelecionado] = useState("");
  const [actionKey, setActionKey] = useState("");

  const tipoLabel = TIPOS.find((item) => item.key === tipo)?.label || tipo;

  const elegiveisMap = useMemo(
    () => new Map(elegiveis.map((item) => [Number(item.id), item])),
    [elegiveis]
  );

  const ativos = useMemo(
    () => atribuicoes.filter((item) => !item.revogado),
    [atribuicoes]
  );

  const revogados = useMemo(
    () => atribuicoes.filter((item) => item.revogado),
    [atribuicoes]
  );

  const atribuicoesDoTipo = useMemo(
    () => atribuicoes.filter((item) => item.tipo === tipo),
    [atribuicoes, tipo]
  );

  const ativosDoTipo = useMemo(
    () => atribuicoesDoTipo.filter((item) => !item.revogado),
    [atribuicoesDoTipo]
  );

  const idsDoTipo = useMemo(() => {
    const set = new Set();

    for (const item of atribuicoesDoTipo) {
      set.add(Number(item.avaliador_id));
    }

    return set;
  }, [atribuicoesDoTipo]);

  const elegiveisFiltrados = useMemo(() => {
    const term = query.trim().toLowerCase();

    return elegiveis.filter((item) => {
      const jaAtribuidoNoTipo = idsDoTipo.has(Number(item.id));

      if (jaAtribuidoNoTipo) return false;

      if (!term) return true;

      return `${item.nome} ${item.email}`.toLowerCase().includes(term);
    });
  }, [elegiveis, query, idsDoTipo]);

  const selecionadoInfo = useMemo(() => {
    const id = Number(avaliadorSelecionado);
    if (!Number.isInteger(id) || id <= 0) return null;

    return elegiveisMap.get(id) || null;
  }, [avaliadorSelecionado, elegiveisMap]);

  const carregar = useCallback(async () => {
    if (!modalOpen || !submissaoId) return;

    setLoading(true);
    setErro("");
    setMensagem("");
    setActionKey("");
    setAvaliadorSelecionado("");
    setQuery("");

    try {
      const candidatos = await listarElegiveis();
      const map = new Map(candidatos.map((item) => [Number(item.id), item]));
      const vinculados = await listarAtribuicao(submissaoId, map);

      setElegiveis(candidatos);
      setAtribuicoes(vinculados);
    } catch (error) {
      setErro(
        getMessage(
          error,
          "Não foi possível carregar avaliadores e atribuições. Verifique se existe endpoint oficial de avaliadores elegíveis."
        )
      );
      setElegiveis([]);
      setAtribuicoes([]);
    } finally {
      setLoading(false);
    }
  }, [modalOpen, submissaoId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => {
    if (!modalOpen) return undefined;

    function onKeyDown(event) {
      if (event.key === "Escape") {
        onClose?.();
      }

      const typing = ["input", "textarea", "select"].includes(
        document.activeElement?.tagName?.toLowerCase()
      );

      if (event.key === "/" && !typing) {
        event.preventDefault();
        searchRef.current?.focus?.();
      }
    }

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    window.setTimeout(() => closeRef.current?.focus?.(), 60);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [modalOpen, onClose]);

  async function recarregarSilencioso() {
    const candidatos = elegiveis.length ? elegiveis : await listarElegiveis();
    const map = new Map(candidatos.map((item) => [Number(item.id), item]));
    const vinculados = await listarAtribuicao(submissaoId, map);

    setElegiveis(candidatos);
    setAtribuicoes(vinculados);
    onChanged?.();
  }

  async function incluir() {
    const avaliadorId = Number(avaliadorSelecionado);

    if (!Number.isInteger(avaliadorId) || avaliadorId <= 0) {
      setErro("Selecione um avaliador antes de incluir.");
      return;
    }

    if (idsDoTipo.has(avaliadorId)) {
      setErro("Este avaliador já está vinculado nesta modalidade.");
      return;
    }

    setSaving(true);
    setErro("");
    setMensagem("");

    try {
      await incluirAvaliador(submissaoId, avaliadorId, tipo);
      setMensagem("Avaliador incluído com sucesso.");
      setAvaliadorSelecionado("");
      await recarregarSilencioso();
    } catch (error) {
      setErro(getMessage(error, "Não foi possível incluir o avaliador."));
    } finally {
      setSaving(false);
    }
  }

  async function revogar(avaliadorId, itemTipo) {
    const key = `revogar-${itemTipo}-${avaliadorId}`;

    setActionKey(key);
    setErro("");
    setMensagem("");

    try {
      await revogarAvaliador(submissaoId, avaliadorId, itemTipo);
      setMensagem("Avaliador revogado com sucesso.");
      await recarregarSilencioso();
    } catch (error) {
      setErro(getMessage(error, "Não foi possível revogar o avaliador."));
    } finally {
      setActionKey("");
    }
  }

  async function restaurar(avaliadorId, itemTipo) {
    const key = `restaurar-${itemTipo}-${avaliadorId}`;

    setActionKey(key);
    setErro("");
    setMensagem("");

    try {
      await restaurarAvaliador(submissaoId, avaliadorId, itemTipo);
      setMensagem("Avaliador restaurado com sucesso.");
      await recarregarSilencioso();
    } catch (error) {
      setErro(getMessage(error, "Não foi possível restaurar o avaliador."));
    } finally {
      setActionKey("");
    }
  }

  if (!modalOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
        role="presentation"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) onClose?.();
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descId}
className="flex h-[100dvh] w-full max-w-5xl flex-col overflow-hidden bg-white shadow-2xl dark:bg-slate-950 sm:h-[92dvh] sm:rounded-[2rem] sm:border sm:border-white/20"          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 30, scale: 0.98 }}
          transition={{ duration: 0.18 }}
        >
          <header className="relative overflow-hidden border-b border-white/10 bg-slate-950 p-5 text-white sm:p-6">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(245,158,11,.30),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(217,70,239,.25),transparent_35%),radial-gradient(circle_at_70%_80%,rgba(16,185,129,.22),transparent_35%)]" />

            <div className="relative flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="mb-3 flex flex-wrap gap-2">
                  <Badge tone="amber" icon={Users}>
                    Gestão de avaliadores
                  </Badge>
                  <Badge tone="violet">Submissão #{submissaoId}</Badge>
                </div>

                <h3
                  id={titleId}
                  className="flex items-center gap-2 text-xl font-black tracking-tight sm:text-2xl"
                >
                  <UserCheck className="h-5 w-5" aria-hidden="true" />
                  Atribuir avaliadores
                </h3>

                <p id={descId} className="mt-2 max-w-4xl text-sm leading-relaxed text-white/75">
                  Gerencie avaliadores de avaliação escrita e oral. Revogação não apaga histórico: apenas desativa o vínculo.
                </p>
              </div>

              <button
                type="button"
                ref={closeRef}
                onClick={onClose}
                className="rounded-2xl p-2 text-white/80 transition hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-amber-300"
                aria-label="Fechar atribuição de avaliadores"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </header>

          <div aria-live="polite" className="sr-only">
            {loading ? "Carregando avaliadores." : erro ? erro : mensagem}
          </div>

          {loading ? (
            <div className="flex min-h-[320px] items-center justify-center bg-slate-50 p-8 dark:bg-slate-950">
              <div className="rounded-[2rem] border border-slate-200 bg-white p-8 text-center shadow-xl dark:border-slate-800 dark:bg-slate-900">
                <Loader2 className="mx-auto h-8 w-8 animate-spin text-amber-600" />
                <p className="mt-4 text-sm font-semibold text-slate-600 dark:text-slate-300">
                  Carregando avaliadores...
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto bg-slate-50 p-4 dark:bg-slate-950 sm:p-6">
                {erro ? (
                  <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
                    <div className="flex gap-2">
                      <AlertCircle className="mt-0.5 h-4 w-4 flex-none" />
                      <span>{erro}</span>
                    </div>
                  </div>
                ) : null}

                {mensagem ? (
                  <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
                    <div className="flex gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none" />
                      <span>{mensagem}</span>
                    </div>
                  </div>
                ) : null}

                <div className="grid gap-3 sm:grid-cols-3">
                  <MiniStat icon={BadgeCheck} label="Ativos" value={ativos.length} tone="emerald" />
                  <MiniStat icon={Users} label={`Ativos em ${tipoLabel}`} value={ativosDoTipo.length} tone="amber" />
                  <MiniStat icon={ShieldAlert} label="Revogados" value={revogados.length} tone="rose" />
                </div>

                <div className="mt-6 grid gap-6 lg:grid-cols-[360px_1fr]">
                  <aside className="space-y-4">
                    <section className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
                      <h4 className="mb-4 font-black text-slate-900 dark:text-white">
                        Modalidade
                      </h4>

                      <div
                        role="tablist"
                        aria-label="Modalidades de avaliação"
                        className="grid grid-cols-2 gap-2"
                      >
                        {TIPOS.map((item) => {
                          const active = tipo === item.key;

                          return (
                            <button
                              key={item.key}
                              type="button"
                              role="tab"
                              aria-selected={active}
                              onClick={() => {
                                setTipo(item.key);
                                setAvaliadorSelecionado("");
                                setErro("");
                                setMensagem("");
                              }}
                              className={cx(
                                "rounded-2xl border px-4 py-3 text-sm font-black transition focus:outline-none focus:ring-2 focus:ring-amber-500",
                                active
                                  ? "border-amber-600 bg-amber-600 text-white"
                                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
                              )}
                            >
                              {item.label}
                            </button>
                          );
                        })}
                      </div>
                    </section>

                    <section className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
                      <h4 className="mb-4 font-black text-slate-900 dark:text-white">
                        Incluir avaliador
                      </h4>

                      <label className="block">
                        <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-400">
                          Buscar
                        </span>

                        <div className="relative">
                          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <input
                            ref={searchRef}
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="Nome ou e-mail..."
                            className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 text-sm outline-none transition focus:ring-2 focus:ring-amber-500 dark:border-slate-700 dark:bg-slate-950"
                          />
                        </div>
                      </label>

                      <label className="mt-3 block">
                        <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-400">
                          Selecionar para {tipoLabel}
                        </span>

                        <select
                          value={avaliadorSelecionado}
                          onChange={(event) => setAvaliadorSelecionado(event.target.value)}
                          className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:ring-2 focus:ring-amber-500 dark:border-slate-700 dark:bg-slate-950"
                        >
                          <option value="">Selecione...</option>
                          {elegiveisFiltrados.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.nome} — {item.email || "sem e-mail"}
                            </option>
                          ))}
                        </select>
                      </label>

                      {selecionadoInfo ? (
                        <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                          <p className="font-black">{selecionadoInfo.nome}</p>
                          <p className="mt-1 text-xs">{selecionadoInfo.email || "E-mail não informado"}</p>
                        </div>
                      ) : null}

                      <Button
                        tone="primary"
                        icon={PlusCircle}
                        loading={saving}
                        disabled={!avaliadorSelecionado}
                        onClick={incluir}
                        className="mt-4 w-full"
                      >
                        Incluir em {tipoLabel}
                      </Button>
                    </section>
                  </aside>

                  <section className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
                    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h4 className="font-black text-slate-900 dark:text-white">
                          Atribuídos em {tipoLabel}
                        </h4>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                          {atribuicoesDoTipo.length} vínculo(s) nesta modalidade.
                        </p>
                      </div>

                      <Button tone="slate" icon={RotateCcw} onClick={carregar}>
                        Recarregar
                      </Button>
                    </div>

                    {atribuicoesDoTipo.length === 0 ? (
                      <div className="rounded-3xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                        Nenhum avaliador atribuído nesta modalidade.
                      </div>
                    ) : (
                      <ul className="space-y-3">
                        {atribuicoesDoTipo.map((item) => {
                          const keyRevogar = `revogar-${item.tipo}-${item.avaliador_id}`;
                          const keyRestaurar = `restaurar-${item.tipo}-${item.avaliador_id}`;
                          const busy = actionKey === keyRevogar || actionKey === keyRestaurar;

                          return (
                            <AvaliadorRow
                              key={`${item.tipo}-${item.avaliador_id}`}
                              item={item}
                              busy={busy}
                              onRevogar={revogar}
                              onRestaurar={restaurar}
                            />
                          );
                        })}
                      </ul>
                    )}
                  </section>
                </div>
              </div>

              <footer className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950 sm:flex-row sm:items-center sm:justify-end">
                <Button tone="ghost" onClick={onClose}>
                  Fechar
                </Button>
                <Button tone="slate" icon={RotateCcw} onClick={carregar}>
                  Recarregar
                </Button>
              </footer>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

ModalAtribuirAvaliadores.propTypes = {
  submissaoId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  isOpen: PropTypes.bool,
  open: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
  onChanged: PropTypes.func,
};