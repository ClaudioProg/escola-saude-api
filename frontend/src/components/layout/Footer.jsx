// ✅ src/components/layout/Footer.jsx — v2.2
// Atualizado em: 21/05/2026
// Plataforma Escola da Saúde

import {
  ArrowUp,
  ExternalLink,
  Mail,
  MapPin,
  Phone,
  Sparkles,
} from "lucide-react";

import { getCampanhaSaudeVisual } from "../../utils/campanhaSaudeVisual";

function classNames(...classes) {
  return classes.filter(Boolean).join(" ");
}

function doisDigitos(value) {
  return String(value).padStart(2, "0");
}

function formatarPeriodoMes(data) {
  const ano = data.getFullYear();
  const mes = data.getMonth() + 1;
  const ultimoDia = new Date(ano, mes, 0).getDate();

  return `01/${doisDigitos(mes)}/${ano} a ${doisDigitos(ultimoDia)}/${doisDigitos(mes)}/${ano}`;
}

function voltarAoTopo() {
  if (typeof window === "undefined") return;

  window.scrollTo({
    top: 0,
    behavior: "smooth",
  });
}

function AccentPill({ campanha, children }) {
  const claro = campanha.textoContraste === "escuro";

  return (
    <span
      className={classNames(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-black shadow-sm ring-1 backdrop-blur",
        claro
          ? "border-slate-200 bg-white/85 text-slate-900 ring-white/70 dark:border-white/10 dark:bg-slate-900 dark:text-slate-100 dark:ring-white/10"
          : "border-white/15 bg-white/10 text-white ring-white/10"
      )}
    >
      {children}
    </span>
  );
}

export default function Footer() {
  const agora = new Date();
  const ano = agora.getFullYear();

  const campanha = getCampanhaSaudeVisual();
  const claro = campanha.textoContraste === "escuro";
  const periodoCampanha = formatarPeriodoMes(agora);

  return (
    <footer
      className="mt-12 border-t border-slate-200 bg-white text-slate-950 dark:border-white/10 dark:bg-slate-950 dark:text-slate-100"
      role="contentinfo"
      aria-label={`Rodapé institucional — ${campanha.nome}: ${campanha.referencia}`}
    >
      <div className="relative overflow-hidden">
        <div
          className={classNames("h-2 w-full bg-gradient-to-r", campanha.topbar)}
          aria-hidden="true"
        />

        <div
          aria-hidden="true"
          className={classNames(
            "pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-r blur-3xl",
            "opacity-75 dark:opacity-30",
            campanha.topbarGlow
          )}
        />

        <div className="h-px w-full bg-black/5 dark:bg-white/10" />
      </div>

      <section
        className={classNames(
          "relative overflow-hidden border-b px-4 pb-6 pt-7 text-center sm:px-6",
          "border-slate-200 bg-gradient-to-br from-white via-slate-50 to-white",
          "dark:border-white/10 dark:bg-none dark:bg-slate-950"
        )}
        aria-label="Campanha mensal de saúde"
      >
        <div
          className="pointer-events-none absolute inset-0 hidden bg-gradient-to-br from-slate-950 via-slate-950 to-slate-900 dark:block"
          aria-hidden="true"
        />

        <div
          className={classNames(
            "pointer-events-none absolute -left-20 -top-24 h-56 w-56 rounded-full blur-3xl",
            "opacity-80 dark:opacity-30",
            campanha.brilhoPrimario
          )}
          aria-hidden="true"
        />

        <div
          className={classNames(
            "pointer-events-none absolute -bottom-24 -right-20 h-64 w-64 rounded-full blur-3xl",
            "opacity-80 dark:opacity-25",
            campanha.brilhoSecundario
          )}
          aria-hidden="true"
        />

        <div className="relative mx-auto max-w-7xl">
          <div className="flex items-center justify-center">
            <AccentPill campanha={campanha}>
              <Sparkles className="h-3.5 w-3.5 opacity-90" aria-hidden="true" />
              Campanha do mês
            </AccentPill>
          </div>

          <h2
            className={classNames(
              "mt-3 text-base font-black tracking-tight sm:text-lg",
              claro ? "text-slate-950 dark:text-white" : "text-white"
            )}
          >
            {campanha.nome}
            <span className="mx-2 text-slate-400 dark:text-slate-600">•</span>
            <span>{campanha.referencia}</span>
          </h2>

          <p
            className={classNames(
              "mt-1 text-xs font-medium",
              claro ? "text-slate-600 dark:text-slate-400" : "text-white/70"
            )}
          >
            Período: {periodoCampanha}
          </p>

          <div
            className="mx-auto mt-6 h-px w-full max-w-5xl bg-gradient-to-r from-transparent via-slate-200 to-transparent dark:via-white/10"
            aria-hidden="true"
          />
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-9 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12">
        <section aria-label="Identidade institucional" className="space-y-6">
          <div>
            <div
              className={classNames(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-black shadow-sm",
                "border-slate-200 bg-slate-50 text-slate-900",
                "dark:border-white/10 dark:bg-slate-900 dark:text-slate-100"
              )}
            >
              <span
                className={classNames(
                  "h-1.5 w-1.5 rounded-full bg-gradient-to-r",
                  campanha.topbar
                )}
                aria-hidden="true"
              />
              Ambiente institucional autenticado
            </div>

            <h3 className="mt-4 text-lg font-black tracking-tight sm:text-xl">
              Escola Municipal de Saúde Pública
            </h3>

            <p className="mt-1 max-w-2xl text-sm font-medium leading-relaxed text-slate-600 dark:text-slate-400">
              Secretaria Municipal de Saúde — Prefeitura Municipal de Santos/SP.
              Plataforma oficial para gestão de eventos, inscrições, presenças,
              avaliações, certificados e serviços institucionais da Escola da
              Saúde.
            </p>
          </div>

          <div className="rounded-[1.75rem] border border-slate-200 bg-slate-50/70 p-4 dark:border-white/10 dark:bg-slate-900/70">
            <div className="flex items-start gap-3">
              <span
                className={classNames(
                  "grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br text-white ring-1 ring-white/30",
                  campanha.topbar
                )}
              >
                <MapPin className="h-5 w-5" aria-hidden="true" />
              </span>

              <div className="min-w-0">
                <h4 className="text-sm font-black">Localização</h4>

                <address className="mt-1 not-italic text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                  Rua Amador Bueno, 333 — 4º andar — Sala 401
                  <br />
                  Centro, Santos/SP — CEP 11013-151
                </address>

                <a
                  href="https://www.google.com/maps/search/?api=1&query=Rua+Amador+Bueno,+333,+Santos,+SP"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={classNames(
                    "mt-3 inline-flex items-center gap-1.5 rounded-xl text-sm font-black transition hover:opacity-80 focus-visible:outline-none focus-visible:ring-2",
                    "text-slate-900 dark:text-slate-100",
                    campanha.foco
                  )}
                >
                  Ver no mapa
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              </div>
            </div>
          </div>
        </section>

        <section aria-label="Contatos e suporte" className="space-y-6">
          <div className="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-900/70">
            <div className="flex items-start gap-3">
              <span
                className={classNames(
                  "grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br text-white ring-1 ring-white/30",
                  campanha.topbar
                )}
              >
                <Phone className="h-5 w-5" aria-hidden="true" />
              </span>

              <div className="min-w-0">
                <h4 className="text-sm font-black">Contatos</h4>

                <div className="mt-3 space-y-2.5 text-sm font-medium text-slate-600 dark:text-slate-400">
                  <p className="flex items-center gap-2">
                    <Phone className="h-4 w-4 shrink-0" aria-hidden="true" />

                    <a
                      href="tel:+551332135100"
                      className={classNames(
                        "rounded-lg transition hover:text-slate-950 hover:underline focus-visible:outline-none focus-visible:ring-2 dark:hover:text-white",
                        campanha.foco
                      )}
                    >
                      (13) 3213-5100
                      <span className="ml-1 text-slate-500 dark:text-slate-500">
                        Ramal 5331
                      </span>
                    </a>
                  </p>

                  <p className="flex items-center gap-2">
                    <Phone className="h-4 w-4 shrink-0" aria-hidden="true" />

                    <a
                      href="https://wa.me/5513996182615"
                      target="_blank"
                      rel="noopener noreferrer"
                      className={classNames(
                        "rounded-lg transition hover:text-slate-950 hover:underline focus-visible:outline-none focus-visible:ring-2 dark:hover:text-white",
                        campanha.foco
                      )}
                    >
                      WhatsApp: (13) 99618-2615
                    </a>
                  </p>

                  <p className="flex items-start gap-2">
                    <Mail
                      className="mt-0.5 h-4 w-4 shrink-0"
                      aria-hidden="true"
                    />

                    <a
                      href="mailto:escoladasaude@santos.sp.gov.br"
                      className={classNames(
                        "break-all rounded-lg transition hover:text-slate-950 hover:underline focus-visible:outline-none focus-visible:ring-2 dark:hover:text-white",
                        campanha.foco
                      )}
                    >
                      escoladasaude@santos.sp.gov.br
                    </a>
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-slate-200 bg-slate-50/70 p-4 dark:border-white/10 dark:bg-slate-900/70">
            <p className="text-sm font-black text-slate-900 dark:text-slate-100">
              Atendimento e suporte
            </p>

            <p className="mt-1 text-sm font-medium leading-relaxed text-slate-600 dark:text-slate-400">
              Segunda a sexta-feira, das 8h às 18h. Para agilizar o atendimento,
              informe seu nome, e-mail utilizado na plataforma, evento ou turma
              relacionada e uma descrição objetiva do problema.
            </p>
          </div>
        </section>
      </div>

      <section
        className="border-t border-slate-200 bg-white/80 px-4 py-6 dark:border-white/10 dark:bg-slate-950 sm:px-6"
        aria-label="Marcas institucionais"
      >
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-center gap-6 sm:flex-row sm:justify-between">
          <img
            src="/logos/escola-saude.png"
            alt="Escola da Saúde"
            className="max-h-14 w-auto object-contain"
            loading="lazy"
          />

          <img
            src="/logos/secretaria-saude.png"
            alt="Secretaria Municipal de Saúde de Santos"
            className="max-h-14 w-auto object-contain"
            loading="lazy"
          />

          <img
            src="/logos/prefeitura-santos.png"
            alt="Prefeitura de Santos"
            className="max-h-14 w-auto object-contain"
            loading="lazy"
          />
        </div>
      </section>

      <div className="border-t border-slate-200 dark:border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-4 text-center text-[11px] font-medium text-slate-500 dark:text-slate-400 sm:flex-row sm:px-6 sm:text-left">
          <span>
            © {ano} Escola Municipal de Saúde Pública — Secretaria Municipal de
            Saúde — Município de Santos
          </span>

          <button
            type="button"
            onClick={voltarAoTopo}
            className={classNames(
              "inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 py-1.5 font-black transition focus-visible:outline-none focus-visible:ring-2",
              "bg-slate-100 text-slate-900 hover:bg-slate-200",
              "dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800",
              campanha.foco
            )}
            aria-label="Voltar ao topo da página"
          >
            <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
            Topo
          </button>
        </div>
      </div>
    </footer>
  );
}