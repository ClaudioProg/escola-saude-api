/* eslint-disable no-console */
// ✅ frontend/src/pages/Perfil.jsx — v2.1
// Atualizado em: 21/05/2026
// Plataforma Escola da Saúde
// Meu Perfil premium, mobile-first, acessível, anti-fuso, sem aliases e alinhado ao contrato oficial.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import {
  AlertTriangle,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  Edit,
  IdCard,
  LockKeyhole,
  Mail,
  Phone,
  RefreshCw,
  Save,
  ShieldCheck,
  Sparkles,
  User,
} from "lucide-react";

import Footer from "../components/layout/Footer";
import HeaderHero from "../components/layout/HeaderHero";
import ModalAssinatura from "../components/usuarios/ModalAssinatura";

import useEscolaTheme from "../hooks/useEscolaTheme";
import {
  apiPerfilMe,
  apiPerfilOpcao,
  apiUsuarioAtualizarBasico,
  apiUsuarioAtualizarPerfilInstitucional,
  setPerfilIncompletoFlag,
} from "../services/api";

/* ─────────────────────────────────────────────────────────────
   Contrato oficial
────────────────────────────────────────────────────────────── */

const PERFIS_ASSINATURA = new Set(["organizador", "administrador"]);

const CAMPOS_INSTITUCIONAIS_OBRIGATORIOS = [
  "celular",
  "unidade_id",
  "cargo_id",
  "escolaridade_id",
  "deficiencia_id",
  "data_nascimento",
];

const SENHA_FORTE_RE =
  /^(?=\S{8,}$)(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).*$/;

/* ─────────────────────────────────────────────────────────────
   Helpers
────────────────────────────────────────────────────────────── */

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function onlyDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function asStr(value) {
  return value === null || value === undefined ? "" : String(value);
}

function normText(value) {
  return String(value || "").trim();
}

function normEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function unwrap(response) {
  return response?.data ?? response;
}

function aplicarMascaraCPF(value) {
  return onlyDigits(value)
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

function aplicarMascaraCelular(value) {
  const digits = onlyDigits(value).slice(0, 11);

  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }

  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function aplicarMascaraRegistro(value) {
  const digits = onlyDigits(value).slice(0, 7);

  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}-${digits.slice(5, 6)}`;
}

function validarEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normEmail(value));
}

function validarCelularObrigatorio(value) {
  const digits = onlyDigits(value);
  return /^\d{10,11}$/.test(digits);
}

function todayYmd() {
  const date = new Date();
  const pad = (number) => String(number).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}`;
}

function toYmd(value) {
  const match = String(value || "")
    .trim()
    .match(/^(\d{4}-\d{2}-\d{2})/);

  return match ? match[1] : "";
}

function validarYmdReal(value) {
  const ymd = String(value || "").trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return false;

  const [anoRaw, mesRaw, diaRaw] = ymd.split("-");
  const ano = Number(anoRaw);
  const mes = Number(mesRaw);
  const dia = Number(diaRaw);

  const date = new Date(Date.UTC(ano, mes - 1, dia));

  const existe =
    date.getUTCFullYear() === ano &&
    date.getUTCMonth() === mes - 1 &&
    date.getUTCDate() === dia;

  if (!existe) return false;
  if (ano < 1900) return false;

  return ymd <= todayYmd();
}

function toNumberOrNull(value) {
  if (value === "" || value === null || value === undefined) return null;

  const number = Number(value);

  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

function getFieldErrors(error) {
  const data = error?.response?.data || error?.data || {};

  return data?.fieldErrors || data?.fields || {};
}

function getErrorMessage(error, fallback) {
  const data = error?.response?.data || error?.data || {};

  return data?.message || data?.erro || error?.message || fallback;
}

function ordenarPorNome(array = []) {
  return [...array].sort((a, b) =>
    String(a?.nome || a?.sigla || "").localeCompare(
      String(b?.nome || b?.sigla || ""),
      "pt-BR",
      { sensitivity: "base" }
    )
  );
}

function ordenarUnidades(array = []) {
  return [...array].sort((a, b) =>
    String(a?.sigla || a?.nome || "").localeCompare(
      String(b?.sigla || b?.nome || ""),
      "pt-BR",
      { sensitivity: "base" }
    )
  );
}

function montarSnapshot(values) {
  return {
    nome: normText(values.nome),
    email: normEmail(values.email),
    celular: onlyDigits(values.celular),
    registro: normText(values.registro),
    data_nascimento: normText(values.dataNascimento),
    unidade_id: normText(values.unidadeId),
    cargo_id: normText(values.cargoId),
    escolaridade_id: normText(values.escolaridadeId),
    deficiencia_id: normText(values.deficienciaId),
    genero_id: normText(values.generoId),
    orientacao_sexual_id: normText(values.orientacaoSexualId),
    cor_raca_id: normText(values.corRacaId),
  };
}

function perfilObrigatorioCompleto(usuario = {}) {
  return Boolean(
    validarCelularObrigatorio(usuario.celular) &&
      usuario.unidade_id &&
      usuario.cargo_id &&
      usuario.escolaridade_id &&
      usuario.deficiencia_id &&
      toYmd(usuario.data_nascimento)
  );
}

function sincronizarSessaoPerfil(usuarioAtualizado) {
  if (!usuarioAtualizado || typeof usuarioAtualizado !== "object") {
    return;
  }

  try {
    const antigo = JSON.parse(localStorage.getItem("usuario") || "{}");
    const novo = { ...antigo, ...usuarioAtualizado };

    localStorage.setItem("usuario", JSON.stringify(novo));
    localStorage.setItem("nome", novo.nome || "");

    window.dispatchEvent(
      new CustomEvent("escola:perfil-atualizado", {
        detail: {
          usuario: novo,
          perfil_incompleto: Boolean(novo.perfil_incompleto),
        },
      })
    );

    window.dispatchEvent(
      new CustomEvent("escola:sessao-atualizada", {
        detail: {
          usuario: novo,
        },
      })
    );
  } catch {
    // noop
  }
}

/* ─────────────────────────────────────────────────────────────
   Componentes locais
────────────────────────────────────────────────────────────── */

function SpinnerLocal() {
  return (
    <span
      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent align-[-2px]"
      aria-hidden="true"
    />
  );
}

function BotaoLocal({
  children,
  variant = "primary",
  className = "",
  leftIcon = null,
  loading = false,
  disabled = false,
  ...props
}) {
  const base =
    "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-extrabold transition focus:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-60";

  const variants = {
    primary:
      "bg-emerald-600 text-white shadow-lg shadow-emerald-900/10 hover:bg-emerald-700 focus-visible:ring-emerald-500/70",
    secondary:
      "border border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100 focus-visible:ring-emerald-500/60 dark:border-white/10 dark:bg-zinc-900/40 dark:text-zinc-200 dark:hover:bg-white/5",
    light:
      "border border-white/20 bg-white/10 text-white hover:bg-white/20 focus-visible:ring-white/70",
  };

  return (
    <button
      type="button"
      className={cx(base, variants[variant] || variants.primary, className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <SpinnerLocal /> : leftIcon}
      {children}
    </button>
  );
}

function FieldError({ id, children }) {
  if (!children) return null;

  return (
    <p id={id} className="mt-1 text-xs text-rose-600 dark:text-rose-300" role="alert">
      {children}
    </p>
  );
}

function FieldHint({ id, children, isDark }) {
  if (!children) return null;

  return (
    <p
      id={id}
      className={cx("mt-1 text-[11px]", isDark ? "text-zinc-400" : "text-slate-500")}
    >
      {children}
    </p>
  );
}

function SectionCard({ title, description, icon: Icon, isDark, children }) {
  return (
    <section
      className={cx(
        "rounded-3xl border p-5 shadow-sm md:p-7",
        isDark ? "border-white/10 bg-zinc-900/50" : "border-slate-200 bg-white"
      )}
    >
      <div className="mb-5 flex items-start gap-3">
        <div
          className={cx(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border",
            isDark
              ? "border-white/10 bg-white/5 text-emerald-300"
              : "border-emerald-100 bg-emerald-50 text-emerald-700"
          )}
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>

        <div>
          <h2 className="text-lg font-extrabold">{title}</h2>
          {description ? (
            <p className={cx("mt-0.5 text-sm", isDark ? "text-zinc-400" : "text-slate-500")}>
              {description}
            </p>
          ) : null}
        </div>
      </div>

      {children}
    </section>
  );
}

function StatusItem({ icon: Icon, label, value, hint, tone = "emerald" }) {
  const tones = {
    emerald:
      "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/25 dark:text-emerald-200 dark:border-emerald-900/40",
    amber:
      "bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-950/25 dark:text-amber-200 dark:border-amber-900/40",
    rose:
      "bg-rose-50 text-rose-700 border-rose-100 dark:bg-rose-950/25 dark:text-rose-200 dark:border-rose-900/40",
    sky:
      "bg-sky-50 text-sky-700 border-sky-100 dark:bg-sky-950/25 dark:text-sky-200 dark:border-sky-900/40",
  };

  return (
    <div className="flex min-w-0 items-center gap-3">
      <div
        className={cx(
          "grid h-12 w-12 shrink-0 place-items-center rounded-2xl border",
          tones[tone] || tones.emerald
        )}
      >
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>

      <div className="min-w-0">
        <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500 dark:text-zinc-400">
          {label}
        </p>
        <p className="mt-0.5 text-xl font-black text-slate-950 dark:text-zinc-50">
          {value}
        </p>
        {hint ? (
          <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">{hint}</p>
        ) : null}
      </div>
    </div>
  );
}

function ProfileStatusPanel({
  stats,
  dirty,
  salvando,
  atualizando,
  onSave,
  onRefresh,
  onAssinatura,
  podeGerenciarAssinatura,
  isDark,
}) {
  const completo = stats.completo;
  const percent = Math.max(0, Math.min(100, stats.percent));

  return (
    <section
      className={cx(
        "rounded-3xl border p-5 shadow-sm md:p-6",
        isDark ? "border-white/10 bg-zinc-900/50" : "border-slate-200 bg-white"
      )}
      aria-label="Resumo do perfil"
    >
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <StatusItem
          icon={completo ? CheckCircle2 : AlertTriangle}
          label="Status"
          value={completo ? "Completo" : "Incompleto"}
          hint={completo ? "Dados obrigatórios preenchidos" : `${stats.pendentes} pendente(s)`}
          tone={completo ? "emerald" : "amber"}
        />

        <div className="md:border-l md:border-slate-200 md:pl-5 md:dark:border-white/10">
          <StatusItem
            icon={BadgeCheck}
            label="Completude"
            value={`${percent}%`}
            hint="Campos obrigatórios"
            tone="emerald"
          />
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-zinc-800">
            <div
              className="h-full rounded-full bg-emerald-600 transition-all"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>

        <div className="md:border-l md:border-slate-200 md:pl-5 md:dark:border-white/10">
          <StatusItem
            icon={CalendarDays}
            label="Pendentes"
            value={stats.pendentes}
            hint={stats.pendentes === 1 ? "campo obrigatório" : "campos obrigatórios"}
            tone={stats.pendentes ? "rose" : "emerald"}
          />
        </div>
      </div>

      <div className="mt-5 h-px w-full bg-slate-200 dark:bg-white/10" />

      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
        <BotaoLocal
          onClick={onRefresh}
          disabled={atualizando}
          loading={atualizando}
          className="w-full sm:w-auto"
          aria-label="Atualizar dados do perfil"
          leftIcon={<RefreshCw className="h-4 w-4" aria-hidden="true" />}
        >
          {atualizando ? "Atualizando..." : "Atualizar"}
        </BotaoLocal>

        <BotaoLocal
          variant="secondary"
          onClick={onSave}
          disabled={salvando || !dirty}
          loading={salvando}
          className="w-full sm:w-auto"
          aria-label="Salvar alterações no perfil"
          leftIcon={<Save className="h-4 w-4" aria-hidden="true" />}
        >
          {salvando ? "Salvando..." : dirty ? "Salvar alterações" : "Sem alterações"}
        </BotaoLocal>

        {podeGerenciarAssinatura ? (
          <BotaoLocal
            variant="secondary"
            onClick={onAssinatura}
            className="w-full sm:w-auto"
            aria-label="Gerenciar assinatura digital"
            leftIcon={<Edit className="h-4 w-4" aria-hidden="true" />}
          >
            Gerenciar assinatura
          </BotaoLocal>
        ) : null}
      </div>
    </section>
  );
}

function SaveBottomPanel({ dirty, salvando, stats, onSave, isDark }) {
  return (
    <section
      className={cx(
        "rounded-3xl border p-5 shadow-sm md:p-6",
        stats.completo
          ? isDark
            ? "border-emerald-900/40 bg-emerald-950/20"
            : "border-emerald-200 bg-emerald-50"
          : isDark
            ? "border-amber-900/40 bg-amber-950/20"
            : "border-amber-200 bg-amber-50"
      )}
      aria-label="Finalizar atualização cadastral"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p
            className={cx(
              "text-sm font-extrabold",
              stats.completo
                ? isDark
                  ? "text-emerald-100"
                  : "text-emerald-900"
                : isDark
                  ? "text-amber-100"
                  : "text-amber-950"
            )}
          >
            Finalizar atualização cadastral
          </p>

          <p
            className={cx(
              "mt-1 text-xs leading-relaxed",
              stats.completo
                ? isDark
                  ? "text-emerald-200/80"
                  : "text-emerald-800"
                : isDark
                  ? "text-amber-200/80"
                  : "text-amber-900/80"
            )}
          >
            Revise os dados obrigatórios e salve para liberar a navegação na
            plataforma sem precisar sair, atualizar ou fazer novo login.
          </p>
        </div>

        <BotaoLocal
          onClick={onSave}
          disabled={salvando || !dirty}
          loading={salvando}
          className={cx(
            "w-full sm:w-auto",
            dirty
              ? "bg-emerald-700 text-white hover:bg-emerald-800"
              : ""
          )}
          aria-label="Salvar alterações do cadastro"
          leftIcon={<Save className="h-4 w-4" aria-hidden="true" />}
        >
          {salvando ? "Salvando..." : dirty ? "Salvar alterações" : "Sem alterações"}
        </BotaoLocal>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
   Página
────────────────────────────────────────────────────────────── */

export default function Perfil() {
  const { isDark } = useEscolaTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const [usuario, setUsuario] = useState(null);

  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [email, setEmail] = useState("");
  const [celular, setCelular] = useState("");
  const [senha, setSenha] = useState("");
  const [registro, setRegistro] = useState("");
  const [dataNascimento, setDataNascimento] = useState("");

  const [unidadeId, setUnidadeId] = useState("");
  const [cargoId, setCargoId] = useState("");
  const [escolaridadeId, setEscolaridadeId] = useState("");
  const [deficienciaId, setDeficienciaId] = useState("");
  const [generoId, setGeneroId] = useState("");
  const [orientacaoSexualId, setOrientacaoSexualId] = useState("");
  const [corRacaId, setCorRacaId] = useState("");

  const [unidades, setUnidades] = useState([]);
  const [cargos, setCargos] = useState([]);
  const [escolaridades, setEscolaridades] = useState([]);
  const [deficiencias, setDeficiencias] = useState([]);
  const [generos, setGeneros] = useState([]);
  const [orientacoesSexuais, setOrientacoesSexuais] = useState([]);
  const [coresRacas, setCoresRacas] = useState([]);

  const [salvando, setSalvando] = useState(false);
  const [atualizando, setAtualizando] = useState(false);
  const [carregandoListas, setCarregandoListas] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [temAssinatura, setTemAssinatura] = useState(null);
  const [baseline, setBaseline] = useState(null);

  const [erros, setErros] = useState({});

  const liveRef = useRef(null);
  const rNome = useRef(null);
  const rEmail = useRef(null);
  const rCelular = useRef(null);
  const rSenha = useRef(null);
  const rRegistro = useRef(null);
  const rData = useRef(null);
  const rUnidade = useRef(null);
  const rCargo = useRef(null);
  const rEscolaridade = useRef(null);
  const rDeficiencia = useRef(null);
  const rGenero = useRef(null);
  const rOrientacao = useRef(null);
  const rCor = useRef(null);

  const setLive = useCallback((message) => {
    if (liveRef.current) liveRef.current.textContent = message || "";
  }, []);

  const destinoAposPerfil = useMemo(() => {
  try {
    const params = new URLSearchParams(location.search);
    const next = String(params.get("next") || "").trim();

    if (next && next.startsWith("/") && !next.startsWith("//")) {
      return next;
    }
  } catch {
    // noop
  }

  return "/painel";
}, [location.search]);

  const inputCls = useCallback(
    (hasError) =>
      cx(
        "w-full rounded-2xl border px-4 py-3 text-sm outline-none transition",
        "focus:ring-2 focus:ring-emerald-500/70",
        isDark
          ? "border-white/10 bg-zinc-950/30 text-zinc-100 placeholder:text-zinc-500"
          : "border-slate-300 bg-white text-slate-900 placeholder:text-slate-400",
        hasError ? "border-red-500/60 ring-2 ring-red-500/60" : ""
      ),
    [isDark]
  );

  const selectCls = useCallback(
    (hasError) => cx(inputCls(hasError), "appearance-none"),
    [inputCls]
  );

  const readonlyCls = cx(
    "w-full rounded-2xl border px-4 py-3 text-sm",
    isDark
      ? "border-white/10 bg-zinc-950/30 text-zinc-400"
      : "border-slate-200 bg-slate-100 text-slate-600"
  );

  const hintCls = isDark ? "text-zinc-400" : "text-slate-500";
  const labelCls = "block text-sm font-semibold";

  useEffect(() => {
    document.title = "Meu Perfil — Escola da Saúde";
  }, []);

  function clearErrors() {
    setErros({});
  }

  function focarPrimeiroErro(fields = {}) {
    const ordem = [
      ["nome", rNome],
      ["email", rEmail],
      ["celular", rCelular],
      ["senha", rSenha],
      ["novaSenha", rSenha],
      ["registro", rRegistro],
      ["data_nascimento", rData],
      ["unidade_id", rUnidade],
      ["cargo_id", rCargo],
      ["escolaridade_id", rEscolaridade],
      ["deficiencia_id", rDeficiencia],
      ["genero_id", rGenero],
      ["orientacao_sexual_id", rOrientacao],
      ["cor_raca_id", rCor],
    ];

    const item = ordem.find(([field]) => fields[field]);

    if (item?.[1]?.current) {
      item[1].current.scrollIntoView({ behavior: "smooth", block: "center" });
      item[1].current.focus();
    }
  }

  function focarCelular() {
    rCelular.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    rCelular.current?.focus();
  }

  function preencherFormulario(me) {
    const data = me || {};

    setUsuario(data);
    setNome(data.nome || "");
    setCpf(aplicarMascaraCPF(data.cpf || ""));
    setEmail(data.email || "");
    setCelular(aplicarMascaraCelular(data.celular || ""));
    setRegistro(aplicarMascaraRegistro(data.registro || ""));
    setDataNascimento(toYmd(data.data_nascimento));

    setUnidadeId(asStr(data.unidade_id));
    setCargoId(asStr(data.cargo_id));
    setEscolaridadeId(asStr(data.escolaridade_id));
    setDeficienciaId(asStr(data.deficiencia_id));
    setGeneroId(asStr(data.genero_id));
    setOrientacaoSexualId(asStr(data.orientacao_sexual_id));
    setCorRacaId(asStr(data.cor_raca_id));

    const snapshot = montarSnapshot({
      nome: data.nome || "",
      email: data.email || "",
      celular: data.celular || "",
      registro: data.registro || "",
      dataNascimento: toYmd(data.data_nascimento),
      unidadeId: asStr(data.unidade_id),
      cargoId: asStr(data.cargo_id),
      escolaridadeId: asStr(data.escolaridade_id),
      deficienciaId: asStr(data.deficiencia_id),
      generoId: asStr(data.genero_id),
      orientacaoSexualId: asStr(data.orientacao_sexual_id),
      corRacaId: asStr(data.cor_raca_id),
    });

    setBaseline(snapshot);
  }

  const snapshotAtual = useMemo(
    () =>
      montarSnapshot({
        nome,
        email,
        celular,
        registro,
        dataNascimento,
        unidadeId,
        cargoId,
        escolaridadeId,
        deficienciaId,
        generoId,
        orientacaoSexualId,
        corRacaId,
      }),
    [
      cargoId,
      celular,
      corRacaId,
      dataNascimento,
      deficienciaId,
      email,
      escolaridadeId,
      generoId,
      nome,
      orientacaoSexualId,
      registro,
      unidadeId,
    ]
  );

  const dirty = useMemo(() => {
    if (!baseline) return false;
    if (senha) return true;

    return Object.keys(snapshotAtual).some(
      (key) => String(snapshotAtual[key] ?? "") !== String(baseline[key] ?? "")
    );
  }, [baseline, senha, snapshotAtual]);

  const podeGerenciarAssinatura = useMemo(() => {
    const perfil = String(usuario?.perfil || "").trim();

    return PERFIS_ASSINATURA.has(perfil);
  }, [usuario?.perfil]);

  const stats = useMemo(() => {
    const required = {
      celular: onlyDigits(celular),
      unidade_id: unidadeId,
      cargo_id: cargoId,
      escolaridade_id: escolaridadeId,
      deficiencia_id: deficienciaId,
      data_nascimento: dataNascimento,
    };

    const pendentes = CAMPOS_INSTITUCIONAIS_OBRIGATORIOS.filter(
      (field) => !String(required[field] || "").trim()
    ).length;

    const total = CAMPOS_INSTITUCIONAIS_OBRIGATORIOS.length;
    const percent = Math.round(((total - pendentes) / total) * 100);

    return {
      completo: pendentes === 0,
      pendentes,
      percent,
      celular_pendente: !String(required.celular || "").trim(),
    };
  }, [cargoId, celular, dataNascimento, deficienciaId, escolaridadeId, unidadeId]);

  const carregarPerfil = useCallback(async () => {
    try {
      setAtualizando(true);
      setLive("Atualizando perfil…");

      const response = await apiPerfilMe({
        auth: true,
        on401: "silent",
        on403: "silent",
      });

      const me = unwrap(response);

      if (!me?.id) {
        throw new Error("Perfil não encontrado.");
      }

            preencherFormulario(me);
      sincronizarSessaoPerfil(me);

      const incompleto = Boolean(
        me.perfil_incompleto || !perfilObrigatorioCompleto(me)
      );

      setPerfilIncompletoFlag?.(incompleto);
      setLive("Perfil atualizado.");
    
    } catch (error) {
      console.error("[Perfil] falha ao atualizar perfil", {
        message: error?.message,
      });

      toast.error("Não foi possível atualizar seu perfil agora.");
      setLive("Falha ao atualizar perfil.");
    } finally {
      setAtualizando(false);
    }
  }, [setLive]);

  const carregarListas = useCallback(async () => {
    try {
      setCarregandoListas(true);

      const response = await apiPerfilOpcao();
      const opcoes = unwrap(response) || {};

      setUnidades(ordenarUnidades(Array.isArray(opcoes.unidades) ? opcoes.unidades : []));
      setCargos(ordenarPorNome(Array.isArray(opcoes.cargos) ? opcoes.cargos : []));
      setEscolaridades(
        ordenarPorNome(Array.isArray(opcoes.escolaridades) ? opcoes.escolaridades : [])
      );
      setDeficiencias(
        ordenarPorNome(Array.isArray(opcoes.deficiencias) ? opcoes.deficiencias : [])
      );
      setGeneros(ordenarPorNome(Array.isArray(opcoes.generos) ? opcoes.generos : []));
      setOrientacoesSexuais(
        ordenarPorNome(
          Array.isArray(opcoes.orientacoes_sexuais)
            ? opcoes.orientacoes_sexuais
            : []
        )
      );
      setCoresRacas(
        ordenarPorNome(Array.isArray(opcoes.cores_racas) ? opcoes.cores_racas : [])
      );
    } catch (error) {
      console.error("[Perfil] falha ao carregar opções", error);

      toast.error("Não foi possível carregar as listas auxiliares.");
    } finally {
      setCarregandoListas(false);
    }
  }, []);

  const carregarAssinatura = useCallback(async () => {
    setTemAssinatura(null);
  }, []);

  useEffect(() => {
    carregarPerfil();
    carregarListas();
  }, [carregarListas, carregarPerfil]);

  useEffect(() => {
    if (!podeGerenciarAssinatura) {
      setTemAssinatura(null);
      return;
    }

    carregarAssinatura();
  }, [carregarAssinatura, podeGerenciarAssinatura]);

  function validarCliente() {
    const fields = {};

    if (!normText(nome)) {
      fields.nome = "Informe seu nome.";
    }

    if (!validarEmail(email)) {
      fields.email = "E-mail inválido.";
    }

    if (!onlyDigits(celular)) {
      fields.celular = "Celular é obrigatório.";
    } else if (!validarCelularObrigatorio(celular)) {
      fields.celular = "Celular inválido. Informe DDD + número.";
    }

    if (senha && !SENHA_FORTE_RE.test(senha)) {
      fields.senha =
        "A senha precisa ter 8+ caracteres, com maiúscula, minúscula, número, símbolo e sem espaços.";
    }

    if (!dataNascimento) {
      fields.data_nascimento = "Data de nascimento é obrigatória.";
    } else if (!validarYmdReal(dataNascimento)) {
      fields.data_nascimento = "Data de nascimento inválida.";
    }

    if (!unidadeId) fields.unidade_id = "Unidade é obrigatória.";
    if (!cargoId) fields.cargo_id = "Cargo é obrigatório.";
    if (!escolaridadeId) fields.escolaridade_id = "Escolaridade é obrigatória.";
    if (!deficienciaId) fields.deficiencia_id = "Deficiência é obrigatória.";

    return fields;
  }

  const salvarAlteracao = useCallback(async () => {
    if (!usuario?.id) return;

    if (!dirty) {
      toast.info("Nenhuma alteração para salvar.");
      return;
    }

    clearErrors();

    const fields = validarCliente();

    if (Object.keys(fields).length) {
      setErros(fields);
      focarPrimeiroErro(fields);
      toast.warn("Revise os campos destacados.");
      return;
    }

    const basicPayload = {
      nome: normText(nome),
      email: normEmail(email),
      celular: onlyDigits(celular),
      ...(senha ? { senha } : {}),
    };

    const perfilPayload = {
      registro: registro ? registro : null,
      unidade_id: Number(unidadeId),
      cargo_id: Number(cargoId),
      escolaridade_id: Number(escolaridadeId),
      deficiencia_id: Number(deficienciaId),
      data_nascimento: dataNascimento,
      genero_id: toNumberOrNull(generoId),
      orientacao_sexual_id: toNumberOrNull(orientacaoSexualId),
      cor_raca_id: toNumberOrNull(corRacaId),
    };

    try {
      setSalvando(true);
      setLive("Salvando alterações…");

      const changedBasic =
        basicPayload.nome !== baseline?.nome ||
        basicPayload.email !== baseline?.email ||
        basicPayload.celular !== baseline?.celular ||
        !!senha;

      const changedPerfil = [
        "registro",
        "unidade_id",
        "cargo_id",
        "escolaridade_id",
        "deficiencia_id",
        "data_nascimento",
        "genero_id",
        "orientacao_sexual_id",
        "cor_raca_id",
      ].some((field) => {
        const value = perfilPayload[field];
        const baselineValue = baseline?.[field];

        return String(value ?? "") !== String(baselineValue ?? "");
      });

      if (changedBasic) {
        await apiUsuarioAtualizarBasico(usuario.id, basicPayload);
      }

      if (changedPerfil) {
        await apiUsuarioAtualizarPerfilInstitucional(usuario.id, perfilPayload);
      }

      const atualizadoResponse = await apiPerfilMe({
        auth: true,
        on401: "silent",
        on403: "silent",
      });

      const atualizado = unwrap(atualizadoResponse);

            preencherFormulario(atualizado);
      setSenha("");
      sincronizarSessaoPerfil(atualizado);

      const incompleto = Boolean(
        atualizado?.perfil_incompleto || !perfilObrigatorioCompleto(atualizado)
      );

      setPerfilIncompletoFlag?.(incompleto);

      toast.success("Dados atualizados com sucesso.");
      setLive("Alterações salvas.");

      if (!incompleto) {
        window.setTimeout(() => {
          navigate(destinoAposPerfil, { replace: true });
        }, 250);
      }
    } catch (error) {
      console.error("[Perfil] falha ao salvar alterações", error);

      const fieldsServidor = getFieldErrors(error);
      const message = getErrorMessage(
        error,
        "Não foi possível salvar as alterações."
      );

      if (Object.keys(fieldsServidor).length) {
        setErros(fieldsServidor);
        focarPrimeiroErro(fieldsServidor);
      }

      toast.error(message);
      setLive("Falha ao salvar alterações.");
    } finally {
      setSalvando(false);
    }
  }, [
    baseline,
    cargoId,
    celular,
    corRacaId,
    dataNascimento,
    deficienciaId,
    dirty,
    email,
    escolaridadeId,
    generoId,
    nome,
    orientacaoSexualId,
    registro,
    senha,
    unidadeId,
    navigate,
    destinoAposPerfil,
    usuario?.id,
  ]);

  useEffect(() => {
    const onKey = (event) => {
      const isSave =
        (event.ctrlKey || event.metaKey) &&
        String(event.key).toLowerCase() === "s";

      if (!isSave) return;

      event.preventDefault();
      salvarAlteracao();
    };

    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, [salvarAlteracao]);

  if (!usuario) {
    return (
      <main
        className={cx(
          "flex min-h-screen flex-col",
          isDark ? "bg-zinc-950 text-zinc-100" : "bg-slate-50 text-slate-900"
        )}
      >
        <div className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6">
          <HeaderHero
            titulo="Meu Perfil"
            subtitulo="Atualize seus dados pessoais e institucionais. O CPF permanece somente para consulta."
            icone={User}
            tamanho="lg"
            raio="xl"
          />
        </div>

        <section className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
          <div
            className={cx(
              "rounded-3xl border p-6 text-center shadow-sm md:p-8",
              isDark ? "border-white/10 bg-zinc-900/50" : "border-slate-200 bg-white"
            )}
          >
            <div className="inline-flex items-center gap-2 text-sm font-semibold">
              <SpinnerLocal />
              Carregando dados do perfil...
            </div>
          </div>
        </section>

        <Footer />
      </main>
    );
  }

  return (
    <main
      className={cx(
        "flex min-h-screen flex-col transition-colors",
        isDark ? "bg-zinc-950 text-zinc-100" : "bg-slate-50 text-slate-900"
      )}
    >
      <p ref={liveRef} className="sr-only" aria-live="polite" />

      <div className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6">
        <HeaderHero
          titulo="Meu Perfil"
          subtitulo="Atualize seus dados pessoais e institucionais. O CPF permanece somente para consulta."
          icone={User}
          tamanho="lg"
          raio="xl"
        />
      </div>

      <section id="conteudo" role="main" className="flex-1">
        <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-4 sm:px-6 md:py-8">
          <ProfileStatusPanel
            stats={stats}
            dirty={dirty}
            salvando={salvando}
            atualizando={atualizando}
            onSave={salvarAlteracao}
            onRefresh={carregarPerfil}
            onAssinatura={() => setModalAberto(true)}
            podeGerenciarAssinatura={podeGerenciarAssinatura}
            isDark={isDark}
          />

          <div
            role={stats.completo ? "status" : "alert"}
            aria-live="polite"
            className={cx(
              "rounded-2xl border px-4 py-3 text-sm",
              stats.completo
                ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-200"
                : "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-200"
            )}
          >
            {stats.completo ? (
              <>
                <CheckCircle2 className="mr-1 inline h-4 w-4" aria-hidden="true" />
                <strong className="font-extrabold">Cadastro completo.</strong>{" "}
                Seus dados obrigatórios estão preenchidos.
              </>
            ) : (
              <>
                <AlertTriangle className="mr-1 inline h-4 w-4" aria-hidden="true" />
                <strong className="font-extrabold">Perfil incompleto:</strong>{" "}
                complete os campos obrigatórios para evitar bloqueios de fluxo.
              </>
            )}
          </div>

          {stats.celular_pendente ? (
            <div className="rounded-3xl border border-rose-200 bg-white p-5 shadow-sm dark:border-rose-900/40 dark:bg-zinc-900/50">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-rose-100 bg-rose-50 text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/25 dark:text-rose-200">
                    <Phone className="h-5 w-5" aria-hidden="true" />
                  </div>

                  <div>
                    <p className="font-extrabold text-slate-950 dark:text-zinc-50">
                      Celular obrigatório
                    </p>
                    <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
                      Informe um número de celular para contato e segurança da conta.
                    </p>
                  </div>
                </div>

                <BotaoLocal
                  variant="secondary"
                  onClick={focarCelular}
                  className="w-full sm:w-auto"
                  leftIcon={<Edit className="h-4 w-4" aria-hidden="true" />}
                >
                  Preencher agora
                </BotaoLocal>
              </div>
            </div>
          ) : null}

          {podeGerenciarAssinatura ? (
            <div
              role="status"
              aria-live="polite"
              className={cx(
                "rounded-2xl border px-4 py-3 text-sm",
                temAssinatura === false
                  ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-200"
                  : "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900/40 dark:bg-sky-900/20 dark:text-sky-200"
              )}
            >
              <div className="flex items-start gap-2">
                <ShieldCheck className="mt-0.5 h-4 w-4" aria-hidden="true" />
                <div>
                  <strong className="font-extrabold">Assinatura digital:</strong>{" "}
                  {temAssinatura === false ? (
                    <>
                      você ainda não cadastrou uma assinatura. Use{" "}
                      <em>Gerenciar assinatura</em> para registrar uma assinatura
                      digital.
                    </>
                  ) : temAssinatura === true ? (
                    <>assinatura localizada. Você pode alterá-la quando necessário.</>
                  ) : (
                    <>
                      use <em>Gerenciar assinatura</em> para consultar, cadastrar ou
                      atualizar sua assinatura digital.
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          <SectionCard
            title="Dados pessoais"
            description="Dados principais de identificação e contato."
            icon={IdCard}
            isDark={isDark}
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label htmlFor="nome" className={labelCls}>
                  Nome completo <span className="text-rose-600">*</span>
                </label>
                <input
                  id="nome"
                  ref={rNome}
                  type="text"
                  value={nome}
                  onChange={(event) => {
                    setNome(event.target.value);
                    setErros((old) => ({ ...old, nome: "" }));
                  }}
                  className={inputCls(!!erros.nome)}
                  aria-invalid={!!erros.nome}
                  aria-describedby={erros.nome ? "erro-nome" : undefined}
                  autoComplete="name"
                  disabled={salvando}
                />
                <FieldError id="erro-nome">{erros.nome}</FieldError>
              </div>

              <div>
                <label htmlFor="cpf" className={labelCls}>
                  CPF
                </label>
                <input
                  id="cpf"
                  type="text"
                  value={cpf}
                  readOnly
                  className={readonlyCls}
                  aria-readonly="true"
                />
                <FieldHint id="dica-cpf" isDark={isDark}>
                  Somente leitura nesta tela.
                </FieldHint>
              </div>

              <div>
                <label htmlFor="email" className={labelCls}>
                  E-mail <span className="text-rose-600">*</span>
                </label>
                <div className="relative">
                  <Mail
                    className={cx(
                      "pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2",
                      hintCls
                    )}
                    aria-hidden="true"
                  />
                  <input
                    id="email"
                    ref={rEmail}
                    type="email"
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      setErros((old) => ({ ...old, email: "" }));
                    }}
                    className={cx(inputCls(!!erros.email), "pl-10")}
                    aria-invalid={!!erros.email}
                    aria-describedby={erros.email ? "erro-email" : "dica-email"}
                    autoComplete="email"
                    disabled={salvando}
                  />
                </div>
                {erros.email ? (
                  <FieldError id="erro-email">{erros.email}</FieldError>
                ) : (
                  <FieldHint id="dica-email" isDark={isDark}>
                    Ex.: nome.sobrenome@santos.sp.gov.br
                  </FieldHint>
                )}
              </div>

              <div>
                <label htmlFor="celular" className={labelCls}>
                  Celular <span className="text-rose-600">*</span>
                </label>
                <div className="relative">
                  <Phone
                    className={cx(
                      "pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2",
                      hintCls
                    )}
                    aria-hidden="true"
                  />
                  <input
                    id="celular"
                    ref={rCelular}
                    type="tel"
                    value={celular}
                    onChange={(event) => {
                      setCelular(aplicarMascaraCelular(event.target.value));
                      setErros((old) => ({ ...old, celular: "" }));
                    }}
                    className={cx(inputCls(!!erros.celular), "pl-10")}
                    placeholder="(13) 99999-9999"
                    maxLength={15}
                    inputMode="numeric"
                    autoComplete="tel"
                    disabled={salvando}
                    aria-invalid={!!erros.celular}
                    aria-describedby={erros.celular ? "erro-celular" : "dica-celular"}
                  />
                </div>
                {erros.celular ? (
                  <FieldError id="erro-celular">{erros.celular}</FieldError>
                ) : (
                  <FieldHint id="dica-celular" isDark={isDark}>
                    Campo obrigatório para contato e segurança da conta.
                  </FieldHint>
                )}
              </div>

              <div>
                <label htmlFor="senha" className={labelCls}>
                  Nova senha
                </label>
                <div className="relative">
                  <LockKeyhole
                    className={cx(
                      "pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2",
                      hintCls
                    )}
                    aria-hidden="true"
                  />
                  <input
                    id="senha"
                    ref={rSenha}
                    type="password"
                    value={senha}
                    onChange={(event) => {
                      setSenha(event.target.value);
                      setErros((old) => ({ ...old, senha: "" }));
                    }}
                    placeholder="Digite apenas se quiser alterar"
                    className={cx(inputCls(!!erros.senha), "pl-10")}
                    autoComplete="new-password"
                    disabled={salvando}
                    aria-invalid={!!erros.senha}
                    aria-describedby={erros.senha ? "erro-senha" : "dica-senha"}
                  />
                </div>
                {erros.senha ? (
                  <FieldError id="erro-senha">{erros.senha}</FieldError>
                ) : (
                  <FieldHint id="dica-senha" isDark={isDark}>
                    Mínimo de 8 caracteres com maiúscula, minúscula, número e
                    símbolo.
                  </FieldHint>
                )}
              </div>

              <div>
                <label htmlFor="registro" className={labelCls}>
                  Registro
                </label>
                <input
                  id="registro"
                  ref={rRegistro}
                  type="text"
                  value={registro}
                  onChange={(event) => {
                    setRegistro(aplicarMascaraRegistro(event.target.value));
                    setErros((old) => ({ ...old, registro: "" }));
                  }}
                  className={inputCls(!!erros.registro)}
                  placeholder="Ex.: 28.053-7"
                  disabled={salvando}
                  inputMode="numeric"
                  aria-invalid={!!erros.registro}
                  aria-describedby={erros.registro ? "erro-registro" : "dica-registro"}
                />
                {erros.registro ? (
                  <FieldError id="erro-registro">{erros.registro}</FieldError>
                ) : (
                  <FieldHint id="dica-registro" isDark={isDark}>
                    Se não for servidor, deixe em branco.
                  </FieldHint>
                )}
              </div>

              <div>
                <label htmlFor="data_nascimento" className={labelCls}>
                  Data de nascimento <span className="text-rose-600">*</span>
                </label>
                <div className="relative">
                  <CalendarDays
                    className={cx(
                      "pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2",
                      hintCls
                    )}
                    aria-hidden="true"
                  />
                  <input
                    id="data_nascimento"
                    ref={rData}
                    type="date"
                    value={dataNascimento}
                    max={todayYmd()}
                    onChange={(event) => {
                      setDataNascimento(event.target.value);
                      setErros((old) => ({ ...old, data_nascimento: "" }));
                    }}
                    className={cx(inputCls(!!erros.data_nascimento), "pl-10")}
                    disabled={salvando}
                    aria-invalid={!!erros.data_nascimento}
                    aria-describedby={
                      erros.data_nascimento ? "erro-data_nascimento" : undefined
                    }
                  />
                </div>
                <FieldError id="erro-data_nascimento">
                  {erros.data_nascimento}
                </FieldError>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Perfil institucional"
            description="Campos obrigatórios para liberar fluxos da plataforma."
            icon={ShieldCheck}
            isDark={isDark}
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="unidade_id" className={labelCls}>
                  Unidade <span className="text-rose-600">*</span>
                </label>
                <select
                  id="unidade_id"
                  ref={rUnidade}
                  value={unidadeId}
                  onChange={(event) => {
                    setUnidadeId(event.target.value);
                    setErros((old) => ({ ...old, unidade_id: "" }));
                  }}
                  className={selectCls(!!erros.unidade_id)}
                  disabled={salvando || carregandoListas}
                  aria-invalid={!!erros.unidade_id}
                  aria-describedby={erros.unidade_id ? "erro-unidade_id" : undefined}
                >
                  <option value="">
                    {carregandoListas ? "Carregando..." : "Selecione…"}
                  </option>
                  {unidades.map((unidade) => (
                    <option key={unidade.id} value={String(unidade.id)}>
                      {unidade.sigla || unidade.nome}
                    </option>
                  ))}
                </select>
                <FieldError id="erro-unidade_id">{erros.unidade_id}</FieldError>
              </div>

              <div>
                <label htmlFor="escolaridade_id" className={labelCls}>
                  Escolaridade <span className="text-rose-600">*</span>
                </label>
                <select
                  id="escolaridade_id"
                  ref={rEscolaridade}
                  value={escolaridadeId}
                  onChange={(event) => {
                    setEscolaridadeId(event.target.value);
                    setErros((old) => ({ ...old, escolaridade_id: "" }));
                  }}
                  className={selectCls(!!erros.escolaridade_id)}
                  disabled={salvando || carregandoListas}
                  aria-invalid={!!erros.escolaridade_id}
                  aria-describedby={
                    erros.escolaridade_id ? "erro-escolaridade_id" : undefined
                  }
                >
                  <option value="">
                    {carregandoListas ? "Carregando..." : "Selecione…"}
                  </option>
                  {escolaridades.map((escolaridade) => (
                    <option key={escolaridade.id} value={String(escolaridade.id)}>
                      {escolaridade.nome}
                    </option>
                  ))}
                </select>
                <FieldError id="erro-escolaridade_id">
                  {erros.escolaridade_id}
                </FieldError>
              </div>

              <div className="md:col-span-2">
                <label htmlFor="cargo_id" className={labelCls}>
                  Cargo <span className="text-rose-600">*</span>
                </label>
                <select
                  id="cargo_id"
                  ref={rCargo}
                  value={cargoId}
                  onChange={(event) => {
                    setCargoId(event.target.value);
                    setErros((old) => ({ ...old, cargo_id: "" }));
                  }}
                  className={selectCls(!!erros.cargo_id)}
                  disabled={salvando || carregandoListas}
                  aria-invalid={!!erros.cargo_id}
                  aria-describedby={erros.cargo_id ? "erro-cargo_id" : undefined}
                >
                  <option value="">
                    {carregandoListas ? "Carregando..." : "Selecione…"}
                  </option>
                  {cargos.map((cargo) => (
                    <option key={cargo.id} value={String(cargo.id)}>
                      {cargo.nome}
                    </option>
                  ))}
                </select>
                <FieldError id="erro-cargo_id">{erros.cargo_id}</FieldError>
              </div>

              <div>
                <label htmlFor="deficiencia_id" className={labelCls}>
                  Deficiência <span className="text-rose-600">*</span>
                </label>
                <select
                  id="deficiencia_id"
                  ref={rDeficiencia}
                  value={deficienciaId}
                  onChange={(event) => {
                    setDeficienciaId(event.target.value);
                    setErros((old) => ({ ...old, deficiencia_id: "" }));
                  }}
                  className={selectCls(!!erros.deficiencia_id)}
                  disabled={salvando || carregandoListas}
                  aria-invalid={!!erros.deficiencia_id}
                  aria-describedby={
                    erros.deficiencia_id ? "erro-deficiencia_id" : "dica-deficiencia_id"
                  }
                >
                  <option value="">
                    {carregandoListas ? "Carregando..." : "Selecione…"}
                  </option>
                  {deficiencias.map((deficiencia) => (
                    <option key={deficiencia.id} value={String(deficiencia.id)}>
                      {deficiencia.nome}
                    </option>
                  ))}
                </select>
                {erros.deficiencia_id ? (
                  <FieldError id="erro-deficiencia_id">
                    {erros.deficiencia_id}
                  </FieldError>
                ) : (
                  <FieldHint id="dica-deficiencia_id" isDark={isDark}>
                    Se não possuir deficiência, selecione a opção correspondente.
                  </FieldHint>
                )}
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Informações opcionais"
            description="Campos demográficos não bloqueiam o perfil institucional."
            icon={BadgeCheck}
            isDark={isDark}
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label htmlFor="genero_id" className={labelCls}>
                  Gênero
                </label>
                <select
                  id="genero_id"
                  ref={rGenero}
                  value={generoId}
                  onChange={(event) => {
                    setGeneroId(event.target.value);
                    setErros((old) => ({ ...old, genero_id: "" }));
                  }}
                  className={selectCls(!!erros.genero_id)}
                  disabled={salvando || carregandoListas}
                  aria-invalid={!!erros.genero_id}
                  aria-describedby={erros.genero_id ? "erro-genero_id" : undefined}
                >
                  <option value="">
                    {carregandoListas ? "Carregando..." : "Não informar"}
                  </option>
                  {generos.map((genero) => (
                    <option key={genero.id} value={String(genero.id)}>
                      {genero.nome}
                    </option>
                  ))}
                </select>
                <FieldError id="erro-genero_id">{erros.genero_id}</FieldError>
              </div>

              <div>
                <label htmlFor="orientacao_sexual_id" className={labelCls}>
                  Orientação sexual
                </label>
                <select
                  id="orientacao_sexual_id"
                  ref={rOrientacao}
                  value={orientacaoSexualId}
                  onChange={(event) => {
                    setOrientacaoSexualId(event.target.value);
                    setErros((old) => ({ ...old, orientacao_sexual_id: "" }));
                  }}
                  className={selectCls(!!erros.orientacao_sexual_id)}
                  disabled={salvando || carregandoListas}
                  aria-invalid={!!erros.orientacao_sexual_id}
                  aria-describedby={
                    erros.orientacao_sexual_id
                      ? "erro-orientacao_sexual_id"
                      : undefined
                  }
                >
                  <option value="">
                    {carregandoListas ? "Carregando..." : "Não informar"}
                  </option>
                  {orientacoesSexuais.map((orientacao) => (
                    <option key={orientacao.id} value={String(orientacao.id)}>
                      {orientacao.nome}
                    </option>
                  ))}
                </select>
                <FieldError id="erro-orientacao_sexual_id">
                  {erros.orientacao_sexual_id}
                </FieldError>
              </div>

              <div>
                <label htmlFor="cor_raca_id" className={labelCls}>
                  Cor/raça
                </label>
                <select
                  id="cor_raca_id"
                  ref={rCor}
                  value={corRacaId}
                  onChange={(event) => {
                    setCorRacaId(event.target.value);
                    setErros((old) => ({ ...old, cor_raca_id: "" }));
                  }}
                  className={selectCls(!!erros.cor_raca_id)}
                  disabled={salvando || carregandoListas}
                  aria-invalid={!!erros.cor_raca_id}
                  aria-describedby={erros.cor_raca_id ? "erro-cor_raca_id" : undefined}
                >
                  <option value="">
                    {carregandoListas ? "Carregando..." : "Não informar"}
                  </option>
                  {coresRacas.map((cor) => (
                    <option key={cor.id} value={String(cor.id)}>
                      {cor.nome}
                    </option>
                  ))}
                </select>
                <FieldError id="erro-cor_raca_id">{erros.cor_raca_id}</FieldError>
              </div>
            </div>
          </SectionCard>

          <SaveBottomPanel
            dirty={dirty}
            salvando={salvando}
            stats={stats}
            onSave={salvarAlteracao}
            isDark={isDark}
          />

          <ModalAssinatura
            isOpen={modalAberto}
            onClose={() => {
              setModalAberto(false);
              if (podeGerenciarAssinatura) carregarAssinatura();
            }}
          />
        </div>
      </section>

      <Footer />
    </main>
  );
}