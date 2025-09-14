// 📁 src/components/ModalEditarUsuario.jsx
import { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import Modal from "react-modal";
import { toast } from "react-toastify";
import { User, Mail, BadgeAsterisk } from "lucide-react";
import { apiPut } from "../services/api";
import { formatarCPF as formatarCPFUtils } from "../utils/data";

// helpers
const somenteDigitos = (s = "") => s.replace(/\D/g, "");
const isEmail = (s = "") =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s).trim());

/** Validação oficial dos dígitos do CPF (sem máscara) */
function validarCPF(cpf) {
  const c = somenteDigitos(cpf);
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  let soma = 0;
  for (let i = 0; i < 9; i++) soma += Number(c[i]) * (10 - i);
  let d1 = (soma * 10) % 11;
  if (d1 === 10) d1 = 0;
  if (d1 !== Number(c[9])) return false;
  soma = 0;
  for (let i = 0; i < 10; i) soma += Number(c[i]) * (11 - i++);
  let d2 = (soma * 10) % 11;
  if (d2 === 10) d2 = 0;
  return d2 === Number(c[10]);
}

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
    if (somenteDigitos(cpf).length !== 11) e.cpf = "CPF deve ter 11 dígitos.";
    else if (!validarCPF(cpf)) e.cpf = "CPF inválido.";
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
    } catch {
      toast.error("❌ Erro ao atualizar o usuário.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={salvando ? undefined : onClose}
      shouldCloseOnOverlayClick={!salvando}
      ariaHideApp={false}
      contentLabel="Editar usuário"
      className="modal"
      overlayClassName="overlay"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSalvar();
        }}
        className="space-y-4"
      >
        <h2 className="text-xl font-bold text-lousa dark:text-white">✏️ Editar Usuário</h2>

        {/* Nome */}
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="edt-nome">
            Nome completo
          </label>
          <div className="relative">
            <User className="absolute left-3 top-3 text-gray-500" size={18} aria-hidden />
            <input
              id="edt-nome"
              type="text"
              placeholder="Nome completo"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              disabled={salvando}
              aria-invalid={!!erro.nome}
              className={`w-full pl-10 py-2 border rounded-md ${erro.nome ? "border-red-500" : ""}`}
            />
          </div>
          {erro.nome && <p className="text-xs text-red-600 mt-1">{erro.nome}</p>}
        </div>

        {/* E-mail */}
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="edt-email">
            E-mail
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-3 text-gray-500" size={18} aria-hidden />
            <input
              id="edt-email"
              type="email"
              placeholder="E-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={salvando}
              aria-invalid={!!erro.email}
              className={`w-full pl-10 py-2 border rounded-md ${erro.email ? "border-red-500" : ""}`}
            />
          </div>
          {erro.email && <p className="text-xs text-red-600 mt-1">{erro.email}</p>}
        </div>

        {/* CPF */}
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="edt-cpf">
            CPF
          </label>
          <div className="relative">
            <BadgeAsterisk className="absolute left-3 top-3 text-gray-500" size={18} aria-hidden />
            <input
              id="edt-cpf"
              inputMode="numeric"
              placeholder="CPF"
              value={cpfFormatado}
              onChange={(e) => setCpf(somenteDigitos(e.target.value))}
              disabled={salvando}
              aria-invalid={!!erro.cpf}
              maxLength={14} // 000.000.000-00
              className={`w-full pl-10 py-2 border rounded-md ${erro.cpf ? "border-red-500" : ""}`}
            />
          </div>
          {erro.cpf && <p className="text-xs text-red-600 mt-1">{erro.cpf}</p>}
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={salvando}
            className="bg-gray-300 hover:bg-gray-400 px-4 py-2 rounded-md disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={salvando || possuiErros}
            className="bg-green-700 text-white hover:bg-green-800 px-4 py-2 rounded-md disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {salvando ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </form>
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
