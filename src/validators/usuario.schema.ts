// src/validators/usuario.schema.ts
import { z } from "zod";

// normaliza "38.959-3" → "389593" e "340.502.828-01" → "34050282801"
const strip = (s='') => String(s).replace(/[^\dA-Za-z@._-]/g, "");

const cpfValido = (cpf) => {
  cpf = strip(cpf);
  if (!/^\d{11}$/.test(cpf)) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;
  const calc = (base) => {
    let sum = 0;
    for (let i = 0; i < base.length; i++) sum += parseInt(base[i]) * (base.length + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  const d1 = calc(cpf.slice(0,9));
  const d2 = calc(cpf.slice(0,10));
  return d1 === parseInt(cpf[9]) && d2 === parseInt(cpf[10]);
};

export const UsuarioCadastroSchema = z.object({
  nome: z.string().min(3, "Nome muito curto."),
  cpf: z.string().refine(cpfValido, "CPF inválido."),
  email: z.string().email("E-mail inválido."),
  registro: z.string().optional(), // pode aceitar vazio
  dataNascimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data no formato YYYY-MM-DD."),
  cargoId: z.number().int().positive("Selecione um cargo."),
  unidadeId: z.number().int().positive("Selecione uma unidade."),
  generoId: z.number().int().positive("Selecione o gênero."),
  // ...demais obrigatórios conforme seu modelo
}).transform((v) => ({
  ...v,
  cpf: strip(v.cpf),
  registro: v.registro ? strip(v.registro) : null,
}));
