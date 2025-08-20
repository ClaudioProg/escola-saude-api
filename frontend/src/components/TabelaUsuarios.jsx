// src/components/TabelaUsuarios.jsx
import PropTypes from "prop-types";
import { Pencil } from "lucide-react";

/* ===========================
   Normalização de perfis
   =========================== */

const PERFIS_MAP = {
  1: "administrador",
  2: "instrutor",
  3: "usuario",
};

function normalizePerfilItem(raw) {
  if (raw == null) return null;

  // objeto: {nome}, {descricao}, {label}, {value}, {id}
  if (typeof raw === "object") {
    if (typeof raw.nome === "string") return raw.nome.trim();
    if (typeof raw.descricao === "string") return raw.descricao.trim();
    if (typeof raw.label === "string") return raw.label.trim();
    if (typeof raw.value === "string") return raw.value.trim();
    if (typeof raw.id === "number" && PERFIS_MAP[raw.id]) return PERFIS_MAP[raw.id];
    // fallback
    return String(raw).trim();
  }

  // número enum
  if (typeof raw === "number" && PERFIS_MAP[raw]) {
    return PERFIS_MAP[raw];
  }

  // string simples (pode vir "instrutor, administrador")
  if (typeof raw === "string") {
    return raw.trim();
  }

  // qualquer outro tipo
  return String(raw).trim();
}

function splitPossiblyCommaSeparated(str) {
  if (typeof str !== "string") return [str];
  // divide por vírgula e/ou ponto-e-vírgula
  return str
    .split(/[;,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function extractPerfis(usuario) {
  // fontes possíveis
  const fontes = [
    usuario?.perfil,     // "instrutor" | "instrutor, administrador" | 2 | {nome:"..."} | [...]
    usuario?.perfis,     // ["instrutor", "admin"] | [{nome:"..."}, ...]
    usuario?.role,       // "admin"
    usuario?.roles,      // ["admin","instrutor"]
    usuario?.perfil_id,  // 1 | 2 | 3
    usuario?.perfilObj,  // {id:2, nome:"instrutor"}
  ];

  // agrega e normaliza em array de strings
  const itens = [];
  for (const fonte of fontes) {
    if (fonte == null) continue;

    if (Array.isArray(fonte)) {
      for (const f of fonte) {
        const val = normalizePerfilItem(f);
        if (val != null) {
          // se for string contendo vírgulas, quebrar
          if (typeof val === "string" && /[,;]/.test(val)) {
            itens.push(...splitPossiblyCommaSeparated(val));
          } else {
            itens.push(val);
          }
        }
      }
    } else {
      const val = normalizePerfilItem(fonte);
      if (val != null) {
        if (typeof val === "string" && /[,;]/.test(val)) {
          itens.push(...splitPossiblyCommaSeparated(val));
        } else {
          itens.push(val);
        }
      }
    }
  }

  // limpar, normalizar e deduplicar
  const set = new Set(
    itens
      .map((s) => String(s).trim().toLowerCase())
      .filter(Boolean)
  );

  // capitalização leve para exibir
  const pretty = Array.from(set).map((p) => p.charAt(0).toUpperCase() + p.slice(1));

  return pretty; // ex.: ["Instrutor","Administrador"]
}

/* ===========================
   UI helpers
   =========================== */

function perfilBadgeClass(perfil) {
  const p = perfil.toLowerCase();
  // cores baseadas no padrão (verde lousa + variações)
  if (p.includes("admin")) return "bg-purple-100 text-purple-700 border-purple-200";
  if (p.includes("instrutor")) return "bg-teal-100 text-teal-700 border-teal-200";
  if (p.includes("gestor")) return "bg-rose-100 text-rose-700 border-rose-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
}

/* ===========================
   Componente
   =========================== */

export default function TabelaUsuarios({ usuarios, onEditar }) {
  if (!Array.isArray(usuarios) || usuarios.length === 0) {
    return (
      <p className="text-center text-gray-600 dark:text-gray-300">
        Nenhum usuário encontrado.
      </p>
    );
  }

  return (
    <ul className="space-y-4 max-w-5xl mx-auto">
      {usuarios.map((usuario) => {
        const perfis = extractPerfis(usuario); // sempre array seguro

        return (
          <li
            key={usuario.id}
            className="p-4 bg-white dark:bg-gray-800 rounded-xl shadow flex justify-between items-center gap-4"
          >
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white truncate">
                {usuario.nome || "—"}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-300 truncate">
                {usuario.email || "—"}
              </p>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">Perfis:</span>
                {perfis.length > 0 ? (
                  perfis.map((p) => (
                    <span
                      key={p}
                      className={`text-xs font-medium border rounded-full px-2 py-0.5 ${perfilBadgeClass(
                        p
                      )}`}
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
              className="px-3 py-1.5 rounded-md bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium flex items-center gap-2 shadow transition-all"
              aria-label={`Editar perfil de ${usuario.nome || "usuário"}`}
            >
              <Pencil size={16} />
              Editar
            </button>
          </li>
        );
      })}
    </ul>
  );
}

TabelaUsuarios.propTypes = {
  usuarios: PropTypes.array.isRequired,
  onEditar: PropTypes.func.isRequired,
};
