// 📁 src/components/TabelaUsuarios.jsx
import { useMemo, useState, useCallback } from "react";
import PropTypes from "prop-types";
import {
  Pencil,
  Mail,
  Shield,
  GraduationCap,
  Award,
  IdCard,
  Hash,
  Building2,
  Briefcase,
  Accessibility,
  CalendarClock,
  UserRound,
  ChevronDown,
  ChevronRight,
  Loader2,
} from "lucide-react";

/* ===========================
   Normalização de perfis
=========================== */
const PERFIS_MAP = { 1: "administrador", 2: "instrutor", 3: "usuario" };

function normalizePerfilItem(raw) {
  if (raw == null) return null;

  if (typeof raw === "object") {
    if (typeof raw.nome === "string") return raw.nome.trim();
    if (typeof raw.descricao === "string") return raw.descricao.trim();
    if (typeof raw.label === "string") return raw.label.trim();
    if (typeof raw.value === "string") return raw.value.trim();
    if (typeof raw.id === "number" && PERFIS_MAP[raw.id]) return PERFIS_MAP[raw.id];
    return String(raw).trim();
  }

  if (typeof raw === "number" && PERFIS_MAP[raw]) return PERFIS_MAP[raw];
  if (typeof raw === "string") return raw.trim();

  return String(raw).trim();
}

function splitPossiblyCommaSeparated(str) {
  if (typeof str !== "string") return [str];
  return str.split(/[;,]/).map((s) => s.trim()).filter(Boolean);
}

function extractPerfis(usuario) {
  const fontes = [
    usuario?.perfil,
    usuario?.perfis,
    usuario?.role,
    usuario?.roles,
    usuario?.perfil_id,
    usuario?.perfilObj,
  ];

  const itens = [];
  for (const fonte of fontes) {
    if (fonte == null) continue;

    if (Array.isArray(fonte)) {
      for (const f of fonte) {
        const val = normalizePerfilItem(f);
        if (val != null) {
          if (typeof val === "string" && /[,;]/.test(val)) itens.push(...splitPossiblyCommaSeparated(val));
          else itens.push(val);
        }
      }
    } else {
      const val = normalizePerfilItem(fonte);
      if (val != null) {
        if (typeof val === "string" && /[,;]/.test(val)) itens.push(...splitPossiblyCommaSeparated(val));
        else itens.push(val);
      }
    }
  }

  const set = new Set(itens.map((s) => String(s).trim().toLowerCase()).filter(Boolean));
  return Array.from(set).map((p) => p.charAt(0).toUpperCase() + p.slice(1));
}

/* ===========================
   UI helpers
=========================== */
function cx(...arr) {
  return arr.filter(Boolean).join(" ");
}

const F = (v) => (v === null || v === undefined || v === "" ? "—" : String(v));

const initials = (name = "") =>
  String(name || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("") || "?";

function perfilBadgeClass(perfil) {
  const p = String(perfil || "").toLowerCase();
  if (p.includes("admin"))
    return "bg-violet-500/12 text-violet-950 ring-1 ring-violet-700/20 dark:bg-violet-400/10 dark:text-violet-100 dark:ring-violet-300/20";
  if (p.includes("instrutor"))
    return "bg-teal-500/12 text-teal-950 ring-1 ring-teal-700/20 dark:bg-teal-400/10 dark:text-teal-100 dark:ring-teal-300/20";
  if (p.includes("gestor"))
    return "bg-rose-500/12 text-rose-950 ring-1 ring-rose-700/20 dark:bg-rose-400/10 dark:text-rose-100 dark:ring-rose-300/20";
  return "bg-zinc-200/70 text-zinc-900 ring-1 ring-black/10 dark:bg-white/10 dark:text-zinc-100 dark:ring-white/15";
}

/* CPF seguro (default) */
const maskCpfDefault = (cpf, revealed) => {
  const d = String(cpf || "").replace(/\D/g, "");
  if (d.length !== 11) return cpf ? String(cpf) : "—";
  const fmt = d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  if (revealed) return fmt;
  return fmt.replace(/^\d{3}\.\d{3}\.\d{3}/, "***.***.***").replace(/\d{2}$/, "**");
};

/**
 * Idade sem timezone-bug:
 * - Se vier "YYYY-MM-DD" usamos parsing manual (sem new Date("YYYY-MM-DD"))
 * - Se vier Date/ISO com hora, cai no Date normalmente.
 */
function calcIdadeSafe(nasc) {
  if (!nasc) return null;

  // string YYYY-MM-DD
  if (typeof nasc === "string") {
    const s = nasc.includes("T") ? nasc.split("T")[0] : nasc;
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) {
      const y = Number(m[1]);
      const mo = Number(m[2]);
      const d = Number(m[3]);
      if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;

      const today = new Date();
      let a = today.getFullYear() - y;
      const mm = (today.getMonth() + 1) - mo;
      if (mm < 0 || (mm === 0 && today.getDate() < d)) a--;
      return a >= 0 ? a : null;
    }

    // fallback (se veio outra string)
    const dt = new Date(nasc);
    if (Number.isNaN(dt.getTime())) return null;
    return calcIdadeSafe(dt);
  }

  if (nasc instanceof Date) {
    if (Number.isNaN(nasc.getTime())) return null;
    const today = new Date();
    let a = today.getFullYear() - nasc.getFullYear();
    const m = today.getMonth() - nasc.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < nasc.getDate())) a--;
    return a >= 0 ? a : null;
  }

  return null;
}

/* Pill chip */
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
    <div className="flex items-center gap-2 min-w-0">
      <Icon className="h-4 w-4 text-zinc-500 dark:text-zinc-300 shrink-0" aria-hidden="true" />
      <div className="min-w-0">
        <div className="text-[11px] text-zinc-500 dark:text-zinc-400">{label}</div>
        <div className="text-sm font-semibold text-zinc-800 dark:text-zinc-100 break-words">
          {children ?? value}
        </div>
      </div>
    </div>
  );
}

/* ===========================
   Item (subcomponente)
=========================== */
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

  const perfis = useMemo(() => extractPerfis(usuario), [usuario]);
  const key = String(usuario?.id ?? usuario?.email ?? Math.random());
  const nome = usuario?.nome || "—";
  const email = usuario?.email || "—";
  const id = usuario?.id;

  const revealed = typeof isCpfRevealed === "function" ? !!isCpfRevealed(id) : false;
  const cpfRender = (maskCpfFn || maskCpfDefault)(usuario?.cpf, revealed);

  const registro = F(usuario?.registro);

  const idadeDireta = usuario?.idade;
  const idadeCalc = calcIdadeSafe(usuario?.data_nascimento);
  const idade = idadeDireta ?? (idadeCalc ?? "—");

  const unidade = F(usuario?.unidade_nome ?? usuario?.unidade ?? usuario?.unidade_id);
  const escolaridade = F(usuario?.escolaridade_nome ?? usuario?.escolaridade ?? usuario?.escolaridade_id);
  const cargo = F(usuario?.cargo_nome ?? usuario?.cargo ?? usuario?.cargo_id);
  const deficiencia = F(usuario?.deficiencia_nome ?? usuario?.deficiencia ?? usuario?.deficiencia_id);

  const temResumo = typeof hasResumo === "function" ? !!hasResumo(id) : false;
  const carregandoResumo = typeof isResumoLoading === "function" ? !!isResumoLoading(id) : false;

  const concluidos75 = temResumo ? Number(usuario?.cursos_concluidos_75 ?? 0) : "—";
  const certificados = temResumo ? Number(usuario?.certificados_emitidos ?? 0) : "—";

  const toggleExpand = () => {
    const abrir = !expanded;
    setExpanded(abrir);

    if (abrir && !temResumo && typeof onCarregarResumo === "function" && !carregandoResumo) {
      onCarregarResumo(id);
    }
  };

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
      {/* top accent */}
      <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-violet-600 via-fuchsia-600 to-indigo-600 opacity-80" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-x-0 -top-6 h-16 bg-[radial-gradient(closest-side,rgba(168,85,247,0.20),transparent)] blur-2xl" aria-hidden="true" />

      <div className="p-4 sm:p-5">
        {/* Cabeçalho */}
        <div className="flex items-start gap-3 sm:gap-4">
          {/* Avatar */}
          <div
            aria-hidden="true"
            className="shrink-0 grid place-items-center h-12 w-12 rounded-2xl bg-gradient-to-br from-indigo-600 to-fuchsia-600 text-white font-extrabold shadow-sm"
          >
            {initials(nome)}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-col gap-2">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="text-base sm:text-lg font-extrabold text-zinc-900 dark:text-white flex items-center gap-2 min-w-0">
                    <UserRound className="h-4 w-4 text-zinc-500 dark:text-zinc-300 shrink-0" aria-hidden="true" />
                    <span className="truncate">{nome}</span>

                    {id != null && (
                      <span
                        className="ml-1 inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-mono text-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 shrink-0"
                        title={`ID do usuário: ${id}`}
                        aria-label={`ID do usuário: ${id}`}
                      >
                        ID: {id}
                      </span>
                    )}
                  </h2>

                  <div className="mt-1 flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-zinc-500 dark:text-zinc-300" aria-hidden="true" />
                    {email && email !== "—" ? (
                      <a
                        href={`mailto:${email}`}
                        className="text-zinc-700 dark:text-zinc-200 break-all underline-offset-2 hover:underline"
                        title={`Enviar e-mail para ${nome}`}
                      >
                        {email}
                      </a>
                    ) : (
                      <span className="text-zinc-500 dark:text-zinc-400">—</span>
                    )}
                  </div>

                  {/* Perfis */}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="sr-only">Perfis:</span>
                    {perfis.length ? (
                      perfis.map((p) => (
                        <span
                          key={p}
                          className={cx(
                            "text-xs font-extrabold rounded-full px-2.5 py-1 inline-flex items-center gap-1.5",
                            perfilBadgeClass(p)
                          )}
                          title={`Perfil: ${p}`}
                          role="status"
                          aria-label={`Perfil: ${p}`}
                        >
                          <Shield className="h-3.5 w-3.5" aria-hidden="true" />
                          {p}
                        </span>
                      ))
                    ) : (
                      <span className="italic text-zinc-500 dark:text-zinc-400 text-sm">Sem perfis</span>
                    )}
                  </div>
                </div>

                {/* Ações */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={toggleExpand}
                    className={cx(
                      "inline-flex items-center gap-1.5 px-3 py-2 rounded-2xl border text-sm font-extrabold transition",
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
                    onClick={() => typeof onEditar === "function" && onEditar(usuario)}
                    className={cx(
                      "inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-extrabold text-white transition",
                      "bg-teal-600 hover:bg-teal-700",
                      "focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/60"
                    )}
                    aria-label={`Editar perfil de ${nome}`}
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

        {/* Dados básicos (sempre visíveis) */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50/60 px-3 py-2 dark:border-white/10 dark:bg-white/5">
            <IconMeta Icon={IdCard} label="CPF" value={cpfRender}>
              <div className="flex items-center gap-2">
                <span className="font-mono tabular-nums">{cpfRender}</span>
                {typeof onToggleCpf === "function" && typeof isCpfRevealed === "function" && (
                  <button
                    type="button"
                    onClick={() => onToggleCpf(id)}
                    className="text-xs font-extrabold underline underline-offset-2 text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white"
                    aria-label={revealed ? "Ocultar CPF" : "Revelar CPF"}
                    title={revealed ? "Ocultar CPF" : "Revelar CPF"}
                  >
                    {revealed ? "ocultar" : "revelar"}
                  </button>
                )}
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

        {/* Detalhes (lazy) */}
        {expanded && (
          <div
            id={`detalhes-${key}`}
            className="mt-4 rounded-2xl border border-zinc-200 dark:border-white/10 bg-white/60 dark:bg-white/5 p-3 sm:p-4"
          >
            {carregandoResumo ? (
              <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300" aria-live="polite">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Carregando indicadores…
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Pill Icon={GraduationCap} label="Cursos ≥ 75%" value={concluidos75} tone="violet" />
                <Pill Icon={Award} label="Certificados emitidos" value={certificados} tone="amber" />
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

/* ===========================
   Lista (TabelaUsuarios)
=========================== */
export default function TabelaUsuarios({
  usuarios = [],
  onEditar = () => {},
  className = "",
  onToggleCpf,
  isCpfRevealed,
  maskCpfFn,
  loading = false,

  // lazy resumo
  onCarregarResumo,
  isResumoLoading,
  hasResumo,

  "data-testid": testId,
}) {
  const lista = useMemo(() => (Array.isArray(usuarios) ? usuarios : []), [usuarios]);

  if (loading) {
    return (
      <ul
        className={cx("space-y-4 max-w-6xl mx-auto", className)}
        role="status"
        aria-busy="true"
        aria-label="Carregando usuários"
        data-testid={testId}
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <li key={i}>
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
          "max-w-5xl mx-auto mt-2 rounded-2xl border p-4 text-center",
          "border-zinc-200 bg-white/70 dark:border-white/10 dark:bg-zinc-900/40",
          className
        )}
        aria-live="polite"
        data-testid={testId}
      >
        <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">Nenhum usuário encontrado.</p>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Tente ajustar os filtros e pesquisar novamente.</p>
      </div>
    );
  }

  return (
    <ul
      className={cx("space-y-4 max-w-6xl mx-auto", className)}
      role="list"
      aria-label="Lista de usuários"
      data-testid={testId}
    >
      {lista.map((usuario, idx) => {
        const key = usuario?.id ?? usuario?.email ?? idx;
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

/* ===========================
   Skeleton premium (shimmer)
=========================== */
function SkeletonUsuarioCard() {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-zinc-200 dark:border-white/10 bg-white/70 dark:bg-zinc-900/45 p-5">
      <div className="h-1.5 w-full -mx-5 -mt-5 mb-4 bg-gradient-to-r from-violet-600/30 via-fuchsia-600/25 to-indigo-600/20" />
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(110deg,transparent,rgba(255,255,255,0.55),transparent)] translate-x-[-100%] motion-safe:animate-[shimmer_1.6s_infinite]"
        aria-hidden="true"
      />
      <div className="flex gap-3">
        <div className="h-12 w-12 rounded-2xl bg-zinc-200/70 dark:bg-white/10 animate-pulse" />
        <div className="flex-1">
          <div className="h-5 w-56 rounded-xl bg-zinc-200/70 dark:bg-white/10 animate-pulse" />
          <div className="mt-2 h-4 w-72 rounded-xl bg-zinc-200/60 dark:bg-white/10 animate-pulse" />
          <div className="mt-3 h-6 w-52 rounded-full bg-zinc-200/60 dark:bg-white/10 animate-pulse" />
        </div>
      </div>
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-14 rounded-2xl bg-zinc-100/80 dark:bg-white/5 animate-pulse" />
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

/* ===========================
   PropTypes
=========================== */
Pill.propTypes = {
  Icon: PropTypes.elementType.isRequired,
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  title: PropTypes.string,
  tone: PropTypes.oneOf(["violet", "emerald", "amber"]),
};

UsuarioItem.propTypes = {
  usuario: PropTypes.object.isRequired,
  onEditar: PropTypes.func,
  onToggleCpf: PropTypes.func,
  isCpfRevealed: PropTypes.func,
  maskCpfFn: PropTypes.func,
  onCarregarResumo: PropTypes.func,
  isResumoLoading: PropTypes.func,
  hasResumo: PropTypes.func,
};

TabelaUsuarios.propTypes = {
  usuarios: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
      nome: PropTypes.string,
      email: PropTypes.string,
      cpf: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      registro: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      data_nascimento: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
      idade: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
      unidade_nome: PropTypes.any,
      escolaridade_nome: PropTypes.any,
      cargo_nome: PropTypes.any,
      deficiencia_nome: PropTypes.any,
      cursos_concluidos_75: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
      certificados_emitidos: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
      perfil: PropTypes.any,
      perfis: PropTypes.any,
      role: PropTypes.any,
      roles: PropTypes.any,
      perfil_id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
      perfilObj: PropTypes.shape({
        id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
        nome: PropTypes.string,
      }),
    })
  ).isRequired,
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
