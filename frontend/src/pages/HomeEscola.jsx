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
            {/* 0) Mostra Semana David Capistrano */}
            <DestaqueLongo
              imgSrc="/banners/mostra.png"
              imgAlt="Cartaz da Mostra Semana David Capistrano 2025"
              titulo="Participe da Mostra Semana David Capistrano 2025!"
              subtitulo="Inscrições abertas até 20 de outubro de 2025"
              badge="PRORROGADO"
            >
              <p>
                A Escola da Saúde convida todos os profissionais das unidades de administração direta e publicizadas da Secretaria Municipal de Saúde de Santos a participarem da 4ª Mostra de Experiências Exitosas da Semana de Saúde Pública David Capistrano 2025.
              </p>
              <p>
                Este é um importante espaço de valorização e compartilhamento de práticas que contribuíram para a melhoria das ações e serviços de saúde em nosso município.
              </p>
              <p>
                <strong>📅 Prazo para submissão: até 20 de outubro de 2025, às 23h59 (horário de Brasília).</strong>
              </p>
              <p>
                <strong>🌐 Local de inscrição: </strong>
                <a
                  href="https://escoladasaude.vercel.app/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-700 dark:text-emerald-300 underline underline-offset-2"
                >
                  https://escoladasaude.vercel.app/
                </a>
              </p>
              <p>
                👉 Acesse a aba <em>“Usuário - Submissão de Trabalhos”</em> para preencher o formulário e enviar seu texto e pôster conforme as orientações do regulamento.
              </p>
              <p>
                Os trabalhos concorrerão ao Prêmio Santista David Capistrano 2025, com entrega durante a Semana de Saúde Pública.
              </p>
              <p>👉 Participe e compartilhe suas experiências que fazem a diferença na saúde pública de Santos!</p>
              <p>
                Em caso de dúvidas, entre em contato pelo e-mail: <strong>escoladasaude@santos.sp.gov.br</strong>
              </p>
              <p>
                Atenciosamente,<br />
                <strong>Escola da Saúde – Secretaria Municipal de Saúde de Santos</strong>
              </p>
              <p className="mt-4 font-semibold">
                📄 Confira a publicação oficial no Diário Oficial de Santos:
                <br />
                <a
                  href="https://diariooficial.santos.sp.gov.br/edicoes/inicio/download/2025-10-07"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-700 dark:text-emerald-300 underline underline-offset-2 break-all"
                >
                  https://diariooficial.santos.sp.gov.br/edicoes/inicio/download/2025-10-07
                </a>
              </p>
            </DestaqueLongo>

            {/* 1) Semana David Capistrano */}
            <DestaqueLongo
              imgSrc="/banners/semana-david-capistrano.png"
              imgAlt="Cartaz da Semana David Capistrano 2025"
              titulo="Participe da Semana David Capistrano 2025!"
              subtitulo="11 a 14 de novembro de 2025"
              badge="Evento especial"
            >
              <p>
                De 11 a 14 de novembro de 2025, a Escola da Saúde Pública de Santos realiza na <strong>Universidade São Judas, campus Unimonte</strong>, mais uma edição da Semana Municipal de Saúde Pública Dr. David Capistrano, evento já consolidado no calendário oficial da cidade e reconhecido como espaço de encontro, reflexão e troca de experiências entre trabalhadoras e trabalhadores do SUS.
              </p>
              <p>
                Ao longo dos quatro dias, a programação contará com mesas temáticas, mostra de trabalhos com premiação e oficinas práticas ministradas por servidores, estudantes e parceiros da rede de saúde. Será um momento único para compartilhar saberes, fortalecer vínculos e debater caminhos para o fortalecimento da saúde pública.
              </p>
              <p>
                Em 2025, a Semana reafirma sua vocação de ser um evento construído pelos servidores e para os servidores, valorizando o protagonismo de quem, diariamente, atua na promoção do cuidado, da equidade e da qualidade no SUS. É a oportunidade de apresentar experiências exitosas, refletir sobre desafios atuais e construir soluções conjuntas que impactam diretamente o cotidiano da população.
              </p>
              <p>
                A participação de cada profissional é fundamental para manter viva a memória e o legado do Dr. David Capistrano, que sempre defendeu uma saúde pública integral, inclusiva e transformadora.
              </p>
              <p>👉 Venha participar, trazer sua experiência e fortalecer ainda mais a nossa rede de cuidado.</p>
              <p>
                <strong className="text-red-600 dark:text-red-400 font-bold">
                  Inscrições serão abertas em breve!
                </strong>
              </p>
              <p>Porque o SUS se constrói todos os dias, com a contribuição de cada trabalhadora e trabalhador da saúde.</p>
            </DestaqueLongo>

            {/* 2) Outubro Rosa */}
            <DestaqueLongo
              imgSrc="/banners/outubro-rosa.jpg"
              imgAlt="Arte da campanha Outubro Rosa"
              titulo="🌷 Outubro Rosa: um mês pela vida"
              subtitulo="Prevenção do câncer de mama"
              badge="Campanha"
            >
              <p>
                Outubro é marcado mundialmente como o mês de conscientização sobre o câncer de mama, uma das doenças que mais acometem mulheres no Brasil e no mundo. Esta campanha nasceu para lembrar a importância da prevenção e do diagnóstico precoce, que pode salvar milhares de vidas.
              </p>
              <p>
                A cor rosa que vemos iluminar prédios, ruas e símbolos neste mês não é apenas um detalhe visual: é um chamado para que todas as pessoas – mulheres e também homens, que em menor número também podem ser acometidos – estejam atentos aos cuidados com a saúde.
              </p>
              <p><strong>💡 Prevenção e autocuidado</strong></p>
              <p>Autoexame das mamas: deve ser feito regularmente, conhecendo o próprio corpo e identificando alterações como nódulos, retrações ou secreções.</p>
              <p>Consultas médicas e exames periódicos: a mamografia é o principal exame para o diagnóstico precoce e deve ser realizada conforme orientação médica, especialmente a partir dos 40 anos.</p>
              <p>Hábitos de vida saudáveis: manter uma alimentação equilibrada, praticar atividade física e evitar o consumo excessivo de álcool e tabaco são medidas que ajudam na prevenção.</p>
              <p><strong>🌍 Um compromisso coletivo</strong></p>
              <p>
                O Outubro Rosa é mais do que uma campanha: é um convite para o cuidado consigo mesmo e com quem está ao nosso lado. Compartilhe informações, incentive amigas, colegas e familiares a realizarem seus exames. Cada gesto pode fazer a diferença.
              </p>
              <p><strong>Cuidar da saúde é um ato de amor e de coragem. Previna-se. Valorize a vida. 💖</strong></p>
            </DestaqueLongo>

            {/* 3) Saúde Mental */}
            <DestaqueLongo
              imgSrc="/banners/saude-mental.png"
              imgAlt="Arte do Dia Mundial da Saúde Mental"
              titulo="💙 Dia Mundial da Saúde Mental"
              subtitulo="10 de Outubro"
              badge="Saúde"
            >
              <p>
                O Dia Mundial da Saúde Mental foi instituído em 1992 pela Federação Mundial para a Saúde Mental (World Federation for Mental Health), com apoio da Organização Mundial da Saúde (OMS). Desde então, a data é lembrada anualmente em mais de 150 países como um chamado à reflexão e à ação sobre um tema que toca a todos nós: o cuidado com a saúde mental.
              </p>
              <p>
                Falar de saúde mental já foi cercado de tabus. Hoje sabemos que cuidar da mente é tão essencial quanto cuidar do corpo. Depressão, ansiedade, estresse, burnout e outros transtornos afetam milhões de pessoas, comprometendo qualidade de vida, relações sociais e a saúde física.
              </p>
              <p><strong>🌱 A importância da data</strong></p>
              <p>Conscientizar, informar e promover acolhimento. Criar ambientes mais saudáveis, relações mais empáticas e sociedades mais inclusivas.</p>
              <p><strong>💡 Orientações e cuidados</strong></p>
              <p>Fale sobre o que sente; procure ajuda profissional; cuide do sono, alimentação e atividade física; pratique pausas e lazer; cultive vínculos.</p>
              <p><strong>🌍 Um compromisso coletivo</strong></p>
              <p>Construir uma cultura de respeito, empatia e solidariedade, combatendo preconceitos e abrindo espaço para o diálogo.</p>
              <p><strong>Neste 10 de outubro, lembre-se: cuidar da mente é cuidar da vida. 💙</strong></p>
            </DestaqueLongo>

            {/* 4) Vacinação */}
            <DestaqueLongo
              imgSrc="/banners/vacinacao.png"
              imgAlt="Arte do Dia Nacional de Vacinação"
              titulo="💉 Dia Nacional da Vacinação"
              subtitulo="17 de Outubro"
              badge="Saúde"
            >
              <p>
                O Dia Nacional da Vacinação reforça a imunização como uma das ferramentas mais eficazes de prevenção de doenças. Cada dose aplicada representa um ato de cuidado consigo e com a comunidade.
              </p>
              <p>
                Graças às vacinas, controlamos ou erradicamos doenças como varíola, poliomielite e sarampo. Vacinas são seguras e passam por rigorosos processos de pesquisa e controle de qualidade.
              </p>
              <p><strong>🌱 A importância da data</strong></p>
              <p>Reconhecer o papel da vacinação e valorizar o trabalho dos profissionais de saúde que garantem a cobertura vacinal.</p>
              <p><strong>💡 Orientações</strong></p>
              <p>Mantenha a caderneta em dia; vacine-se em todas as fases da vida; participe das campanhas; proteja-se e proteja quem você ama.</p>
              <p><strong>🌍 Um compromisso de todos</strong></p>
              <p><strong>Neste 17 de outubro, reafirme o compromisso com a vida: vacine-se. 💉💙</strong></p>
            </DestaqueLongo>

            {/* 5) Sífilis */}
            <DestaqueLongo
              imgSrc="/banners/sifilis.png"
              imgAlt="Arte do Dia Nacional de Combate à Sífilis"
              titulo="💗 Dia Nacional de Combate à Sífilis e à Sífilis Congênita: um alerta pela vida"
              subtitulo="Terceiro sábado de Outubro"
              badge="Saúde"
            >
              <p>
                A data é dedicada à conscientização sobre prevenção, diagnóstico e tratamento da sífilis, IST que tem cura, mas ainda representa um desafio para a saúde pública.
              </p>
              <p>
                A sífilis pode ser transmitida por contato sexual sem proteção e da mãe para o bebê durante a gestação (sífilis congênita). O pré-natal adequado e o tratamento correto evitam complicações graves.
              </p>
              <p><strong>🌿 Prevenção e cuidado</strong></p>
              <p>Use preservativo em todas as relações sexuais. Na gestação, realize o teste rápido em todas as consultas. Se positivo, trate com penicilina (disponível no SUS).</p>
              <p><strong>🌺 Compromisso coletivo</strong></p>
              <p>Quebrar tabus, informar e incentivar o cuidado mútuo. A informação é o primeiro passo para vencer a sífilis.</p>
              <p><strong>✨ Cuidar da saúde sexual é um gesto de amor e proteção à vida.</strong></p>
            </DestaqueLongo>
          </div>
        </section>
      </div>

      <Footer />
    </>
  );
}
