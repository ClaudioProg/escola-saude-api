// ✅ frontend/src/pages/Cadastro.jsx — v2.0
// Plataforma Escola da Saúde
// Cadastro completo, premium, mobile-first, acessível, diagnosticável e alinhado ao backend /auth/cadastro.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  BadgeCheck,
  CheckCircle2,
  ClipboardList,
  Eye,
  EyeOff,
  HelpCircle,
  Info,
  LockKeyhole,
  Phone,
  ShieldCheck,
  Sparkles,
  UserPlus,
} from "lucide-react";
import { toast } from "react-toastify";

import Footer from "../components/layout/Footer";

import useEscolaTheme from "../hooks/useEscolaTheme";
import { apiCadastrarUsuario, apiPerfilOpcao } from "../services/api";

/* ─────────────────────────────────────────────────────────────
   Constantes oficiais
────────────────────────────────────────────────────────────── */

const REQUIRED_FIELDS = [
  "nome",
  "cpf",
  "email",
  "celular",
  "data_nascimento",
  "unidade_id",
  "cargo_id",
  "escolaridade_id",
  "deficiencia_id",
  "senha",
  "confirmarSenha",
];

const PALAVRAS_MINUSCULAS_PT = new Set([
  "a",
  "as",
  "da",
  "das",
  "de",
  "di",
  "do",
  "dos",
  "du",
  "e",
  "o",
  "os",
]);

const SENHA_FORTE_RE =
  /^(?=\S{8,}$)(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).*$/;

/* ─────────────────────────────────────────────────────────────
   Helpers
────────────────────────────────────────────────────────────── */

function onlyDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function titleCasePtBr(nome) {
  const value = String(nome || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

  if (!value) return "";

  return value
    .split(" ")
    .map((part, index) => {
      if (index > 0 && PALAVRAS_MINUSCULAS_PT.has(part)) return part;
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(" ");
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

function validarCPF(value) {
  return /^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(String(value || ""));
}

function validarEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function validarCelular(value) {
  return /^\d{10,11}$/.test(onlyDigits(value));
}

function todayYmd() {
  const date = new Date();
  const pad = (number) => String(number).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}`;
}

function validarDataNascimento(value) {
  const dateOnly = String(value || "").trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) return false;

  const [anoRaw, mesRaw, diaRaw] = dateOnly.split("-");
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

  return dateOnly <= todayYmd();
}

function toNumberOrNull(value) {
  if (value === "" || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizarErroMensagem(error) {
  const data = error?.response?.data || error?.data || {};
  return data?.message || data?.erro || error?.message || "Erro ao criar conta.";
}

function normalizarFieldErrors(error) {
  const data = error?.response?.data || error?.data || {};
  return data?.fieldErrors || {};
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
    "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-extrabold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70 disabled:cursor-not-allowed disabled:opacity-60";

  const variants = {
    primary:
      "bg-emerald-600 text-white shadow-lg shadow-emerald-900/10 hover:bg-emerald-700",
    secondary:
      "border border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100 dark:border-white/10 dark:bg-zinc-900/40 dark:text-zinc-200 dark:hover:bg-white/5",
  };

  return (
    <button
      className={[base, variants[variant] || variants.primary, className].join(
        " "
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <SpinnerLocal /> : leftIcon}
      {children}
    </button>
  );
}

function RequiredBadge({ isDark }) {
  return (
    <span
      className={[
        "ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide",
        isDark
          ? "bg-emerald-400/10 text-emerald-200"
          : "bg-emerald-50 text-emerald-700",
      ].join(" ")}
    >
      obrigatório
    </span>
  );
}

function OptionalBadge({ isDark }) {
  return (
    <span
      className={[
        "ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide",
        isDark ? "bg-zinc-800 text-zinc-300" : "bg-slate-100 text-slate-600",
      ].join(" ")}
    >
      opcional
    </span>
  );
}

function SectionCard({ title, description, icon: Icon, children, isDark }) {
  return (
    <section
      className={[
        "rounded-3xl border p-4 sm:p-5",
        isDark
          ? "border-white/10 bg-zinc-950/30"
          : "border-slate-200 bg-slate-50/70",
      ].join(" ")}
    >
      <div className="mb-4 flex items-start gap-3">
        <div
          className={[
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border",
            isDark
              ? "border-white/10 bg-white/5 text-emerald-300"
              : "border-emerald-100 bg-emerald-50 text-emerald-700",
          ].join(" ")}
        >
          <Icon size={19} aria-hidden="true" />
        </div>

        <div>
          <h3 className="text-sm font-extrabold">{title}</h3>
          {description ? (
            <p
              className={[
                "mt-0.5 text-xs",
                isDark ? "text-zinc-400" : "text-slate-500",
              ].join(" ")}
            >
              {description}
            </p>
          ) : null}
        </div>
      </div>

      <div className="space-y-3">{children}</div>
    </section>
  );
}

function NumberBullet({ n }) {
  return (
    <span
      className="inline-flex h-7 w-7 shrink-0 select-none items-center justify-center rounded-full bg-emerald-600 text-[12px] font-bold text-white shadow-sm"
      aria-label={`Item ${n}`}
    >
      {n}
    </span>
  );
}

function RegrasDicasCadastro({ isDark }) {
  const regras = [
    {
      titulo: "Cadastro completo",
      conteudo:
        "O cadastro reúne dados pessoais, contato, vínculo institucional, dados opcionais e senha.",
    },
    {
      titulo: "Campos obrigatórios",
      conteudo:
        "Nome, CPF, e-mail, celular, data de nascimento, unidade, cargo, escolaridade, deficiência e senha são obrigatórios.",
    },
    {
      titulo: "Campos opcionais",
      conteudo:
        "Registro, gênero, orientação sexual e cor/raça podem ser preenchidos agora ou deixados em branco.",
    },
    {
      titulo: "Unidade OUTROS",
      conteudo:
        "Se não tiver vínculo com unidade da Prefeitura, selecione OUTROS na lista oficial carregada do sistema.",
    },
    {
      titulo: "Senha segura",
      conteudo:
        "Use maiúscula, minúscula, número e símbolo. A plataforma mostra a força da senha antes do envio.",
    },
  ];

  return (
    <aside className="w-full">
      <div className="mb-4 flex items-center justify-center gap-2 text-center">
        <ShieldCheck
          className={[
            "h-5 w-5",
            isDark ? "text-emerald-300" : "text-emerald-700",
          ].join(" ")}
          aria-hidden="true"
        />
        <h2
          className={[
            "text-base font-extrabold",
            isDark ? "text-zinc-100" : "text-slate-900",
          ].join(" ")}
        >
          Guia rápido do cadastro
        </h2>
      </div>

      <div
        className={[
          "rounded-3xl border p-5 sm:p-6",
          isDark
            ? "border-white/10 bg-zinc-900/55"
            : "border-slate-200 bg-white shadow-sm",
        ].join(" ")}
      >
        <ol className="space-y-4">
          {regras.map((regra, index) => (
            <li key={regra.titulo} className="flex gap-3">
              <NumberBullet n={index + 1} />
              <div className="text-sm leading-6">
                <p
                  className={[
                    "font-semibold",
                    isDark ? "text-zinc-100" : "text-slate-900",
                  ].join(" ")}
                >
                  {regra.titulo}
                </p>
                <p className={isDark ? "text-zinc-300" : "text-slate-700"}>
                  {regra.conteudo}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </aside>
  );
}

function CampoTexto({
  id,
  label,
  required,
  optional,
  error,
  hint,
  isDark,
  children,
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold">
        {label}
        {required ? <RequiredBadge isDark={isDark} /> : null}
        {optional ? <OptionalBadge isDark={isDark} /> : null}
      </label>

      {children}

      {error ? (
        <p
          id={`erro-${id}`}
          className={[
            "mt-1 text-xs",
            isDark ? "text-red-300" : "text-red-600",
          ].join(" ")}
          role="alert"
        >
          {error}
        </p>
      ) : hint ? (
        <p
          id={`dica-${id}`}
          className={[
            "mt-1 text-[11px]",
            isDark ? "text-zinc-400" : "text-slate-500",
          ].join(" ")}
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function PainelProgresso({ totalObrigatorios, preenchidos, pendentes, isDark }) {
  const percentual = totalObrigatorios
    ? Math.round((preenchidos / totalObrigatorios) * 100)
    : 0;

  const completo = pendentes.length === 0;

  return (
    <div
      className={[
        "rounded-3xl border p-4",
        isDark
          ? "border-white/10 bg-zinc-950/40"
          : "border-slate-200 bg-white shadow-sm",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-extrabold">Progresso do cadastro</p>
          <p
            className={[
              "mt-0.5 text-xs",
              isDark ? "text-zinc-400" : "text-slate-500",
            ].join(" ")}
          >
            {completo
              ? "Todos os campos obrigatórios foram preenchidos."
              : `${pendentes.length} campo(s) obrigatório(s) pendente(s).`}
          </p>
        </div>

        <div
          className={[
            "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-extrabold",
            completo
              ? isDark
                ? "bg-emerald-400/10 text-emerald-200"
                : "bg-emerald-50 text-emerald-700"
              : isDark
                ? "bg-amber-400/10 text-amber-200"
                : "bg-amber-50 text-amber-700",
          ].join(" ")}
        >
          {completo ? <CheckCircle2 size={14} /> : <Info size={14} />}
          {percentual}%
        </div>
      </div>

      <div
        className={[
          "mt-3 h-2 overflow-hidden rounded-full",
          isDark ? "bg-white/10" : "bg-slate-200",
        ].join(" ")}
      >
        <div
          className="h-full rounded-full bg-emerald-500 transition-all duration-300"
          style={{ width: `${percentual}%` }}
        />
      </div>

      {!completo ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {pendentes.slice(0, 6).map((p) => (
            <span
              key={p}
              className={[
                "rounded-full px-2.5 py-1 text-[11px] font-bold",
                isDark
                  ? "bg-white/5 text-zinc-300"
                  : "bg-slate-100 text-slate-600",
              ].join(" ")}
            >
              {p}
            </span>
          ))}

          {pendentes.length > 6 ? (
            <span
              className={[
                "rounded-full px-2.5 py-1 text-[11px] font-bold",
                isDark
                  ? "bg-white/5 text-zinc-300"
                  : "bg-slate-100 text-slate-600",
              ].join(" ")}
            >
              +{pendentes.length - 6}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Página
────────────────────────────────────────────────────────────── */

export default function Cadastro() {
  const navigate = useNavigate();
  const { isDark } = useEscolaTheme();

  const refNome = useRef(null);
  const refCpf = useRef(null);
  const refEmail = useRef(null);
  const refCelular = useRef(null);
  const refRegistro = useRef(null);
  const refData = useRef(null);
  const refUnidade = useRef(null);
  const refCargo = useRef(null);
  const refEscolaridade = useRef(null);
  const refDeficiencia = useRef(null);
  const refGenero = useRef(null);
  const refOrientacao = useRef(null);
  const refCorRaca = useRef(null);
  const refSenha = useRef(null);
  const refConfirmar = useRef(null);
  const hpRef = useRef(null);

  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [email, setEmail] = useState("");
  const [celular, setCelular] = useState("");
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

  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [capsOn, setCapsOn] = useState(false);

  const [erro, setErro] = useState("");
  const [erros, setErros] = useState({});

  const [loading, setLoading] = useState(false);
  const [loadinglookup, setLoadinglookup] = useState(true);

  const inputCls = useCallback(
    (hasError) =>
      [
        "w-full rounded-2xl border px-4 py-3 text-sm outline-none transition",
        "focus:ring-2 focus:ring-emerald-500/70",
        isDark
          ? "border-white/10 bg-zinc-950/30 text-zinc-100 placeholder:text-zinc-500"
          : "border-slate-300 bg-white text-slate-900 placeholder:text-slate-400",
        hasError ? "border-red-500/60 ring-2 ring-red-500/60" : "",
      ].join(" "),
    [isDark]
  );

  const selectCls = useCallback(
    (hasError) => [inputCls(hasError), "appearance-none"].join(" "),
    [inputCls]
  );

  useEffect(() => {
    document.title = "Cadastro — Escola da Saúde";
    refNome.current?.focus();
  }, []);

function ordenarPorNome(array = []) {
  return [...array].sort((a, b) =>
    String(a?.nome || a?.sigla || "").localeCompare(
      String(b?.nome || b?.sigla || ""),
      "pt-BR",
      { sensitivity: "base" }
    )
  );
}

function ordenarPorId(array = []) {
  return [...array].sort((a, b) => Number(a?.id || 0) - Number(b?.id || 0));
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

  useEffect(() => {
    let alive = true;

    async function carregarlookup() {
      try {
        setLoadinglookup(true);

        const data = await apiPerfilOpcao();
        if (!alive) return;

        const unidadesData = Array.isArray(data?.unidades) ? data.unidades : [];
        const cargosData = Array.isArray(data?.cargos) ? data.cargos : [];
        const escolaridadesData = Array.isArray(data?.escolaridades)
          ? data.escolaridades
          : [];
        const deficienciasData = Array.isArray(data?.deficiencias)
          ? data.deficiencias
          : [];
        const generosData = Array.isArray(data?.generos) ? data.generos : [];
        const orientacoesData = Array.isArray(data?.orientacoes_sexuais)
          ? data.orientacoes_sexuais
          : [];
        const coresData = Array.isArray(data?.cores_racas)
          ? data.cores_racas
          : [];

        const temOutros = unidadesData.some((unidade) => {
          const sigla = String(unidade?.sigla || "").trim().toLowerCase();
          const nomeUnidade = String(unidade?.nome || "").trim().toLowerCase();
          return sigla === "outros" || nomeUnidade === "outros";
        });

        if (!temOutros) {
          toast.warn(
            "A unidade OUTROS não foi localizada na lista oficial. Verifique o cadastro de unidades."
          );
        }

setUnidades(ordenarUnidades(unidadesData));
setCargos(ordenarPorNome(cargosData));

// Escolaridade e deficiência respeitam a ordem oficial recebida da API.
setEscolaridades(escolaridadesData);
setDeficiencias(deficienciasData);

// Campos opcionais: exibição em ordem de ID do banco.
setGeneros(generosData);
setOrientacoesSexuais(ordenarPorId(orientacoesData));
setCoresRacas(ordenarPorId(coresData));

        if (
          !unidadesData.length ||
          !cargosData.length ||
          !escolaridadesData.length ||
          !deficienciasData.length
        ) {
          toast.warn("Algumas listas obrigatórias não foram carregadas.");
        }
      } catch (error) {
        console.warn("[Cadastro.v2.0] Falha ao carregar lookup", error);
        toast.error(
          "Não foi possível carregar as listas do cadastro. Tente novamente em instantes."
        );
      } finally {
        if (alive) setLoadinglookup(false);
      }
    }

    carregarlookup();

    return () => {
      alive = false;
    };
  }, []);

  const forcaSenha = useMemo(() => {
    const value = senha || "";
    let score = 0;

    if (value.length >= 8) score += 1;
    if (/[A-Z]/.test(value)) score += 1;
    if (/[a-z]/.test(value)) score += 1;
    if (/\d/.test(value)) score += 1;
    if (/[^A-Za-z0-9\s]/.test(value)) score += 1;
    if (/\s/.test(value)) score = Math.max(0, score - 1);

    return Math.min(score, 5);
  }, [senha]);

  const labelForca = useMemo(() => {
    if (!senha) return null;

    if (forcaSenha <= 1) {
      return {
        text: "Fraca",
        className: isDark ? "text-red-300" : "text-red-600",
      };
    }

    if (forcaSenha === 2) {
      return {
        text: "Média",
        className: isDark ? "text-amber-300" : "text-amber-700",
      };
    }

    if (forcaSenha === 3 || forcaSenha === 4) {
      return {
        text: "Boa",
        className: isDark ? "text-sky-300" : "text-sky-700",
      };
    }

    return {
      text: "Forte",
      className: isDark ? "text-emerald-300" : "text-emerald-700",
    };
  }, [forcaSenha, isDark, senha]);

  const camposObrigatoriosStatus = useMemo(() => {
    const status = {
      nome: nome.trim().length > 0,
      cpf: validarCPF(cpf),
      email: validarEmail(email),
      celular: validarCelular(celular),
      data_nascimento: validarDataNascimento(dataNascimento),
      unidade_id: !!unidadeId,
      cargo_id: !!cargoId,
      escolaridade_id: !!escolaridadeId,
      deficiencia_id: !!deficienciaId,
      senha: SENHA_FORTE_RE.test(senha),
      confirmarSenha: !!confirmarSenha && senha === confirmarSenha,
    };

    const labels = {
      nome: "Nome",
      cpf: "CPF",
      email: "E-mail",
      celular: "Celular",
      data_nascimento: "Data de nascimento",
      unidade_id: "Unidade",
      cargo_id: "Cargo",
      escolaridade_id: "Escolaridade",
      deficiencia_id: "Deficiência",
      senha: "Senha",
      confirmarSenha: "Confirmação",
    };

    const preenchidos = REQUIRED_FIELDS.filter((field) => status[field]).length;
    const pendentes = REQUIRED_FIELDS.filter((field) => !status[field]).map(
      (field) => labels[field]
    );

    return {
      total: REQUIRED_FIELDS.length,
      preenchidos,
      pendentes,
    };
  }, [
    cargoId,
    celular,
    confirmarSenha,
    cpf,
    dataNascimento,
    deficienciaId,
    email,
    escolaridadeId,
    nome,
    senha,
    unidadeId,
  ]);

  function limparErrosVisuais() {
    setErro("");
    setErros({});
  }

  function focarPrimeiroErro(fields = {}) {
    const ordem = [
      ["nome", refNome],
      ["cpf", refCpf],
      ["email", refEmail],
      ["celular", refCelular],
      ["registro", refRegistro],
      ["data_nascimento", refData],
      ["unidade_id", refUnidade],
      ["cargo_id", refCargo],
      ["escolaridade_id", refEscolaridade],
      ["deficiencia_id", refDeficiencia],
      ["genero_id", refGenero],
      ["orientacao_sexual_id", refOrientacao],
      ["cor_raca_id", refCorRaca],
      ["senha", refSenha],
      ["novaSenha", refSenha],
      ["confirmarSenha", refConfirmar],
    ];

    const item = ordem.find(([field]) => fields[field]);
    item?.[1]?.current?.focus();
  }

  function aplicarErrosServidor(fields = {}) {
    setErros(fields);
    focarPrimeiroErro(fields);
  }

  function aplicarErrosCliente(fields = {}) {
    setErros(fields);
    focarPrimeiroErro(fields);
  }

  const onBlurNome = useCallback(() => {
    if (!nome) return;

    const formatted = titleCasePtBr(nome);
    if (formatted && formatted !== nome) setNome(formatted);
  }, [nome]);

  const onSenhaKey = useCallback((event) => {
    setCapsOn(event.getModifierState && event.getModifierState("CapsLock"));
  }, []);

  useEffect(() => {
    function onKey(event) {
      if (event.key === "Escape") limparErrosVisuais();

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "enter") {
        document.querySelector("#btn-cadastrar")?.click();
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function validarFormularioCliente() {
    const fields = {};
    const nomeTrim = nome.trim();
    const emailTrim = email.trim().toLowerCase();

    if (!nomeTrim) fields.nome = "Nome é obrigatório.";

    if (!validarCPF(cpf)) {
      fields.cpf = "CPF inválido. Use 000.000.000-00.";
    }

    if (!validarEmail(emailTrim)) fields.email = "E-mail inválido.";

    if (!validarCelular(celular)) {
      fields.celular = "Celular inválido. Informe DDD + número.";
    }

    if (!dataNascimento) {
      fields.data_nascimento = "Data de nascimento é obrigatória.";
    } else if (!validarDataNascimento(dataNascimento)) {
      fields.data_nascimento = "Data de nascimento inválida.";
    }

    if (!unidadeId) fields.unidade_id = "Unidade é obrigatória.";
    if (!cargoId) fields.cargo_id = "Cargo é obrigatório.";
    if (!escolaridadeId) fields.escolaridade_id = "Escolaridade é obrigatória.";
    if (!deficienciaId) fields.deficiencia_id = "Deficiência é obrigatória.";

    if (!SENHA_FORTE_RE.test(senha)) {
      fields.senha =
        "A senha precisa ter 8+ caracteres, com maiúscula, minúscula, número, símbolo e sem espaços.";
    }

    if (senha !== confirmarSenha) {
      fields.confirmarSenha = "As senhas não coincidem.";
    }

    return fields;
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (loading) return;

    if (hpRef.current?.value) {
      toast.error("Falha na validação.");
      return;
    }

    limparErrosVisuais();

    const errosCliente = validarFormularioCliente();

    if (Object.keys(errosCliente).length) {
      aplicarErrosCliente(errosCliente);
      setErro("Revise os campos destacados.");
      toast.warn("Revise os campos destacados antes de enviar.");
      return;
    }

    const payload = {
      nome: nome.trim(),
      cpf: onlyDigits(cpf),
      email: email.trim().toLowerCase(),
      celular: onlyDigits(celular),
      senha,
      unidade_id: Number(unidadeId),
      cargo_id: Number(cargoId),
      escolaridade_id: Number(escolaridadeId),
      deficiencia_id: Number(deficienciaId),
      data_nascimento: dataNascimento,
      genero_id: toNumberOrNull(generoId),
      orientacao_sexual_id: toNumberOrNull(orientacaoSexualId),
      cor_raca_id: toNumberOrNull(corRacaId),
      registro: registro ? registro : null,
    };

    setLoading(true);

    try {
      await apiCadastrarUsuario(payload);

      toast.success("Cadastro realizado com sucesso. Você já pode fazer login.");
      setTimeout(() => navigate("/login"), 800);
    } catch (error) {
      const fields = normalizarFieldErrors(error);
      const message = normalizarErroMensagem(error);

      aplicarErrosServidor(fields);
      setErro(message);
      toast.error(message);

      setSenha("");
      setConfirmarSenha("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <a
        href="#form-cadastro"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow"
      >
        Pular para o formulário
      </a>

      <main
        className={[
          "min-h-screen transition-colors",
          isDark
            ? "bg-gradient-to-b from-zinc-950 to-zinc-900 text-zinc-100"
            : "bg-slate-50 text-slate-900",
        ].join(" ")}
      >
        <header className="relative px-4 pt-4 sm:px-6">
  <div
    className={[
      "relative mx-auto max-w-7xl overflow-hidden rounded-[2.5rem] border backdrop-blur-xl",
      "shadow-[0_30px_120px_-40px_rgba(15,23,42,.85)]",
      isDark
        ? "border-white/10 bg-white/[0.03]"
        : "border-white/70 bg-white/20",
    ].join(" ")}
  >
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,#7c3aed_0%,#4f46e5_45%,#c026d3_100%)]" />
    {isDark ? <div className="absolute inset-0 bg-black/35" /> : null}

    <div
      aria-hidden="true"
      className="absolute inset-0 opacity-[0.08]"
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140' viewBox='0 0 140 140'%3E%3Cg fill='white' fill-opacity='1'%3E%3Ccircle cx='1' cy='1' r='1'/%3E%3C/g%3E%3C/svg%3E\")",
      }}
    />

    <div
      className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-white/20 blur-3xl"
      aria-hidden="true"
    />

    <div
      className="absolute -bottom-28 -right-28 h-80 w-80 rounded-full bg-white/16 blur-3xl"
      aria-hidden="true"
    />

    <div className="relative px-5 py-7 text-center sm:px-8 md:py-8">
      <div className="flex flex-col items-center gap-4">
        <div className="inline-flex rounded-[1.75rem] bg-white p-3 shadow-xl ring-1 ring-white/80">
          <img
            src="/logo_escola.png"
            alt="Logotipo da Escola Municipal de Saúde Pública de Santos"
            className="h-16 w-16 object-contain sm:h-20 sm:w-20"
            loading="eager"
          />
        </div>

        <div className="inline-flex items-center gap-2 text-xs font-semibold text-white/90">
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          <span>Portal oficial • criação segura de conta</span>
        </div>

        <h1 className="text-2xl font-black tracking-[-0.03em] text-white md:text-4xl">
          Cadastro
        </h1>

        <p className="max-w-2xl text-sm leading-relaxed text-white/90 md:text-base">
          Crie sua conta para acessar cursos, presenças, avaliações e
          certificados da Escola da Saúde.
        </p>
      </div>
    </div>

    <div className="h-px w-full bg-white/25" aria-hidden="true" />
  </div>
</header>

        <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 md:py-12">
          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
            <div className="space-y-5 lg:col-span-4">
              <PainelProgresso
                totalObrigatorios={camposObrigatoriosStatus.total}
                preenchidos={camposObrigatoriosStatus.preenchidos}
                pendentes={camposObrigatoriosStatus.pendentes}
                isDark={isDark}
              />

              <RegrasDicasCadastro isDark={isDark} />
            </div>

            <div className="lg:col-span-8">
              <div
                className={[
                  "rounded-3xl border p-5 transition-colors sm:p-6 md:p-8",
                  isDark
                    ? "border-white/10 bg-zinc-900/50 shadow-none"
                    : "border-slate-200 bg-white shadow-xl",
                ].join(" ")}
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={[
                        "flex h-12 w-12 items-center justify-center rounded-2xl border",
                        isDark
                          ? "border-white/10 bg-violet-500/10"
                          : "border-violet-100 bg-violet-50",
                      ].join(" ")}
                    >
                      <UserPlus
                        className={[
                          "h-6 w-6",
                          isDark ? "text-violet-300" : "text-violet-700",
                        ].join(" ")}
                        aria-hidden="true"
                      />
                    </div>

                    <div>
                      <h2 className="text-lg font-extrabold md:text-xl">
                        Criar conta
                      </h2>
                      <p
                        className={[
                          "text-xs",
                          isDark ? "text-zinc-300" : "text-slate-500",
                        ].join(" ")}
                      >
                        Preencha os dados obrigatórios. Os opcionais podem ficar
                        em branco.
                      </p>
                    </div>
                  </div>

                  <span
                    className={[
                      "inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold",
                      isDark
                        ? "border-white/10 bg-zinc-950/40 text-zinc-200"
                        : "border-slate-200 bg-slate-50 text-slate-700",
                    ].join(" ")}
                  >
                    <BadgeCheck className="h-4 w-4" aria-hidden="true" />
                    Cadastro seguro
                  </span>
                </div>

                <form
                  id="form-cadastro"
                  onSubmit={handleSubmit}
                  noValidate
                  className="mt-6 space-y-5"
                  aria-label="Formulário de Cadastro"
                  aria-busy={loading ? "true" : "false"}
                >
                  {erro ? (
                    <div
                      className={[
                        "rounded-2xl border px-4 py-3 text-sm",
                        isDark
                          ? "border-red-400/20 bg-red-500/10 text-red-200"
                          : "border-red-200 bg-red-50 text-red-700",
                      ].join(" ")}
                      role="alert"
                      aria-live="assertive"
                    >
                      <div className="flex gap-2">
                        <AlertTriangle
                          className="mt-0.5 h-4 w-4 shrink-0"
                          aria-hidden="true"
                        />
                        <p>{erro}</p>
                      </div>
                    </div>
                  ) : null}

                  <SectionCard
                    title="Dados pessoais"
                    description="Identificação principal do usuário na plataforma."
                    icon={ClipboardList}
                    isDark={isDark}
                  >
                    <CampoTexto
                      id="nome"
                      label="Nome completo"
                      required
                      error={erros.nome}
                      isDark={isDark}
                    >
                      <input
                        id="nome"
                        ref={refNome}
                        type="text"
                        placeholder="Nome completo"
                        value={nome}
                        onChange={(event) => {
                          setNome(event.target.value);
                          setErros((old) => ({ ...old, nome: "" }));
                        }}
                        onBlur={onBlurNome}
                        className={inputCls(!!erros.nome)}
                        autoComplete="name"
                        autoCapitalize="words"
                        required
                        aria-describedby={erros.nome ? "erro-nome" : undefined}
                        aria-invalid={!!erros.nome}
                      />
                    </CampoTexto>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <CampoTexto
                        id="cpf"
                        label="CPF"
                        required
                        error={erros.cpf}
                        isDark={isDark}
                      >
                        <input
                          id="cpf"
                          ref={refCpf}
                          type="text"
                          placeholder="000.000.000-00"
                          value={cpf}
                          onChange={(event) => {
                            setCpf(aplicarMascaraCPF(event.target.value));
                            setErros((old) => ({ ...old, cpf: "" }));
                          }}
                          maxLength={14}
                          className={inputCls(!!erros.cpf)}
                          autoComplete="username"
                          inputMode="numeric"
                          required
                          aria-describedby={erros.cpf ? "erro-cpf" : undefined}
                          aria-invalid={!!erros.cpf}
                        />
                      </CampoTexto>

                      <CampoTexto
                        id="email"
                        label="E-mail"
                        required
                        error={erros.email}
                        isDark={isDark}
                      >
                        <input
                          id="email"
                          ref={refEmail}
                          type="email"
                          placeholder="seu@email.com"
                          value={email}
                          onChange={(event) => {
                            setEmail(event.target.value);
                            setErros((old) => ({ ...old, email: "" }));
                          }}
                          className={inputCls(!!erros.email)}
                          autoComplete="email"
                          required
                          aria-describedby={
                            erros.email ? "erro-email" : undefined
                          }
                          aria-invalid={!!erros.email}
                        />
                      </CampoTexto>
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <CampoTexto
                        id="celular"
                        label="Celular"
                        required
                        error={erros.celular}
                        hint="Informe DDD + número. Ex.: (13) 99999-9999."
                        isDark={isDark}
                      >
                        <input
                          id="celular"
                          ref={refCelular}
                          type="tel"
                          placeholder="(13) 99999-9999"
                          value={celular}
                          onChange={(event) => {
                            setCelular(
                              aplicarMascaraCelular(event.target.value)
                            );
                            setErros((old) => ({ ...old, celular: "" }));
                          }}
                          maxLength={15}
                          className={inputCls(!!erros.celular)}
                          autoComplete="tel"
                          inputMode="numeric"
                          required
                          aria-describedby={
                            erros.celular ? "erro-celular" : "dica-celular"
                          }
                          aria-invalid={!!erros.celular}
                        />
                      </CampoTexto>

                      <CampoTexto
                        id="data_nascimento"
                        label="Data de nascimento"
                        required
                        error={erros.data_nascimento}
                        isDark={isDark}
                      >
                        <input
                          id="data_nascimento"
                          ref={refData}
                          type="date"
                          value={dataNascimento}
                          max={todayYmd()}
                          onChange={(event) => {
                            setDataNascimento(event.target.value);
                            setErros((old) => ({
                              ...old,
                              data_nascimento: "",
                            }));
                          }}
                          className={inputCls(!!erros.data_nascimento)}
                          required
                          aria-describedby={
                            erros.data_nascimento
                              ? "erro-data_nascimento"
                              : undefined
                          }
                          aria-invalid={!!erros.data_nascimento}
                        />
                      </CampoTexto>
                    </div>

                    <CampoTexto
                      id="registro"
                      label="Registro"
                      optional
                      error={erros.registro}
                      hint="Exclusivo para servidores da Prefeitura. Se não for servidor, deixe em branco."
                      isDark={isDark}
                    >
                      <input
                        id="registro"
                        ref={refRegistro}
                        type="text"
                        placeholder="Ex.: 00.000-0"
                        value={registro}
                        onChange={(event) => {
                          setRegistro(aplicarMascaraRegistro(event.target.value));
                          setErros((old) => ({ ...old, registro: "" }));
                        }}
                        className={inputCls(!!erros.registro)}
                        autoComplete="off"
                        inputMode="numeric"
                        aria-describedby={
                          erros.registro ? "erro-registro" : "dica-registro"
                        }
                        aria-invalid={!!erros.registro}
                      />
                    </CampoTexto>
                  </SectionCard>

                  <SectionCard
                    title="Perfil institucional"
                    description="Campos necessários para vínculo, certificados e relatórios."
                    icon={ShieldCheck}
                    isDark={isDark}
                  >
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <CampoTexto
                        id="unidade_id"
                        label="Unidade"
                        required
                        error={erros.unidade_id}
                        isDark={isDark}
                      >
                        <select
                          id="unidade_id"
                          ref={refUnidade}
                          value={unidadeId}
                          onChange={(event) => {
                            setUnidadeId(event.target.value);
                            setErros((old) => ({ ...old, unidade_id: "" }));
                          }}
                          className={selectCls(!!erros.unidade_id)}
                          disabled={loading || loadinglookup}
                          required
                          aria-describedby={
                            erros.unidade_id ? "erro-unidade_id" : undefined
                          }
                          aria-invalid={!!erros.unidade_id}
                        >
                          <option value="">
                            {loadinglookup ? "Carregando..." : "Selecione…"}
                          </option>
                          {unidades.map((unidade) => (
                            <option key={unidade.id} value={String(unidade.id)}>
                              {unidade.sigla || unidade.nome}
                            </option>
                          ))}
                        </select>
                      </CampoTexto>

                      <CampoTexto
                        id="cargo_id"
                        label="Cargo"
                        required
                        error={erros.cargo_id}
                        isDark={isDark}
                      >
                        <select
                          id="cargo_id"
                          ref={refCargo}
                          value={cargoId}
                          onChange={(event) => {
                            setCargoId(event.target.value);
                            setErros((old) => ({ ...old, cargo_id: "" }));
                          }}
                          className={selectCls(!!erros.cargo_id)}
                          disabled={loading || loadinglookup}
                          required
                          aria-describedby={
                            erros.cargo_id ? "erro-cargo_id" : undefined
                          }
                          aria-invalid={!!erros.cargo_id}
                        >
                          <option value="">
                            {loadinglookup ? "Carregando..." : "Selecione…"}
                          </option>
                          {cargos.map((cargo) => (
                            <option key={cargo.id} value={String(cargo.id)}>
                              {cargo.nome}
                            </option>
                          ))}
                        </select>
                      </CampoTexto>
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <CampoTexto
                        id="escolaridade_id"
                        label="Escolaridade"
                        required
                        error={erros.escolaridade_id}
                        isDark={isDark}
                      >
                        <select
                          id="escolaridade_id"
                          ref={refEscolaridade}
                          value={escolaridadeId}
                          onChange={(event) => {
                            setEscolaridadeId(event.target.value);
                            setErros((old) => ({
                              ...old,
                              escolaridade_id: "",
                            }));
                          }}
                          className={selectCls(!!erros.escolaridade_id)}
                          disabled={loading || loadinglookup}
                          required
                          aria-describedby={
                            erros.escolaridade_id
                              ? "erro-escolaridade_id"
                              : undefined
                          }
                          aria-invalid={!!erros.escolaridade_id}
                        >
                          <option value="">
                            {loadinglookup ? "Carregando..." : "Selecione…"}
                          </option>
                          {escolaridades.map((escolaridade) => (
                            <option
                              key={escolaridade.id}
                              value={String(escolaridade.id)}
                            >
                              {escolaridade.nome}
                            </option>
                          ))}
                        </select>
                      </CampoTexto>

                      <CampoTexto
                        id="deficiencia_id"
                        label="Deficiência"
                        required
                        error={erros.deficiencia_id}
                        hint="Se não possuir deficiência, escolha a opção correspondente."
                        isDark={isDark}
                      >
                        <select
                          id="deficiencia_id"
                          ref={refDeficiencia}
                          value={deficienciaId}
                          onChange={(event) => {
                            setDeficienciaId(event.target.value);
                            setErros((old) => ({
                              ...old,
                              deficiencia_id: "",
                            }));
                          }}
                          className={selectCls(!!erros.deficiencia_id)}
                          disabled={loading || loadinglookup}
                          required
                          aria-describedby={
                            erros.deficiencia_id
                              ? "erro-deficiencia_id"
                              : "dica-deficiencia_id"
                          }
                          aria-invalid={!!erros.deficiencia_id}
                        >
                          <option value="">
                            {loadinglookup ? "Carregando..." : "Selecione…"}
                          </option>
                          {deficiencias.map((deficiencia) => (
                            <option
                              key={deficiencia.id}
                              value={String(deficiencia.id)}
                            >
                              {deficiencia.nome}
                            </option>
                          ))}
                        </select>
                      </CampoTexto>
                    </div>
                  </SectionCard>

                  <SectionCard
                    title="Informações opcionais"
                    description="Esses dados podem ser informados agora ou deixados em branco."
                    icon={Info}
                    isDark={isDark}
                  >
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                      <CampoTexto
                        id="genero_id"
                        label="Gênero"
                        optional
                        error={erros.genero_id}
                        isDark={isDark}
                      >
                        <select
                          id="genero_id"
                          ref={refGenero}
                          value={generoId}
                          onChange={(event) => {
                            setGeneroId(event.target.value);
                            setErros((old) => ({ ...old, genero_id: "" }));
                          }}
                          className={selectCls(!!erros.genero_id)}
                          disabled={loading || loadinglookup}
                          aria-describedby={
                            erros.genero_id ? "erro-genero_id" : undefined
                          }
                          aria-invalid={!!erros.genero_id}
                        >
                          <option value="">
  {loadinglookup ? "Carregando..." : "Selecione…"}
</option>
                          {generos.map((genero) => (
                            <option key={genero.id} value={String(genero.id)}>
                              {genero.nome}
                            </option>
                          ))}
                        </select>
                      </CampoTexto>

                      <CampoTexto
                        id="orientacao_sexual_id"
                        label="Orientação sexual"
                        optional
                        error={erros.orientacao_sexual_id}
                        isDark={isDark}
                      >
                        <select
                          id="orientacao_sexual_id"
                          ref={refOrientacao}
                          value={orientacaoSexualId}
                          onChange={(event) => {
                            setOrientacaoSexualId(event.target.value);
                            setErros((old) => ({
                              ...old,
                              orientacao_sexual_id: "",
                            }));
                          }}
                          className={selectCls(!!erros.orientacao_sexual_id)}
                          disabled={loading || loadinglookup}
                          aria-describedby={
                            erros.orientacao_sexual_id
                              ? "erro-orientacao_sexual_id"
                              : undefined
                          }
                          aria-invalid={!!erros.orientacao_sexual_id}
                        >
                          <option value="">
  {loadinglookup ? "Carregando..." : "Selecione…"}
</option>
                          {orientacoesSexuais.map((orientacao) => (
                            <option
                              key={orientacao.id}
                              value={String(orientacao.id)}
                            >
                              {orientacao.nome}
                            </option>
                          ))}
                        </select>
                      </CampoTexto>

                      <CampoTexto
                        id="cor_raca_id"
                        label="Cor/raça"
                        optional
                        error={erros.cor_raca_id}
                        isDark={isDark}
                      >
                        <select
                          id="cor_raca_id"
                          ref={refCorRaca}
                          value={corRacaId}
                          onChange={(event) => {
                            setCorRacaId(event.target.value);
                            setErros((old) => ({ ...old, cor_raca_id: "" }));
                          }}
                          className={selectCls(!!erros.cor_raca_id)}
                          disabled={loading || loadinglookup}
                          aria-describedby={
                            erros.cor_raca_id ? "erro-cor_raca_id" : undefined
                          }
                          aria-invalid={!!erros.cor_raca_id}
                        >
                          <option value="">
  {loadinglookup ? "Carregando..." : "Selecione…"}
</option>
                          {coresRacas.map((cor) => (
                            <option key={cor.id} value={String(cor.id)}>
                              {cor.nome}
                            </option>
                          ))}
                        </select>
                      </CampoTexto>
                    </div>
                  </SectionCard>

                  <SectionCard
                    title="Segurança"
                    description="Defina uma senha forte para proteger sua conta."
                    icon={LockKeyhole}
                    isDark={isDark}
                  >
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <CampoTexto
                        id="senha"
                        label="Senha"
                        required
                        error={erros.senha}
                        hint="Use maiúscula, minúscula, número e símbolo."
                        isDark={isDark}
                      >
                        <div className="relative">
                          <input
                            id="senha"
                            ref={refSenha}
                            type={mostrarSenha ? "text" : "password"}
                            placeholder="Senha forte"
                            value={senha}
                            onChange={(event) => {
                              setSenha(event.target.value);
                              setErros((old) => ({ ...old, senha: "" }));
                            }}
                            onKeyUp={onSenhaKey}
                            onKeyDown={onSenhaKey}
                            className={[inputCls(!!erros.senha), "pr-12"].join(
                              " "
                            )}
                            autoComplete="new-password"
                            required
                            aria-describedby={
                              erros.senha ? "erro-senha" : "dica-senha"
                            }
                            aria-invalid={!!erros.senha}
                          />

                          <button
                            type="button"
                            onClick={() => setMostrarSenha((value) => !value)}
                            className={[
                              "absolute right-2 top-1/2 -translate-y-1/2 rounded-xl px-2.5 py-2",
                              "focus:outline-none focus:ring-2 focus:ring-emerald-500/70",
                              isDark
                                ? "text-zinc-300 hover:bg-white/10"
                                : "text-slate-600 hover:bg-slate-100",
                            ].join(" ")}
                            aria-label={
                              mostrarSenha ? "Ocultar senha" : "Mostrar senha"
                            }
                          >
                            {mostrarSenha ? (
                              <EyeOff size={18} aria-hidden="true" />
                            ) : (
                              <Eye size={18} aria-hidden="true" />
                            )}
                          </button>
                        </div>

                        {capsOn ? (
                          <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-300">
                            <AlertTriangle size={12} aria-hidden="true" />
                            Caps Lock ativo
                          </p>
                        ) : null}

                        {senha ? (
                          <div className="mt-2">
                            <div className="flex items-center justify-between">
                              <span
                                className={[
                                  "text-[11px] font-bold",
                                  isDark ? "text-zinc-400" : "text-slate-500",
                                ].join(" ")}
                              >
                                Força
                              </span>
                              <span
                                className={[
                                  "text-[11px] font-extrabold",
                                  labelForca?.className || "",
                                ].join(" ")}
                              >
                                {labelForca?.text}
                              </span>
                            </div>

                            <div
                              className={[
                                "mt-1 h-2 overflow-hidden rounded-full",
                                isDark ? "bg-white/10" : "bg-slate-200",
                              ].join(" ")}
                            >
                              <div
                                className={[
                                  "h-full rounded-full transition-all duration-300",
                                  forcaSenha <= 1
                                    ? "w-1/5 bg-red-500"
                                    : forcaSenha === 2
                                      ? "w-2/5 bg-amber-500"
                                      : forcaSenha === 3
                                        ? "w-3/5 bg-sky-500"
                                        : forcaSenha === 4
                                          ? "w-4/5 bg-sky-500"
                                          : "w-full bg-emerald-500",
                                ].join(" ")}
                              />
                            </div>
                          </div>
                        ) : null}
                      </CampoTexto>

                      <CampoTexto
                        id="confirmarSenha"
                        label="Confirmar senha"
                        required
                        error={erros.confirmarSenha}
                        isDark={isDark}
                      >
                        <input
                          id="confirmarSenha"
                          ref={refConfirmar}
                          type="password"
                          placeholder="Confirmar senha"
                          value={confirmarSenha}
                          onChange={(event) => {
                            setConfirmarSenha(event.target.value);
                            setErros((old) => ({
                              ...old,
                              confirmarSenha: "",
                            }));
                          }}
                          className={inputCls(!!erros.confirmarSenha)}
                          autoComplete="new-password"
                          required
                          aria-describedby={
                            erros.confirmarSenha
                              ? "erro-confirmarSenha"
                              : undefined
                          }
                          aria-invalid={!!erros.confirmarSenha}
                        />
                      </CampoTexto>
                    </div>

                    <div aria-hidden="true" className="hidden">
                      <label>Deixe em branco</label>
                      <input
                        ref={hpRef}
                        type="text"
                        tabIndex={-1}
                        autoComplete="off"
                      />
                    </div>
                  </SectionCard>

                  <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:gap-3">
                    <BotaoLocal
                      id="btn-cadastrar"
                      type="submit"
                      className="w-full"
                      disabled={loading || loadinglookup}
                      loading={loading}
                      aria-busy={loading}
                      leftIcon={<UserPlus size={16} aria-hidden="true" />}
                    >
                      {loading ? "Cadastrando..." : "Cadastrar"}
                    </BotaoLocal>

                    <BotaoLocal
                      type="button"
                      variant="secondary"
                      onClick={() => navigate("/login")}
                      className="w-full"
                      disabled={loading}
                    >
                      Voltar para login
                    </BotaoLocal>
                  </div>

                  <div
                    className={[
                      "rounded-2xl border px-4 py-3 text-[11px]",
                      isDark
                        ? "border-white/10 bg-zinc-950/30 text-zinc-400"
                        : "border-slate-200 bg-slate-50 text-slate-500",
                    ].join(" ")}
                  >
                    <div className="flex gap-2">
                      <Phone
                        className="mt-0.5 h-4 w-4 shrink-0"
                        aria-hidden="true"
                      />
                      <p>
                        Ao se cadastrar, você concorda com o uso dos seus dados
                        para controle de eventos, presença, avaliação e
                        certificação.
                      </p>
                    </div>
                  </div>

                  <p
                    className={[
                      "mt-2 flex flex-wrap items-center justify-center gap-2 text-center text-[11px]",
                      isDark ? "text-zinc-400" : "text-slate-600",
                    ].join(" ")}
                  >
                    <HelpCircle size={14} aria-hidden="true" />
                    <a
                      href="/privacidade"
                      target="_blank"
                      rel="noreferrer"
                      className="underline underline-offset-2 hover:opacity-90"
                    >
                      Privacidade
                    </a>
                  </p>

                  <div className="sr-only" aria-live="polite">
                    {loading ? "Enviando cadastro" : ""}
                  </div>
                </form>
              </div>
            </div>
          </div>
        </section>

        <Footer />
      </main>
    </>
  );
}