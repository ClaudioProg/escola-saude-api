1. certificados_avulsos.cpf
- Existem 217 registros com CPF vazio.
- Não foi criado CHECK cpf não vazio.
- Precisará diagnóstico manual/regra de negócio.

2. trabalhos_modelos
- Tabela vazia, legada, ainda usada no uploadController.js.
- Candidata futura à remoção após revisão/migração do código.

3. evento_unidades
- Tabela vazia, legada, ainda usada pelo código.
- Candidata futura à remoção após revisão do fluxo.

4. evento_cargos
- Tabela em uso no eventoAdminController.js.
- Possui 1 registro com cargo = '54' em texto.
- Candidata futura à migração/remoção após revisar backend/frontend.

5. normalizar_nome x normalize_nome
- Duas funções de normalização de nome coexistem.
- Não remover sem busca no backend.