// ✅ src/utils/campanhaSaudeVisual.js — v2.0
// Atualizado em: 21/05/2026
// Plataforma Escola da Saúde
//
// Utilitário oficial de campanhas mensais de saúde.
//
// Contratos:
// - mês numérico oficial: 1 a 12;
// - sem aliases;
// - sem cor chapada como padrão visual;
// - degradês controlados;
// - contraste protegido para meses claros;
// - pronto para HeaderHero, Botao e Topbar.

const MES_ATUAL_FALLBACK = new Date().getMonth() + 1;

const CAMPANHAS_SAUDE_MENSAL = {
  1: {
    mes: 1,
    nome: "Janeiro Branco",
    referencia: "Saúde mental e emocional",
    textoContraste: "escuro",
    gradienteHero:
      "from-white via-slate-100 to-cyan-100",
    overlayHero: "bg-white/10",
    textoHero: "text-slate-950",
    textoSuaveHero: "text-slate-700",
    bordaHero: "border-slate-200",
    anelHero: "ring-slate-300/70",
    brilhoPrimario: "bg-cyan-200/45",
    brilhoSecundario: "bg-white/70",
    botao:
      "border-slate-300 bg-gradient-to-br from-white via-slate-100 to-cyan-100 text-slate-950 hover:brightness-95 focus-visible:ring-cyan-500",
    botaoContraste:
      "border-transparent bg-gradient-to-br from-slate-900 via-slate-800 to-cyan-900 text-white hover:brightness-110 focus-visible:ring-cyan-500",
    topbar:
      "from-white via-slate-100 to-cyan-100",
    topbarGlow:
      "from-cyan-300/35 via-white/40 to-slate-300/35",
    foco: "focus-visible:ring-cyan-500",
  },

  2: {
    mes: 2,
    nome: "Fevereiro Roxo",
    referencia: "Conscientização e cuidado contínuo",
    textoContraste: "claro",
    gradienteHero:
      "from-violet-950 via-purple-800 to-fuchsia-800",
    overlayHero: "bg-slate-950/18",
    textoHero: "text-white",
    textoSuaveHero: "text-white/90",
    bordaHero: "border-white/10",
    anelHero: "ring-violet-100/25",
    brilhoPrimario: "bg-violet-200/18",
    brilhoSecundario: "bg-fuchsia-200/14",
    botao:
      "border-transparent bg-gradient-to-br from-violet-800 via-purple-800 to-fuchsia-800 text-white hover:brightness-110 focus-visible:ring-violet-500",
    botaoContraste:
      "border-transparent bg-white text-violet-950 hover:bg-violet-50 focus-visible:ring-white/80",
    topbar:
      "from-violet-700 via-purple-700 to-fuchsia-700",
    topbarGlow:
      "from-violet-400/35 via-purple-400/30 to-fuchsia-400/35",
    foco: "focus-visible:ring-violet-500",
  },

  3: {
    mes: 3,
    nome: "Março Lilás",
    referencia: "Saúde da mulher",
    textoContraste: "claro",
    gradienteHero:
      "from-purple-800 via-fuchsia-700 to-pink-700",
    overlayHero: "bg-slate-950/16",
    textoHero: "text-white",
    textoSuaveHero: "text-white/90",
    bordaHero: "border-white/10",
    anelHero: "ring-fuchsia-100/25",
    brilhoPrimario: "bg-fuchsia-200/18",
    brilhoSecundario: "bg-purple-200/14",
    botao:
      "border-transparent bg-gradient-to-br from-purple-700 via-fuchsia-700 to-pink-700 text-white hover:brightness-110 focus-visible:ring-fuchsia-500",
    botaoContraste:
      "border-transparent bg-white text-purple-950 hover:bg-purple-50 focus-visible:ring-white/80",
    topbar:
      "from-purple-600 via-fuchsia-600 to-pink-600",
    topbarGlow:
      "from-purple-300/35 via-fuchsia-300/30 to-pink-300/35",
    foco: "focus-visible:ring-fuchsia-500",
  },

  4: {
    mes: 4,
    nome: "Abril Verde",
    referencia: "Saúde, segurança e prevenção",
    textoContraste: "claro",
    gradienteHero:
      "from-emerald-800 via-green-700 to-teal-700",
    overlayHero: "bg-slate-950/14",
    textoHero: "text-white",
    textoSuaveHero: "text-white/90",
    bordaHero: "border-white/10",
    anelHero: "ring-emerald-100/25",
    brilhoPrimario: "bg-emerald-200/18",
    brilhoSecundario: "bg-teal-200/14",
    botao:
      "border-transparent bg-gradient-to-br from-emerald-700 via-green-700 to-teal-700 text-white hover:brightness-110 focus-visible:ring-emerald-500",
    botaoContraste:
      "border-transparent bg-white text-emerald-950 hover:bg-emerald-50 focus-visible:ring-white/80",
    topbar:
      "from-emerald-600 via-green-600 to-teal-600",
    topbarGlow:
      "from-emerald-300/35 via-green-300/30 to-teal-300/35",
    foco: "focus-visible:ring-emerald-500",
  },

  5: {
    mes: 5,
    nome: "Maio Amarelo",
    referencia: "Atenção, prevenção e cuidado",
    textoContraste: "escuro",
    gradienteHero:
      "from-amber-200 via-yellow-300 to-orange-300",
    overlayHero: "bg-white/8",
    textoHero: "text-slate-950",
    textoSuaveHero: "text-slate-800",
    bordaHero: "border-amber-300/70",
    anelHero: "ring-amber-400/45",
    brilhoPrimario: "bg-yellow-100/70",
    brilhoSecundario: "bg-orange-200/45",
    botao:
      "border-amber-300 bg-gradient-to-br from-amber-200 via-yellow-300 to-orange-300 text-slate-950 hover:brightness-95 focus-visible:ring-amber-500",
    botaoContraste:
      "border-transparent bg-gradient-to-br from-slate-950 via-zinc-900 to-amber-950 text-white hover:brightness-110 focus-visible:ring-amber-500",
    topbar:
      "from-amber-300 via-yellow-300 to-orange-300",
    topbarGlow:
      "from-amber-300/45 via-yellow-300/40 to-orange-300/45",
    foco: "focus-visible:ring-amber-500",
  },

  6: {
    mes: 6,
    nome: "Junho Vermelho/Laranja",
    referencia: "Doação, prevenção e cuidado",
    textoContraste: "claro",
    gradienteHero:
      "from-red-800 via-orange-700 to-amber-700",
    overlayHero: "bg-slate-950/16",
    textoHero: "text-white",
    textoSuaveHero: "text-white/90",
    bordaHero: "border-white/10",
    anelHero: "ring-orange-100/25",
    brilhoPrimario: "bg-orange-200/18",
    brilhoSecundario: "bg-red-200/14",
    botao:
      "border-transparent bg-gradient-to-br from-red-700 via-orange-700 to-amber-700 text-white hover:brightness-110 focus-visible:ring-orange-500",
    botaoContraste:
      "border-transparent bg-white text-red-950 hover:bg-orange-50 focus-visible:ring-white/80",
    topbar:
      "from-red-600 via-orange-600 to-amber-600",
    topbarGlow:
      "from-red-300/35 via-orange-300/30 to-amber-300/35",
    foco: "focus-visible:ring-orange-500",
  },

  7: {
    mes: 7,
    nome: "Julho Amarelo/Verde",
    referencia: "Prevenção e vigilância em saúde",
    textoContraste: "escuro",
    gradienteHero:
      "from-lime-200 via-yellow-300 to-emerald-300",
    overlayHero: "bg-white/8",
    textoHero: "text-slate-950",
    textoSuaveHero: "text-slate-800",
    bordaHero: "border-lime-300/70",
    anelHero: "ring-lime-400/45",
    brilhoPrimario: "bg-yellow-100/70",
    brilhoSecundario: "bg-emerald-200/45",
    botao:
      "border-lime-300 bg-gradient-to-br from-lime-200 via-yellow-300 to-emerald-300 text-slate-950 hover:brightness-95 focus-visible:ring-lime-500",
    botaoContraste:
      "border-transparent bg-gradient-to-br from-slate-950 via-green-950 to-lime-950 text-white hover:brightness-110 focus-visible:ring-lime-500",
    topbar:
      "from-lime-300 via-yellow-300 to-emerald-300",
    topbarGlow:
      "from-lime-300/45 via-yellow-300/40 to-emerald-300/45",
    foco: "focus-visible:ring-lime-500",
  },

  8: {
    mes: 8,
    nome: "Agosto Dourado",
    referencia: "Promoção do cuidado e vínculo",
    textoContraste: "escuro",
    gradienteHero:
      "from-amber-300 via-yellow-400 to-orange-400",
    overlayHero: "bg-white/8",
    textoHero: "text-slate-950",
    textoSuaveHero: "text-slate-800",
    bordaHero: "border-amber-400/70",
    anelHero: "ring-amber-500/45",
    brilhoPrimario: "bg-yellow-100/70",
    brilhoSecundario: "bg-orange-200/45",
    botao:
      "border-amber-400 bg-gradient-to-br from-amber-300 via-yellow-400 to-orange-400 text-slate-950 hover:brightness-95 focus-visible:ring-amber-500",
    botaoContraste:
      "border-transparent bg-gradient-to-br from-slate-950 via-amber-950 to-orange-950 text-white hover:brightness-110 focus-visible:ring-amber-500",
    topbar:
      "from-amber-400 via-yellow-400 to-orange-400",
    topbarGlow:
      "from-amber-300/45 via-yellow-300/40 to-orange-300/45",
    foco: "focus-visible:ring-amber-500",
  },

  9: {
    mes: 9,
    nome: "Setembro Vermelho",
    referencia: "Cuidado cardiovascular e prevenção",
    textoContraste: "claro",
    gradienteHero:
      "from-red-950 via-red-800 to-rose-800",
    overlayHero: "bg-slate-950/16",
    textoHero: "text-white",
    textoSuaveHero: "text-white/90",
    bordaHero: "border-white/10",
    anelHero: "ring-red-100/25",
    brilhoPrimario: "bg-red-200/18",
    brilhoSecundario: "bg-rose-200/14",
    botao:
      "border-transparent bg-gradient-to-br from-red-800 via-red-700 to-rose-700 text-white hover:brightness-110 focus-visible:ring-red-500",
    botaoContraste:
      "border-transparent bg-white text-red-950 hover:bg-red-50 focus-visible:ring-white/80",
    topbar:
      "from-red-700 via-red-600 to-rose-600",
    topbarGlow:
      "from-red-300/35 via-rose-300/30 to-red-300/35",
    foco: "focus-visible:ring-red-500",
  },

  10: {
    mes: 10,
    nome: "Outubro Rosa",
    referencia: "Saúde da mulher e prevenção",
    textoContraste: "claro",
    gradienteHero:
      "from-rose-800 via-pink-700 to-fuchsia-700",
    overlayHero: "bg-slate-950/14",
    textoHero: "text-white",
    textoSuaveHero: "text-white/90",
    bordaHero: "border-white/10",
    anelHero: "ring-pink-100/25",
    brilhoPrimario: "bg-pink-200/18",
    brilhoSecundario: "bg-rose-200/14",
    botao:
      "border-transparent bg-gradient-to-br from-rose-700 via-pink-700 to-fuchsia-700 text-white hover:brightness-110 focus-visible:ring-pink-500",
    botaoContraste:
      "border-transparent bg-white text-pink-950 hover:bg-pink-50 focus-visible:ring-white/80",
    topbar:
      "from-rose-600 via-pink-600 to-fuchsia-600",
    topbarGlow:
      "from-rose-300/35 via-pink-300/30 to-fuchsia-300/35",
    foco: "focus-visible:ring-pink-500",
  },

  11: {
    mes: 11,
    nome: "Novembro Azul/Roxo",
    referencia: "Saúde do homem, prevenção e prematuridade",
    textoContraste: "claro",
    gradienteHero:
      "from-blue-900 via-indigo-800 to-purple-800",
    overlayHero: "bg-slate-950/16",
    textoHero: "text-white",
    textoSuaveHero: "text-white/90",
    bordaHero: "border-white/10",
    anelHero: "ring-blue-100/25",
    brilhoPrimario: "bg-blue-200/18",
    brilhoSecundario: "bg-purple-200/14",
    botao:
      "border-transparent bg-gradient-to-br from-blue-800 via-indigo-800 to-purple-800 text-white hover:brightness-110 focus-visible:ring-blue-500",
    botaoContraste:
      "border-transparent bg-white text-blue-950 hover:bg-blue-50 focus-visible:ring-white/80",
    topbar:
      "from-blue-700 via-indigo-700 to-purple-700",
    topbarGlow:
      "from-blue-300/35 via-indigo-300/30 to-purple-300/35",
    foco: "focus-visible:ring-blue-500",
  },

  12: {
    mes: 12,
    nome: "Dezembro Laranja",
    referencia: "Prevenção e cuidado com a pele",
    textoContraste: "claro",
    gradienteHero:
      "from-orange-800 via-amber-700 to-red-700",
    overlayHero: "bg-slate-950/14",
    textoHero: "text-white",
    textoSuaveHero: "text-white/90",
    bordaHero: "border-white/10",
    anelHero: "ring-orange-100/25",
    brilhoPrimario: "bg-orange-200/18",
    brilhoSecundario: "bg-amber-200/14",
    botao:
      "border-transparent bg-gradient-to-br from-orange-700 via-amber-700 to-red-700 text-white hover:brightness-110 focus-visible:ring-orange-500",
    botaoContraste:
      "border-transparent bg-white text-orange-950 hover:bg-orange-50 focus-visible:ring-white/80",
    topbar:
      "from-orange-600 via-amber-600 to-red-600",
    topbarGlow:
      "from-orange-300/35 via-amber-300/30 to-red-300/35",
    foco: "focus-visible:ring-orange-500",
  },
};

export function normalizarMesReferencia(mesReferencia) {
  const numero = Number(mesReferencia);

  if (Number.isInteger(numero) && numero >= 1 && numero <= 12) {
    return numero;
  }

  return MES_ATUAL_FALLBACK;
}

export function getCampanhaSaudeVisual(mesReferencia) {
  const mes = normalizarMesReferencia(mesReferencia);
  return CAMPANHAS_SAUDE_MENSAL[mes] || CAMPANHAS_SAUDE_MENSAL[MES_ATUAL_FALLBACK];
}

export function getMesReferenciaAtual() {
  return MES_ATUAL_FALLBACK;
}

export function getCampanhasSaudeMensal() {
  return CAMPANHAS_SAUDE_MENSAL;
}

export default CAMPANHAS_SAUDE_MENSAL;