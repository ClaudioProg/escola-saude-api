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
            
            {/* 1. Instalação do App PWA */}
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

            {/* 2) Novembro Azul */}
<DestaqueLongo
  imgSrc="/banners/novembro-azul.png"
  imgAlt="Arte da campanha Novembro Azul"
  titulo="💙 Novembro Azul: um mês pela vida"
  subtitulo="Prevenção do câncer de próstata"
  badge="Campanha"
>
  <p>
    Novembro é o mês dedicado à conscientização sobre a saúde do homem, com ênfase na prevenção
    e no diagnóstico precoce do câncer de próstata — o segundo tipo mais comum entre os homens
    brasileiros, atrás apenas do câncer de pele.
  </p>

  <p>
    A cor azul que ilumina monumentos, prédios e espaços públicos neste período simboliza um
    lembrete importante: cuidar da saúde também é um gesto de responsabilidade e amor-próprio.
    O Novembro Azul convida todos os homens a romperem preconceitos e a procurarem acompanhamento
    médico regular.
  </p>

  <p><strong>💡 Prevenção e autocuidado</strong></p>

  <p>
    <strong>Consultas e exames de rotina:</strong> o acompanhamento com o urologista é fundamental,
    especialmente a partir dos 45 anos (ou 40, para quem tem histórico familiar de câncer de próstata).
    O exame de toque retal e o exame de sangue PSA são aliados no diagnóstico precoce.
  </p>

  <p>
    <strong>Estilo de vida saudável:</strong> manter uma alimentação balanceada, praticar atividades
    físicas, evitar o tabagismo e o consumo excessivo de álcool contribuem para reduzir o risco de
    doenças crônicas e câncer.
  </p>

  <p>
    <strong>Escuta e cuidado integral:</strong> cuidar da saúde mental, buscar apoio quando necessário
    e manter vínculos afetivos também fazem parte do bem-estar masculino.
  </p>

  <p><strong>🌍 Um compromisso com a vida</strong></p>

  <p>
    O Novembro Azul é mais do que uma campanha: é um movimento pela valorização da saúde,
    da informação e da vida. Falar sobre prevenção é um ato de coragem e amor — por si e
    por quem está ao seu lado.
  </p>

  <p>
    <strong>Cuide-se. Faça seus exames. Valorize a vida. 💙</strong>
  </p>
</DestaqueLongo>


            {/* 3) Novembro Roxo */}
<DestaqueLongo
  imgSrc="/banners/novembro-roxo.png"
  imgAlt="Arte da campanha Novembro Roxo"
  titulo="💜 Novembro Roxo: juntos pela prematuridade"
  subtitulo="Conscientização sobre o nascimento prematuro"
  badge="Campanha"
>
  <p>
    O Novembro Roxo é o mês mundial de sensibilização sobre a prematuridade, uma condição que
    afeta milhões de bebês todos os anos. A campanha tem como objetivo conscientizar sobre as
    causas, consequências e, principalmente, sobre a importância da prevenção e do cuidado
    adequado com os bebês que nascem antes das 37 semanas de gestação.
  </p>

  <p>
    O roxo, cor símbolo da campanha, representa sensibilidade, compaixão e transformação.
    Ele nos lembra que cada vida prematura é uma história de força, amor e esperança — e que
    o apoio das famílias, profissionais de saúde e da sociedade faz toda a diferença na jornada
    desses pequenos guerreiros.
  </p>

  <p><strong>💡 Cuidados e prevenção</strong></p>

  <p>
    <strong>Pré-natal regular:</strong> realizar o acompanhamento médico adequado é essencial
    para identificar e tratar precocemente condições que podem levar ao parto prematuro, como
    infecções, hipertensão e diabetes gestacional.
  </p>

  <p>
    <strong>Estilo de vida saudável:</strong> manter uma alimentação equilibrada, evitar o
    consumo de álcool e cigarro e praticar atividades físicas leves, conforme orientação médica,
    ajudam na saúde da gestante e do bebê.
  </p>

  <p>
    <strong>Apoio e acolhimento:</strong> famílias de bebês prematuros precisam de suporte
    emocional e informações adequadas para lidar com os desafios da UTI neonatal e com os
    cuidados após a alta hospitalar.
  </p>

  <p><strong>🌍 Um compromisso com o começo da vida</strong></p>

  <p>
    O Novembro Roxo é um chamado à empatia e à responsabilidade coletiva. Cuidar da gestante,
    promover o parto seguro e apoiar as famílias de prematuros é garantir um início de vida
    mais saudável e humano para todos.
  </p>

  <p>
    <strong>Prematuro não é pequeno. É forte. É vida que floresce com cuidado e amor. 💜</strong>
  </p>
</DestaqueLongo>

{/* 4) Dia Nacional de Combate à Tuberculose */}
<DestaqueLongo
  imgSrc="/banners/combate-tuberculose.png"
  imgAlt="Arte da campanha Dia Nacional de Combate à Tuberculose"
  titulo="❤️ 17 de Novembro: Dia Nacional de Combate à Tuberculose"
  subtitulo="Conscientização, prevenção e tratamento"
  badge="Data de saúde"
>
  <p>
    No dia 17 de novembro é celebrado o <strong>Dia Nacional de Combate à Tuberculose</strong>,
    uma data dedicada à conscientização sobre a importância da prevenção, do diagnóstico precoce
    e do tratamento adequado dessa doença infecciosa que ainda representa um desafio para a saúde pública.
  </p>

  <p>
    Causada pela bactéria <em>Mycobacterium tuberculosis</em>, a tuberculose afeta principalmente
    os pulmões, mas pode atingir outros órgãos do corpo. É uma doença curável, desde que o tratamento
    seja iniciado e mantido corretamente até o fim, conforme orientação médica.
  </p>

  <p><strong>💡 Prevenção e cuidados</strong></p>

  <p>
    <strong>Diagnóstico precoce:</strong> a tosse persistente por mais de três semanas é o principal
    sintoma e deve ser investigada. O exame de escarro é gratuito e disponível nas Unidades de Saúde.
  </p>

  <p>
    <strong>Tratamento gratuito:</strong> o tratamento da tuberculose é oferecido gratuitamente
    pelo Sistema Único de Saúde (SUS) e dura, em média, seis meses. É essencial não interromper
    o uso dos medicamentos antes do término, mesmo que os sintomas desapareçam.
  </p>

  <p>
    <strong>Prevenção e proteção:</strong> manter os ambientes ventilados e iluminados, cobrir a boca
    ao tossir ou espirrar, e realizar a vacinação com a BCG (indicada para crianças) são medidas
    importantes para evitar o contágio.
  </p>

  <p><strong>🌍 Um compromisso coletivo</strong></p>

  <p>
    O combate à tuberculose exige informação, solidariedade e vigilância. Cada gesto conta —
    desde buscar o diagnóstico até apoiar quem está em tratamento. Com cuidado, empatia e adesão
    ao tratamento, é possível vencer a doença.
  </p>

  <p>
    <strong>Tosse persistente? Procure a Unidade de Saúde mais próxima. Cuidar da saúde é o melhor caminho. ❤️</strong>
  </p>
</DestaqueLongo>

           </div>
        </section>
      </div>

      <Footer />
    </>
  );
}
