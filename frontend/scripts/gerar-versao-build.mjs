// ✅ frontend/scripts/gerar-versao-build.mjs — v2.1
// Atualizado em: 28/05/2026
//
// Gera o arquivo público public/version.json a cada build.
// Esse arquivo é consultado pelo frontend para detectar atualização da plataforma.
//
// Regra v2.1:
// - version vem preferencialmente do package.json;
// - buildId muda a cada build/deploy;
// - buildAt registra o horário ISO do build;
// - o arquivo é gerado com quebra de linha final para melhor versionamento.

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const publicDir = path.join(root, "public");
const outputPath = path.join(publicDir, "version.json");

function normalizarTexto(valor) {
  return String(valor || "").trim();
}

function obterVersaoPlataforma() {
  const versaoPackage = normalizarTexto(process.env.npm_package_version);
  const versaoEnv = normalizarTexto(process.env.VITE_APP_VERSION);

  return versaoPackage || versaoEnv || "2.0.0";
}

function obterBuildId(agora) {
  return (
    normalizarTexto(process.env.VERCEL_GIT_COMMIT_SHA) ||
    normalizarTexto(process.env.RENDER_GIT_COMMIT) ||
    normalizarTexto(process.env.COMMIT_SHA) ||
    String(agora.getTime())
  );
}

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

const agora = new Date();

const versionPayload = {
  app: "escoladasaude",
  version: obterVersaoPlataforma(),
  buildId: obterBuildId(agora),
  buildAt: agora.toISOString(),
};

fs.writeFileSync(
  outputPath,
  `${JSON.stringify(versionPayload, null, 2)}\n`,
  "utf8"
);

console.log("[build-version] version.json gerado em:", outputPath);
console.log("[build-version] payload:", versionPayload);