// 📁 src/components/TabelaUsuarios.jsx
import PropTypes from "prop-types";
import { Pencil } from "lucide-react";

/* ===========================
   Normalização de perfis
   =========================== */
const PERFIS_MAP = { 1: "administrador", 2: "instrutor", 3: "usuario" };

function normalizePerfilItem(raw) {
  if (raw == null) return null;
  if (typeof raw === "object") {
    if (typeof raw.nome === "string") return raw.nome.trim();
    if (typeof raw.descricao === "string") return raw.descricao.trim();
    if (typeof raw.label === "string") return raw.label.trim();
    if (typeof raw.value === "string") return raw.value.trim();
    if (typeof raw.id === "number" && PERFIS_MAP[raw.id]) return PERFIS_MAP[raw.id];
    return String(raw).trim();
  }
  if (typeof raw === "number" && PERFIS_MAP[raw]) return PERFIS_MAP[raw];
  if (typeof raw === "string") return raw.trim();
  return String(raw).trim();
}

function splitPossiblyCommaSeparated(str) {
  if (typeof str !== "string") return [str];
  return str.split(/[;,]/).map((s) => s.trim()).filter(Boolean);
}

function extractPerfis(usuario) {
  const fontes = [
    usuario?.perfil,
    usuario?.perfis,
    usuario?.role,
    usuario?.roles,
    usuario?.perfil_id,
    usuario?.perfilObj,
  ];

  const itens = [];
  for (const fonte of fontes) {
    if (fonte == null) continue;
    if (Array.isArray(fonte)) {
      for (const f of fonte) {
        const val = normalizePerfilItem(f);
        if (val != null) {
          if (typeof val === "string" && /[,;]/.test(val)) itens.push(...splitPossiblyCommaSeparated(val));
          else itens.push(val);
        }
      }
    } else {
      const val = normalizePerfilItem(fonte);
      if (val != null) {
        if (typeof val === "string" && /[,;]/.test(val)) itens.push(...splitPossiblyCommaSeparated(val));
        else itens.push(val);
      }
    }
  }

  const set = new Set(itens.map((s) => String(s).trim().toLowerCase()).filter(Boolean));
  return Array.from(set).map((p) => p.charAt(0).toUpperCase() + p.slice(1));
}

/* ===========================
   UI helpers
   =========================== */
function perfilBadgeClass(perfil) {
  const p = perfil.toLowerCase();
  if (p.includes("admin")) return "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-500/20 dark:text-purple-200";
  if (p.includes("instrutor")) return "bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-500/20 dark:text-teal-200";
  if (p.includes("gestor")) return "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-500/20 dark:text-rose-200";
  return "bg-slate-100 text-slate-700 border-slate-200 dark:bg-zinc-600/30 dark:text-zinc-200";
}

/* ===========================
   Componente
   =========================== */
export default function TabelaUsuarios({ usuarios = [], onEditar = () => {}, className = "" }) {
  if (!Array.isArray(usuarios) || usuarios.length === 0) {
    return (
      <p className="text-center text-gray-600 dark:text-gray-300 py-4" aria-live="polite">
        Nenhum usuário encontrado.
      </p>
    );
  }

  return (
    <ul
      className={`space-y-4 max-w-5xl mx-auto ${className}`}
      role="list"
      aria-label="Lista de usuários"
    >
      {usuarios.map((usuario, idx) => {
        const perfis = extractPerfis(usuario);
        const key = usuario.id ?? usuario.email ?? idx;

        const nome = usuario?.nome || "—";
        const email = usuario?.email || "—";

        return (
          <li key={key}>
            <article
              className="p-4 bg-white dark:bg-gray-800 rounded-xl shadow flex justify-between items-center gap-4 hover:shadow-md transition focus-within:shadow-md"
              aria-label={`Usuário: ${nome}`}
            >
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white truncate">
                  {nome}
                </h2>

                {email && email !== "—" ? (
                  <a
                    href={`mailto:${email}`}
                    className="text-sm text-gray-600 dark:text-gray-300 break-all underline-offset-2 hover:underline"
                    title={`Enviar e-mail para ${nome}`}
                  >
                    {email}
                  </a>
                ) : (
                  <p className="text-sm text-gray-600 dark:text-gray-300">—</p>
                )}

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Perfis:</span>
                  {perfis.length > 0 ? (
                    perfis.map((p) => (
                      <span
                        key={p}
                        className={`text-xs font-medium border rounded-full px-2 py-0.5 ${perfilBadgeClass(p)}`}
                        title={p}
                      >
                        {p}
                      </span>
                    ))
                  ) : (
                    <span className="ml-1 italic text-gray-400 text-sm">Nenhum</span>
                  )}
                </div>
              </div>

              <button
                onClick={() => onEditar(usuario)}
                className="px-3 py-1.5 rounded-md bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium flex items-center gap-2 shadow transition-all focus:outline-none focus:ring-2 focus:ring-green-700/40"
                aria-label={`Editar perfil de ${nome}`}
                title="Editar usuário"
              >
                <Pencil size={16} />
                Editar
              </button>
            </article>
          </li>
        );
      })}
    </ul>
  );
}

/* ===========================
   PropTypes
   =========================== */
TabelaUsuarios.propTypes = {
  usuarios: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
      nome: PropTypes.string,
      email: PropTypes.string,
      perfil: PropTypes.any,
      perfis: PropTypes.any,
      role: PropTypes.any,
      roles: PropTypes.any,
      perfil_id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
      perfilObj: PropTypes.shape({
        id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
        nome: PropTypes.string,
      }),
    })
  ).isRequired,
  onEditar: PropTypes.func,
  className: PropTypes.string,
};
