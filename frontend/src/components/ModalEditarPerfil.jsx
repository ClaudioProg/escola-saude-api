// 📁 src/components/ModalEditarPerfil.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import { toast } from "react-toastify";
import Modal from "./Modal";
import { apiPut } from "../services/api";
import { UserCog } from "lucide-react";

export default function ModalEditarPerfil({
  isOpen = true,                  // controlável
  usuario,
  onFechar,
  onSalvar,
  enviarComoString = false,       // se o backend espera string
}) {
  const perfisDisponiveis = [
    { label: "usuario", value: "usuario" },
    { label: "instrutor", value: "instrutor" },
    { label: "administrador", value: "administrador" },
  ];

  // normaliza perfil vindo do backend
  const perfilInicial = useMemo(() => {
    if (Array.isArray(usuario?.perfil)) return (usuario.perfil[0] ?? "") || "";
    if (typeof usuario?.perfil === "string") {
      const arr = usuario.perfil.split(",").map((p) => p.trim()).filter(Boolean);
      return arr[0] ?? "";
    }
    return "";
  }, [usuario]);

  const [perfilSelecionado, setPerfilSelecionado] = useState(perfilInicial);
  const [salvando, setSalvando] = useState(false);
  const [msgA11y, setMsgA11y] = useState("");
  const firstChipRef = useRef(null);

  // re-sincroniza se trocar o usuario prop
  useEffect(() => {
    setPerfilSelecionado(perfilInicial);
  }, [perfilInicial]);

  // foco no primeiro chip ao abrir
  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => firstChipRef.current?.focus(), 30);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  const mudou = perfilSelecionado !== perfilInicial;
  const podeSalvar = mudou && !!perfilSelecionado && !salvando;

  const salvar = async () => {
    if (!podeSalvar) return;
    setSalvando(true);
    setMsgA11y("Salvando alterações de perfil...");
    try {
      const payloadPerfil = enviarComoString ? perfilSelecionado : [perfilSelecionado];
      await apiPut(`/api/usuarios/${usuario.id}/perfil`, { perfil: payloadPerfil });

      toast.success("✅ Perfil atualizado com sucesso!");
      setMsgA11y("Perfil atualizado com sucesso.");
      onSalvar?.(usuario.id, payloadPerfil);
      onFechar?.();
    } catch (error) {
      const msg =
        error?.data?.mensagem ||
        error?.data?.message ||
        error?.message ||
        "Erro ao atualizar perfil";
      toast.error(`❌ ${msg}`);
      setMsgA11y(`Erro ao atualizar perfil: ${msg}`);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal
      open={isOpen}
      onClose={salvando ? undefined : onFechar} // bloqueia fechar durante salvamento
      labelledBy="titulo-editar-perfil"
      describedBy="descricao-editar-perfil"
      className="w-[96%] max-w-md p-0 overflow-hidden"
    >
      {/* Header com degradê exclusivo (mantendo altura/tipografia) */}
      <header
        className="px-4 sm:px-5 py-4 text-white bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-700"
        role="group"
        aria-label="Edição de perfil do usuário"
      >
        <h2 id="titulo-editar-perfil" className="text-xl sm:text-2xl font-extrabold tracking-tight">
          Editar perfil
        </h2>
        <p id="descricao-editar-perfil" className="text-white/90 text-sm mt-1">
          Selecione o perfil principal para <strong>{usuario?.nome ?? "usuário"}</strong>.
        </p>
      </header>

      {/* Live region para leitores de tela */}
      <div aria-live="polite" className="sr-only">
        {msgA11y}
      </div>

      {/* Corpo */}
      <section className="px-4 sm:px-5 py-4">
        <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200 mb-3">
          <UserCog className="w-4 h-4" aria-hidden="true" />
          <span className="text-sm">
            Perfil atual:{" "}
            <strong className="font-semibold">
              {perfilInicial || "—"}
            </strong>
          </span>
        </div>

        <fieldset className="space-y-2" aria-describedby="ajuda-perfis">
          <legend className="sr-only">Selecione um perfil</legend>

          <p id="ajuda-perfis" className="text-xs text-slate-500 dark:text-slate-400 mb-2">
            Escolha um perfil. Você poderá ajustar novamente depois.
          </p>

          {/* Chips de perfil (radio) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {perfisDisponiveis.map((perfil, idx) => {
              const selected = perfilSelecionado === perfil.value;
              return (
                <label
                  key={perfil.value}
                  className={[
                    "relative flex items-center gap-2 rounded-xl border px-3 py-2 cursor-pointer select-none text-sm",
                    selected
                      ? "border-emerald-400 bg-emerald-50 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200"
                      : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-emerald-300",
                  ].join(" ")}
                >
                  <input
                    ref={idx === 0 ? firstChipRef : undefined}
                    type="radio"
                    name="perfil"
                    value={perfil.value}
                    checked={selected}
                    onChange={() => setPerfilSelecionado(perfil.value)}
                    className="accent-emerald-600"
                    disabled={salvando}
                  />
                  <span className="capitalize">{perfil.label}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      </section>

      {/* Rodapé sticky (ótimo no mobile) */}
      <div className="sticky bottom-0 left-0 right-0 bg-white/85 dark:bg-zinc-950/85 backdrop-blur border-t border-slate-200 dark:border-slate-800 px-4 sm:px-5 py-3 flex items-center justify-end gap-2">
        <button
          onClick={onFechar}
          disabled={salvando}
          className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100 hover:bg-slate-300 dark:hover:bg-slate-700 transition disabled:opacity-60"
        >
          Cancelar
        </button>
        <button
          onClick={salvar}
          disabled={!podeSalvar}
          className={[
            "px-4 py-2 rounded-xl text-white font-semibold transition disabled:opacity-60",
            podeSalvar
              ? "bg-emerald-600 hover:bg-emerald-700"
              : "bg-emerald-900 cursor-not-allowed",
          ].join(" ")}
          aria-busy={salvando ? "true" : "false"}
        >
          {salvando ? "Salvando..." : "Salvar"}
        </button>
      </div>
    </Modal>
  );
}

ModalEditarPerfil.propTypes = {
  isOpen: PropTypes.bool,
  usuario: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
    nome: PropTypes.string,
    perfil: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.arrayOf(PropTypes.string),
    ]),
  }).isRequired,
  onFechar: PropTypes.func.isRequired,
  onSalvar: PropTypes.func,          // (id, novoPerfil) => void
  enviarComoString: PropTypes.bool,
};
