// 📁 src/controllers/salasController.js
const { query, getClient } = require("../db");
const IS_DEV = process.env.NODE_ENV !== "production";

/* ======================================================================= */
/* Helpers de data (sem surpresas de fuso)                                 */
/* ======================================================================= */

function parseISODate(dateStr) {
  return new Date(`${dateStr}T12:00:00`);
}

function toISODateString(dateObj) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, "0");
  const d = String(dateObj.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isWeekend(dateStr) {
  const d = parseISODate(dateStr);
  const dow = d.getDay(); // 0 = domingo, 6 = sábado (local)
  return dow === 0 || dow === 6;
}

function hojeISO() {
  return toISODateString(new Date());
}

/* ======================================================================= */
/* Helper para ano/mês com fallback seguro                                 */
/* ======================================================================= */

function getAnoMesFromQuery(queryObj) {
  const now = new Date();
  let ano = Number(queryObj.ano);
  let mes = Number(queryObj.mes); // 1-12

  if (!Number.isFinite(ano) || ano < 2000 || ano > 2100) {
    ano = now.getFullYear();
  }
  if (!Number.isFinite(mes) || mes < 1 || mes > 12) {
    mes = now.getMonth() + 1; // 1-12
  }

  return { ano, mes };
}

/* ======================================================================= */
/* GET /api/salas/agenda-admin                                             */
/* Query params: ano, mes (1-12), sala (opcional)                          */
/* ======================================================================= */

async function listarAgendaAdmin(req, res) {
  try {
    const ano = parseInt(req.query.ano, 10) || new Date().getFullYear();
    const mes = parseInt(req.query.mes, 10) || (new Date().getMonth() + 1);
    const sala = req.query.sala && req.query.sala.trim() ? req.query.sala.trim() : null;

    console.log("[listarAgendaAdmin] query recebida:", { ano, mes, sala });

    // 🔹 Reservas das salas
    const paramsBase = [ano, mes];
    let sqlReservas = `
      SELECT
        id,
        sala,
        data,
        periodo,
        qtd_pessoas,
        coffee_break,
        status,
        observacao_admin AS observacao,
        finalidade,
        solicitante_id
      FROM reservas_salas
      WHERE EXTRACT(YEAR FROM data) = $1
        AND EXTRACT(MONTH FROM data) = $2
    `;

    if (sala) {
      sqlReservas += ` AND sala = $3`;
      paramsBase.push(sala);
    }

    sqlReservas += ` ORDER BY data ASC, sala ASC, periodo ASC`;

    const { rows: reservas } = await query(sqlReservas, paramsBase);

    // 🔹 Bloqueios do calendário
    const sqlBloqueios = `
      SELECT
        id,
        data,
        tipo,
        descricao
      FROM calendario_bloqueios
      WHERE EXTRACT(YEAR FROM data) = $1
        AND EXTRACT(MONTH FROM data) = $2
      ORDER BY data ASC;
    `;
    const { rows: bloqueios } = await query(sqlBloqueios, [ano, mes]);

    const feriados = bloqueios.filter((b) =>
      ["feriado_nacional", "feriado_municipal", "ponto_facultativo"].includes(b.tipo)
    );
    const datas_bloqueadas = bloqueios.filter((b) => b.tipo === "bloqueio_interno");

    return res.json({
      ano,
      mes,
      reservas,
      feriados,
      datas_bloqueadas,
    });
  } catch (err) {
    console.error("[listarAgendaAdmin] ERRO:", err);
    return res.status(500).json({ erro: "Erro ao listar agenda das salas." });
  }
}

/* ======================================================================= */
/* GET /api/salas/agenda-usuario                                           */
/* Query params: ano, mes (1-12), sala (opcional)                          */
/* ======================================================================= */
async function listarAgendaUsuario(req, res) {
  try {
    const { ano, mes } = getAnoMesFromQuery(req.query);
    const salaRaw = req.query.sala;
    const sala = salaRaw && String(salaRaw).trim()
      ? String(salaRaw).trim()
      : null; // 'auditorio' | 'sala_reuniao' | null
    const usuarioId = req.user.id;

    console.log("[listarAgendaUsuario] query:", { ano, mes, sala }, "user:", usuarioId);

    // 🔹 Reservas do próprio usuário no mês
    const params = [ano, mes, usuarioId];
    let whereSala = "";
    if (sala) {
      whereSala = "AND rs.sala = $4";
      params.push(sala);
    }

    const sqlReservas = `
      SELECT
        rs.id,
        rs.sala,
        rs.data,
        rs.periodo,
        rs.status,
        rs.qtd_pessoas,
        rs.coffee_break,
        rs.finalidade,
        rs.solicitante_id
      FROM reservas_salas rs
      WHERE EXTRACT(YEAR FROM rs.data) = $1
        AND EXTRACT(MONTH FROM rs.data) = $2
        AND rs.solicitante_id = $3
        ${whereSala}
      ORDER BY rs.data, rs.sala, rs.periodo;
    `;
    const { rows: reservas } = await query(sqlReservas, params);

    // 🔹 Bloqueios do calendário (feriados, ponto facultativo, bloqueio interno)
    const sqlBloqueios = `
      SELECT
        id,
        data,
        tipo,
        descricao
      FROM calendario_bloqueios
      WHERE EXTRACT(YEAR FROM data) = $1
        AND EXTRACT(MONTH FROM data) = $2
      ORDER BY data ASC;
    `;
    const { rows: bloqueios } = await query(sqlBloqueios, [ano, mes]);

    const feriados = bloqueios.filter((b) =>
      ["feriado_nacional", "feriado_municipal", "ponto_facultativo"].includes(b.tipo)
    );
    const datas_bloqueadas = bloqueios.filter((b) => b.tipo === "bloqueio_interno");

    return res.json({
      ano,
      mes,
      reservas,
      feriados,
      datas_bloqueadas,
    });
  } catch (err) {
    console.error("[listarAgendaUsuario] Erro:", err);
    return res
      .status(500)
      .json({ erro: "Erro ao carregar disponibilidade das salas." });
  }
}

/* ======================================================================= */
/* POST /api/salas/solicitar (usuário)                                     */
/* body: { sala, data, periodo, qtd_pessoas, coffee_break, finalidade }    */
/* ======================================================================= */
async function solicitarReserva(req, res) {
  try {
    const usuarioId = req.user.id;
    const {
      sala,
      data,
      periodo,
      qtd_pessoas,
      coffee_break = false,
      finalidade, // obrigatório
    } = req.body;

    if (!sala || !data || !periodo || !qtd_pessoas) {
      return res
        .status(400)
        .json({ erro: "Sala, data, período e quantidade são obrigatórios." });
    }

    if (!finalidade || !String(finalidade).trim()) {
      return res
        .status(400)
        .json({ erro: "Informe a finalidade do uso da sala / evento." });
    }

    const capacidadeMax = sala === "auditorio" ? 60 : 30;
    if (qtd_pessoas > capacidadeMax) {
      return res.status(400).json({
        erro: `Capacidade máxima para esta sala é de ${capacidadeMax} pessoas.`,
      });
    }

    if (isWeekend(data)) {
      return res
        .status(400)
        .json({ erro: "Não é possível agendar em sábados ou domingos." });
    }

    const bloqueio = await query(
      `
        SELECT 1
          FROM calendario_bloqueios
         WHERE data = $1
           AND tipo = ANY(ARRAY[
             'feriado_nacional'::varchar,
             'feriado_municipal'::varchar,
             'ponto_facultativo'::varchar,
             'bloqueio_interno'::varchar
           ]);
      `,
      [data]
    );
    if (bloqueio.rowCount > 0) {
      return res.status(400).json({
        erro: "Não é possível agendar em feriados, pontos facultativos ou datas bloqueadas.",
      });
    }

    const insertSql = `
      INSERT INTO reservas_salas
        (sala, data, periodo, qtd_pessoas, coffee_break, solicitante_id, status, finalidade)
      VALUES ($1, $2, $3, $4, $5, $6, 'pendente', $7)
      RETURNING *;
    `;
    const { rows } = await query(insertSql, [
      sala,
      data,
      periodo,
      qtd_pessoas,
      coffee_break,
      usuarioId,
      String(finalidade).trim(),
    ]);

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error("[solicitarReserva] Erro:", err);
    if (err.code === "23505") {
      return res
        .status(409)
        .json({ erro: "Este horário já está reservado para esta sala." });
    }
    res.status(500).json({ erro: "Erro ao solicitar reserva." });
  }
}

/* ======================================================================= */
/* PUT /api/salas/minhas/:id (usuário edita a própria solicitação)         */
/* body: { sala?, data?, periodo?, qtd_pessoas?, coffee_break?, finalidade?}*/
/* ======================================================================= */
async function atualizarReservaUsuario(req, res) {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ erro: "ID inválido." });

    const userId = req.user.id;

    const sel = await query(
      `SELECT * FROM reservas_salas WHERE id = $1`,
      [id]
    );
    const atual = sel.rows[0];
    if (!atual) return res.status(404).json({ erro: "Reserva não encontrada." });
    if (Number(atual.solicitante_id) !== Number(userId))
      return res.status(403).json({ erro: "Você não pode alterar esta reserva." });
    if (atual.status !== "pendente")
      return res.status(403).json({ erro: "Edição permitida apenas enquanto pendente." });

    const sala         = req.body.sala        ?? atual.sala;
    const data         = req.body.data        ?? toISODateString(new Date(atual.data));
    const periodo      = req.body.periodo     ?? atual.periodo;
    const qtd_pessoas  = req.body.qtd_pessoas ?? atual.qtd_pessoas;
    const coffee_break = (typeof req.body.coffee_break === "boolean")
      ? req.body.coffee_break
      : atual.coffee_break;
    const finalidade   = (req.body.finalidade != null)
      ? String(req.body.finalidade).trim()
      : (atual.finalidade ?? null);

    if (!sala || !data || !periodo || !qtd_pessoas) {
      return res.status(400).json({ erro: "Sala, data, período e quantidade são obrigatórios." });
    }

    const capacidadeMax = sala === "auditorio" ? 60 : 30;
    if (qtd_pessoas > capacidadeMax) {
      return res.status(400).json({
        erro: `Capacidade máxima para esta sala é de ${capacidadeMax} pessoas.`
      });
    }

    if (data < hojeISO()) {
      return res.status(400).json({ erro: "Não é possível agendar para data passada." });
    }

    if (isWeekend(data)) {
      return res.status(400).json({ erro: "Não é possível agendar em sábados ou domingos." });
    }

    const bloqueio = await query(
      `
        SELECT 1
          FROM calendario_bloqueios
         WHERE data = $1
           AND tipo = ANY(ARRAY[
             'feriado_nacional'::varchar,
             'feriado_municipal'::varchar,
             'ponto_facultativo'::varchar,
             'bloqueio_interno'::varchar
           ]);
      `,
      [data]
    );
    if (bloqueio.rowCount > 0) {
      return res.status(400).json({
        erro: "Não é possível agendar em feriados, pontos facultativos ou datas bloqueadas.",
      });
    }
    

    const conflito = await query(
      `SELECT 1
         FROM reservas_salas
        WHERE sala = $1 AND data = $2 AND periodo = $3 AND id <> $4`,
      [sala, data, periodo, id]
    );
    if (conflito.rowCount > 0) {
      return res.status(409).json({
        erro: "Já existe uma reserva para esta sala, data e período."
      });
    }

    const upd = await query(
      `UPDATE reservas_salas
          SET sala = $2,
              data = $3,
              periodo = $4,
              qtd_pessoas = $5,
              coffee_break = $6,
              finalidade = $7,
              updated_at = now()
        WHERE id = $1
        RETURNING *;`,
      [id, sala, data, periodo, qtd_pessoas, coffee_break, finalidade || null]
    );

    return res.json(upd.rows[0]);
  } catch (err) {
    console.error("[atualizarReservaUsuario] Erro:", err);
    if (err.code === "23505") {
      return res.status(409).json({ erro: "Conflito de horário para esta sala." });
    }
    return res.status(500).json({ erro: "Erro ao atualizar a solicitação." });
  }
}

/* ======================================================================= */
/* DELETE /api/salas/minhas/:id (usuário exclui a própria solicitação)     */
/* ======================================================================= */
async function excluirReservaUsuario(req, res) {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ erro: "ID inválido." });

    const userId = req.user.id;

    const sel = await query(
      `SELECT status, solicitante_id FROM reservas_salas WHERE id = $1`,
      [id]
    );
    const r = sel.rows[0];
    if (!r) return res.status(404).json({ erro: "Reserva não encontrada." });

    if (Number(r.solicitante_id) !== Number(userId))
      return res.status(403).json({ erro: "Você não pode excluir esta reserva." });

    if (r.status !== "pendente")
      return res.status(403).json({ erro: "Exclusão permitida apenas enquanto pendente." });

    const del = await query(`DELETE FROM reservas_salas WHERE id = $1`, [id]);
    if (!del.rowCount) {
      return res.status(404).json({ erro: "Reserva não encontrada." });
    }

    return res.status(204).send();
  } catch (err) {
    console.error("[excluirReservaUsuario] Erro:", err);
    return res.status(500).json({ erro: "Erro ao excluir a solicitação." });
  }
}

/* ======================================================================= */
/* Helpers de recorrência para admin                                       */
/* ======================================================================= */

// Gera datas futuras a partir de uma data base, conforme recorrência.
// Retorna array de 'YYYY-MM-DD' (somente FUTURAS, sem incluir a base).
function gerarDatasRecorrencia(dataBaseISO, recorrencia) {
  if (!recorrencia || !recorrencia.tipo) return [];
  const tipo = recorrencia.tipo;

  // 🔹 Caso ESPECIAL: "sempre" (repete mensalmente até limiteMeses)
  if (tipo === "sempre") {
    const limiteMeses = Math.min(Number(recorrencia.limiteMeses) || 24, 120);
    const base = parseISODate(dataBaseISO);
    const datas = [];
    for (let i = 1; i <= limiteMeses; i++) {
      const d = new Date(base);
      d.setMonth(d.getMonth() + i);
      // se o mês não tiver o mesmo dia (ex.: 31), cai no último dia do mês
      if (d.getMonth() === (base.getMonth() + i) % 12) {
        // ok
      } else {
        const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        d.setDate(last.getDate());
      }
      datas.push(toISODateString(d));
    }
    return datas;
  }

  // Demais tipos precisam de 'repeticoes'
  const repeticoes = Number(recorrencia.repeticoes) || 0;
  if (repeticoes <= 0) return [];

  const baseDate = parseISODate(dataBaseISO);
  const baseTime = baseDate.getTime();
  const results = [];

  const oneDayMs = 24 * 60 * 60 * 1000;

  if (tipo === "semanal" && recorrencia.semanal) {
    const { intervaloSemanas = 1, diasSemana = [] } = recorrencia.semanal;
    const intSem = Number(intervaloSemanas) || 1;
    const diasSet = new Set(diasSemana);
    if (diasSet.size === 0) return [];

    const limiteDias = repeticoes * 7 * intSem + 14;
    for (let i = 1; i <= limiteDias && results.length < repeticoes; i++) {
      const d = new Date(baseTime + i * oneDayMs);
      const diffDays = Math.floor((d - baseDate) / oneDayMs);
      const weekIndex = Math.floor(diffDays / 7);
      if (weekIndex % intSem !== 0) continue;

      const dow = d.getDay(); // 0-6
      if (!diasSet.has(dow)) continue;

      const iso = toISODateString(d);
      if (iso !== dataBaseISO) results.push(iso);
    }
    return results;
  }

  if (tipo === "mensal" && recorrencia.mensal) {
    const {
      modo = "dia_mes", // 'dia_mes' | 'ordem_semana'
      diaMesBase,
      diaSemanaBaseIndex,
      ordemSemanaBase,
      ehUltimaSemana,
    } = recorrencia.mensal;

    const baseYear = baseDate.getFullYear();
    const baseMonth = baseDate.getMonth(); // 0-11

    for (let i = 1; i <= repeticoes; i++) {
      const targetMonthIndex = baseMonth + i;
      const year = baseYear + Math.floor(targetMonthIndex / 12);
      const month = targetMonthIndex % 12;

      let d;
      if (modo === "ordem_semana" && diaSemanaBaseIndex != null) {
        d = getDateByOrdemSemana(
          year,
          month,
          Number(diaSemanaBaseIndex),
          Number(ordemSemanaBase),
          !!ehUltimaSemana
        );
      } else {
        const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
        const day = Math.min(
          Number(diaMesBase) || baseDate.getDate(),
          lastDayOfMonth
        );
        d = new Date(year, month, day, 12, 0, 0);
      }

      const iso = toISODateString(d);
      if (iso !== dataBaseISO) results.push(iso);
    }
    return results;
  }

  if (tipo === "anual" && recorrencia.anual) {
    const {
      modo = "dia_mes",
      diaMesBase,
      diaSemanaBaseIndex,
      ordemSemanaBase,
      ehUltimaSemana,
      meses = [],
    } = recorrencia.anual;

    const mesesSorted = Array.from(new Set(meses)).sort((a, b) => a - b);
    if (mesesSorted.length === 0) return [];

    const baseYear = baseDate.getFullYear();
    const maxLoops = repeticoes * 3;

    let yearOffset = 0;
    while (results.length < repeticoes && yearOffset <= maxLoops) {
      const year = baseYear + yearOffset;

      for (const m of mesesSorted) {
        let d;
        if (modo === "ordem_semana" && diaSemanaBaseIndex != null) {
          d = getDateByOrdemSemana(
            year,
            Number(m),
            Number(diaSemanaBaseIndex),
            Number(ordemSemanaBase),
            !!ehUltimaSemana
          );
        } else {
          const lastDayOfMonth = new Date(year, Number(m) + 1, 0).getDate();
          const day = Math.min(
            Number(diaMesBase) || baseDate.getDate(),
            lastDayOfMonth
          );
          d = new Date(year, Number(m), day, 12, 0, 0);
        }

        const iso = toISODateString(d);
        if (iso > dataBaseISO) {
          results.push(iso);
          if (results.length >= repeticoes) break;
        }
      }

      yearOffset += 1;
    }
    return results;
  }

  return [];
}

// Retorna a data correspondente à "ordem" de um dia da semana no mês (1ª, 2ª... última)
function getDateByOrdemSemana(
  year,
  monthIndex,
  weekday,
  ordemSemana,
  ehUltimaSemana
) {
  if (ehUltimaSemana) {
    const lastDay = new Date(year, monthIndex + 1, 0);
    const lastDow = lastDay.getDay();
    const diff = (lastDow - weekday + 7) % 7;
    const day = lastDay.getDate() - diff;
    return new Date(year, monthIndex, day, 12, 0, 0);
  }

  const ordem = Number(ordemSemana) || 1;
  const firstDay = new Date(year, monthIndex, 1);
  const firstDow = firstDay.getDay();
  const delta = (weekday - firstDow + 7) % 7;
  let day = 1 + delta + (ordem - 1) * 7;

  const lastDayOfMonth = new Date(year, monthIndex + 1, 0).getDate();
  if (day > lastDayOfMonth) {
    const lastDay = new Date(year, monthIndex + 1, 0);
    const lastDow = lastDay.getDay();
    const diff = (lastDow - weekday + 7) % 7;
    day = lastDay.getDate() - diff;
  }

  return new Date(year, monthIndex, day, 12, 0, 0);
}

/* ======================================================================= */
/* POST /api/salas/admin/reservas (admin cria reserva + recorrência)       */
/* ======================================================================= */
async function criarReservaAdmin(req, res) {
  let client;

  // 🔍 LOGA o que está chegando do modal
  console.log("\n[criarReservaAdmin] body recebido:");
  console.dir(req.body, { depth: null });

  try {
    client = await getClient();

    const adminId = req.user.id;
    const {
      sala,
      data,
      periodo,
      qtd_pessoas,
      coffee_break = false,
      status = "aprovado",
      observacao,
      recorrencia = null,
      finalidade, // opcional
    } = req.body;

    console.log("[criarReservaAdmin] parametros basicos:", {
      sala,
      data,
      periodo,
      qtd_pessoas,
      coffee_break,
      status,
      finalidade,
      temRecorrencia: !!recorrencia,
    });

    if (!sala || !data || !periodo || !qtd_pessoas) {
      return res.status(400).json({
        erro: "Sala, data, período e quantidade são obrigatórios.",
      });
    }

    const capacidadeMax = sala === "auditorio" ? 60 : 30;
    if (Number(qtd_pessoas) > capacidadeMax) {
      return res.status(400).json({
        erro: `Capacidade máxima para esta sala é de ${capacidadeMax} pessoas.`,
      });
    }

    // 🔁 gera datas de recorrência (se houver)
    let datasRecorrentes = [];
    try {
      datasRecorrentes = gerarDatasRecorrencia(data, recorrencia);
      console.log(
        "[criarReservaAdmin] datas recorrentes geradas:",
        datasRecorrentes
      );
    } catch (eRec) {
      console.error("[criarReservaAdmin] ERRO em gerarDatasRecorrencia:", eRec);
      // se der erro aqui, não derruba tudo, só ignora recorrência
      datasRecorrentes = [];
    }

    const todasDatas = [data, ...datasRecorrentes];
    const datasUnicas = Array.from(new Set(todasDatas));

    console.log("[criarReservaAdmin] todasDatas:", todasDatas);
    console.log("[criarReservaAdmin] datasUnicas:", datasUnicas);

    // 🔎 feriados nessas datas
    // 🔎 bloqueios nessas datas (feriados, ponto facultativo, bloqueio interno)
const bloqueiosRes = await query(
  `
  SELECT data, tipo
  FROM calendario_bloqueios
  WHERE data = ANY($1::date[])
    AND tipo = ANY(ARRAY[
      'feriado_nacional'::varchar,
      'feriado_municipal'::varchar,
      'ponto_facultativo'::varchar,
      'bloqueio_interno'::varchar
    ])
  `,
  [datasUnicas]
);

const bloqueiosSet = new Set(
  bloqueiosRes.rows.map((r) => r.data.toISOString().slice(0, 10))
);

console.log("[criarReservaAdmin] bloqueios encontrados:", bloqueiosSet);

// remove fins de semana e qualquer data bloqueada
const datasValidas = datasUnicas.filter(
  (dt) => !isWeekend(dt) && !bloqueiosSet.has(dt)
);

console.log("[criarReservaAdmin] datasValidas:", datasValidas);


    if (datasValidas.length === 0) {
      return res.status(400).json({
        erro:
          "Nenhuma data válida para agendamento (todas caem em finais de semana ou feriados/pontos facultativos).",
      });
    }

    // SQL base de insert (usaremos com SAVEPOINT a cada loop)
    const insertSql = `
      INSERT INTO reservas_salas
        (sala, data, periodo, qtd_pessoas, coffee_break, solicitante_id, status, observacao_admin, finalidade)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *;
    `;

    await client.query("BEGIN");

    const inseridas = [];
    const conflitos = [];

    for (const dt of datasValidas) {
      console.log("[criarReservaAdmin] tentando inserir data:", dt);

      // 🔹 cria SAVEPOINT para isolar erro desta data
      await client.query("SAVEPOINT sp_reserva");

      try {
        const { rows } = await client.query(insertSql, [
          sala,
          dt,
          periodo,
          Number(qtd_pessoas),
          !!coffee_break,
          adminId,
          status,
          observacao || null,
          finalidade ? String(finalidade).trim() : null,
        ]);

        inseridas.push(rows[0]);
      } catch (errInsert) {
        console.error(
          "[criarReservaAdmin] erro ao inserir data",
          dt,
          "- code:",
          errInsert.code,
          "- msg:",
          errInsert.message
        );

        if (errInsert.code === "23505") {
          // conflito de unicidade → desfaz só essa tentativa e segue
          await client.query("ROLLBACK TO SAVEPOINT sp_reserva");
          conflitos.push(dt);
        } else {
          // erro real → propaga para o catch externo
          throw errInsert;
        }
      }
    }

    console.log("[criarReservaAdmin] inseridas:", inseridas.length);
    console.log("[criarReservaAdmin] conflitos:", conflitos);

    if (conflitos.length > 0 && inseridas.length === 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        erro:
          "Já existem reservas para esta sala em algumas das datas/períodos selecionados.",
        conflitos,
      });
    }

    await client.query("COMMIT");
    return res.status(201).json({ inseridas, conflitos });
  } catch (err) {
    try {
      if (client) await client.query("ROLLBACK");
    } catch (rollbackErr) {
      console.error("[criarReservaAdmin] erro no ROLLBACK:", rollbackErr);
    }

    console.error("[criarReservaAdmin] ERRO GERAL:", err);

    return res.status(500).json({
      erro: "Erro ao criar reserva de sala.",
      detalhe: IS_DEV ? err.message : undefined, // aparece no Network → Response
    });
  } finally {
    if (client) client.release();
  }
}

/* ======================================================================= */
/* PUT /api/salas/admin/reservas/:id (admin atualiza uma reserva)          */
/* ======================================================================= */
async function atualizarReservaAdmin(req, res) {
  try {
    const id = Number(req.params.id);
    if (!id) {
      return res.status(400).json({ erro: "ID inválido." });
    }

    const {
      status,
      qtd_pessoas,
      coffee_break,
      observacao,
      finalidade, // opcional
    } = req.body;

    const sql = `
      UPDATE reservas_salas
      SET
        status           = COALESCE($2, status),
        qtd_pessoas      = COALESCE($3, qtd_pessoas),
        coffee_break     = COALESCE($4, coffee_break),
        observacao_admin = COALESCE($5, observacao_admin),
        finalidade       = COALESCE($6, finalidade),
        updated_at       = now()
      WHERE id = $1
      RETURNING *;
    `;

    const { rows } = await query(sql, [
      id,
      status || null,
      qtd_pessoas || null,
      typeof coffee_break === "boolean" ? coffee_break : null,
      observacao || null,
      finalidade ? String(finalidade).trim() : null,
    ]);

    if (!rows[0]) {
      return res.status(404).json({ erro: "Reserva não encontrada." });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error("[atualizarReservaAdmin] Erro:", err);
    res.status(500).json({ erro: "Erro ao atualizar reserva." });
  }
}

/* ======================================================================= */
/* DELETE /api/salas/admin/reservas/:id                                    */
/* ======================================================================= */
async function excluirReservaAdmin(req, res) {
  try {
    const id = Number(req.params.id);
    if (!id) {
      return res.status(400).json({ erro: "ID inválido." });
    }

    const { rowCount } = await query(
      `DELETE FROM reservas_salas WHERE id = $1`,
      [id]
    );
    if (!rowCount) {
      return res.status(404).json({ erro: "Reserva não encontrada." });
    }
    res.status(204).send();
  } catch (err) {
    console.error("[excluirReservaAdmin] Erro:", err);
    res.status(500).json({ erro: "Erro ao excluir reserva." });
  }
}

/* ======================================================================= */

module.exports = {
  listarAgendaAdmin,
  listarAgendaUsuario,
  solicitarReserva,
  atualizarReservaUsuario,
  excluirReservaUsuario,
  criarReservaAdmin,
  atualizarReservaAdmin,
  excluirReservaAdmin,
};
