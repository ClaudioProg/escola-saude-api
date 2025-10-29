// ✅ src/controllers/turmaController.js
/* eslint-disable no-console */
const db = require("../db");

/* ===== Utils ===== */

function validarDatasPayload(datas) {
  console.group("🔍[validarDatasPayload]");
  if (!Array.isArray(datas) || datas.length === 0) {
    console.warn("⛔ nenhuma data enviada");
    console.groupEnd();
    return { ok: false, msg: "Envie ao menos 1 data." };
  }

  for (const d of datas) {
    console.log("checando data:", d);

    if (!d?.data || !/^\d{4}-\d{2}-\d{2}$/.test(d.data)) {
      console.warn("⛔ campo 'data' inválido:", d?.data);
      console.groupEnd();
      return {
        ok: false,
        msg: "Campo 'data' deve estar em formato YYYY-MM-DD.",
      };
    }

    if (d.horario_inicio && !/^\d{2}:\d{2}$/.test(d.horario_inicio)) {
      console.warn(
        "⛔ campo 'horario_inicio' inválido:",
        d.horario_inicio
      );
      console.groupEnd();
      return {
        ok: false,
        msg: "Campo 'horario_inicio' deve estar em HH:MM.",
      };
    }

    if (d.horario_fim && !/^\d{2}:\d{2}$/.test(d.horario_fim)) {
      console.warn(
        "⛔ campo 'horario_fim' inválido:",
        d.horario_fim
      );
      console.groupEnd();
      return {
        ok: false,
        msg: "Campo 'horario_fim' deve estar em HH:MM.",
      };
    }
  }

  console.log("✅ datasPayload válido");
  console.groupEnd();
  return { ok: true };
}

function ordenarDatas(datas = []) {
  return [...datas].sort((a, b) =>
    String(a.data).localeCompare(String(b.data))
  );
}

function minutesBetween(hhmmIni, hhmmFim) {
  if (!hhmmIni || !hhmmFim) return 0;
  const [h1, m1] = hhmmIni.split(":").map(Number);
  const [h2, m2] = hhmmFim.split(":").map(Number);
  if (![h1, m1, h2, m2].every(Number.isFinite)) return 0;
  return h2 * 60 + m2 - (h1 * 60 + m1);
}

// Regra: se um encontro tiver >= 6h (360 min), desconta 1h almoço
function somaHorasDatas(datas = []) {
  let totalMin = 0;
  for (const d of datas) {
    const mins = minutesBetween(d.horario_inicio, d.horario_fim);
    if (mins > 0) {
      totalMin += mins >= 360 ? mins - 60 : mins;
    }
  }
  return totalMin / 60;
}

/* ===== 🎯 Criar turma ===== */
// POST /api/turmas
async function criarTurma(req, res) {
  console.group("🆕[criarTurma] body:", req.body);

  const client = await db.getClient();
  try {
    const {
      evento_id,
      nome,
      vagas_total = null,
      datas = [], // [{data:'YYYY-MM-DD', horario_inicio:'HH:MM', horario_fim:'HH:MM'}]
    } = req.body;

    console.log("→ evento_id:", evento_id, "nome:", nome);

    if (!evento_id || !nome) {
      console.warn("⛔ evento_id ou nome ausente");
      console.groupEnd();
      return res
        .status(400)
        .json({ erro: "Evento e nome são obrigatórios." });
    }

    const v = validarDatasPayload(datas);
    if (!v.ok) {
      console.warn("⛔ validarDatasPayload falhou:", v.msg);
      console.groupEnd();
      return res.status(400).json({ erro: v.msg });
    }

    // ordena cronologicamente
    const datasOrdenadas = ordenarDatas(datas);
    console.log("datasOrdenadas:", datasOrdenadas);

    const data_inicio = datasOrdenadas[0].data;
    const data_fim =
      datasOrdenadas[datasOrdenadas.length - 1].data;

    // carga horária planejada somando encontros
    const carga_horaria = somaHorasDatas(datasOrdenadas);

    console.log("➡ payload turma:", {
      evento_id,
      nome,
      vagas_total,
      data_inicio,
      data_fim,
      carga_horaria,
    });

    await client.query("BEGIN");

    // insere turma base
    const { rows: insTurma } = await client.query(
      `
      INSERT INTO turmas (
        evento_id,
        nome,
        data_inicio,
        data_fim,
        vagas_total,
        carga_horaria
      )
      VALUES ($1,$2,$3,$4,$5,$6)
      RETURNING id
      `,
      [
        evento_id,
        nome,
        data_inicio,
        data_fim,
        vagas_total,
        carga_horaria,
      ]
    );

    const turma_id = insTurma[0].id;
    console.log("✅ turma criada id:", turma_id);

    // persiste encontros/datas reais da turma
    const insertData = `
      INSERT INTO datas_turma (turma_id, data, horario_inicio, horario_fim)
      VALUES ($1, $2, $3, $4)
    `;
    for (const d of datasOrdenadas) {
      console.log(
        "→ inserindo encontro:",
        turma_id,
        d.data,
        d.horario_inicio,
        d.horario_fim
      );
      await client.query(insertData, [
        turma_id,
        d.data,
        d.horario_inicio || null,
        d.horario_fim || null,
      ]);
    }

    await client.query("COMMIT");
    console.log("🎉 criarTurma OK:", turma_id);
    console.groupEnd();
    return res.status(201).json({ turma_id });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("❌ criarTurma erro:", e);
    console.groupEnd();
    return res.status(500).json({ erro: "Erro ao criar turma." });
  } finally {
    client.release();
  }
}

/* ===== ✏️ Atualizar turma ===== */
// PUT /api/turmas/:id
async function atualizarTurma(req, res) {
  console.group(
    "✏️[atualizarTurma] params:",
    req.params,
    "body:",
    req.body
  );

  const client = await db.getClient();
  try {
    const turma_id = Number(req.params.id);
    const {
      nome,
      vagas_total = null,
      datas = [], // [{data, horario_inicio, horario_fim}]
    } = req.body;

    console.log("→ turma_id:", turma_id);

    const v = validarDatasPayload(datas);
    if (!v.ok) {
      console.warn("⛔ validarDatasPayload falhou:", v.msg);
      console.groupEnd();
      return res.status(400).json({ erro: v.msg });
    }

    const datasOrdenadas = ordenarDatas(datas);
    console.log("datasOrdenadas:", datasOrdenadas);

    const data_inicio = datasOrdenadas[0].data;
    const data_fim =
      datasOrdenadas[datasOrdenadas.length - 1].data;

    const carga_horaria = somaHorasDatas(datasOrdenadas);

    console.log("➡ update turma:", {
      nome,
      vagas_total,
      data_inicio,
      data_fim,
      carga_horaria,
    });

    await client.query("BEGIN");

    // atualiza turma base
    await client.query(
      `
      UPDATE turmas 
         SET nome          = COALESCE($2, nome),
             vagas_total   = COALESCE($3, vagas_total),
             data_inicio   = $4,
             data_fim      = $5,
             carga_horaria = $6
       WHERE id=$1
      `,
      [
        turma_id,
        nome || null,
        vagas_total,
        data_inicio,
        data_fim,
        carga_horaria,
      ]
    );

    console.log("✅ turma atualizada, recriando datas_turma...");

    // recria datas_turma
    await client.query(
      `DELETE FROM datas_turma WHERE turma_id=$1`,
      [turma_id]
    );

    const insertData = `
      INSERT INTO datas_turma (turma_id, data, horario_inicio, horario_fim)
      VALUES ($1, $2, $3, $4)
    `;
    for (const d of datasOrdenadas) {
      console.log(
        "→ inserindo encontro:",
        turma_id,
        d.data,
        d.horario_inicio,
        d.horario_fim
      );
      await client.query(insertData, [
        turma_id,
        d.data,
        d.horario_inicio || null,
        d.horario_fim || null,
      ]);
    }

    await client.query("COMMIT");
    console.log("🎉 atualizarTurma OK:", turma_id);
    console.groupEnd();
    return res.json({ ok: true });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("❌ atualizarTurma erro:", e);
    console.groupEnd();
    return res
      .status(500)
      .json({ erro: "Erro ao atualizar turma." });
  } finally {
    client.release();
  }
}

/* ===== ➕ Adicionar instrutor(es) ===== */
// POST /api/eventos/:id/instrutores
async function adicionarInstrutor(req, res) {
  console.group(
    "👨‍🏫[adicionarInstrutor] params:",
    req.params,
    "body:",
    req.body
  );

  const { id: evento_id } = req.params;
  const { instrutores } = req.body;

  if (!Array.isArray(instrutores) || instrutores.length === 0) {
    console.warn("⛔ lista de instrutores vazia/ruim");
    console.groupEnd();
    return res
      .status(400)
      .json({ erro: "Lista de instrutores inválida." });
  }

  try {
    // evento existe?
    const eventoExiste = await db.query(
      "SELECT id FROM eventos WHERE id = $1",
      [evento_id]
    );
    if (eventoExiste.rowCount === 0) {
      console.warn("⛔ evento não encontrado:", evento_id);
      console.groupEnd();
      return res
        .status(404)
        .json({ erro: "Evento não encontrado." });
    }

    // vincula cada instrutor se ainda não vinculado
    for (const instrutor_id of instrutores) {
      console.log(
        "→ vinculando instrutor",
        instrutor_id,
        "ao evento",
        evento_id
      );

      const existe = await db.query(
        `
        SELECT 1 
        FROM evento_instrutor 
        WHERE evento_id = $1 AND instrutor_id = $2
        `,
        [evento_id, instrutor_id]
      );

      if (existe.rowCount === 0) {
        await db.query(
          `
          INSERT INTO evento_instrutor (evento_id, instrutor_id) 
          VALUES ($1, $2)
          `,
          [evento_id, instrutor_id]
        );
      } else {
        console.log(
          "↪ instrutor já vinculado, ignorando duplicata:",
          instrutor_id
        );
      }
    }

    console.log("✅ instrutores adicionados ao evento", evento_id);
    console.groupEnd();
    return res
      .status(201)
      .json({ mensagem: "Instrutor(es) adicionados com sucesso." });
  } catch (err) {
    console.error("❌ adicionarInstrutor erro:", err);
    console.groupEnd();
    return res
      .status(500)
      .json({ erro: "Erro ao adicionar instrutor." });
  }
}

/* ===== 📋 Listar turmas por evento ===== */
async function listarTurmasPorEvento(req, res) {
  console.group(
    "📋[listarTurmasPorEvento] params:",
    req.params
  );
  console.warn(
    "⚠ listarTurmasPorEvento (turmaController) é stub! use listarTurmasPorEvento do turmasController.js"
  );
  console.groupEnd();

  // Mantém resposta clara pra evitar uso indevido desse stub
  return res.status(500).json({
    erro: "Use listarTurmasPorEvento do turmasController.js",
  });
}

/* ========================================================================
   ⚠️ As funções abaixo NÃO estão definidas neste arquivo.
   Elas existem (com muito mais lógica) em turmasController.js.
   Estamos exportando nomes iguais só pra manter compatibilidade caso
   algo esteja fazendo `require('./turmaController')` e esperando tudo.
   Se este arquivo for usado sozinho, você vai tomar ReferenceError.
   Sugestão: migrar rotas para usar turmasController.js diretamente.
   ======================================================================== */

// placeholder só pra debug se alguém chamar sem trocar import
function notImplementedFactory(nomeFn) {
  return function notImplemented(req, res) {
    console.group(`⚠️[${nomeFn}] chamada em turmaController, mas não implementada aqui`);
    console.warn(
      `Função ${nomeFn} não está implementada em turmaController.js. ` +
        "Use turmasController.js."
    );
    console.groupEnd();
    return res.status(500).json({
      erro: `Função ${nomeFn} não está implementada aqui. Use turmasController.js.`,
    });
  };
}

// stubs garantindo que o module.exports abaixo não quebre
const excluirTurma = notImplementedFactory("excluirTurma");
const listarInstrutorDaTurma = notImplementedFactory(
  "listarInstrutorDaTurma"
);
const obterDetalhesTurma = notImplementedFactory(
  "obterDetalhesTurma"
);
const listarTurmasComUsuarios = notImplementedFactory(
  "listarTurmasComUsuarios"
);
const listarTurmasDoInstrutor = notImplementedFactory(
  "listarTurmasDoInstrutor"
);

/* ===================================================================== */

module.exports = {
  criarTurma,
  atualizarTurma,
  adicionarInstrutor,

  // stubs / compat:
  excluirTurma,
  listarTurmasPorEvento,
  listarInstrutorDaTurma,
  obterDetalhesTurma,
  listarTurmasComUsuarios,
  listarTurmasDoInstrutor,

  // aliases retrocompatíveis
  editarTurma: atualizarTurma,
  adicionarinstrutor: adicionarInstrutor,
  listarinstrutorDaTurma: listarInstrutorDaTurma,
  listarTurmasComusuarios: listarTurmasComUsuarios,
  listarTurmasDoinstrutor: listarTurmasDoInstrutor,
};
