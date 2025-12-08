// ✅ src/pages/HomeEscola.jsx
import { useEffect } from "react";
import { motion } from "framer-motion";
import { CalendarDays, Megaphone } from "lucide-react";
import Footer from "../components/Footer"; // rodapé institucional

/** Card de destaque com imagem e texto longo (sem CTA) */
function DestaqueLongo({ imgSrc, imgAlt, titulo, subtitulo, badge, children }) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="overflow-hidden rounded-3xl bg-white dark:bg-zinc-900 shadow ring-1 ring-black/5 flex flex-col"
    >
      <div className="relative">
        <img
          src={imgSrc}
          alt={imgAlt}
          className="w-full h-56 object-cover"
          loading="lazy"
        />
        {badge && (
          <span className="absolute top-3 left-3 inline-flex items-center rounded-full bg-emerald-600 text-white text-xs font-semibold px-3 py-1 shadow">
            {badge}
          </span>
        )}
      </div>
      <div className="p-5 sm:p-6 space-y-2 text-justify">
        <h3 className="text-lg font-bold">{titulo}</h3>
        {subtitulo && (
          <p className="text-emerald-700 dark:text-emerald-300 text-sm font-medium">
            {subtitulo}
          </p>
        )}
        <div className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed space-y-3">
          {children}
        </div>
      </div>
    </motion.article>
  );
}

export default function HomeEscola() {
  useEffect(() => {
    document.title = "Escola da Saúde";
  }, []);

  return (
    <>
      <div className="max-w-7xl mx-auto p-4 md:p-6">
        {/* Hero (3 cores, como combinado) */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl p-8 md:p-12 bg-gradient-to-r from-amber-500 via-rose-500 to-fuchsia-600 text-white shadow"
          role="banner"
        >
          <h1 className="text-3xl md:text-4xl font-bold">Escola da Saúde</h1>
          <p className="mt-2 text-white/90 max-w-3xl">
            Informações importantes, campanhas e destaques da Escola Municipal de Saúde
            Pública de Santos.
          </p>

          {/* Avisos curtos */}
          <div className="mt-6 flex flex-wrap gap-3">
            <span className="inline-flex items-center gap-2 bg-white/15 px-3 py-1.5 rounded-full text-sm">
              <Megaphone className="w-4 h-4" /> Informes e campanhas
            </span>
            <span className="inline-flex items-center gap-2 bg-white/15 px-3 py-1.5 rounded-full text-sm">
              <CalendarDays className="w-4 h-4" /> Semana David Capistrano
            </span>
          </div>
        </motion.section>

        {/* 🎯 DESTAQUES (banners com texto completo) */}
        <section className="mt-8" aria-label="Destaques">
          <h2 className="text-xl font-semibold mb-3">Destaques</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

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
            
            {/* 2. Instalação do App PWA */}
<DestaqueLongo
  imgSrc="/banners/app-escola-saude.png"
  imgAlt="Instale o App Escola da Saúde"
  titulo="📲 Instale o App Escola da Saúde!"
  subtitulo="Disponível como aplicativo PWA"
  badge="Instalação rápida"
>
  <h3 className="font-bold mt-4">🍎 iPhone / iPad (iOS)</h3>
  <ul className="list-disc ml-6">
    <li><strong>Navegador obrigatório:</strong> Safari</li>
    <li>Acesse: <strong>https://escola.santos.sp.gov.br</strong></li>
    <li>Toque no botão <strong>Compartilhar</strong> (ícone de quadrado com seta)</li>
    <li>Selecione <strong>Adicionar à Tela de Início</strong></li>
    <li>Confirme em <strong>Adicionar</strong></li>
    <li>📌 O app aparecerá na tela como um aplicativo normal</li>
  </ul>

  <h3 className="font-bold mt-4">📱 Samsung Galaxy / Android – Chrome</h3>
  <ul className="list-disc ml-6">
    <li>Acesse: <strong>https://escola.santos.sp.gov.br</strong></li>
    <li>Toque no menu <strong>⋮</strong> (Três pontinhos)</li>
    <li>Selecione <strong>Instalar aplicativo</strong> ou <strong>Adicionar à tela inicial</strong></li>
    <li>Confirme em <strong>Instalar</strong></li>
    <li>📌 O ícone aparecerá automaticamente na tela</li>
  </ul>

  <h3 className="font-bold mt-4">📱 Outros Android (Xiaomi, Motorola, Asus, Lenovo)</h3>
  <ul className="list-disc ml-6">
    <li>Abra o navegador <strong>Chrome</strong></li>
    <li>Acesse: <strong>https://escola.santos.sp.gov.br</strong></li>
    <li>Toque no menu <strong>⋮</strong></li>
    <li>Toque em <strong>Instalar app</strong> ou <strong>Adicionar à tela inicial</strong></li>
    <li>Toque em <strong>Instalar</strong></li>
  </ul>

  <h3 className="font-bold mt-4">🟦 Microsoft Edge (Android)</h3>
  <ul className="list-disc ml-6">
    <li>Acesse: <strong>https://escola.santos.sp.gov.br</strong></li>
    <li>Toque no menu <strong>⋯</strong></li>
    <li>Selecione <strong>Instalar aplicativo</strong></li>
    <li>Confirme instalação</li>
  </ul>

  <h3 className="font-bold mt-4">🌐 Computador (Windows / Chromebook / Linux)</h3>
  <ul className="list-disc ml-6">
    <li>Abra o <strong>Chrome</strong> ou <strong>Edge</strong></li>
    <li>Acesse: <strong>https://escola.santos.sp.gov.br</strong></li>
    <li>Clique no ícone <strong>Instalar</strong> na barra de endereço</li>
    <li>Confirme em <strong>Instalar</strong></li>
    <li>📌 O app abrirá em uma janela própria, como um programa</li>
  </ul>

  <h3 className="font-bold mt-4">❓ Como saber que foi instalado corretamente?</h3>
  <ul className="list-disc ml-6">
    <li>✔ Ícone na tela inicial do celular</li>
    <li>✔ Abre em tela cheia (sem barra do navegador)</li>
    <li>✔ Funciona offline em algumas funcionalidades</li>
    <li>✔ Notificações ativas (certificados, avaliações e presença)</li>
  </ul>

  <p className="mt-4 font-bold text-green-600 dark:text-green-400">
    Toque no menu <strong>⋮ → Instalar app</strong> (Android)
  </p>
  <p className="font-bold text-blue-600 dark:text-blue-400">
    Toque em <strong>Compartilhar → Adicionar à Tela de Início</strong> (iPhone)
  </p>

  <p className="mt-6 font-bold text-gray-800 dark:text-gray-200">
    📍 Em breve, após finalização do programa, o app também estará disponível na
    <strong className="text-green-600"> Google Play Store</strong>.
  </p>
</DestaqueLongo>




           </div>
        </section>
      </div>

      <Footer />
    </>
  );
}
