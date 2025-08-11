// 📁 src/utils/perfis.js
export function getPerfisRobusto() {
  const out = new Set();

  const rawPerfil = localStorage.getItem("perfil");
  if (rawPerfil) {
    try {
      const parsed = JSON.parse(rawPerfil);
      if (Array.isArray(parsed)) parsed.forEach(p => out.add(String(p).toLowerCase()));
      else if (typeof parsed === "string") {
        parsed.split(",").forEach(p => out.add(p.replace(/[\[\]"]/g, "").trim().toLowerCase()));
      }
    } catch {
      rawPerfil.split(",").forEach(p => out.add(p.replace(/[\[\]"]/g, "").trim().toLowerCase()));
    }
  }

  try {
    const rawUser = localStorage.getItem("usuario");
    if (rawUser) {
      const u = JSON.parse(rawUser);
      if (u?.perfil) {
        if (Array.isArray(u.perfil)) u.perfil.forEach(p => out.add(String(p).toLowerCase()));
        else out.add(String(u.perfil).toLowerCase());
      }
      if (u?.perfis) {
        if (Array.isArray(u.perfis)) u.perfis.forEach(p => out.add(String(p).toLowerCase()));
        else String(u.perfis).split(",").forEach(p => out.add(p.replace(/[\[\]"]/g, "").trim().toLowerCase()));
      }
    }
  } catch {}

  if (out.size === 0) out.add("usuario");
  return Array.from(out);
}

export function ehAdmin(perfis) {
  return perfis.map(p => p.toLowerCase()).includes("administrador");
}
export function ehInstrutor(perfis) {
  const p = perfis.map(p => p.toLowerCase());
  return p.includes("instrutor") || p.includes("administrador"); // 👈 admin é superusuário
}
