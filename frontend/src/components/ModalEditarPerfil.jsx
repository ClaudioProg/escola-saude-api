// ✅ src/components/ModalEditarPerfil.jsx (Premium + A11y + keyboard + ids únicos)
// - CONTROLADO por isOpen (props)
// - NÃO faz apiPut aqui (evita salvar duplicado)
// - Salvar chama onSalvar(id, payloadPerfil) e fecha via onFechar

import { useEffect, useMemo, useRef, useState, useId, useCallback } from "react";
import PropTypes from "prop-types";
import Modal from "./Modal";
import { UserCog, ShieldCheck, Users, GraduationCap } from "lucide-react";

/* ========================= Helpers ========================= */
function normalizePerfil(perfil) {
  // backend pode vir: ["admin"] | "admin,instrutor" | "admin"
  if (Array.isArray(perfil)) return (perfil[0] ?? "").toString().trim();
  if (typeof perfil === "string") {
    const arr = perfil.split(",").map((p) => p.trim()).filter(Boolean);
    return (arr[0] ?? "").toString().trim();
  }
  return "";
}

function cls(...p) {
  return p.filter(Boolean).join(" ");
}

function iconByPerfil(value) {
  if (value === "administrador") return ShieldCheck;
  if (value === "instrutor") return GraduationCap;
  return Users; // usuario
}

/* ========================= Componente ========================= */
export default function ModalEditarPerfil({
  isOpen = false,
  usuario,
  onFechar,
  onSalvar,
  enviarComoString = false,
}) {
  // IDs únicos (evita colisão em múltiplos modais)
  const uid = useId();
  const titleId = `titulo-editar-perfil-${uid}`;
  const descId = `descricao-editar-perfil-${uid}`;
  const helpId = `ajuda-perfis-${uid}`;
  const liveId = `live-perfil-${uid}`;

  const perfisDisponiveis = useMemo(
    () => [
      { label: "Usuário", value: "usuario" },
      { label: "Instrutor", value: "instrutor" },
      { label: "Administrador", value: "administrador" },
    ],
    []
  );

  const perfilInicial = useMemo(() => normalizePerfil(usuario?.perfil), [usuario]);

  const [perfilSelecionado, setPerfilSelecionado] = useState(perfilInicial);
  const [salvando, setSalvando] = useState(false);
  const [msgA11y, setMsgA11y] = useState("");

  // refs dos chips p/ navegação por teclado
  const chipRefs = useRef([]);
  chipRefs.current = [];

  // re-sincroniza se trocar usuário
  useEffect(() => {
    setPerfilSelecionado(perfilInicial);
  }, [perfilInicial]);

  const mudou = perfilSelecionado !== perfilInicial;
  const podeSalvar = mudou && !!perfilSelecionado && !salvando;

  // foco ao abrir: prioriza o chip do perfil atual, senão o primeiro
  useEffect(() => {
    if (!isOpen) return;

    const t = setTimeout(() => {
      const idxAtual = perfisDisponiveis.findIndex(
        (p) => p.value === (perfilSelecionado || perfilInicial)
      );
      const idx = idxAtual >= 0 ? idxAtual : 0;
      chipRefs.current[idx]?.focus?.();
    }, 50);

    return () => clearTimeout(t);
  }, [isOpen, perfisDisponiveis, perfilSelecionado, perfilInicial]);

  // teclado: setas navegam dentro do radio group
  const onChipsKeyDown = useCallback(
    (e) => {
      if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(e.key)) return;

      const values = perfisDisponiveis.map((p) => p.value);
      const current = values.indexOf(perfilSelecionado);
      let next = current;

      if (e.key === "ArrowRight") next = (current + 1 + values.length) % values.length;
      if (e.key === "ArrowLeft") next = (current - 1 + values.length) % values.length;
      if (e.key === "Home") next = 0;
      if (e.key === "End") next = values.length - 1;

      e.preventDefault();
      const v = values[next];
      setPerfilSelecionado(v);
      requestAnimationFrame(() => chipRefs.current[next]?.focus?.());
    },
    [perfisDisponiveis, perfilSelecionado]
  );

  // ✅ Agora salvar NÃO chama API aqui.
  // Quem salva é o pai (GestaoUsuarios) via onSalvar.
  const salvar = async () => {
    if (!podeSalvar) return;

    setSalvando(true);
    setMsgA11y("Salvando alterações de perfil...");

    try {
      const payloadPerfil = enviarComoString ? perfilSelecionado : [perfilSelecionado];

      // ✅ delega o salvamento ao pai
      await onSalvar?.(usuario.id, payloadPerfil);

      setMsgA11y("Perfil atualizado com sucesso.");
      onFechar?.();
    } catch (error) {
      const msg =
        error?.data?.mensagem ||
        error?.data?.message ||
        error?.message ||
        "Erro ao atualizar perfil";
      setMsgA11y(`Erro ao atualizar perfil: ${msg}`);
      // O pai normalmente já dá toast, mas se quiser duplicar, dá pra por toast aqui.
      throw error;
    } finally {
      setSalvando(false);
    }
  };

  const IconSelecionado = iconByPerfil(perfilSelecionado);

  return (
    <Modal
      open={isOpen} // ✅ CONTROLADO PELO PAI
      onClose={salvando ? undefined : onFechar}
      labelledBy={titleId}
      describedBy={descId}
      closeOnBackdrop={!salvando}
      closeOnEscape={!salvando}
      className="w-[96%] max-w-md p-0 overflow-hidden"
    >
      {/* Header hero */}
      <header
        className="px-4 sm:px-5 py-4 text-white bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-700"
        role="group"
        aria-label="Edição de perfil do usuário"
      >
        <h2 id={titleId} className="text-xl sm:text-2xl font-extrabold tracking-tight">
          Editar perfil
        </h2>
        <p id={descId} className="text-white/90 text-sm mt-1">
          Selecione o perfil principal para <strong>{usuario?.nome ?? "usuário"}</strong>.
        </p>
      </header>

      {/* Live region */}
      <div id={liveId} aria-live="polite" className="sr-only">
        {msgA11y}
      </div>

      {/* Corpo */}
      <section className="px-4 sm:px-5 py-4 space-y-4">
        {/* Ministats */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-2xl border border-emerald-100 dark:border-emerald-900 p-3 shadow-sm bg-white dark:bg-slate-900">
            <div className="flex items-center gap-2 mb-1 text-slate-700 dark:text-slate-200">
              <UserCog className="w-4 h-4" aria-hidden="true" />
              <span className="text-xs font-bold uppercase tracking-wide">Perfil atual</span>
            </div>
            <div className="text-sm font-extrabold text-slate-900 dark:text-white">
              {perfilInicial || "—"}
            </div>
          </div>

          <div className="rounded-2xl border border-emerald-100 dark:border-emerald-900 p-3 shadow-sm bg-white dark:bg-slate-900">
            <div className="flex items-center gap-2 mb-1 text-slate-700 dark:text-slate-200">
              <IconSelecionado className="w-4 h-4" aria-hidden="true" />
              <span className="text-xs font-bold uppercase tracking-wide">Selecionado</span>
            </div>
            <div className="text-sm font-extrabold text-slate-900 dark:text-white">
              {perfilSelecionado || "—"}
            </div>
          </div>
        </div>

        <fieldset aria-describedby={helpId} className="space-y-2">
          <legend className="sr-only">Selecione um perfil</legend>

          <p id={helpId} className="text-xs text-slate-500 dark:text-slate-400">
            Use as setas ← → para navegar entre perfis. Você poderá ajustar novamente depois.
          </p>

          {/* Chips (radio) */}
          <div
            className="grid grid-cols-1 sm:grid-cols-3 gap-2"
            role="radiogroup"
            aria-label="Perfis disponíveis"
            onKeyDown={onChipsKeyDown}
          >
            {perfisDisponiveis.map((perfil) => {
              const selected = perfilSelecionado === perfil.value;
              const Icon = iconByPerfil(perfil.value);

              return (
                <label
                  key={perfil.value}
                  ref={(el) => {
                    if (el) chipRefs.current.push(el);
                  }}
                  tabIndex={0}
                  className={cls(
                    "relative flex items-center gap-2 rounded-xl border px-3 py-2 cursor-pointer select-none text-sm outline-none",
                    "focus-visible:ring-2 focus-visible:ring-emerald-500",
                    selected
                      ? "border-emerald-400 bg-emerald-50 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200"
                      : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-emerald-300",
                    salvando && "opacity-70 cursor-not-allowed"
                  )}
                  aria-checked={selected}
                  role="radio"
                >
                  <input
                    type="radio"
                    name="perfil"
                    value={perfil.value}
                    checked={selected}
                    onChange={() => setPerfilSelecionado(perfil.value)}
                    className="sr-only"
                    disabled={salvando}
                  />

                  <span
                    className={cls(
                      "inline-flex h-8 w-8 items-center justify-center rounded-xl border",
                      selected
                        ? "bg-emerald-100 border-emerald-200 text-emerald-800 dark:bg-emerald-900/40 dark:border-emerald-800 dark:text-emerald-200"
                        : "bg-slate-100 border-slate-200 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
                    )}
                    aria-hidden="true"
                  >
                    <Icon className="w-4 h-4" />
                  </span>

                  <span className="font-semibold">{perfil.label}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      </section>

      {/* Rodapé c sticky */}
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
          className={cls(
            "px-4 py-2 rounded-xl text-white font-extrabold transition disabled:opacity-60",
            podeSalvar ? "bg-emerald-600 hover:bg-emerald-700" : "bg-emerald-900 cursor-not-allowed"
          )}
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
    perfil: PropTypes.oneOfType([PropTypes.string, PropTypes.arrayOf(PropTypes.string)]),
  }).isRequired,
  onFechar: PropTypes.func.isRequired,
  onSalvar: PropTypes.func, // async (id, payloadPerfil) => Promise
  enviarComoString: PropTypes.bool,
};
