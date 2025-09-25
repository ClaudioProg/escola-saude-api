// ✅ src/pages/HomeEscola.jsx
import { useEffect } from "react";
import { motion } from "framer-motion";
import { CalendarDays, Megaphone } from "lucide-react";
import Footer from "../components/Footer"; // ⬅️ novo

/** Card de destaque com imagem e texto longo (sem CTA) */
function DestaqueLongo({ imgSrc, imgAlt, titulo, subtitulo, badge, texto }) {
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
      <div className="p-5 sm:p-6 space-y-2">
        <h3 className="text-lg font-bold">{titulo}</h3>
        {subtitulo && (
          <p className="text-emerald-700 dark:text-emerald-300 text-sm font-medium">
            {subtitulo}
          </p>
        )}
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line">
          {texto}
        </p>
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
        {/* Hero */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl p-8 md:p-12 bg-gradient-to-r from-amber-500 via-rose-500 to-fuchsia-600 text-white shadow"
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
        <section className="mt-8">
          <h2 className="text-xl font-semibold mb-3">Destaques</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 1) Semana David Capistrano */}
            <DestaqueLongo
              imgSrc="/banners/semana-david-capistrano.png"
              imgAlt="Cartaz da Semana David Capistrano 2025"
              titulo="Participe da Semana David Capistrano 2025!"
              subtitulo="11 a 14 de novembro de 2025"
              badge="Evento especial"
              texto={`De 11 a 14 de novembro de 2025, a Escola da Saúde Pública de Santos realiza na Univesidade São Judas, campus Unimonte, mais uma edição da Semana Municipal de Saúde Pública Dr. David Capistrano, evento já consolidado no calendário oficial da cidade e reconhecido como espaço de encontro, reflexão e troca de experiências entre trabalhadoras e trabalhadores do SUS.

Ao longo dos quatro dias, a programação contará com mesas temáticas, mostra de trabalhos com premiação e oficinas práticas ministradas por servidores, estudantes e parceiros da rede de saúde. Será um momento único para compartilhar saberes, fortalecer vínculos e debater caminhos para o fortalecimento da saúde pública.

Em 2025, a Semana reafirma sua vocação de ser um evento construído pelos servidores e para os servidores, valorizando o protagonismo de quem, diariamente, atua na promoção do cuidado, da equidade e da qualidade no SUS. É a oportunidade de apresentar experiências exitosas, refletir sobre desafios atuais e construir soluções conjuntas que impactam diretamente o cotidiano da população.

A participação de cada profissional é fundamental para manter viva a memória e o legado do Dr. David Capistrano, que sempre defendeu uma saúde pública integral, inclusiva e transformadora.

👉 Venha participar, trazer sua experiência e fortalecer ainda mais a nossa rede de cuidado. Inscrições serão abertas em breve!
Porque o SUS se constrói todos os dias, com a contribuição de cada trabalhadora e trabalhador da saúde.`}
            />

            {/* 2) Setembro Amarelo */}
            <DestaqueLongo
              imgSrc="/banners/setembro-amarelo.png"
              imgAlt="Arte da campanha Setembro Amarelo"
              titulo="🌻 Setembro Amarelo: Falar é a melhor solução"
              subtitulo="Prevenção do suicídio"
              badge="Campanha"
              texto={`O Setembro Amarelo é o mês dedicado à prevenção do suicídio, um tema que precisa ser tratado com sensibilidade, responsabilidade e acolhimento. Todos os anos, milhares de vidas são perdidas em silêncio, mas esse silêncio pode ser quebrado com diálogo, apoio e cuidado.

Falar sobre saúde mental é um passo essencial para salvar vidas. É preciso combater o estigma, reforçar a importância da escuta atenta e garantir que ninguém se sinta sozinho diante da dor. Cuidar da mente é tão importante quanto cuidar do corpo.

Se você ou alguém que você conhece está passando por um momento difícil, não hesite em pedir ajuda. O CVV – Centro de Valorização da Vida oferece atendimento gratuito e sigiloso pelo número 188, disponível 24 horas por dia, em todo o Brasil.

💛 Lembre-se: sua vida importa. Você não está sozinho. Falar é a melhor solução.`}
            />

            {/* 3) Setembro Verde — Doação de órgãos */}
            <DestaqueLongo
              imgSrc="/banners/setembro-verde-doacao.png"
              imgAlt="Arte da campanha Setembro Verde — Doação de Órgãos"
              titulo="💚 Setembro Verde: Doe órgãos, salve vidas"
              subtitulo="Conscientização sobre doação de órgãos"
              badge="Conscientização"
              texto={`O mês de setembro é marcado pela campanha do Setembro Verde, dedicada à conscientização sobre a importância da doação de órgãos e tecidos. Um único doador pode transformar e salvar diversas vidas, oferecendo esperança a quem aguarda por um transplante.

Falar sobre doação de órgãos é falar sobre solidariedade, empatia e amor ao próximo. Mas, para que a doação aconteça, é fundamental que a família esteja ciente dessa vontade. Por isso, converse com seus familiares e manifeste seu desejo em vida.

No Brasil, milhares de pessoas esperam por um transplante. Ao decidir ser doador, você pode fazer parte dessa corrente de vida.

💚 Doe órgãos, salve vidas. A sua atitude pode ser o recomeço de alguém.`}
            />

            {/* 4) Setembro Verde — Inclusão da Pessoa com Deficiência */}
            <DestaqueLongo
              imgSrc="/banners/setembro-verde-pcd.png"
              imgAlt="Arte da campanha Setembro Verde — Inclusão da Pessoa com Deficiência"
              titulo="💚 Setembro Verde: Inclusão é respeito, é direito"
              subtitulo="Acessibilidade e participação plena"
              badge="Inclusão"
              texto={`O Setembro Verde é dedicado à inclusão da pessoa com deficiência, reforçando a importância de uma sociedade mais justa, acessível e igualitária.

A inclusão não é apenas garantir acesso a espaços, serviços e oportunidades, mas também valorizar a diversidade, combater preconceitos e promover o respeito. Cada pessoa tem potencial e contribuições únicas para oferecer, e cabe a todos nós construir ambientes em que ninguém seja deixado para trás.

Neste mês, lembramos que direitos das pessoas com deficiência são conquistas de toda a sociedade. Acessibilidade, equidade e participação plena são pilares fundamentais para um mundo verdadeiramente inclusivo.

💚 Incluir é transformar. É enxergar talentos, promover autonomia e respeitar cada ser humano em sua totalidade.`}
            />
          </div>
        </section>
      </div>

      <Footer /> {/* ⬅️ novo */}
    </>
  );
}
