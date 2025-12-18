// ✅ src/pages/HomeEscola.jsx
import { useEffect, useMemo, useCallback, useState } from "react";
import { motion } from "framer-motion";
import {
  CalendarDays,
  Megaphone,
  ShieldCheck,
  Download,
  Sparkles,
  ArrowRight,
  FileText,
  ClipboardList,
  ListChecks,
  QrCode,
  ExternalLink,
  Copy,
  Instagram,
  Share2,
} from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";

import Footer from "../components/Footer";
import HeaderHero from "../components/HeaderHero";
import QrSiteEscola from "../components/QrSiteEscola";

const SITE_URL = "https://escoladasaude.vercel.app";
const INSTAGRAM_URL =
  "https://www.instagram.com/escoladasaudesms?igsh=Zzd5M3MyazZ0aXRm&utm_source=qr";

/* ────────────────────────────────────────────────────────────── */
/* Card de destaque (premium)                                      */
/* ────────────────────────────────────────────────────────────── */
function DestaqueLongo({ imgSrc, imgAlt, titulo, subtitulo, badge, children }) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="overflow-hidden rounded-3xl bg-white dark:bg-zinc-900/55 shadow-sm ring-1 ring-black/5 dark:ring-white/10 flex flex-col"
    >
      <div className="relative">
        <img src={imgSrc} alt={imgAlt} className="w-full h-56 object-cover" loading="lazy" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/15 to-transparent" />

        {badge && (
          <span className="absolute top-3 left-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/15 backdrop-blur px-3 py-1 text-xs font-extrabold text-white shadow-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-white/80" aria-hidden="true" />
            {badge}
          </span>
        )}
      </div>

      <div className="p-5 sm:p-6 space-y-2">
        <h3 className="text-lg sm:text-xl font-extrabold tracking-tight text-slate-900 dark:text-zinc-100">
          {titulo}
        </h3>
        {subtitulo && (
          <p className="text-emerald-700 dark:text-emerald-300 text-sm font-bold">
            {subtitulo}
          </p>
        )}
        <div className="text-sm text-slate-700 dark:text-zinc-300 leading-relaxed space-y-3 text-justify">
          {children}
        </div>
      </div>
    </motion.article>
  );
}

/* ────────────────────────────────────────────────────────────── */
/* MiniStat                                                        */
/* ────────────────────────────────────────────────────────────── */
function MiniStat({ icon: Icon, label, value, hint, tone = "emerald" }) {
  const toneMap = {
    emerald: "bg-emerald-600/10 text-emerald-700 dark:text-emerald-200 dark:bg-emerald-400/10",
    sky: "bg-sky-600/10 text-sky-700 dark:text-sky-200 dark:bg-sky-400/10",
    violet: "bg-violet-600/10 text-violet-700 dark:text-violet-200 dark:bg-violet-400/10",
    amber: "bg-amber-600/10 text-amber-800 dark:text-amber-200 dark:bg-amber-400/10",
    rose: "bg-rose-600/10 text-rose-800 dark:text-rose-200 dark:bg-rose-400/10",
  };

  return (
    <div className="rounded-3xl bg-white dark:bg-zinc-900/55 border border-slate-200 dark:border-white/10 p-4 sm:p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
            {label}
          </div>
          <div className="mt-1 text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-zinc-100">
            {value}
          </div>
          {hint ? (
            <div className="mt-1 text-[12px] text-slate-600 dark:text-zinc-400">
              {hint}
            </div>
          ) : null}
        </div>

        <div className={`shrink-0 rounded-2xl p-3 ${toneMap[tone] || toneMap.emerald}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────── */
/* Quick card (atalhos)                                            */
/* ────────────────────────────────────────────────────────────── */
function QuickCard({ to, icon: Icon, title, subtitle, tone = "emerald" }) {
  const toneBar = {
    emerald: "from-emerald-500/45 via-emerald-500/20 to-transparent",
    sky: "from-sky-500/45 via-sky-500/20 to-transparent",
    violet: "from-violet-500/45 via-violet-500/20 to-transparent",
    amber: "from-amber-500/45 via-amber-500/20 to-transparent",
  };

  return (
    <Link
      to={to}
      className="group rounded-3xl bg-white dark:bg-zinc-900/55 border border-slate-200 dark:border-white/10 p-4 sm:p-5 shadow-sm hover:shadow-md transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
    >
      <div className={`h-1.5 w-full rounded-full bg-gradient-to-r ${toneBar[tone] || toneBar.emerald}`} aria-hidden="true" />

      <div className="mt-4 flex items-start gap-3">
        <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-zinc-950/30 p-3 group-hover:bg-slate-100 dark:group-hover:bg-white/5 transition">
          <Icon className="w-5 h-5 text-slate-800 dark:text-zinc-100" />
        </div>

        <div className="min-w-0">
          <div className="text-sm font-extrabold text-slate-900 dark:text-zinc-100">
            {title}
          </div>
          <div className="mt-1 text-[12px] text-slate-600 dark:text-zinc-400">
            {subtitle}
          </div>
        </div>

        <ArrowRight className="ml-auto w-5 h-5 text-slate-400 group-hover:text-slate-700 dark:text-zinc-500 dark:group-hover:text-zinc-200 transition" />
      </div>
    </Link>
  );
}

/* ────────────────────────────────────────────────────────────── */
/* QR Card                                                         */
/* ────────────────────────────────────────────────────────────── */
function QrCard({ title, subtitle, icon: Icon, accent = "teal", url, qrSize }) {
  const accentMap = {
    teal: "text-teal-600 dark:text-teal-300",
    emerald: "text-emerald-600 dark:text-emerald-300",
    pink: "text-pink-600 dark:text-pink-300",
    sky: "text-sky-600 dark:text-sky-300",
  };
  const badgeBar = {
    teal: "from-teal-500/40 via-emerald-500/20 to-transparent",
    emerald: "from-emerald-500/40 via-sky-500/20 to-transparent",
    pink: "from-pink-500/40 via-rose-500/20 to-transparent",
    sky: "from-sky-500/40 via-violet-500/20 to-transparent",
  };

  return (
    <div className="rounded-3xl bg-white dark:bg-zinc-900/55 border border-slate-200 dark:border-white/10 p-5 sm:p-6 shadow-sm">
      <div className={`h-1.5 w-full rounded-full bg-gradient-to-r ${badgeBar[accent] || badgeBar.teal}`} aria-hidden="true" />

      <div className="mt-4 flex items-start gap-3">
        <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-zinc-950/30 p-3">
          <Icon className={`w-5 h-5 ${accentMap[accent] || accentMap.teal}`} />
        </div>

        <div className="min-w-0">
          <div className="text-sm font-extrabold text-slate-900 dark:text-zinc-100">
            {title}
          </div>
          <div className="mt-1 text-[12px] text-slate-600 dark:text-zinc-400">
            {subtitle}
          </div>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-center">
        <QrSiteEscola size={qrSize} showLogo={false} url={url} />
      </div>
    </div>
  );
}

function ActionBtn({ onClick, icon: Icon, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-extrabold text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:bg-zinc-900/35 dark:text-zinc-200 dark:hover:bg-white/5 transition"
    >
      <Icon className="w-4 h-4" />
      {children}
    </button>
  );
}

export default function HomeEscola() {
  useEffect(() => {
    document.title = "Escola da Saúde — Painel";
  }, []);

  const isDark = useMemo(() => document.documentElement.classList.contains("dark"), []);

  const qrSize = useMemo(() => {
    if (typeof window !== "undefined") {
      if (window.innerWidth < 360) return 220;
      if (window.innerWidth < 768) return 240;
    }
    return 260;
  }, []);

  // Ações QR
  const abrirSite = useCallback(() => {
    window.open(SITE_URL, "_blank", "noopener,noreferrer");
  }, []);
  const copiarSite = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(SITE_URL);
      toast.success("🔗 Link do site copiado!");
    } catch {
      toast.error("Não foi possível copiar o link.");
    }
  }, []);
  const abrirInstagram = useCallback(() => {
    window.open(INSTAGRAM_URL, "_blank", "noopener,noreferrer");
  }, []);
  const compartilhar = useCallback(async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Escola da Saúde de Santos",
          text: "Acesse os links oficiais da Escola da Saúde",
          url: SITE_URL,
        });
      } else {
        await navigator.clipboard.writeText(SITE_URL);
        toast.success("📎 Link copiado (compartilhamento indisponível).");
      }
    } catch {
      /* cancelado pelo usuário */
    }
  }, []);

  return (
    <>
      <div className="max-w-7xl mx-auto p-4 md:p-6">
        {/* HeaderHero premium (sem os pills da direita) */}
        <HeaderHero
          title="Painel da Escola da Saúde"
          subtitle="Informações importantes, campanhas e destaques da Escola Municipal de Saúde Pública de Santos."
          badge="Plataforma oficial • autenticado"
          icon={Sparkles}
          gradient="from-emerald-700 via-teal-600 to-sky-700"
          isDark={isDark}
          rightSlot={null}
        />

        {/* Ministats (reduzidos: remove Notificações e Campanhas) */}
        <section className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <MiniStat
            icon={Download}
            label="Aplicativo"
            value="PWA disponível"
            hint="Instale no celular ou PC em 1 minuto"
            tone="amber"
          />
          <MiniStat
            icon={ShieldCheck}
            label="Acesso"
            value="Autenticado"
            hint="Ambiente oficial e seguro"
            tone="emerald"
          />
        </section>

        {/* Acesso rápido */}
        <section className="mt-6" aria-label="Acesso rápido">
          <div className="flex items-end justify-between gap-3">
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-zinc-100">
              Acesso rápido
            </h2>
            <p className="hidden sm:block text-sm text-slate-600 dark:text-zinc-400">
              Atalhos para as áreas mais usadas
            </p>
          </div>

          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <QuickCard
              to="/eventos"
              icon={CalendarDays}
              title="Eventos"
              subtitle="Veja a programação e detalhes"
              tone="sky"
            />
            <QuickCard
              to="/minhas-inscricoes"
              icon={ClipboardList}
              title="Inscrições"
              subtitle="Acompanhe seus cursos e turmas"
              tone="emerald"
            />
            <QuickCard
              to="/minhas-presencas"
              icon={ListChecks}
              title="Presenças"
              subtitle="Confirme e consulte presença"
              tone="violet"
            />
            <QuickCard
              to="/certificados"
              icon={FileText}
              title="Certificados"
              subtitle="Gere e baixe seus certificados"
              tone="amber"
            />
          </div>
        </section>

        {/* Links oficiais (QR do site + Instagram) */}
        <section className="mt-8" aria-label="Links oficiais">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-zinc-100">
                Links oficiais
              </h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
                QR Codes do site institucional e do Instagram oficial.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <ActionBtn onClick={abrirSite} icon={ExternalLink}>Abrir site</ActionBtn>
              <ActionBtn onClick={copiarSite} icon={Copy}>Copiar link</ActionBtn>
              <ActionBtn onClick={abrirInstagram} icon={Instagram}>Instagram</ActionBtn>
              <ActionBtn onClick={compartilhar} icon={Share2}>Compartilhar</ActionBtn>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
            <QrCard
              title="Site oficial"
              subtitle="escoladasaude.vercel.app"
              icon={QrCode}
              accent="emerald"
              url={SITE_URL}
              qrSize={qrSize}
            />
            <QrCard
              title="Instagram"
              subtitle="@escoladasaudesms"
              icon={Instagram}
              accent="pink"
              url={INSTAGRAM_URL}
              qrSize={qrSize}
            />
          </div>
        </section>

        {/* Destaques */}
        <section className="mt-8" aria-label="Destaques">
          <div className="flex items-end justify-between gap-3">
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-zinc-100">
              Destaques
            </h2>
            <p className="hidden sm:block text-sm text-slate-600 dark:text-zinc-400">
              Comunicados e campanhas oficiais
            </p>
          </div>

          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 0) Mensagem de Natal e Feliz 2026 */}
            <DestaqueLongo
              imgSrc="/banners/natal-2025.png"
              imgAlt="Mensagem de Natal e Feliz 2026"
              titulo="🎄 Feliz Natal e um 2026 iluminado!"
              subtitulo="Gratidão, união e novos caminhos"
              badge="Mensagem Especial"
            >
              <p>
                Chegamos ao fim de mais um ano de muito trabalho, dedicação e aprendizado. Em nome da
                <strong> Escola da Saúde </strong> e da
                <strong> Secretaria Municipal de Saúde</strong>, registramos nosso sincero agradecimento
                a todas as pessoas que constroem diariamente uma saúde pública mais humana, acolhedora e eficiente.
              </p>

              <p>
                A cada profissional, instrutor, colaborador, estudante, participante de nossos cursos e
                a cada usuário desta plataforma: <strong>obrigado</strong> por fazer parte dessa jornada e
                por contribuir para o fortalecimento da educação em saúde no município.
              </p>

              <p>
                <strong>Que o Natal renove nossas energias</strong>, trazendo paz, esperança e afeto aos lares,
                e que 2026 nos presenteie com novas oportunidades de crescimento, aprendizado e realizações.
              </p>

              <p><strong>✨ Que o novo ano seja leve, próspero e cheio de conquistas.</strong></p>

              <p>
                Seguimos juntos, promovendo conhecimento, ampliando horizontes e transformando vidas.
                <strong> Feliz Natal e um extraordinário 2026 a todos! 🎄💫</strong>
              </p>
            </DestaqueLongo>

            {/* 1) 01/12 – Dia Mundial de Luta Contra a Aids */}
            <DestaqueLongo
              imgSrc="/banners/dia-mundial-aids.png"
              imgAlt="Arte da campanha Dia Mundial de Luta Contra a Aids"
              titulo="❤️ 1º de Dezembro — Dia Mundial de Luta Contra a Aids"
              subtitulo="Prevenção, cuidado e acolhimento"
              badge="Campanha"
            >
              <p>
                O <strong>Dia Mundial de Luta Contra a Aids</strong> é celebrado em 1º de dezembro e representa
                um chamado global à conscientização, à prevenção e ao enfrentamento do HIV, reforçando o compromisso
                com a vida, o cuidado e o acesso à informação.
              </p>

              <p>
                Desde o surgimento da epidemia, grandes avanços tornaram o HIV uma condição tratável. Hoje,
                pessoas vivendo com HIV podem ter qualidade de vida e expectativa semelhante à da população geral,
                desde que em acompanhamento e tratamento adequados.
              </p>

              <p><strong>💡 Prevenção e informação salvam vidas</strong></p>

              <p>
                <strong>Prevenção Combinada:</strong> inclui o uso de preservativos, PEP (profilaxia pós-exposição),
                PrEP (profilaxia pré-exposição) e testagem regular — todos disponíveis pelo SUS.
              </p>

              <p>
                <strong>Testagem gratuita:</strong> conhecer o diagnóstico é o primeiro passo para o cuidado. Os testes
                rápidos estão disponíveis nas Unidades de Saúde e Centros de Testagem e Aconselhamento (CTA).
              </p>

              <p>
                <strong>Tratamento para todos:</strong> o início precoce da terapia antirretroviral (TARV) garante
                melhor saúde e reduz drasticamente o risco de transmissão.
              </p>

              <p><strong>🌍 Um movimento por respeito e acolhimento</strong></p>

              <p>
                Combater o estigma e a discriminação é tão importante quanto promover prevenção e acesso ao tratamento.
                A luta contra a Aids é coletiva — envolve empatia, responsabilidade social e defesa da vida.
              </p>

              <p>
                <strong>Testar, tratar, acolher e respeitar. Esse é o caminho para um futuro sem estigma. ❤️</strong>
              </p>
            </DestaqueLongo>

            {/* 2) Instalação do App PWA */}
            <DestaqueLongo
              imgSrc="/banners/app-escola-saude.png"
              imgAlt="Instale o App Escola da Saúde"
              titulo="📲 Instale o App Escola da Saúde!"
              subtitulo="Disponível como aplicativo PWA"
              badge="Instalação rápida"
            >
              <h3 className="font-extrabold mt-4">🍎 iPhone / iPad (iOS)</h3>
              <ul className="list-disc ml-6">
                <li><strong>Navegador obrigatório:</strong> Safari</li>
                <li>Acesse: <strong>https://escola.santos.sp.gov.br</strong></li>
                <li>Toque no botão <strong>Compartilhar</strong> (ícone de quadrado com seta)</li>
                <li>Selecione <strong>Adicionar à Tela de Início</strong></li>
                <li>Confirme em <strong>Adicionar</strong></li>
                <li>📌 O app aparecerá na tela como um aplicativo normal</li>
              </ul>

              <h3 className="font-extrabold mt-4">📱 Android – Chrome</h3>
              <ul className="list-disc ml-6">
                <li>Acesse: <strong>https://escola.santos.sp.gov.br</strong></li>
                <li>Toque no menu <strong>⋮</strong></li>
                <li>Selecione <strong>Instalar aplicativo</strong> ou <strong>Adicionar à tela inicial</strong></li>
                <li>Confirme em <strong>Instalar</strong></li>
                <li>📌 O ícone aparecerá automaticamente na tela</li>
              </ul>

              <h3 className="font-extrabold mt-4">🌐 Computador (Windows / Chromebook / Linux)</h3>
              <ul className="list-disc ml-6">
                <li>Abra o <strong>Chrome</strong> ou <strong>Edge</strong></li>
                <li>Acesse: <strong>https://escola.santos.sp.gov.br</strong></li>
                <li>Clique no ícone <strong>Instalar</strong> na barra de endereço</li>
                <li>Confirme em <strong>Instalar</strong></li>
                <li>📌 O app abrirá em uma janela própria, como um programa</li>
              </ul>

              <h3 className="font-extrabold mt-4">❓ Como saber que foi instalado corretamente?</h3>
              <ul className="list-disc ml-6">
                <li>✔ Ícone na tela inicial do celular</li>
                <li>✔ Abre em tela cheia (sem barra do navegador)</li>
                <li>✔ Funciona offline em algumas funcionalidades</li>
                <li>✔ Notificações ativas (certificados, avaliações e presença)</li>
              </ul>

              <p className="mt-4 font-extrabold text-emerald-700 dark:text-emerald-300">
                Android: <strong>⋮ → Instalar app</strong>
              </p>
              <p className="font-extrabold text-sky-700 dark:text-sky-300">
                iPhone: <strong>Compartilhar → Adicionar à Tela de Início</strong>
              </p>

              <p className="mt-6 font-extrabold text-slate-900 dark:text-zinc-100">
                📍 Em breve, após finalização do programa, o app também estará disponível na
                <strong className="text-emerald-700 dark:text-emerald-300"> Google Play Store</strong>.
              </p>
            </DestaqueLongo>
          </div>
        </section>
      </div>

      <Footer />
    </>
  );
}
