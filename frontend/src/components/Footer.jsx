// 📁 src/components/Footer.jsx
import { Mail, Phone, MapPin } from "lucide-react";

/** Zero à esquerda p/ 2 dígitos */
function dd(n) {
  return String(n).padStart(2, "0");
}

/** Retorna config temática (cores + título) por mês, ou null para padrão */
function getCampaignForMonth(month /* 1-12 */) {
  const campaigns = {
    7: {
      // Julho – Amarelo (Hepatites virais)
      title: "JULHO AMARELO • Prevenção às Hepatites Virais",
      footerBg: "bg-yellow-600",
      barBg: "bg-yellow-700",
      textColor: "text-white",
    },
    8: {
      // Agosto – Dourado (Aleitamento materno)
      title: "AGOSTO DOURADO • Promoção do Aleitamento Materno",
      footerBg: "bg-amber-600",
      barBg: "bg-amber-700",
      textColor: "text-white",
    },
    9: {
      // Setembro – Amarelo e Verde (Suicídio, PcD, Doação de órgãos)
      title:
        "SETEMBRO • Prevenção ao Suicídio • Inclusão das Pessoas com Deficiência • Doação de Órgãos e Tecidos",
      footerBg: "bg-gradient-to-r from-yellow-600 to-emerald-800",
      barBg: "bg-emerald-800",
      textColor: "text-white",
    },
    10: {
      // Outubro – Rosa (Câncer de mama)
      title: "OUTUBRO ROSA • Prevenção ao Câncer de Mama",
      footerBg: "bg-pink-700",
      barBg: "bg-pink-800",
      textColor: "text-white",
    },
    11: {
      // Novembro – Azul; Roxo (Próstata; Prematuridade)
      title:
        "NOVEMBRO • Prevenção do Câncer de Próstata • Conscientização sobre a Prematuridade",
      footerBg: "bg-gradient-to-r from-blue-700 to-purple-700",
      barBg: "bg-purple-800",
      textColor: "text-white",
    },
    12: {
      // Dezembro – Vermelho (HIV/AIDS e outras ISTs)
      title:
        "DEZEMBRO VERMELHO • Conscientização e Prevenção ao HIV/AIDS e outras ISTs",
      footerBg: "bg-red-700",
      barBg: "bg-red-800",
      textColor: "text-white",
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
  return `de ${dd(first.getDate())}/${dd(month)}/${year} a ${dd(
    last.getDate()
  )}/${dd(month)}/${year}`;
}

export default function Footer() {
  // Usa fuso local do navegador
  const now = new Date();
  const month = now.getMonth() + 1; // 1-12
  const year = now.getFullYear();

  const campaign = getCampaignForMonth(month);

  // Cores padrão (verde) fora de julho–dezembro
  const footerBg = campaign ? campaign.footerBg : "bg-emerald-900";
  const barBg = campaign ? campaign.barBg : "bg-emerald-800";
  const textColor = campaign ? campaign.textColor : "text-white";

  const periodo = campaign ? periodTextOfMonth(now) : null;

  return (
    <footer
      className={`${footerBg} ${textColor} mt-10 print:text-black print:bg-white`}
      role="contentinfo"
      aria-label={
        campaign
          ? `Rodapé institucional — campanha do mês: ${campaign.title}`
          : "Rodapé institucional"
      }
    >
      {/* Faixa com TÍTULO da campanha e PERÍODO (exibida só de jul–dez) */}
      {campaign && (
        <div className="px-6 py-4 text-center">
          <h2
            id="footer-campaign-title"
            className="text-base sm:text-lg font-bold"
          >
            {campaign.title}
          </h2>
          {periodo && (
            <p className="text-xs sm:text-sm opacity-90 mt-1">{periodo}</p>
          )}
        </div>
      )}

      {/* Bloco principal com microdados básicos de organização */}
      <div
        className="max-w-7xl mx-auto px-6 py-8 grid gap-8 sm:grid-cols-2"
        itemScope
        itemType="https://schema.org/Organization"
      >
        {/* Logo e Instituição */}
        <div>
          <h3 className="text-lg font-bold" itemProp="name">
            Escola Municipal de Saúde Pública
          </h3>
          <address
            className="not-italic text-sm mt-2 leading-relaxed"
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
              <span itemProp="addressLocality">Santos</span>,{" "}
              <span itemProp="addressRegion">SP</span>,{" "}
              <span itemProp="postalCode">11013-151</span>
            </span>
          </address>
        </div>

        {/* Contatos */}
        <div className="space-y-3 text-sm" aria-labelledby="footer-contatos">
          <h4 id="footer-contatos" className="sr-only">
            Informações de contato
          </h4>

          <p className="flex items-center gap-2">
            <Phone size={18} aria-hidden="true" />
            <a
              href="tel:+551332015000"
              className="hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 dark:focus-visible:ring-white/70 rounded-sm"
              itemProp="telephone"
            >
              (13) 3201-5000 R. 5331
            </a>
          </p>

          <p className="flex items-center gap-2">
            <Mail size={18} aria-hidden="true" />
            <a
              href="mailto:escoladasaude@santos.sp.gov.br"
              className="hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 dark:focus-visible:ring-white/70 rounded-sm break-all"
              itemProp="email"
            >
              escoladasaude@santos.sp.gov.br
            </a>
          </p>

          <p className="flex items-center gap-2">
            <MapPin size={18} aria-hidden="true" />
            <span>Santos/SP</span>
          </p>
        </div>
      </div>

      <div className={`${barBg} text-center text-xs py-3 px-2`}>
        © {year} Escola da Saúde – Secretaria Municipal de Saúde – Prefeitura de Santos
      </div>
    </footer>
  );
}
