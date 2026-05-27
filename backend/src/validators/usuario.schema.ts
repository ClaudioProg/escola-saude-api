// 📁 src/validators/usuario.schema.ts — v2.0
import { z } from "zod";

/**
 * Plataforma Escola da Saúde
 *
 * Schemas oficiais de usuário.
 *
 * Contrato:
 * - Cadastro básico: nome, CPF, e-mail, senha e celular.
 * - Perfil institucional: unidade, cargo, data de nascimento,
 *   escolaridade e deficiência.
 *
 * Campos opcionais:
 * - registro
 * - genero_id
 * - orientacao_sexual_id
 * - cor_raca_id
 *
 * Regra anti-fuso:
 * - Datas date-only são tratadas como string YYYY-MM-DD.
 * - Não usar new Date("YYYY-MM-DD").
 */

/* =========================
   Helpers
========================= */

const SENHA_FORTE_RE =
  /^(?=\S{8,}$)(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).*$/;

function digits(value: unknown = "") {
  return String(value ?? "").replace(/\D+/g, "");
}

function sanitizeEmail(value: unknown = "") {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^\dA-Za-z@._+-]/g, "");
}

function isValidIsoDateOnly(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const [year, month, day] = value.split("-").map(Number);

  if (!Number.isInteger(year) || year < 1900 || year > 2200) return false;
  if (!Number.isInteger(month) || month < 1 || month > 12) return false;
  if (!Number.isInteger(day) || day < 1 || day > 31) return false;

  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function getTodayDateOnlySaoPaulo() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function isNotFutureIsoDateOnly(value: string) {
  if (!isValidIsoDateOnly(value)) return false;

  return value <= getTodayDateOnlySaoPaulo();
}

function cpfValido(cpfRaw: unknown) {
  const cpf = digits(cpfRaw);

  if (!/^\d{11}$/.test(cpf)) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  const calc = (base: string) => {
    let sum = 0;

    for (let index = 0; index < base.length; index += 1) {
      sum += Number(base[index]) * (base.length + 1 - index);
    }

    const result = (sum * 10) % 11;

    return result === 10 ? 0 : result;
  };

  const digit1 = calc(cpf.slice(0, 9));
  const digit2 = calc(cpf.slice(0, 10));

  return digit1 === Number(cpf[9]) && digit2 === Number(cpf[10]);
}

function celularValido(value: unknown) {
  const celular = digits(value);

  return /^(\d{10}|\d{11})$/.test(celular);
}

const idPositivo = (message: string) =>
  z.coerce
    .number({
      invalid_type_error: message,
      required_error: message,
    })
    .int({ message })
    .positive({ message });

const idPositivoOpcional = z
  .union([z.string(), z.number(), z.null(), z.undefined()])
  .optional()
  .transform((value) => {
    if (value === null || value === undefined || value === "") return null;

    const number = Number(value);

    if (!Number.isInteger(number) || number <= 0) return null;

    return number;
  });

/* =========================
   Campos reutilizáveis
========================= */

const NomeSchema = z
  .string({
    required_error: "Nome é obrigatório.",
    invalid_type_error: "Nome inválido.",
  })
  .trim()
  .min(3, "Nome muito curto.")
  .max(120, "Nome muito longo.");

const CpfSchema = z
  .string({
    required_error: "CPF é obrigatório.",
    invalid_type_error: "CPF inválido.",
  })
  .transform((value) => digits(value))
  .refine((value) => /^\d{11}$/.test(value), "CPF deve conter 11 dígitos.")
  .refine(cpfValido, "CPF inválido.");

const EmailSchema = z
  .string({
    required_error: "E-mail é obrigatório.",
    invalid_type_error: "E-mail inválido.",
  })
  .transform((value) => sanitizeEmail(value))
  .pipe(z.string().email("E-mail inválido.").max(160, "E-mail muito longo."));

const SenhaSchema = z
  .string({
    required_error: "Senha é obrigatória.",
    invalid_type_error: "Senha inválida.",
  })
  .min(8, "A senha deve ter no mínimo 8 caracteres.")
  .max(120, "A senha é muito longa.")
  .refine(
    (value) => SENHA_FORTE_RE.test(value),
    "A senha deve ter maiúscula, minúscula, número, símbolo e não pode conter espaços."
  );

const CelularSchema = z
  .string({
    required_error: "Celular é obrigatório.",
    invalid_type_error: "Celular inválido.",
  })
  .transform((value) => digits(value))
  .refine(celularValido, "Celular deve conter 10 ou 11 dígitos.");

const RegistroSchema = z
  .union([z.string(), z.number(), z.null(), z.undefined()])
  .optional()
  .transform((value) => {
    const registro = digits(value ?? "");

    if (!registro.length) return null;

    return registro.slice(0, 7);
  })
  .refine(
    (value) => value === null || /^\d{6,7}$/.test(value),
    "Registro deve conter 6 ou 7 dígitos."
  );

const DataNascimentoSchema = z
  .string({
    required_error: "Data de nascimento é obrigatória.",
    invalid_type_error: "Data de nascimento inválida.",
  })
  .trim()
  .refine(isValidIsoDateOnly, "Data no formato YYYY-MM-DD válida.")
  .refine(isNotFutureIsoDateOnly, "Data de nascimento não pode ser futura.");

/* =========================
   Cadastro básico
========================= */

export const UsuarioCadastroSchema = z
  .object({
    nome: NomeSchema,
    cpf: CpfSchema,
    email: EmailSchema,
    senha: SenhaSchema,
    celular: CelularSchema,
    registro: RegistroSchema,
  })
  .strict()
  .transform((data) => ({
    nome: data.nome,
    cpf: data.cpf,
    email: data.email,
    senha: data.senha,
    celular: data.celular,
    registro: data.registro,
  }));

/* =========================
   Perfil institucional
========================= */

export const UsuarioPerfilSchema = z
  .object({
    cargoId: idPositivo("Selecione um cargo."),
    unidadeId: idPositivo("Selecione uma unidade."),
    dataNascimento: DataNascimentoSchema,
    escolaridadeId: idPositivo("Selecione a escolaridade."),
    deficienciaId: idPositivo("Selecione a deficiência."),

    generoId: idPositivoOpcional,
    orientacaoSexualId: idPositivoOpcional,
    corRacaId: idPositivoOpcional,
    registro: RegistroSchema,
  })
  .strict()
  .transform((data) => ({
    cargo_id: data.cargoId,
    unidade_id: data.unidadeId,
    data_nascimento: data.dataNascimento,
    escolaridade_id: data.escolaridadeId,
    deficiencia_id: data.deficienciaId,

    genero_id: data.generoId,
    orientacao_sexual_id: data.orientacaoSexualId,
    cor_raca_id: data.corRacaId,
    registro: data.registro,
  }));

/* =========================
   Cadastro + perfil completo
   Uso opcional para fluxos administrativos
========================= */

export const UsuarioCadastroCompletoSchema = z
  .object({
    nome: NomeSchema,
    cpf: CpfSchema,
    email: EmailSchema,
    senha: SenhaSchema,
    celular: CelularSchema,
    registro: RegistroSchema,

    cargoId: idPositivo("Selecione um cargo."),
    unidadeId: idPositivo("Selecione uma unidade."),
    dataNascimento: DataNascimentoSchema,
    escolaridadeId: idPositivo("Selecione a escolaridade."),
    deficienciaId: idPositivo("Selecione a deficiência."),

    generoId: idPositivoOpcional,
    orientacaoSexualId: idPositivoOpcional,
    corRacaId: idPositivoOpcional,
  })
  .strict()
  .transform((data) => ({
    nome: data.nome,
    cpf: data.cpf,
    email: data.email,
    senha: data.senha,
    celular: data.celular,
    registro: data.registro,

    cargo_id: data.cargoId,
    unidade_id: data.unidadeId,
    data_nascimento: data.dataNascimento,
    escolaridade_id: data.escolaridadeId,
    deficiencia_id: data.deficienciaId,

    genero_id: data.generoId,
    orientacao_sexual_id: data.orientacaoSexualId,
    cor_raca_id: data.corRacaId,
  }));

/* =========================
   Tipos úteis
========================= */

export type UsuarioCadastroInput = z.input<typeof UsuarioCadastroSchema>;
export type UsuarioCadastroPayload = z.output<typeof UsuarioCadastroSchema>;

export type UsuarioPerfilInput = z.input<typeof UsuarioPerfilSchema>;
export type UsuarioPerfilPayload = z.output<typeof UsuarioPerfilSchema>;

export type UsuarioCadastroCompletoInput = z.input<
  typeof UsuarioCadastroCompletoSchema
>;
export type UsuarioCadastroCompletoPayload = z.output<
  typeof UsuarioCadastroCompletoSchema
>;