// 📁 src/components/TabelaUsuarios.jsx
import { useMemo, useState } from "react";
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
function perfilBadgeClass(perfil) {
  const p = perfil.toLowerCase();
  if (p.includes("admin"))
    return "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-500/20 dark:text-purple-200";
  if (p.includes("instrutor"))
    return "bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-500/20 dark:text-teal-200";
  if (p.includes("gestor"))
    return "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-500/20 dark:text-rose-200";
  return "bg-slate-100 text-slate-700 border-slate-200 dark:bg-zinc-600/30 dark:text-zinc-200";
}
const F = (v) => (v === null || v === undefined || v === "" ? "—" : String(v));
const initials = (name = "") =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("") || "?";

/* CPF seguro (default) */
const maskCpfDefault = (cpf, revealed) => {
  const d = String(cpf || "").replace(/\D/g, "");
  if (d.length !== 11) return cpf ? String(cpf) : "—";
  const fmt = d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  if (revealed) return fmt;
  return fmt.replace(/^\d{3}\.\d{3}\.\d{3}/, "***.***.***").replace(/\d{2}$/, "**");
};

/* Idade por data de nascimento (fallback) */
const calcIdade = (nasc) => {
  if (!nasc) return null;
  const d = new Date(typeof nasc === "string" ? nasc.slice(0, 10) : nasc);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  let a = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) a--;
  return a >= 0 ? a : null;
};

/* Pill chip */
function Pill({ Icon, label, value, title }) {
  return (
    <div
      className="inline-flex items-center gap-2 rounded-xl border border-violet-200/70 dark:border-violet-500/20 bg-violet-50 dark:bg-violet-500/10 px-3 py-1.5"
      role="group"
      aria-label={label}
      title={title || label}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      <div className="text-left leading-tight">
        <div className="text-[11px] text-zinc-600 dark:text-zinc-300">{label}</div>
        <div className="text-[15px] font-semibold">{value}</div>
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
  // novos props p/ carregar sob demanda
  onCarregarResumo,
  isResumoLoading,
  hasResumo,
}) {
  const [expanded, setExpanded] = useState(false);

  const perfis = useMemo(() => extractPerfis(usuario), [usuario]);
  const key = usuario.id ?? usuario.email;
  const headingId = `user-heading-${key}`;

  const nome = usuario?.nome || "—";
  const email = usuario?.email || "—";

  const id = usuario?.id;
  const revealed = typeof isCpfRevealed === "function" ? !!isCpfRevealed(id) : false;
  const cpfRender = (maskCpfFn || maskCpfDefault)(usuario?.cpf, revealed);

  const registro = F(usuario?.registro);

  const idadeDireta = usuario?.idade;
  const idadeCalc = calcIdade(usuario?.data_nascimento);
  const idade = idadeDireta ?? (idadeCalc ?? "—");

  const unidade = F(usuario?.unidade_nome ?? usuario?.unidade ?? usuario?.unidade_id);
  const escolaridade = F(
    usuario?.escolaridade_nome ?? usuario?.escolaridade ?? usuario?.escolaridade_id
  );
  const cargo = F(usuario?.cargo_nome ?? usuario?.cargo ?? usuario?.cargo_id);
  const deficiencia = F(
    usuario?.deficiencia_nome ?? usuario?.deficiencia ?? usuario?.deficiencia_id
  );

  const temResumo = typeof hasResumo === "function" ? hasResumo(id) : false;
  const carregandoResumo = typeof isResumoLoading === "function" ? isResumoLoading(id) : false;
  const concluidos75 = temResumo ? Number(usuario?.cursos_concluidos_75 ?? 0) : "—";
  const certificados = temResumo ? Number(usuario?.certificados_emitidos ?? 0) : "—";

  function toggleExpand() {
    const abrir = !expanded;
    setExpanded(abrir);
    if (abrir && !temResumo && typeof onCarregarResumo === "function" && !carregandoResumo) {
      onCarregarResumo(id);
    }
  }

  const Chevron = expanded ? ChevronDown : ChevronRight;

  return (
    <article
      className="group relative overflow-hidden rounded-2xl bg-white dark:bg-zinc-900/70 ring-1 ring-zinc-200 dark:ring-zinc-700 shadow-sm hover:shadow-md transition focus-within:shadow-md"
      aria-label={`Usuário: ${nome}`}
      aria-labelledby={headingId}
      tabIndex={0}
      role="article"
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && typeof onEditar === "function") {
          e.preventDefault();
          onEditar(usuario);
        }
      }}
    >
      {/* top border accent */}
      <div
        className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-indigo-500 opacity-70"
        aria-hidden="true"
      />

      <div className="p-4 sm:p-5">
        {/* Cabeçalho */}
        <div className="flex items-start gap-3 sm:gap-4">
          {/* Avatar */}
          <div
            aria-hidden="true"
            className="shrink-0 grid place-items-center h-12 w-12 rounded-full bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white font-bold shadow-sm"
          >
            {initials(nome)}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <h2 id={headingId} className="text-base sm:text-lg font-bold text-gray-900 dark:text-white truncate flex items-center gap-2">
                <UserRound className="h-4 w-4 text-zinc-500 dark:text-zinc-300" />
                <span className="truncate">{nome}</span>
              </h2>

              <div className="flex items-center gap-2 shrink-0">
                {/* Botão de expandir (carrega sob demanda) */}
                <button
                  type="button"
                  onClick={toggleExpand}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-zinc-300 dark:border-zinc-700 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  aria-expanded={expanded ? "true" : "false"}
                  aria-controls={`detalhes-${key}`}
                  title={expanded ? "Recolher detalhes" : "Ver detalhes"}
                >
                  <Chevron className="h-4 w-4" />
                  Detalhes
                </button>

                {/* Editar */}
                <button
                  onClick={() => typeof onEditar === "function" && onEditar(usuario)}
                  className="px-3 py-1.5 rounded-md bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium inline-flex items-center gap-2 shadow transition-all focus:outline-none focus:ring-2 focus:ring-teal-700/40"
                  aria-label={`Editar perfil de ${nome}`}
                  title="Editar usuário"
                >
                  <Pencil size={16} />
                  Editar
                </button>
              </div>
            </div>

            {/* e-mail */}
            <div className="mt-1 flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-zinc-500 dark:text-zinc-300" aria-hidden="true" />
              {email && email !== "—" ? (
                <a
                  href={`mailto:${email}`}
                  className="text-gray-700 dark:text-gray-200 break-all underline-offset-2 hover:underline"
                  title={`Enviar e-mail para ${nome}`}
                >
                  {email}
                </a>
              ) : (
                <span className="text-gray-500 dark:text-gray-400">—</span>
              )}
            </div>

            {/* Perfis */}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="sr-only">Perfis:</span>
              {perfis.length > 0 ? (
                perfis.map((p) => (
                  <span
                    key={p}
                    className={`text-xs font-medium border rounded-full px-2 py-0.5 ${perfilBadgeClass(
                      p
                    )}`}
                    title={`Perfil: ${p}`}
                    role="status"
                    aria-label={`Perfil: ${p}`}
                  >
                    <Shield className="inline -mt-0.5 mr-1 h-3 w-3" aria-hidden="true" />
                    {p}
                  </span>
                ))
              ) : (
                <span className="ml-1 italic text-gray-400 text-sm">Sem perfis</span>
              )}
            </div>
          </div>
        </div>

        {/* Dados básicos (baratos) */}
        <dl className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2 text-sm">
          <div className="flex items-center gap-2">
            <IdCard className="h-4 w-4 text-zinc-500" aria-hidden="true" />
            <dt className="text-gray-500 dark:text-gray-400">CPF:</dt>
            <dd className="ml-1">
              <span>{cpfRender}</span>
              {typeof onToggleCpf === "function" &&
                typeof isCpfRevealed === "function" && (
                  <button
                    type="button"
                    onClick={() => onToggleCpf(id)}
                    className="ml-2 text-xs underline underline-offset-2 text-zinc-600 dark:text-zinc-300 hover:text-zinc-900"
                    aria-label={revealed ? "Ocultar CPF" : "Revelar CPF"}
                  >
                    {revealed ? "ocultar" : "revelar"}
                  </button>
                )}
            </dd>
          </div>

          <div className="flex items-center gap-2">
            <Hash className="h-4 w-4 text-zinc-500" aria-hidden="true" />
            <dt className="text-gray-500 dark:text-gray-400">Registro:</dt>
            <dd className="ml-1">{registro}</dd>
          </div>

          <div className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-zinc-500" aria-hidden="true" />
            <dt className="text-gray-500 dark:text-gray-400">Idade:</dt>
            <dd className="ml-1">{idade}</dd>
          </div>

          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-zinc-500" aria-hidden="true" />
            <dt className="text-gray-500 dark:text-gray-400">Unidade:</dt>
            <dd className="ml-1">{unidade}</dd>
          </div>

          <div className="flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-zinc-500" aria-hidden="true" />
            <dt className="text-gray-500 dark:text-gray-400">Cargo:</dt>
            <dd className="ml-1">{cargo}</dd>
          </div>

          <div className="flex items-center gap-2 lg:col-span-1">
            <GraduationCap className="h-4 w-4 text-zinc-500" aria-hidden="true" />
            <dt className="text-gray-500 dark:text-gray-400">Escolaridade:</dt>
            <dd className="ml-1">{escolaridade}</dd>
          </div>

          <div className="flex items-center gap-2 lg:col-span-2">
            <Accessibility className="h-4 w-4 text-zinc-500" aria-hidden="true" />
            <dt className="text-gray-500 dark:text-gray-400">Deficiência:</dt>
            <dd className="ml-1">{deficiencia}</dd>
          </div>
        </dl>

        {/* Detalhes (carregados sob demanda) */}
        {expanded && (
          <div
            id={`detalhes-${key}`}
            className="mt-4 rounded-xl border border-zinc-200 dark:border-zinc-700 p-3 sm:p-4 bg-zinc-50/60 dark:bg-zinc-800/40"
          >
            {carregandoResumo ? (
              <div className="flex items-center gap-2 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando detalhes…
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Pill Icon={GraduationCap} label="Cursos ≥75%" value={concluidos75} />
                <Pill Icon={Award} label="Certificados" value={certificados} />
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

/* ===========================
   Componente (lista)
   =========================== */
export default function TabelaUsuarios({
  usuarios = [],
  onEditar = () => {},
  className = "",
  onToggleCpf,     // (id) => void
  isCpfRevealed,   // (id) => boolean
  maskCpfFn,       // (cpf, revealed) => string
  loading = false,
  onCarregarResumo,   // (id) => void   ⬅️ novo
  isResumoLoading,    // (id) => boolean
  hasResumo,          // (id) => boolean
  "data-testid": testId,
}) {
  if (loading) {
    return (
      <ul className={`space-y-4 max-w-5xl mx-auto ${className}`} role="status" aria-busy="true" data-testid={testId}>
        {Array.from({ length: 4 }).map((_, i) => (
          <li key={i} className="rounded-2xl bg-white dark:bg-zinc-900/70 p-5 ring-1 ring-zinc-200 dark:ring-zinc-700 animate-pulse">
            <div className="h-6 w-48 bg-gray-200 dark:bg-zinc-700 rounded mb-3" />
            <div className="h-4 w-72 bg-gray-200 dark:bg-zinc-700 rounded mb-2" />
            <div className="h-4 w-52 bg-gray-200 dark:bg-zinc-700 rounded mb-4" />
            <div className="h-8 w-24 bg-gray-200 dark:bg-zinc-700 rounded" />
          </li>
        ))}
      </ul>
    );
  }

  if (!Array.isArray(usuarios) || usuarios.length === 0) {
    return (
      <p className="text-center text-gray-600 dark:text-gray-300 py-4" aria-live="polite" data-testid={testId}>
        Nenhum usuário encontrado.
      </p>
    );
  }

  return (
    <ul
      className={`space-y-4 max-w-5xl mx-auto ${className}`}
      role="list"
      aria-label="Lista de usuários"
      data-testid={testId}
    >
      {usuarios.map((usuario, idx) => {
        const key = usuario.id ?? usuario.email ?? idx;
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
   PropTypes
   =========================== */
Pill.propTypes = {
  Icon: PropTypes.elementType.isRequired,
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  title: PropTypes.string,
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
      cpf: PropTypes.string,
      registro: PropTypes.string,
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
