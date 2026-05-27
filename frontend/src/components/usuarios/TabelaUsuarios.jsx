// ✅ frontend/src/components/usuarios/TabelaUsuarios.jsx — v2.0
/* eslint-disable no-console */
/**
 * Plataforma Escola da Saúde
 *
 * Lista premium de usuários para gestão administrativa.
 *
 * Contrato oficial:
 * - perfil é string única: usuario | organizador | administrador
 * - sem role/roles/perfis/perfil_id/perfilObj
 * - campos exibidos em snake_case ou campos já normalizados pela página:
 *   - unidade_nome / unidade_sigla
 *   - cargo_nome
 *   - escolaridade_nome
 *   - deficiencia_nome
 *   - idade
 *   - cursos_concluidos_75
 *   - certificados_emitidos
 *
 * Segurança:
 * - CPF oculto por padrão.
 * - Revelação de CPF delegada ao componente pai.
 */

import { useMemo, useState } from "react";
import PropTypes from "prop-types";
import {
  Accessibility,
  Award,
  Briefcase,
  Building2,
  CalendarClock,
  ChevronDown,
  ChevronRight,
  GraduationCap,
  Hash,
  IdCard,
  Loader2,
  Mail,
  Pencil,
  Shield,
  UserRound,
} from "lucide-react";

/* ─────────────────────────────────────────────────────────────
   Contrato oficial
────────────────────────────────────────────────────────────── */

const PERFIS_OFICIAIS = new Set(["usuario", "organizador", "administrador"]);

const PERFIL_LABEL = {
  usuario: "Usuário",
  organizador: "organizador",
  administrador: "Administrador",
};

/* ─────────────────────────────────────────────────────────────
   Helpers
────────────────────────────────────────────────────────────── */

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function onlyDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function formatValue(value) {
  return value === null || value === undefined || value === "" ? "—" : String(value);
}

function initials(name = "") {
  return (
    String(name || "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "?"
  );
}

function perfilOficial(value) {
  const perfil = String(value || "").trim();

  return PERFIS_OFICIAIS.has(perfil) ? perfil : "";
}

function perfilLabel(value) {
  const perfil = perfilOficial(value);

  return PERFIL_LABEL[perfil] || "Perfil não informado";
}

function perfilBadgeClass(perfil) {
  const p = perfilOficial(perfil);

  if (p === "administrador") {
    return "bg-violet-500/12 text-violet-950 ring-1 ring-violet-700/20 dark:bg-violet-400/10 dark:text-violet-100 dark:ring-violet-300/20";
  }

  if (p === "organizador") {
    return "bg-teal-500/12 text-teal-950 ring-1 ring-teal-700/20 dark:bg-teal-400/10 dark:text-teal-100 dark:ring-teal-300/20";
  }

  if (p === "usuario") {
    return "bg-zinc-200/70 text-zinc-900 ring-1 ring-black/10 dark:bg-white/10 dark:text-zinc-100 dark:ring-white/15";
  }

  return "bg-amber-500/12 text-amber-950 ring-1 ring-amber-700/20 dark:bg-amber-400/10 dark:text-amber-100 dark:ring-amber-300/20";
}

function maskCpfDefault(cpf, revealed) {
  const digits = onlyDigits(cpf);

  if (digits.length !== 11) {
    return cpf ? String(cpf) : "—";
  }

  const formatted = digits.replace(
    /^(\d{3})(\d{3})(\d{3})(\d{2})$/,
    "$1.$2.$3-$4"
  );

  if (revealed) return formatted;

  return digits.replace(/^(\d{3})\d{3}(\d{3})\d{2}$/, "$1.***.$2-**");
}

function calcIdadeSafe(nascimento) {
  if (!nascimento) return null;

  const ymd = String(nascimento || "")
    .trim()
    .slice(0, 10);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;

  const [anoRaw, mesRaw, diaRaw] = ymd.split("-");
  const ano = Number(anoRaw);
  const mes = Number(mesRaw);
  const dia = Number(diaRaw);

  if (
    !Number.isSafeInteger(ano) ||
    !Number.isSafeInteger(mes) ||
    !Number.isSafeInteger(dia)
  ) {
    return null;
  }

  const hoje = new Date();
  let idade = hoje.getFullYear() - ano;
  const diffMes = hoje.getMonth() + 1 - mes;

  if (diffMes < 0 || (diffMes === 0 && hoje.getDate() < dia)) {
    idade -= 1;
  }

  return Number.isFinite(idade) && idade >= 0 ? idade : null;
}

/* ─────────────────────────────────────────────────────────────
   Componentes locais
────────────────────────────────────────────────────────────── */

function Pill({ Icon, label, value, title, tone = "violet" }) {
  const toneCls =
    tone === "emerald"
      ? "border-emerald-200/70 bg-emerald-50 text-emerald-950 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-100"
      : tone === "amber"
        ? "border-amber-200/70 bg-amber-50 text-amber-950 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100"
        : "border-violet-200/70 bg-violet-50 text-violet-950 dark:border-violet-500/20 dark:bg-violet-500/10 dark:text-violet-100";

  return (
    <div
      className={cx("inline-flex items-center gap-2 rounded-2xl border px-3 py-2", toneCls)}
      role="group"
      aria-label={label}
      title={title || label}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      <div className="text-left leading-tight">
        <div className="text-[11px] opacity-80">{label}</div>
        <div className="text-[15px] font-extrabold tabular-nums">{value}</div>
      </div>
    </div>
  );
}

function IconMeta({ Icon, label, value, children }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Icon
        className="h-4 w-4 shrink-0 text-zinc-500 dark:text-zinc-300"
        aria-hidden="true"
      />
      <div className="min-w-0">
        <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
          {label}
        </div>
        <div className="break-words text-sm font-semibold text-zinc-800 dark:text-zinc-100">
          {children ?? value}
        </div>
      </div>
    </div>
  );
}

function SkeletonUsuarioCard() {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-zinc-200 bg-white/70 p-5 dark:border-white/10 dark:bg-zinc-900/45">
      <div className="-mx-5 -mt-5 mb-4 h-1.5 w-full bg-gradient-to-r from-violet-600/30 via-fuchsia-600/25 to-indigo-600/20" />

      <div
        className="pointer-events-none absolute inset-0 translate-x-[-100%] bg-[linear-gradient(110deg,transparent,rgba(255,255,255,0.55),transparent)] motion-safe:animate-[shimmer_1.6s_infinite]"
        aria-hidden="true"
      />

      <div className="flex gap-3">
        <div className="h-12 w-12 animate-pulse rounded-2xl bg-zinc-200/70 dark:bg-white/10" />
        <div className="flex-1">
          <div className="h-5 w-56 animate-pulse rounded-xl bg-zinc-200/70 dark:bg-white/10" />
          <div className="mt-2 h-4 w-72 animate-pulse rounded-xl bg-zinc-200/60 dark:bg-white/10" />
          <div className="mt-3 h-6 w-52 animate-pulse rounded-full bg-zinc-200/60 dark:bg-white/10" />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="h-14 animate-pulse rounded-2xl bg-zinc-100/80 dark:bg-white/5"
          />
        ))}
      </div>

      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}

function UsuarioItem({
  usuario,
  onEditar,
  onToggleCpf,
  isCpfRevealed,
  maskCpfFn,
  onCarregarResumo,
  isResumoLoading,
  hasResumo,
}) {
  const [expanded, setExpanded] = useState(false);

  const id = usuario?.id;
  const key = String(usuario?.id ?? usuario?.email ?? usuario?.cpf ?? "usuario");
  const nome = usuario?.nome || "—";
  const email = usuario?.email || "—";

  const perfil = perfilOficial(usuario?.perfil);
  const perfilText = perfilLabel(perfil);

  const revealed =
    typeof isCpfRevealed === "function" && id !== undefined && id !== null
      ? !!isCpfRevealed(id)
      : false;

  const cpfRender = (maskCpfFn || maskCpfDefault)(usuario?.cpf, revealed);

  const registro = formatValue(usuario?.registro);

  const idade =
    usuario?.idade ?? calcIdadeSafe(usuario?.data_nascimento) ?? "—";

  const unidade = formatValue(
    usuario?.unidade_sigla || usuario?.unidade_nome || usuario?.unidade_id
  );

  const cargo = formatValue(usuario?.cargo_nome || usuario?.cargo_id);
  const escolaridade = formatValue(
    usuario?.escolaridade_nome || usuario?.escolaridade_id
  );
  const deficiencia = formatValue(
    usuario?.deficiencia_nome || usuario?.deficiencia_id
  );

  const temResumo =
    typeof hasResumo === "function" && id !== undefined && id !== null
      ? !!hasResumo(id)
      : false;

  const carregandoResumo =
    typeof isResumoLoading === "function" && id !== undefined && id !== null
      ? !!isResumoLoading(id)
      : false;

  const concluidos75 = temResumo
    ? Number(usuario?.cursos_concluidos_75 ?? 0)
    : "—";

  const certificados = temResumo
    ? Number(usuario?.certificados_emitidos ?? 0)
    : "—";

  function toggleExpand() {
    const abrir = !expanded;
    setExpanded(abrir);

    if (
      abrir &&
      !temResumo &&
      typeof onCarregarResumo === "function" &&
      !carregandoResumo &&
      id !== undefined &&
      id !== null
    ) {
      onCarregarResumo(id);
    }
  }

  const Chevron = expanded ? ChevronDown : ChevronRight;

  return (
    <article
      className={cx(
        "group relative overflow-hidden rounded-3xl border",
        "border-zinc-200 bg-white/70 shadow-[0_18px_55px_-40px_rgba(2,6,23,0.22)] ring-1 ring-black/5",
        "dark:border-white/10 dark:bg-zinc-900/45 dark:ring-white/10",
        "supports-[backdrop-filter]:backdrop-blur"
      )}
      aria-label={`Usuário: ${nome}`}
    >
      <div
        className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-violet-600 via-fuchsia-600 to-indigo-600 opacity-80"
        aria-hidden="true"
      />

      <div
        className="pointer-events-none absolute inset-x-0 -top-6 h-16 bg-[radial-gradient(closest-side,rgba(168,85,247,0.20),transparent)] blur-2xl"
        aria-hidden="true"
      />

      <div className="p-4 sm:p-5">
        <div className="flex items-start gap-3 sm:gap-4">
          <div
            aria-hidden="true"
            className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-indigo-600 to-fuchsia-600 font-extrabold text-white shadow-sm"
          >
            {initials(nome)}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-col gap-2">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h2 className="flex min-w-0 items-center gap-2 text-base font-extrabold text-zinc-900 dark:text-white sm:text-lg">
                    <UserRound
                      className="h-4 w-4 shrink-0 text-zinc-500 dark:text-zinc-300"
                      aria-hidden="true"
                    />
                    <span className="truncate">{nome}</span>

                    {id !== null && id !== undefined ? (
                      <span
                        className="ml-1 inline-flex shrink-0 items-center rounded-full bg-zinc-100 px-2 py-0.5 font-mono text-[11px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-200"
                        title={`ID do usuário: ${id}`}
                        aria-label={`ID do usuário: ${id}`}
                      >
                        ID: {id}
                      </span>
                    ) : null}
                  </h2>

                  <div className="mt-1 flex items-center gap-2 text-sm">
                    <Mail
                      className="h-4 w-4 text-zinc-500 dark:text-zinc-300"
                      aria-hidden="true"
                    />
                    {email && email !== "—" ? (
                      <a
                        href={`mailto:${email}`}
                        className="break-all text-zinc-700 underline-offset-2 hover:underline dark:text-zinc-200"
                        title={`Enviar e-mail para ${nome}`}
                      >
                        {email}
                      </a>
                    ) : (
                      <span className="text-zinc-500 dark:text-zinc-400">—</span>
                    )}
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="sr-only">Perfil:</span>
                    <span
                      className={cx(
                        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-extrabold",
                        perfilBadgeClass(perfil)
                      )}
                      title={`Perfil: ${perfilText}`}
                      role="status"
                      aria-label={`Perfil: ${perfilText}`}
                    >
                      <Shield className="h-3.5 w-3.5" aria-hidden="true" />
                      {perfilText}
                    </span>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={toggleExpand}
                    className={cx(
                      "inline-flex items-center gap-1.5 rounded-2xl border px-3 py-2 text-sm font-extrabold transition",
                      "border-zinc-200 bg-white hover:bg-zinc-50",
                      "dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10",
                      "focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60"
                    )}
                    aria-expanded={expanded ? "true" : "false"}
                    aria-controls={`detalhes-${key}`}
                    title={expanded ? "Recolher detalhes" : "Ver detalhes"}
                  >
                    <Chevron className="h-4 w-4" aria-hidden="true" />
                    Detalhes
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      typeof onEditar === "function" ? onEditar(usuario) : undefined
                    }
                    className={cx(
                      "inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-extrabold text-white transition",
                      "bg-teal-600 hover:bg-teal-700",
                      "focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/60"
                    )}
                    aria-label={`Editar usuário ${nome}`}
                    title="Editar usuário"
                  >
                    <Pencil size={16} aria-hidden="true" />
                    Editar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50/60 px-3 py-2 dark:border-white/10 dark:bg-white/5">
            <IconMeta Icon={IdCard} label="CPF" value={cpfRender}>
              <div className="flex items-center gap-2">
                <span className="font-mono tabular-nums">{cpfRender}</span>
                {typeof onToggleCpf === "function" &&
                typeof isCpfRevealed === "function" &&
                id !== undefined &&
                id !== null ? (
                  <button
                    type="button"
                    onClick={() => onToggleCpf(id)}
                    className="text-xs font-extrabold text-zinc-600 underline underline-offset-2 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white"
                    aria-label={revealed ? "Ocultar CPF" : "Revelar CPF"}
                    title={revealed ? "Ocultar CPF" : "Revelar CPF"}
                  >
                    {revealed ? "ocultar" : "revelar"}
                  </button>
                ) : null}
              </div>
            </IconMeta>
          </div>

          <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50/60 px-3 py-2 dark:border-white/10 dark:bg-white/5">
            <IconMeta Icon={Hash} label="Registro" value={registro} />
          </div>

          <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50/60 px-3 py-2 dark:border-white/10 dark:bg-white/5">
            <IconMeta Icon={CalendarClock} label="Idade" value={idade} />
          </div>

          <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50/60 px-3 py-2 dark:border-white/10 dark:bg-white/5">
            <IconMeta Icon={Building2} label="Unidade" value={unidade} />
          </div>

          <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50/60 px-3 py-2 dark:border-white/10 dark:bg-white/5">
            <IconMeta Icon={Briefcase} label="Cargo" value={cargo} />
          </div>

          <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50/60 px-3 py-2 dark:border-white/10 dark:bg-white/5">
            <IconMeta Icon={GraduationCap} label="Escolaridade" value={escolaridade} />
          </div>

          <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50/60 px-3 py-2 dark:border-white/10 dark:bg-white/5 lg:col-span-2">
            <IconMeta Icon={Accessibility} label="Deficiência" value={deficiencia} />
          </div>
        </div>

        {expanded ? (
          <div
            id={`detalhes-${key}`}
            className="mt-4 rounded-2xl border border-zinc-200 bg-white/60 p-3 dark:border-white/10 dark:bg-white/5 sm:p-4"
          >
            {carregandoResumo ? (
              <div
                className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300"
                aria-live="polite"
              >
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Carregando indicadores…
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Pill
                  Icon={GraduationCap}
                  label="Cursos ≥ 75%"
                  value={concluidos75}
                  tone="violet"
                />
                <Pill
                  Icon={Award}
                  label="Certificados emitidos"
                  value={certificados}
                  tone="amber"
                />
              </div>
            )}
          </div>
        ) : null}
      </div>
    </article>
  );
}

/* ─────────────────────────────────────────────────────────────
   Lista
────────────────────────────────────────────────────────────── */

export default function TabelaUsuarios({
  usuarios = [],
  onEditar = () => {},
  className = "",
  onToggleCpf,
  isCpfRevealed,
  maskCpfFn,
  loading = false,
  onCarregarResumo,
  isResumoLoading,
  hasResumo,
  "data-testid": testId,
}) {
  const lista = useMemo(() => (Array.isArray(usuarios) ? usuarios : []), [usuarios]);

  if (loading) {
    return (
      <ul
        className={cx("mx-auto max-w-6xl space-y-4", className)}
        role="status"
        aria-busy="true"
        aria-label="Carregando usuários"
        data-testid={testId}
      >
        {Array.from({ length: 6 }).map((_, index) => (
          <li key={index}>
            <SkeletonUsuarioCard />
          </li>
        ))}
      </ul>
    );
  }

  if (!lista.length) {
    return (
      <div
        className={cx(
          "mx-auto mt-2 max-w-5xl rounded-2xl border p-4 text-center",
          "border-zinc-200 bg-white/70 dark:border-white/10 dark:bg-zinc-900/40",
          className
        )}
        aria-live="polite"
        data-testid={testId}
      >
        <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
          Nenhum usuário encontrado.
        </p>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Tente ajustar os filtros e pesquisar novamente.
        </p>
      </div>
    );
  }

  return (
    <ul
      className={cx("mx-auto max-w-6xl space-y-4", className)}
      role="list"
      aria-label="Lista de usuários"
      data-testid={testId}
    >
      {lista.map((usuario, index) => {
        const key = usuario?.id ?? usuario?.email ?? usuario?.cpf ?? index;

        return (
          <li key={key}>
            <UsuarioItem
              usuario={usuario}
              onEditar={onEditar}
              onToggleCpf={onToggleCpf}
              isCpfRevealed={isCpfRevealed}
              maskCpfFn={maskCpfFn}
              onCarregarResumo={onCarregarResumo}
              isResumoLoading={isResumoLoading}
              hasResumo={hasResumo}
            />
          </li>
        );
      })}
    </ul>
  );
}

/* ─────────────────────────────────────────────────────────────
   PropTypes
────────────────────────────────────────────────────────────── */

Pill.propTypes = {
  Icon: PropTypes.elementType.isRequired,
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  title: PropTypes.string,
  tone: PropTypes.oneOf(["violet", "emerald", "amber"]),
};

UsuarioItem.propTypes = {
  usuario: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    nome: PropTypes.string,
    email: PropTypes.string,
    cpf: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    registro: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    data_nascimento: PropTypes.string,
    idade: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    unidade_id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    unidade_nome: PropTypes.string,
    unidade_sigla: PropTypes.string,
    cargo_id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    cargo_nome: PropTypes.string,
    escolaridade_id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    escolaridade_nome: PropTypes.string,
    deficiencia_id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    deficiencia_nome: PropTypes.string,
    cursos_concluidos_75: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    certificados_emitidos: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    perfil: PropTypes.string,
  }).isRequired,
  onEditar: PropTypes.func,
  onToggleCpf: PropTypes.func,
  isCpfRevealed: PropTypes.func,
  maskCpfFn: PropTypes.func,
  onCarregarResumo: PropTypes.func,
  isResumoLoading: PropTypes.func,
  hasResumo: PropTypes.func,
};

TabelaUsuarios.propTypes = {
  usuarios: PropTypes.arrayOf(UsuarioItem.propTypes.usuario).isRequired,
  onEditar: PropTypes.func,
  className: PropTypes.string,
  onToggleCpf: PropTypes.func,
  isCpfRevealed: PropTypes.func,
  maskCpfFn: PropTypes.func,
  loading: PropTypes.bool,
  onCarregarResumo: PropTypes.func,
  isResumoLoading: PropTypes.func,
  hasResumo: PropTypes.func,
  "data-testid": PropTypes.string,
};