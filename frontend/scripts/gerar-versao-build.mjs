// ✅ frontend/scripts/gerar-versao-build.mjs — v2.0
// Atualizado em: 28/05/2026
//
// Gera um arquivo público de versão a cada build.
// Esse arquivo será consultado pelo frontend para detectar atualização da plataforma.

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const publicDir = path.join(root, "public");
const outputPath = path.join(publicDir, "version.json");

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

const agora = new Date();

const versionPayload = {
  app: "escoladasaude",
  version: process.env.VITE_APP_VERSION || "2.0",
  buildId:
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.RENDER_GIT_COMMIT ||
    `${agora.getTime()}`,
  buildAt: agora.toISOString(),
};

fs.writeFileSync(outputPath, JSON.stringify(versionPayload, null, 2), "utf8");

console.log("[build-version] version.json gerado:", versionPayload);