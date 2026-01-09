// src/validators/usuario.schema.ts
import { z } from "zod";

// normaliza removendo caracteres fora do conjunto permitido
// (mantém letras, dígitos e alguns símbolos comuns de e-mail)
const strip = (s: unknown = "") => String(s ?? "").replace(/[^\dA-Za-z@._-]/g, "");

// só dígitos (ideal para cpf/registro)
const digits = (s: unknown = "") => String(s ?? "").replace(/\D+/g, "");

const isValidIsoDateOnly = (s: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  if (!Number.isInteger(y) || y < 1900 || y > 2200) return false;
  if (!Number.isInteger(m) || m < 1 || m > 12) return false;
  if (!Number.isInteger(d) || d < 1 || d > 31) return false;
  // valida dia real do mês (UTC, sem fuso)
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
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

// aceita number ou string numérica (form costuma mandar string)
const idPositivo = (msg: string) =>
  z.coerce.number().int().positive(msg);

export const UsuarioCadastroSchema = z
  .object({
    nome: z
      .string()
      .trim()
      .min(3, "Nome muito curto.")
      .max(120, "Nome muito longo."),

    cpf: z
      .string()
      .transform((v) => digits(v))
      .refine(cpfValido, "CPF inválido."),

    email: z
      .string()
      .trim()
      .toLowerCase()
      .email("E-mail inválido.")
      .max(160, "E-mail muito longo."),

    // registro pode vir vazio, com máscara, etc. → vira null
    registro: z
      .string()
      .optional()
      .transform((v) => {
        const s = digits(v ?? "");
        return s.length ? s : null;
      }),

    // YYYY-MM-DD (data real, sem fuso)
    dataNascimento: z
      .string()
      .refine(isValidIsoDateOnly, "Data no formato YYYY-MM-DD (válida)."),

    cargoId: idPositivo("Selecione um cargo."),
    unidadeId: idPositivo("Selecione uma unidade."),
    generoId: idPositivo("Selecione o gênero."),

  })
  .strict();
