// ✅ src/components/Footer.jsx — Institucional premium (2 colunas + barra em degradê)
import { Mail, Phone, MapPin, Sparkles, ArrowUp, ExternalLink } from "lucide-react";

function dd(n) {
  return String(n).padStart(2, "0");
}

function getCampaignForMonth(month) {
  const campaigns = {
    7: { title: "JULHO AMARELO • Prevenção às Hepatites Virais", accent: "yellow" },
    8: { title: "AGOSTO DOURADO • Promoção do Aleitamento Materno", accent: "amber" },
    9: { title: "SETEMBRO VERDE • Doação de Órgãos e Inclusão", accent: "emerald" },
    10: { title: "OUTUBRO ROSA • Prevenção ao Câncer de Mama", accent: "pink" },
    11: { title: "NOVEMBRO AZUL • Prevenção ao Câncer de Próstata", accent: "sky" },
    12: { title: "DEZEMBRO VERMELHO • Prevenção ao HIV/AIDS", accent: "red" },
  };
  return campaigns[month] || null;
}

function periodTextOfMonth(date) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const first = new Date(year, month - 1, 1);
  const last = new Date(year, month, 0);
  return `de ${dd(first.getDate())}/${dd(month)}/${year} a ${dd(last.getDate())}/${dd(month)}/${year}`;
}

function barGradientClass(accent) {
  // barra premium: degradê + brilho sutil (sem “cards”)
  const map = {
    yellow: "from-yellow-400 via-amber-500 to-yellow-600",
    amber: "from-amber-300 via-amber-500 to-orange-500",
    emerald: "from-emerald-400 via-emerald-600 to-teal-600",
    pink: "from-pink-400 via-fuchsia-500 to-rose-500",
    sky: "from-sky-400 via-sky-600 to-indigo-600",
    red: "from-rose-400 via-red-600 to-rose-700",
  };
  return map[accent] || "from-emerald-500 via-emerald-700 to-teal-700";
}

function AccentPill({ accent = "emerald", children }) {
  const map = {
    emerald:
      "bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-200 dark:ring-emerald-900/50",
    amber:
      "bg-amber-50 text-amber-900 ring-amber-200 dark:bg-amber-950/25 dark:text-amber-200 dark:ring-amber-900/50",
    pink:
      "bg-pink-50 text-pink-900 ring-pink-200 dark:bg-pink-950/25 dark:text-pink-200 dark:ring-pink-900/50",
    sky:
      "bg-sky-50 text-sky-900 ring-sky-200 dark:bg-sky-950/25 dark:text-sky-200 dark:ring-sky-900/50",
    yellow:
      "bg-yellow-50 text-yellow-900 ring-yellow-200 dark:bg-yellow-950/25 dark:text-yellow-200 dark:ring-yellow-900/50",
    red:
      "bg-rose-50 text-rose-900 ring-rose-200 dark:bg-rose-950/25 dark:text-rose-200 dark:ring-rose-900/50",
  };

  return (
    <span
      className={[
        "inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold",
        "ring-1 shadow-sm",
        map[accent] || map.emerald,
      ].join(" ")}
    >
      {children}
    </span>
  );
}

export default function Footer() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const campaign = getCampaignForMonth(month);
  const periodo = campaign ? periodTextOfMonth(now) : null;

  const bar = barGradientClass(campaign?.accent);

  return (
    <footer
      className="mt-12 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 border-t border-zinc-200 dark:border-zinc-800"
      role="contentinfo"
      aria-label={campaign ? `Rodapé — ${campaign.title}` : "Rodapé institucional"}
    >
      {/* Barra superior premium (degradê + brilho) */}
      <div className="relative">
        <div className={`h-2 w-full bg-gradient-to-r ${bar}`} />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background:
              "radial-gradient(40% 140% at 20% 0%, rgba(255,255,255,.55) 0%, rgba(255,255,255,0) 55%)",
          }}
        />
      </div>

      {/* Campanha do mês (discreta e elegante) */}
      {campaign && (
        <div className="max-w-7xl mx-auto px-6 pt-7 pb-3 text-center">
          <div className="flex items-center justify-center gap-2">
            <AccentPill accent={campaign.accent}>
              <Sparkles size={14} className="opacity-90" />
              Campanha do mês
            </AccentPill>
          </div>

          <h2 className="mt-3 text-sm sm:text-base font-extrabold tracking-tight">
            {campaign.title}
          </h2>
          <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{periodo}</p>

          {/* divisória suave */}
          <div className="mt-6 h-px w-full bg-gradient-to-r from-transparent via-zinc-200 to-transparent dark:via-zinc-800" />
        </div>
      )}

      {/* Conteúdo principal — APENAS 2 colunas */}
      <div className="max-w-7xl mx-auto px-6 py-10 grid gap-10 md:grid-cols-2">
        {/* Coluna 1: Identidade + Localização */}
        <div className="space-y-6">
          <div>
            <h3 className="text-base sm:text-lg font-extrabold tracking-tight">
              Escola Municipal de Saúde Pública
            </h3>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Secretaria Municipal de Saúde — Prefeitura de Santos/SP
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 px-3 py-1">
                Ambiente autenticado
              </span>
              <span className="rounded-full bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 px-3 py-1">
                Versão institucional
              </span>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-200">
                <MapPin className="h-4 w-4" aria-hidden="true" />
              </span>
              <h4 className="text-sm font-extrabold">Localização</h4>
            </div>

            <address className="mt-2 not-italic text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
              Rua Amador Bueno, 333 – 4º andar – Sala 401
              <br />
              Centro, Santos/SP – 11013-151
            </address>

            <a
              href="https://www.google.com/maps/search/?api=1&query=Rua+Amador+Bueno,+333,+Santos,+SP"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-sky-700 hover:text-sky-800 dark:text-sky-300 dark:hover:text-sky-200"
            >
              Ver no mapa <ExternalLink size={14} aria-hidden="true" />
            </a>
          </div>
        </div>

        {/* Coluna 2: Contatos + Micro-links */}
        <div className="space-y-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-200">
                <Phone className="h-4 w-4" aria-hidden="true" />
              </span>
              <h4 className="text-sm font-extrabold">Contatos</h4>
            </div>

            <div className="mt-3 space-y-2.5 text-sm text-zinc-700 dark:text-zinc-300">
              <p className="flex items-center gap-2">
                <Phone size={14} className="text-emerald-700 dark:text-emerald-200" aria-hidden="true" />
                <a href="tel:+551332135100" className="hover:underline">
                  (13) 3213-5100 <span className="opacity-70">R. 5331</span>
                </a>
              </p>

              <p className="flex items-start gap-2">
                <Mail
                  size={14}
                  className="mt-0.5 text-emerald-700 dark:text-emerald-200"
                  aria-hidden="true"
                />
                <a
                  href="mailto:escoladasaude@santos.sp.gov.br"
                  className="hover:underline break-all"
                >
                  escoladasaude@santos.sp.gov.br
                </a>
              </p>
            </div>
          </div>

          {/* Bloco premium “discreto” sem bordas */}
          <div className="text-sm text-zinc-600 dark:text-zinc-400">
            <p className="font-semibold text-zinc-800 dark:text-zinc-200">
              Atendimento e suporte
            </p>
            <p className="mt-1 leading-relaxed">
              Em caso de dúvidas sobre inscrições, certificados e acesso, utilize os contatos acima.
            </p>
          </div>
        </div>
      </div>

      {/* Linha inferior */}
      <div className="border-t border-zinc-200 dark:border-zinc-800">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-zinc-600 dark:text-zinc-400">
          <span>
            © {year} Escola Municipal de Saúde Pública — Secretaria Municipal de Saúde — Município de Santos
          </span>

          <button
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-100 text-zinc-800 hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            aria-label="Voltar ao topo"
            type="button"
          >
            <ArrowUp size={14} aria-hidden="true" />
            Topo
          </button>
        </div>
      </div>
    </footer>
  );
}
