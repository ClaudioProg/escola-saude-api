// ✅ src/components/Footer.jsx — versão moderna com fundo branco e barra colorida
import { Mail, Phone, MapPin, Sparkles } from "lucide-react";

function dd(n) {
  return String(n).padStart(2, "0");
}

function getCampaignForMonth(month) {
  const campaigns = {
    7: { title: "JULHO AMARELO • Prevenção às Hepatites Virais", barBg: "bg-yellow-600" },
    8: { title: "AGOSTO DOURADO • Promoção do Aleitamento Materno", barBg: "bg-amber-500" },
    9: { title: "SETEMBRO VERDE • Doação de Órgãos e Inclusão", barBg: "bg-emerald-600" },
    10: { title: "OUTUBRO ROSA • Prevenção ao Câncer de Mama", barBg: "bg-pink-600" },
    11: { title: "NOVEMBRO AZUL • Prevenção ao Câncer de Próstata", barBg: "bg-sky-700" },
    12: { title: "DEZEMBRO VERMELHO • Prevenção ao HIV/AIDS", barBg: "bg-red-600" },
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

export default function Footer() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const campaign = getCampaignForMonth(month);
  const periodo = campaign ? periodTextOfMonth(now) : null;

  return (
    <footer
      className="bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 mt-10 border-t border-zinc-200 dark:border-zinc-700"
      role="contentinfo"
      aria-label={campaign ? `Rodapé — ${campaign.title}` : "Rodapé institucional"}
    >
      {/* Barra colorida separadora */}
      <div className={`${campaign ? campaign.barBg : "bg-emerald-700"} h-1.5 w-full`} />

      {/* Campanha do mês */}
      {campaign && (
        <div className="text-center py-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-zinc-300 dark:border-zinc-700 px-3 py-1 text-[11px] font-semibold">
            <Sparkles size={14} className="text-yellow-600 dark:text-yellow-400" />
            Campanha do mês
          </div>
          <h2 className="mt-2 text-sm sm:text-base font-extrabold tracking-tight">
            {campaign.title}
          </h2>
          <p className="text-xs opacity-70">{periodo}</p>
        </div>
      )}

      {/* Conteúdo */}
      <div className="max-w-7xl mx-auto px-6 py-8 grid gap-6 lg:grid-cols-2">
        {/* Endereço */}
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-sm p-5">
          <div className="flex items-start gap-3">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-emerald-600 text-white">
              <MapPin size={16} />
            </span>
            <div>
              <h3 className="font-bold text-base">Escola Municipal de Saúde Pública</h3>
              <address className="not-italic text-sm leading-relaxed mt-1">
                Rua Amador Bueno, 333 – 4º andar – Sala 401<br />
                Centro, Santos/SP – 11013-151
              </address>
            </div>
          </div>
        </div>

        {/* Contatos */}
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-sm p-5">
          <h4 className="text-sm font-extrabold mb-3">Contatos</h4>
          <div className="space-y-2 text-sm">
            <p className="flex items-center gap-3">
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-emerald-600 text-white">
                <Phone size={16} />
              </span>
              <a href="tel:+551332135100" className="hover:underline">
                (13) 3213-5100 R. 5331
              </a>
            </p>
            <p className="flex items-center gap-3">
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-emerald-600 text-white">
                <Mail size={16} />
              </span>
              <a href="mailto:escoladasaude@santos.sp.gov.br" className="hover:underline break-all">
                escoladasaude@santos.sp.gov.br
              </a>
            </p>
          </div>
        </div>
      </div>

      {/* Linha inferior discreta */}
      <div className="border-t border-zinc-200 dark:border-zinc-700">
        <div className="max-w-7xl mx-auto px-6 py-3 flex flex-col sm:flex-row items-center justify-between text-[11px] text-zinc-600 dark:text-zinc-400">
          <span>© {year} Escola da Saúde — Secretaria Municipal de Saúde — Prefeitura de Santos</span>
          <span className="mt-1 sm:mt-0">Versão institucional • Ambiente autenticado</span>
        </div>
      </div>
    </footer>
  );
}
