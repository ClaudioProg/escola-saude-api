// ✅ src/components/Footer.jsx
import { Mail, Phone, MapPin, Sparkles } from "lucide-react";

/** Zero à esquerda p/ 2 dígitos */
function dd(n) {
  return String(n).padStart(2, "0");
}

/** Retorna config temática (cores + título) por mês, ou null para padrão */
function getCampaignForMonth(month /* 1-12 */) {
  const campaigns = {
    7: {
      title: "JULHO AMARELO • Prevenção às Hepatites Virais",
      footerBg: "bg-gradient-to-br from-yellow-700 via-amber-700 to-orange-700",
      barBg: "bg-yellow-900/70",
      textColor: "text-white",
      accent: "from-yellow-200/60 via-white/40 to-transparent",
      ring: "ring-yellow-200/40",
    },
    8: {
      title: "AGOSTO DOURADO • Promoção do Aleitamento Materno",
      footerBg: "bg-gradient-to-br from-amber-700 via-yellow-700 to-orange-700",
      barBg: "bg-amber-900/70",
      textColor: "text-white",
      accent: "from-amber-200/60 via-white/35 to-transparent",
      ring: "ring-amber-200/40",
    },
    9: {
      title:
        "SETEMBRO • Prevenção ao Suicídio • Inclusão das Pessoas com Deficiência • Doação de Órgãos e Tecidos",
      footerBg: "bg-gradient-to-br from-yellow-700 via-emerald-800 to-teal-900",
      barBg: "bg-emerald-950/70",
      textColor: "text-white",
      accent: "from-emerald-200/55 via-white/30 to-transparent",
      ring: "ring-emerald-200/40",
    },
    10: {
      title: "OUTUBRO ROSA • Prevenção ao Câncer de Mama",
      footerBg: "bg-gradient-to-br from-pink-800 via-rose-700 to-fuchsia-800",
      barBg: "bg-pink-950/70",
      textColor: "text-white",
      accent: "from-pink-200/55 via-white/30 to-transparent",
      ring: "ring-pink-200/40",
    },
    11: {
      title:
        "NOVEMBRO • Prevenção do Câncer de Próstata • Conscientização sobre a Prematuridade",
      footerBg: "bg-gradient-to-br from-blue-800 via-indigo-800 to-purple-800",
      barBg: "bg-purple-950/70",
      textColor: "text-white",
      accent: "from-sky-200/50 via-white/28 to-transparent",
      ring: "ring-sky-200/40",
    },
    12: {
      title:
        "DEZEMBRO VERMELHO • Conscientização e Prevenção ao HIV/AIDS e outras ISTs",
      footerBg: "bg-gradient-to-br from-red-800 via-rose-800 to-orange-800",
      barBg: "bg-red-950/70",
      textColor: "text-white",
      accent: "from-red-200/55 via-white/30 to-transparent",
      ring: "ring-red-200/40",
    },
  };
  return campaigns[month] || null;
}

/** Gera texto “de DD/MM/AAAA a DD/MM/AAAA” do mês de `date` */
function periodTextOfMonth(date) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // 1-12
  const first = new Date(year, month - 1, 1);
  const last = new Date(year, month, 0);
  return `de ${dd(first.getDate())}/${dd(month)}/${year} a ${dd(last.getDate())}/${dd(
    month
  )}/${year}`;
}

function IconChip({ children, ringClass = "ring-white/25", compact = false }) {
  return (
    <span
      className={[
        "inline-flex items-center justify-center rounded-2xl",
        "bg-white/10 backdrop-blur-md ring-1",
        ringClass,
        compact ? "h-8 w-8" : "h-9 w-9",
      ].join(" ")}
      aria-hidden="true"
    >
      {children}
    </span>
  );
}

export default function Footer() {
  const now = new Date();
  const month = now.getMonth() + 1; // 1-12
  const year = now.getFullYear();

  const campaign = getCampaignForMonth(month);

  const footerBg = campaign
    ? campaign.footerBg
    : "bg-gradient-to-br from-emerald-950 via-emerald-900 to-slate-950";
  const barBg = campaign ? campaign.barBg : "bg-emerald-950/70";
  const textColor = campaign ? campaign.textColor : "text-white";
  const accent = campaign
    ? campaign.accent
    : "from-emerald-200/45 via-white/25 to-transparent";
  const ring = campaign ? campaign.ring : "ring-emerald-200/30";

  const periodo = campaign ? periodTextOfMonth(now) : null;

  return (
    <footer
      className={[
        footerBg,
        textColor,
        "mt-10 print:text-black print:bg-white",
        "relative overflow-hidden",
      ].join(" ")}
      role="contentinfo"
      aria-label={
        campaign
          ? `Rodapé institucional — campanha do mês: ${campaign.title}`
          : "Rodapé institucional"
      }
    >
      {/* “Selo” superior (linha + glow) */}
      <div className="absolute inset-x-0 top-0">
        <div className="h-[3px] w-full bg-gradient-to-r from-white/0 via-white/60 to-white/0" />
        <div
          className={`pointer-events-none absolute inset-x-0 -top-2 h-10 bg-gradient-to-r ${accent} blur-2xl`}
          aria-hidden="true"
        />
      </div>

      {/* Textura + blobs (um pouco mais suave) */}
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.14]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,.10) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,.10) 1px, transparent 1px)",
          backgroundSize: "52px 52px",
        }}
      />
      <div
        aria-hidden="true"
        className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-white/10 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="absolute -bottom-28 -right-28 h-80 w-80 rounded-full bg-white/10 blur-3xl"
      />

      {/* Campanha do mês (jul–dez) — mais compacta */}
      {campaign && (
        <div className="relative px-6 pt-6 pb-3 text-center">
          <div className="mx-auto max-w-4xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-extrabold backdrop-blur-md">
              <Sparkles className="h-4 w-4 opacity-90" aria-hidden="true" />
              Campanha do mês
            </div>

            <h2
              id="footer-campaign-title"
              className="mt-2 text-sm sm:text-base md:text-lg font-extrabold tracking-tight"
            >
              {campaign.title}
            </h2>

            {periodo && (
              <p className="text-[11px] sm:text-xs opacity-90 mt-1.5">
                {periodo}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Bloco principal — reduzido verticalmente */}
      <div
        className="relative max-w-7xl mx-auto px-6 py-5 grid gap-4 lg:grid-cols-2"
        itemScope
        itemType="https://schema.org/Organization"
      >
        {/* Card Instituição */}
        <div
          className={[
            "rounded-3xl border border-white/15 bg-white/8 backdrop-blur-md",
            "p-4 sm:p-5 shadow-[0_16px_44px_rgba(0,0,0,.18)]",
          ].join(" ")}
        >
          <div className="flex items-start gap-3">
            <IconChip ringClass={ring} compact>
            <MapPin size={17} className="opacity-95" />
            </IconChip>

            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-extrabold leading-tight" itemProp="name">
                Escola Municipal de Saúde Pública
              </h3>

              <address
                className="not-italic text-[13px] mt-1.5 leading-relaxed opacity-95"
                aria-label="Endereço da instituição"
                itemProp="address"
                itemScope
                itemType="https://schema.org/PostalAddress"
              >
                <span itemProp="streetAddress">
                  Rua Amador Bueno, 333 – 4º andar – Sala 401
                </span>
                <br />
                <span>
                  <span itemProp="addressLocality">Centro</span>,{" "}
                  <span itemProp="addressRegion">Santos / SP</span>,{" "}
                  <span itemProp="postalCode">11013-151</span>
                </span>
              </address>


            </div>
          </div>
        </div>

        {/* Card Contatos */}
        <div
          className={[
            "rounded-3xl border border-white/15 bg-white/8 backdrop-blur-md",
            "p-4 sm:p-5 shadow-[0_16px_44px_rgba(0,0,0,.18)]",
          ].join(" ")}
          aria-labelledby="footer-contatos"
        >
          <h4 id="footer-contatos" className="text-sm font-extrabold">
            Contatos
          </h4>

          <div className="mt-3 space-y-2.5 text-[13px]">
            <p className="flex items-center gap-3">
              <IconChip ringClass={ring} compact>
                <Phone size={17} className="opacity-95" />
              </IconChip>

              <a
                href="tel:+551332135100"
                className="hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 rounded-md"
                itemProp="telephone"
              >
                (13) 3213-5100 R. 5331
              </a>
            </p>

            <p className="flex items-center gap-3">
              <IconChip ringClass={ring} compact>
                <Mail size={17} className="opacity-95" />
              </IconChip>

              <a
                href="mailto:escoladasaude@santos.sp.gov.br"
                className="hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 rounded-md break-all"
                itemProp="email"
              >
                escoladasaude@santos.sp.gov.br
              </a>
            </p>    
          </div>
     
        </div>
      </div>

      {/* Barra final — mais baixa */}
      <div className={`${barBg} relative`}>
        <div className="max-w-7xl mx-auto px-6 py-2.5">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between text-[11px]">
            <span className="opacity-95">
              © {year} Escola da Saúde — Secretaria Municipal de Saúde — Prefeitura de Santos
            </span>
            <span className="opacity-80">Versão institucional • Ambiente autenticado</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
