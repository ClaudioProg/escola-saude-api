// 📁 src/components/ModalEditarUsuario.jsx
import { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import Modal from "./Modal";
import { toast } from "react-toastify";
import { User, Mail, BadgeAsterisk } from "lucide-react";
import { apiPut } from "../services/api";
import { formatarCPF as formatarCPFUtils } from "../utils/data";

/* ================= Helpers ================= */
const somenteDigitos = (s = "") => s.replace(/\D/g, "");
const isEmail = (s = "") => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s).trim());

/** Validação oficial dos dígitos do CPF (sem máscara) */
function validarCPF(cpf) {
  const c = somenteDigitos(cpf);
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;

  // primeiro dígito
  let soma = 0;
  for (let i = 0; i < 9; i++) soma += Number(c[i]) * (10 - i);
  let d1 = (soma * 10) % 11;
  if (d1 === 10) d1 = 0;
  if (d1 !== Number(c[9])) return false;

  // segundo dígito
  soma = 0;
  for (let i = 0; i < 10; i++) soma += Number(c[i]) * (11 - i);
  let d2 = (soma * 10) % 11;
  if (d2 === 10) d2 = 0;

  return d2 === Number(c[10]);
}

/* ================= Componente ================= */
export default function ModalEditarUsuario({ isOpen, onClose, usuario, onAtualizar }) {
  const [nome, setNome] = useState(usuario?.nome || "");
  const [email, setEmail] = useState(usuario?.email || "");
  const [cpf, setCpf] = useState(somenteDigitos(usuario?.cpf || ""));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState({});

  // 🔄 sincroniza quando abre ou quando o 'usuario' muda
  useEffect(() => {
    setNome(usuario?.nome || "");
    setEmail(usuario?.email || "");
    setCpf(somenteDigitos(usuario?.cpf || ""));
    setErro({});
    setSalvando(false);
  }, [usuario, isOpen]);

  const cpfFormatado = useMemo(() => formatarCPFUtils?.(cpf) || cpf, [cpf]);

  // validações simples
  const erros = useMemo(() => {
    const e = {};
    if (!nome.trim()) e.nome = "Informe o nome completo.";
    if (!email.trim() || !isEmail(email)) e.email = "Informe um e-mail válido.";
    const dig = somenteDigitos(cpf);
    if (dig.length !== 11) e.cpf = "CPF deve ter 11 dígitos.";
    else if (!validarCPF(dig)) e.cpf = "CPF inválido.";
    return e;
  }, [nome, email, cpf]);

  const possuiErros = Object.keys(erros).length > 0;

  const handleSalvar = async () => {
    setErro({});
    if (possuiErros) {
      setErro(erros);
      toast.warning("⚠️ Corrija os campos destacados.");
      return;
    }

    try {
      setSalvando(true);
      await apiPut(`/api/usuarios/${usuario.id}`, {
        nome: nome.trim(),
        email: email.trim(),
        cpf: somenteDigitos(cpf),
      });
      toast.success("✅ Usuário atualizado com sucesso!");
      onAtualizar?.();
      onClose?.();
    } catch (e) {
      const msg =
        e?.data?.mensagem || e?.data?.message || e?.message || "Erro ao atualizar o usuário.";
      toast.error(`❌ ${msg}`);
    } finally {
      setSalvando(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      open={isOpen}
      onClose={salvando ? undefined : onClose} // bloqueia fechar enquanto salva
      labelledBy="titulo-editar-usuario"
      describedBy="desc-editar-usuario"
      className="w-[96%] max-w-lg p-0 overflow-hidden"
    >
      {/* Header hero (altura/tipografia padronizadas; degradê 3 cores exclusivo) */}
      <header
        className="px-4 sm:px-6 py-4 text-white bg-gradient-to-br from-slate-900 via-slate-800 to-teal-700"
        role="group"
        aria-label="Edição de usuário"
      >
        <h2 id="titulo-editar-usuario" className="text-xl sm:text-2xl font-extrabold tracking-tight">
          ✏️ Editar Usuário
        </h2>
        <p id="desc-editar-usuario" className="text-white/90 text-sm mt-1">
          Atualize nome, e-mail e CPF de <strong>{usuario?.nome ?? "usuário"}</strong>.
        </p>
      </header>

      {/* Formulário */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSalvar();
        }}
        className="px-4 sm:px-6 pt-4 pb-24 space-y-4"
      >
        {/* Nome */}
        <div>
          <label className="block text-sm font-medium mb-1 text-slate-800 dark:text-slate-200" htmlFor="edt-nome">
            Nome completo
          </label>
          <div className="relative">
            <User className="absolute left-3 top-3 text-slate-500" size={18} aria-hidden />
            <input
              id="edt-nome"
              type="text"
              placeholder="Nome completo"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              disabled={salvando}
              aria-invalid={!!erro.nome}
              autoComplete="name"
              className={[
                "w-full pl-10 py-2 border rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100",
                erro.nome
                  ? "border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  : "border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500",
              ].join(" ")}
            />
          </div>
          {erro.nome && <p className="text-xs text-rose-600 mt-1">{erro.nome}</p>}
        </div>

        {/* E-mail */}
        <div>
          <label className="block text-sm font-medium mb-1 text-slate-800 dark:text-slate-200" htmlFor="edt-email">
            E-mail
          </label>
        <div className="relative">
            <Mail className="absolute left-3 top-3 text-slate-500" size={18} aria-hidden />
            <input
              id="edt-email"
              type="email"
              placeholder="E-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={salvando}
              aria-invalid={!!erro.email}
              autoComplete="email"
              className={[
                "w-full pl-10 py-2 border rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100",
                erro.email
                  ? "border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  : "border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500",
              ].join(" ")}
            />
          </div>
          {erro.email && <p className="text-xs text-rose-600 mt-1">{erro.email}</p>}
        </div>

        {/* CPF */}
        <div>
          <label className="block text-sm font-medium mb-1 text-slate-800 dark:text-slate-200" htmlFor="edt-cpf">
            CPF
          </label>
          <div className="relative">
            <BadgeAsterisk className="absolute left-3 top-3 text-slate-500" size={18} aria-hidden />
            <input
              id="edt-cpf"
              inputMode="numeric"
              placeholder="000.000.000-00"
              value={cpfFormatado}
              onChange={(e) => setCpf(somenteDigitos(e.target.value))}
              disabled={salvando}
              aria-invalid={!!erro.cpf}
              autoComplete="off"
              maxLength={14} // 000.000.000-00
              className={[
                "w-full pl-10 py-2 border rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100",
                erro.cpf
                  ? "border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  : "border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500",
              ].join(" ")}
            />
          </div>
          {erro.cpf && <p className="text-xs text-rose-600 mt-1">{erro.cpf}</p>}
        </div>
      </form>

      {/* Rodapé sticky (mobile-first) */}
      <div className="sticky bottom-0 left-0 right-0 bg-white/85 dark:bg-zinc-950/85 backdrop-blur border-t border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={salvando}
          className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100 hover:bg-slate-300 dark:hover:bg-slate-700 transition disabled:opacity-60"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleSalvar}
          disabled={salvando || possuiErros}
          className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition disabled:opacity-60 disabled:cursor-not-allowed"
          aria-busy={salvando ? "true" : "false"}
        >
          {salvando ? "Salvando..." : "Salvar"}
        </button>
      </div>
    </Modal>
  );
}

ModalEditarUsuario.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func,
  usuario: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
    nome: PropTypes.string,
    email: PropTypes.string,
    cpf: PropTypes.string,
  }).isRequired,
  onAtualizar: PropTypes.func,
};
