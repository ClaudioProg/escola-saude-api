Dossiê de continuidade — Revisão Premium da Plataforma Escola da Saúde
1. Objetivo central da revisão

Estamos fazendo uma revisão estrutural profunda da Plataforma Escola da Saúde, não apenas uma melhoria visual. O objetivo é elevar a plataforma ao nível máximo de excelência em:

segurança
performance
UX/UI premium
acessibilidade
mobile-first
organização de arquivos
contrato único
remoção de legado
auditoria
diagnóstico
rastreabilidade
anti-fuso
manutenção futura
clareza para o usuário
clareza para o administrador

A plataforma deve deixar de ser um conjunto de telas soltas e passar a funcionar como um sistema institucional robusto, bonito, rápido, confiável, fácil de manter e fácil de diagnosticar.

2. Regras permanentes já consolidadas
2.1. Contrato oficial único

Regra central:

Não usar aliases.
Não usar fallbacks legados.
Não aceitar múltiplos nomes para a mesma coisa.
Não aceitar variações por achismo.
Não manter compatibilidade antiga.

Quando houver dúvida sobre o valor oficial de:

campo
status
tipo
perfil
rota
enum
payload
label
chave
modalidade

a decisão é:

parar e confirmar o contrato oficial antes de codar

Exemplo do que não queremos:

admin / administrador / administradores
authToken / access_token / token
user / usuario / perfil
otimo / ótimo / excelente / muito bom / 5 / A

O sistema deve aceitar somente o contrato oficial definido.

2.2. Singular como padrão

Sempre que tecnicamente fizer sentido, usar nomes no singular e com padrão correto de código.

Exemplos definidos:

perfil
evento
certificado
avaliacao
reserva
solicitacao
cursoOnline
pesquisa

Evitar plural desnecessário em contratos, rotas, services, controllers, campos e componentes.

2.3. Legado proibido

Não manter:

rotas antigas paralelas
aliases de props
fallbacks de chave antiga
nomes duplicados
services duplicados
controllers antigos funcionando em paralelo
compatibilidade temporária sem necessidade
exports alternativos
funções mortas
componentes obsoletos

Quando um arquivo for obsoleto ou duplicado, a decisão padrão é excluir e ajustar os pontos de chamada para o local correto.

2.4. Plataforma premium de verdade

A revisão não é para “deixar mais bonitinho”.

Cada arquivo deve ser avaliado com liberdade para:

reestruturar
renomear
mover
fundir
excluir
modernizar layout
melhorar fluxo
reduzir cliques
criar diagnóstico
melhorar performance
melhorar acessibilidade
melhorar experiência mobile

Desde que nenhuma funcionalidade real seja perdida.

3. Estrutura de pastas consolidada até aqui

Os arquivos não devem mais ficar soltos em src/components/.

A estrutura atual de componentes foi organizada por domínio:

src/components/avaliacoes
src/components/certificados
src/components/charts
src/components/eventos
src/components/institucional
src/components/organizadores
src/components/layout
src/components/notificacoes
src/components/presencas
src/components/relatorios
src/components/reservas
src/components/solicitacoes
src/components/trabalhos
src/components/ui
src/components/usuarios

Regra:

componentes genéricos reutilizáveis → ui
componentes de gráficos genéricos → charts
componentes estruturais da aplicação → layout
componentes de conteúdo institucional → institucional
componentes de domínio → pasta do domínio
4. O que já foi feito na revisão de componentes genéricos
4.1. Pasta ui

Foram revisados/reeditados componentes genéricos com foco em:

visual premium
acessibilidade
mobile-first
mensagens claras
estados loading/erro/vazio
contrato limpo
sem legado

Entre os componentes tratados:

AppToast
BotaoSecundario
CarregandoSkeleton
Spinner
ToggleDarkMode / ThemeToggleButton
AccordionAjuda
MiniStat
Select
ErroCarregamento
NadaEncontrado

Diretriz importante consolidada:

Toasts devem ser claros.
O usuário nunca pode receber apenas “erro”.
A mensagem deve explicar o que aconteceu, o que fazer e, quando possível, trazer dica técnica controlada para suporte/admin.
4.2. Pasta charts

Foi definido que charts deve conter somente gráficos genéricos reutilizáveis.

Mantido em charts
DoughnutChart.jsx

Reeditado como gráfico genérico oficial, com:

PropTypes
loading
erro
estado vazio
exportação CSV/PNG
acessibilidade com tabela sr-only
tooltip
percentuais
reduced motion
visual premium
Movido para domínio
GraficoAvaliacao.jsx
→ src/components/avaliacoes/GraficoAvaliacao.jsx

Contrato oficial definido para avaliações:

{
  "Ótimo": number,
  "Bom": number,
  "Regular": number,
  "Ruim": number,
  "Péssimo": number
}

Observação importante: no banco foi identificado nota_enum com valores:

Ótimo
Bom
Regular
Ruim
Péssimo

Portanto, sem aceitar otimo, pessimo, excelente, muito bom, notas numéricas ou letras.

Movido para domínio de eventos
GraficoEventos.jsx
→ src/components/eventos/GraficoEventos.jsx

Durante análise, foi identificado que o controller ainda usava chaves fora do padrão, como:

cursosRealizados
proximosEventos
eventosorganizador

A decisão consolidada foi corrigir para contrato oficial em singular e camelCase correto:

{
  cursoRealizado: number,
  proximoEvento: number,
  eventoorganizador: number
}

Sem manter o contrato errado como legado.

5. O que já foi feito em institucional

Foram tratados componentes/conteúdos institucionais.

5.1. Perguntas frequentes

Arquivo definido:

src/components/institucional/perguntasFrequentes.js

Conteúdo ampliado com perguntas úteis para reduzir suporte simples, incluindo:

senha
perfil
certificados
presença
QR Code
avaliação
questionário
assinatura digital
reserva de sala
suporte
uso no celular
segurança dos dados

Esse arquivo é conteúdo/dados, não componente visual.

5.2. QR Code institucional

Arquivo definido:

src/components/institucional/QrSiteEscola.jsx

Contrato oficial:

siteUrl

Removidos aliases como:

url
value

Melhorias incluídas:

exportação SVG/PNG
copiar link
AppToast oficial
validação de contraste
acessibilidade
visual premium
5.3. Selo institucional

Arquivo definido:

Componente visual institucional, usado como assinatura discreta da plataforma.

Foi padronizado com variantes em português:

saude
residencia
petroleo
violeta
amarelo
rosa
6. O que já foi feito em layout

A pasta layout passou a ser tratada como centro da experiência da plataforma.

6.1. Breadcrumbs

Arquivo:

src/components/layout/Breadcrumbs.jsx

Reeditado com:

props em português
visual premium
schema BreadcrumbList
mobile-first
overflow horizontal
foco visível
sem separator/itemSeparator
sem labels automáticos por achismo sem controle
6.2. EscolaAppShell

Arquivo:

src/components/layout/EscolaAppShell.jsx

Definido como shell oficial da aplicação.

Responsável por:

estrutura principal
Topbar
SidebarNav
drawer mobile
scroll lock
focus trap
skip link
fundo ambiental premium
conteúdo em painel
sessão oficial

Contrato oficial de sessão:

localStorage.token
localStorage.perfil

Removidos:

storageTokenKey
storageUserKey
usuario
nome_completo
escola_token
escola_usuario
6.3. Footer

Arquivo:

src/components/layout/Footer.jsx

Reeditado como rodapé institucional oficial, com:

campanha mensal de saúde
contatos clicáveis
WhatsApp
endereço
link para mapa
botão voltar ao topo
visual premium
acessibilidade
mobile-first
6.4. HeaderHero

Arquivo:

src/components/layout/HeaderHero.jsx

Definido como cabeçalho grande de destaque para páginas importantes.

Contrato em português:

titulo
subtitulo
selo
icone
tom
tamanho
trilha
acoes
mostrarGrade
mostrarPontos
mostrarBrilhos
raio
sombra

Removidos:

title
subtitle
theme
gradient livre
rightSlot
breadcrumbsSlot
isDark
6.5. CabecalhoPagina

Arquivo renomeado:

src/components/layout/CabecalhoPagina.jsx

Substitui PageHeader.jsx.

Diferença entre os dois:

HeaderHero.jsx
→ abertura grande, hero visual, páginas de destaque

CabecalhoPagina.jsx
→ cabeçalho compacto, listas, formulários e páginas administrativas internas

Contrato em português:

titulo
subtitulo
icone
acoes
trilha
alinhamento
nivelTitulo
tom
gradiente
carregando
fixo
compacto
ocultarImpressao
intensidade
comBorda
largura
6.6. PrivateRoute

Arquivo:

src/components/layout/PrivateRoute.jsx

Reeditado com contrato oficial:

token
perfil
api.apiPerfilMe()

Regras:

perfil.perfil deve ser string oficial exata
administrador tem acesso total
sem arrays
sem split por vírgula
sem toLowerCase corretivo
sem aliases
payload errado invalida sessão

Uso:

<PrivateRoute perfilPermitido="administrador">
  <Pagina />
</PrivateRoute>

Para rota autenticada geral:

<PrivateRoute>
  <Pagina />
</PrivateRoute>
6.7. Topbar

Arquivo:

src/components/layout/Topbar.jsx

Reeditado com:

visual premium
tema oficial via ThemeToggleButton
notificações com drawer premium
AppToast para erros
sessão via token/perfil
sem authToken/access_token/user/usuario/roles
sem getPerfisRobusto
sem ThemeCycleButton interno

Mantido badge de notificações.

6.8. SidebarNav

Arquivo:

src/components/layout/SidebarNav.jsx

Reeditado como menu lateral oficial.

Mudanças principais:

sem getPerfisRobusto
sem usuario/perfis/roles
sem split por vírgula
sem lowercase corretivo
usa apenas localStorage.perfil.perfil
props em português
visual premium
modo recolhido mais útil
mobile limpo
badges/ministats contextuais

Props oficiais:

variante
recolhida
aoAlternarRecolhida
aoFechar
resumoMenu

Badges/ministats preparados para:

{
  eventoDisponivel: number,
  certificadoLiberado: number,
  avaliacaoPendente: number,
  notificacaoNaoLida: number,
  reservaPendente: number,
  solicitacaoPendente: number,
  trabalhoPendente: number
}

Importante: não criamos busca inventada. O componente está pronto para receber dados de endpoint/service oficial futuro.

6.9. MenuLink

Arquivo:

src/components/layout/MenuLink.jsx

Mantido como componente estrutural de navegação.

Contrato em português:

rota
icone
iconeDireita
exato
tom
tamanho
formato
desabilitado
novaAba
titulo
aoClicar
recolhido
badge
badgeLabel

Removidos:

to como objeto
variant
size
shape
disabled
rightIcon
activeClassName
pendingClassName
disabledClassName
6.10. MenuAdministrador

Arquivo:

src/components/MenuAdministrador.jsx

Decisão:

EXCLUIR

Motivos:

duplicado funcional
fora da nova estrutura
duplica Topbar/SidebarNav
usa localStorage.clear()
usa localStorage.nome
cria menu paralelo de administrador
conflita com shell oficial
7. Diretriz nova: menus com badges/ministats

Foi definido que os menus podem mostrar contadores contextuais quando houver valor real para o usuário.

Exemplos:

Eventos → quantidade de eventos disponíveis
Certificados → certificados liberados
Avaliações → avaliações pendentes
Notificações → não lidas
Reservas → pendentes
Solicitações → pendentes
Trabalhos → pendentes

Regra:

mostrar badge apenas quando for útil e acionável
não poluir menus
não colocar badge decorativo
dados devem vir de endpoint/service oficial
sem alias
sem fallback
8. Alteração estrutural de gestão por evento

Foi definida uma mudança importante no fluxo administrativo.

Problema atual

Hoje há muitos menus específicos:

Gestão de eventos
Gestão de presença
Gestão de QR Code
Gestão de certificados
Gestão de avaliações

Cada um exige procurar o evento novamente.

Nova direção

Reduzir itens do menu e criar uma gestão mais contextual.

Fluxo desejado:

Central de eventos / Gestão de eventos
→ lista de eventos
→ card do evento
→ ações diretas daquele evento

No card do evento:

Criar evento
Editar evento
Gerenciar turmas
Gerenciar presença
Gerenciar certificados
Gerenciar QR Code
Gerenciar avaliações/questionários
Ver inscrições
Ver relatórios
Diagnóstico do evento

As páginas específicas ainda podem existir, mas deixam de ser a porta principal do menu.

Objetivo
menos fragmentação
menos busca repetida
menos cliques
gestão mais inteligente
experiência premium
diagnóstico por evento
9. Diretriz nova: certificados digitais conforme orientação federal

Foi anexada publicação normativa sobre certificados/diploma digital.

A diretriz definida é:

Se não for possível aderir integralmente, aproximar ao máximo a plataforma das orientações federais.

O foco não será apenas PDF bonito.

O módulo de certificados deve evoluir para:

certificado visual premium
dados estruturados
QR Code de validação
código único
registro de emissão
assinatura institucional
histórico
auditoria
validação pública
possibilidade futura de XML/arquivo técnico
rastreabilidade
cancelamento/anulação quando aplicável

Quando revisarmos certificados, olhar:

banco
controller
service
rotas
geração de PDF
assinaturas
QR Code
validação pública
auditoria
reemissão
cancelamento
logs
diagnóstico de bloqueio
10. Novos módulos e funcionalidades definidos
10.1. Cursos online

Criar novo módulo para cadastrar cursos online.

Objetivo:

divulgar cursos online em diferentes plataformas oficiais ou relevantes

Não limitar ao YouTube.

Plataformas possíveis, a definir em enum oficial:

youtube
gov_br
unasus
ava_sus
universidade
outro

Quando implementar, confirmar nomes oficiais antes.

Estrutura provável:

Banco:
curso_online

Backend:
cursoOnlineRoute
cursoOnlineController
cursoOnlineService

Frontend:
src/pages/cursosOnline
src/components/cursosOnline
src/services/cursoOnlineService.js

Campos prováveis:

id
titulo
descricao
url
plataforma
instituicao
categoria
cargaHoraria
publicoAlvo
imagemUrl
publicado
destaque
ordem
criadoPor
criadoEm
atualizadoEm

Tela do usuário:

cards de cursos
filtro por plataforma/categoria
botão Acessar curso
destaques

Admin:

cadastrar
editar
publicar/despublicar
destacar
ordenar
10.2. Confirmação de uso de sala

No módulo de solicitação/reserva de sala, será acrescentada regra operacional:

Usuário deve confirmar uso da sala entre 7 dias e 48 horas antes da reserva.

Fluxo:

7 dias antes:
→ enviar e-mail solicitando confirmação

entre 7 dias e 48 horas:
→ botão aparece para usuário confirmar uso

48 horas antes:
→ prazo final

se não confirmar:
→ cancelar reserva
→ remover da agenda
→ enviar e-mail informando cancelamento
→ admin visualiza status

Admin deve ver com cores:

verde → confirmado
amarelo → aguardando confirmação
vermelho → vencido/cancelado por falta de confirmação
cinza → fora da janela de confirmação

Possíveis campos:

statusConfirmacaoUso
confirmadoUsoEm
confirmacaoSolicitadaEm
confirmacaoLimiteEm
canceladoPorFaltaConfirmacaoEm

Antes de definir enum, revisar banco atual de reservas.

10.3. E-mail de lembrete na véspera do evento

Regra:

No dia anterior ao evento/turma, usuário inscrito recebe e-mail.

Conteúdo do e-mail:

nome do evento
data
horário
local
turma
orientações relevantes

Cuidados obrigatórios:

não enviar duplicado
não enviar para inscrição cancelada
não enviar para evento/turma encerrada
registrar envio
permitir diagnóstico de erro
anti-fuso rigoroso

Tabela provável de controle:

emailEventoLembrete
id
inscricaoId
turmaId
usuarioId
enviadoEm
statusEnvio
erroEnvio
10.4. Pesquisas abertas

Criar módulo separado de informativos.

Na tela inicial do usuário, pesquisas abertas devem aparecer preferencialmente antes dos informativos.

Dois tipos oficiais:

externa
interna
Pesquisa externa

Admin cadastra:

titulo
descricao
url
dataInicio
dataFim
publicado
destaque
ordem

Usuário clica em:

Participar da pesquisa

Sugestão adicional: registrar clique.

Tabela opcional:

pesquisaClique
id
pesquisaId
usuarioId
clicadoEm
Pesquisa interna

Admin cria dentro da plataforma:

perguntas
opções
respostas descritivas
obrigatoriedade
ordem

Tipos de pergunta sugeridos, ainda a confirmar:

opcao_unica
multipla_escolha
texto_curto
texto_longo
escala

Estrutura provável:

pesquisa
pesquisaPergunta
pesquisaOpcao
pesquisaResposta
pesquisaRespostaItem

Admin deve ter página para:

criar pesquisa
editar pesquisa
publicar/despublicar
ver respostas
ver estatísticas
exportar Excel/CSV
filtrar por período
analisar respostas descritivas
11. Diretriz para e-mails e notificações

As novas funcionalidades exigem uma camada mais robusta de comunicação.

Tipos de e-mail previstos:

confirmação de uso de sala
cancelamento por falta de confirmação
lembrete de evento na véspera
possível certificado liberado
possível pesquisa aberta

Cada envio deve ter:

registro
status
erro quando houver
data/hora
destinatário
motivo
vínculo com entidade

Não pode ser envio “cego” sem rastreabilidade.

12. Diretriz para diagnóstico e saúde da plataforma

A revisão deve continuar incluindo recursos administrativos de diagnóstico.

Exemplos:

diagnóstico de certificado
diagnóstico de avaliação
diagnóstico de presença
diagnóstico de reserva
diagnóstico de evento
diagnóstico de e-mail
diagnóstico de inscrição

Para evento, idealmente um painel de saúde:

evento publicado?
turmas criadas?
inscrições abertas?
QR Code gerado?
presenças registradas?
avaliação configurada?
certificados liberados?
e-mails enviados?
há bloqueios?
qual o motivo técnico?
13. Como vamos continuar daqui em diante

Agora terminou a etapa genérica/layout/institucional/charts.

A próxima fase será revisar módulo por módulo, de forma organizada.

Para cada módulo, seguir blocos:

1. Banco
2. Rotas
3. Controller
4. Service
5. Page
6. Components
7. UX/UI
8. E-mails/notificações
9. Auditoria/logs
10. Diagnóstico
11. Testes manuais
12. Migração/removal de legado

Ordem sugerida dos módulos:

1. Eventos / Central de gestão por evento
2. Turmas
3. Inscrições
4. Presenças
5. QR Code
6. Avaliações/questionários
7. Certificados
8. Reservas de sala
9. Notificações/e-mails
10. Cursos online
11. Pesquisas abertas
12. Informativos
13. Usuários/perfil/permissões
14. Relatórios
15. Trabalhos/submissões
14. Padrão de entrega dos próximos arquivos

Para cada arquivo enviado:

1. dizer se mantém, move, renomeia ou exclui
2. dizer o local correto
3. apontar problemas estruturais
4. remover legado/aliases
5. reeditar completo quando couber
6. manter ou melhorar função existente
7. propor melhoria se o fluxo atual estiver ruim
8. sinalizar contrato incerto antes de decidir

Se o arquivo for de eventos e permanecer em eventos:

entregar já em v2.0 completo
com todas as premissas do dossiê

Se for obsoleto/duplicado:

recomendar exclusão
e depois ajustar chamadas para o local correto
15. Síntese da revisão

A plataforma está sendo transformada em uma solução institucional de alto nível, com:

menos telas soltas
menos menus fragmentados
menos código legado
menos achismo
mais contrato oficial
mais diagnóstico
mais rastreabilidade
mais clareza para usuário
mais poder para administrador
mais performance
mais acessibilidade
mais beleza real
mais inteligência operacional

A diretriz final é:

Banco protege integridade.
Backend protege regra de negócio.
Frontend protege experiência.
Admin diagnostica.
Auditoria prova.
Logs explicam.
Testes previnem.
Layout encanta.
Fluxo reduz esforço.
Contrato único evita caos.


votacaoRoute.js
cursoOnlineRoute.js
pesquisaRoute.js
