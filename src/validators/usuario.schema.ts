// src/validators/usuario.schema.ts
import { z } from "zod";

/* =========================
   Helpers
========================= */

// remove caracteres fora do conjunto permitido
const strip = (s: unknown = "") => String(s ?? "").replace(/[^\dA-Za-z@._-]/g, "");

// mantém só dígitos
const digits = (s: unknown = "") => String(s ?? "").replace(/\D+/g, "");

// senha forte alinhada ao backend
const SENHA_FORTE_RE = /^(?=\S{8,}$)(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).*$/;

const isValidIsoDateOnly = (s: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;

  const [y, m, d] = s.split("-").map(Number);

  if (!Number.isInteger(y) || y < 1900 || y > 2200) return false;
  if (!Number.isInteger(m) || m < 1 || m > 12) return false;
  if (!Number.isInteger(d) || d < 1 || d > 31) return false;

  const dt = new Date(Date.UTC(y, m - 1, d));

  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
};

const isNotFutureIsoDateOnly = (s: string) => {
  if (!isValidIsoDateOnly(s)) return false;

  const [y, m, d] = s.split("-").map(Number);
  const valueUTC = Date.UTC(y, m - 1, d);

  const now = new Date();
  const todayUTC = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  );

  return valueUTC <= todayUTC;
};

const cpfValido = (cpfRaw: unknown) => {
  const cpf = digits(cpfRaw);

  if (!/^\d{11}$/.test(cpf)) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  const calc = (base: string) => {
    let sum = 0;

    for (let i = 0; i < base.length; i++) {
      sum += Number(base[i]) * (base.length + 1 - i);
    }

    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };

  const d1 = calc(cpf.slice(0, 9));
  const d2 = calc(cpf.slice(0, 10));

  return d1 === Number(cpf[9]) && d2 === Number(cpf[10]);
};

const idPositivo = (msg: string) =>
  z.coerce
    .number({
      invalid_type_error: msg,
      required_error: msg,
    })
    .int({ message: msg })
    .positive({ message: msg });

/* =========================
   Schema principal
========================= */

export const UsuarioCadastroSchema = z
  .object({
    nome: z
      .string({
        required_error: "Nome é obrigatório.",
        invalid_type_error: "Nome inválido.",
      })
      .trim()
      .min(3, "Nome muito curto.")
      .max(120, "Nome muito longo."),

    cpf: z
      .string({
        required_error: "CPF é obrigatório.",
        invalid_type_error: "CPF inválido.",
      })
      .transform((v) => digits(v))
      .refine((v) => /^\d{11}$/.test(v), "CPF deve conter 11 dígitos.")
      .refine(cpfValido, "CPF inválido."),

    email: z
      .string({
        required_error: "E-mail é obrigatório.",
        invalid_type_error: "E-mail inválido.",
      })
      .trim()
      .toLowerCase()
      .transform((v) => strip(v))
      .email("E-mail inválido.")
      .max(160, "E-mail muito longo."),

    senha: z
      .string({
        required_error: "Senha é obrigatória.",
        invalid_type_error: "Senha inválida.",
      })
      .min(8, "A senha deve ter no mínimo 8 caracteres.")
      .max(120, "A senha é muito longa.")
      .refine(
        (v) => SENHA_FORTE_RE.test(v),
        "A senha deve ter maiúscula, minúscula, número, símbolo e não pode conter espaços."
      ),

    // registro opcional: vira null quando vazio
    registro: z
      .union([z.string(), z.number()])
      .optional()
      .transform((v) => {
        const s = digits(v ?? "");
        if (!s.length) return null;
        return s.slice(0, 7);
      })
      .refine(
        (v) => v === null || /^\d{6,7}$/.test(v),
        "Registro deve conter 6 ou 7 dígitos."
      ),

    dataNascimento: z
      .string({
        required_error: "Data de nascimento é obrigatória.",
        invalid_type_error: "Data de nascimento inválida.",
      })
      .trim()
      .refine(isValidIsoDateOnly, "Data no formato YYYY-MM-DD (válida).")
      .refine(isNotFutureIsoDateOnly, "Data de nascimento não pode ser futura."),

    cargoId: idPositivo("Selecione um cargo."),
    unidadeId: idPositivo("Selecione uma unidade."),
    generoId: idPositivo("Selecione o gênero."),
    orientacaoSexualId: idPositivo("Selecione a orientação sexual."),
    corRacaId: idPositivo("Selecione cor/raça."),
    escolaridadeId: idPositivo("Selecione a escolaridade."),
    deficienciaId: idPositivo("Selecione a deficiência."),
  })
  .strict()
  .transform((data) => ({
    nome: data.nome,
    cpf: data.cpf,
    email: data.email,
    senha: data.senha,
    registro: data.registro,
    data_nascimento: data.dataNascimento,
    cargo_id: data.cargoId,
    unidade_id: data.unidadeId,
    genero_id: data.generoId,
    orientacao_sexual_id: data.orientacaoSexualId,
    cor_raca_id: data.corRacaId,
    escolaridade_id: data.escolaridadeId,
    deficiencia_id: data.deficienciaId,
  }));

/* =========================
   Tipos úteis
========================= */

export type UsuarioCadastroInput = z.input<typeof UsuarioCadastroSchema>;
export type UsuarioCadastroPayload = z.output<typeof UsuarioCadastroSchema>;