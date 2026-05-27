// ✅ src/components/institucional/perguntasFrequentes.js — v2.0
// Plataforma Escola da Saúde
//
// Conteúdo institucional de perguntas frequentes.
//
// Observação:
// - Este arquivo contém dados/conteúdo, não componente visual.
// - O componente genérico AccordionAjuda.jsx deve receber esta lista por prop.
// - Mantém o domínio institucional separado da camada genérica de UI.
// - As perguntas foram escritas para orientar o usuário final com clareza,
//   reduzir dúvidas operacionais e diminuir chamados simples ao suporte.

export const perguntasFrequentes = [
  {
    id: "esqueci-minha-senha",
    pergunta: "Esqueci minha senha. O que devo fazer?",
    resposta:
      "Clique em “Recuperar Senha” na tela de login e siga as instruções enviadas para seu e-mail cadastrado. Caso não receba a mensagem, verifique também a caixa de spam ou lixo eletrônico.",
  },
  {
    id: "nao-recebi-email-recuperacao",
    pergunta: "Não recebi o e-mail de recuperação de senha. E agora?",
    resposta:
      "Confira se o e-mail informado está correto e verifique a caixa de spam ou lixo eletrônico. Se ainda assim a mensagem não chegar, entre em contato com o suporte da Escola da Saúde para conferência do cadastro.",
  },
  {
    id: "atualizar-dados-pessoais",
    pergunta: "Como atualizo meus dados pessoais?",
    resposta:
      "Acesse o menu “Perfil” para atualizar os dados permitidos pelo sistema. Alguns dados podem depender de validação administrativa para preservar a segurança e a integridade do cadastro.",
  },
  {
    id: "dados-nao-editaveis",
    pergunta: "Por que alguns dados do meu perfil não podem ser editados?",
    resposta:
      "Alguns dados são usados para identificação, inscrição, emissão de certificados e auditoria da plataforma. Por isso, determinadas informações podem ficar bloqueadas para edição direta e exigir solicitação administrativa.",
  },
  {
    id: "nao-consigo-acessar-plataforma",
    pergunta: "Não consigo acessar a plataforma. O que devo verificar?",
    resposta:
      "Verifique se o e-mail e a senha foram digitados corretamente, se sua internet está funcionando e se o navegador está atualizado. Caso o problema continue, utilize a recuperação de senha ou acione o suporte.",
  },
  {
    id: "evento-nao-aparece",
    pergunta: "Um evento não aparece para mim. O que pode ter acontecido?",
    resposta:
      "O evento pode ainda não estar publicado, pode ter sido encerrado ou pode possuir regras específicas de inscrição. Verifique a listagem de eventos e, se necessário, entre em contato com a equipe responsável.",
  },
  {
    id: "evento-restrito",
    pergunta: "O que significa um evento restrito?",
    resposta:
      "Um evento restrito possui critérios específicos de participação, como público-alvo, cargo, unidade ou lista de registros autorizados. A plataforma pode exibir o evento, mas bloquear a inscrição caso o usuário não atenda aos critérios definidos.",
  },
  {
    id: "inscricao-nao-permitida",
    pergunta: "Por que não consigo me inscrever em um evento?",
    resposta:
      "A inscrição pode estar indisponível por encerramento do prazo, lotação da turma, restrição de público, ausência de vagas ou regra administrativa do evento. Leia as informações exibidas na tela para entender o motivo do bloqueio.",
  },
  {
    id: "cancelar-inscricao-evento",
    pergunta: "Consigo cancelar minha inscrição em um evento?",
    resposta:
      "Quando o cancelamento estiver disponível, acesse “Minhas Inscrições” e utilize a opção de cancelamento. A disponibilidade pode variar conforme prazo, situação da turma e regras do evento.",
  },
  {
    id: "confirmar-presenca-evento",
    pergunta: "Como confirmar minha presença em um evento?",
    resposta:
      "A presença pode ser registrada conforme a regra definida para a turma, geralmente por QR Code, lista de presença ou confirmação administrativa dentro da janela permitida pelo sistema.",
  },
  {
    id: "perdi-qr-code-presenca",
    pergunta: "Perdi o QR Code de presença. O que devo fazer?",
    resposta:
      "Procure a equipe responsável pelo evento durante o período de realização da atividade. A validação de presença depende da regra da turma e da janela permitida para registro.",
  },
  {
    id: "presenca-nao-registrada",
    pergunta: "Minha presença não apareceu. O que devo fazer?",
    resposta:
      "Verifique se o registro foi feito dentro do prazo e se a turma correta foi selecionada. Caso a presença não conste mesmo após a confirmação, acione o suporte informando o nome do evento, turma, data e seu cadastro.",
  },
  {
    id: "certificado-nao-apareceu",
    pergunta: "O certificado não apareceu. O que pode ter acontecido?",
    resposta:
      "Verifique se a turma foi encerrada, se a presença mínima exigida foi atingida e se todas as etapas obrigatórias foram concluídas, como questionário, avaliação ou validação administrativa, quando aplicáveis.",
  },
  {
    id: "certificado-com-dados-incorretos",
    pergunta: "Meu certificado saiu com dados incorretos. Como corrigir?",
    resposta:
      "Entre em contato com o suporte informando o evento, a turma e qual dado está incorreto. Algumas correções dependem da atualização do cadastro e da reemissão administrativa do certificado.",
  },
  {
    id: "baixar-certificado",
    pergunta: "Como baixo meu certificado?",
    resposta:
      "Acesse a área de certificados ou o histórico do evento correspondente. Se o certificado estiver liberado, utilize a opção de download disponível na plataforma.",
  },
  {
    id: "avaliacao-obrigatoria-certificado",
    pergunta: "Preciso responder a avaliação para liberar o certificado?",
    resposta:
      "Quando a avaliação for obrigatória para o evento, ela deve ser preenchida antes da liberação do certificado. A própria plataforma indicará quando houver pendência.",
  },
  {
    id: "notificacao-avaliacao",
    pergunta: "Quando recebo a notificação de avaliação?",
    resposta:
      "A avaliação é liberada conforme as regras do evento, geralmente após o encerramento da turma e validação dos requisitos necessários, como presença mínima.",
  },
  {
    id: "questionario-aprendizagem",
    pergunta: "O que é o questionário de aprendizagem?",
    resposta:
      "É uma etapa avaliativa vinculada a determinados eventos ou turmas. Quando estiver configurado como obrigatório, o questionário deve ser respondido conforme as regras definidas para a atividade.",
  },
  {
    id: "nota-minima-questionario",
    pergunta: "Existe nota mínima no questionário?",
    resposta:
      "Alguns questionários podem exigir nota mínima para conclusão. Quando houver essa regra, a plataforma exibirá a informação e indicará se há pendência para liberação das próximas etapas.",
  },
  {
    id: "assinatura-digital",
    pergunta: "O que é a assinatura digital?",
    resposta:
      "É a imagem da assinatura usada automaticamente em documentos e certificados quando o usuário possui permissão e cadastro correspondente, como organizador ou responsável pela certificação.",
  },
  {
    id: "assinatura-nao-aparece",
    pergunta: "Minha assinatura não aparece no certificado. O que pode ser?",
    resposta:
      "A assinatura depende de cadastro válido, permissão adequada e configuração administrativa. Caso ela não apareça onde deveria, acione o suporte para verificação do vínculo e do arquivo de assinatura.",
  },
  {
    id: "agendamento-salas",
    pergunta: "Como faço uma solicitação de reserva de sala?",
    resposta:
      "Acesse a área de agenda ou reserva de salas, escolha a data disponível, selecione o espaço e o período desejado, preencha as informações solicitadas e envie a solicitação para análise.",
  },
  {
    id: "reserva-sala-pendente",
    pergunta: "Minha reserva de sala está pendente. O que significa?",
    resposta:
      "Significa que a solicitação foi enviada e aguarda análise administrativa. A reserva somente deve ser considerada confirmada quando o status estiver aprovado ou confirmado, conforme a regra da plataforma.",
  },
  {
    id: "alterar-reserva-sala",
    pergunta: "Consigo alterar uma reserva de sala?",
    resposta:
      "A alteração depende da situação da solicitação e das regras administrativas. Quando a edição estiver disponível, a plataforma exibirá a opção correspondente. Caso contrário, será necessário solicitar apoio administrativo.",
  },
  {
    id: "suporte-plataforma",
    pergunta: "Quando devo acionar o suporte?",
    resposta:
      "Acione o suporte quando não conseguir concluir uma ação, quando houver divergência de dados, bloqueio sem motivo claro, problema com certificado, presença, inscrição, avaliação ou erro persistente na plataforma.",
  },
  {
    id: "informacoes-para-suporte",
    pergunta: "Quais informações devo enviar ao suporte?",
    resposta:
      "Informe seu nome, e-mail ou registro usado na plataforma, o nome do evento ou turma, a tela onde ocorreu o problema, o que você tentou fazer e, se possível, envie um print da mensagem exibida.",
  },
  {
    id: "navegador-recomendado",
    pergunta: "Qual navegador devo usar?",
    resposta:
      "Prefira navegadores atualizados, como Google Chrome, Microsoft Edge, Mozilla Firefox ou Safari. Manter o navegador atualizado ajuda a evitar falhas de visualização e problemas de compatibilidade.",
  },
  {
    id: "uso-celular",
    pergunta: "Posso usar a plataforma pelo celular?",
    resposta:
      "Sim. A plataforma é preparada para uso em celulares, tablets e computadores. Em telas menores, algumas informações podem aparecer reorganizadas para facilitar a navegação.",
  },
  {
    id: "seguranca-dados",
    pergunta: "Meus dados estão seguros na plataforma?",
    resposta:
      "A plataforma utiliza controles de acesso e recursos administrativos para proteger informações e preservar a rastreabilidade das operações. Evite compartilhar sua senha e mantenha seus dados de acesso protegidos.",
  },
];