## Dependências com CVEs transitivos

O projeto utiliza bibliotecas amplamente adotadas (Express, JWT, Nodemailer, jsPDF).
As vulnerabilidades identificadas são **transitivas**, sem exploração direta no contexto
de uso deste sistema.

Mitigações aplicadas:
- Atualização contínua de dependências
- Uso de Helmet, CSP e Rate Limit
- Validação rigorosa de entradas
- Não renderização de HTML não confiável
- Geração de PDFs apenas no backend
