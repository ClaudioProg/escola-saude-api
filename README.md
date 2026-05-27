# Escola da Saúde API

API oficial da **Plataforma da Escola da Saúde**, responsável por sustentar os módulos de **eventos**, **turmas**, **inscrições**, **presenças**, **avaliações**, **certificados**, **assinaturas**, **informações institucionais**, **chamadas de trabalhos**, **submissões**, **votações**, **questionários** e demais recursos administrativos da plataforma.

Esta API foi estruturada para operar em ambiente moderno, com foco em:

- segurança
- robustez
- compatibilidade com frontend web/PWA
- persistência de arquivos
- controle de acesso por perfil
- compatibilidade com deploy em produção

---

## Visão geral

A plataforma foi desenvolvida para centralizar processos institucionais da Escola da Saúde, permitindo que usuários, organizadores e administradores realizem operações como:

- autenticação local e via Google
- cadastro e atualização de perfil
- gestão de eventos e turmas
- inscrições em cursos
- controle de presença
- envio e leitura de avaliações
- geração e validação de certificados
- publicação de informações institucionais
- assinatura digital
- abertura e gestão de votações
- gerenciamento de chamadas e submissões de trabalhos
- dashboards e relatórios administrativos

---

## Stack principal

- **Node.js**
- **Express**
- **PostgreSQL**
- **JWT**
- **Google OAuth**
- **Multer**
- **Nodemailer**
- **PDFKit**
- **Canvas**
- **Helmet**
- **CORS**
- **Morgan**
- **Luxon**
- **Zod** em partes do ecossistema

---

## Estrutura principal do projeto

```bash
.
├── server.js
├── package.json
├── .env.example
├── src/
│   ├── auth/
│   ├── controllers/
│   ├── middlewares/
│   ├── routes/
│   ├── services/
│   ├── utils/
│   ├── validators/
│   ├── db/
│   └── paths.js
├── public/
├── scripts/
└── uploads/ / data/ (ambiente local, não versionados)