-- =====================================================================
-- Migração: Regra "1 turma por evento" (exceto quando o evento é congresso)
-- =====================================================================

BEGIN;

-- 1) Função do trigger — permite múltiplas inscrições apenas em CONGRESSO
CREATE OR REPLACE FUNCTION fn_bloquear_inscricao_multipla()
RETURNS TRIGGER AS $$
DECLARE
  v_evento_id   BIGINT;
  v_tipo_evento TEXT;
  v_existe      BOOLEAN;
BEGIN
  -- evento da turma que está sendo inserida
  SELECT t.evento_id
    INTO v_evento_id
    FROM turmas t
   WHERE t.id = NEW.turma_id;

  -- enum -> text (para comparação case-insensitive)
  SELECT (e.tipo::text)
    INTO v_tipo_evento
    FROM eventos e
   WHERE e.id = v_evento_id;

  -- ✅ EXCEÇÃO: congresso pode ter múltiplas inscrições no mesmo evento
  IF NOT (v_tipo_evento ILIKE 'congresso') THEN
    SELECT EXISTS (
      SELECT 1
        FROM inscricoes i
        JOIN turmas t2 ON t2.id = i.turma_id
       WHERE i.usuario_id = NEW.usuario_id
         AND t2.evento_id = v_evento_id
    ) INTO v_existe;

    IF v_existe THEN
      RAISE EXCEPTION 'Usuário já inscrito em uma turma deste evento.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2) Trigger que chama a função acima (idempotente)
DROP TRIGGER IF EXISTS trg_bloquear_inscricao_multipla ON inscricoes;

CREATE TRIGGER trg_bloquear_inscricao_multipla
BEFORE INSERT ON inscricoes
FOR EACH ROW
EXECUTE FUNCTION fn_bloquear_inscricao_multipla();

-- 3) (Re)garantia de unicidade na MESMA turma
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'uk_inscricoes_usuario_turma'
  ) THEN
    ALTER TABLE inscricoes
      ADD CONSTRAINT uk_inscricoes_usuario_turma
      UNIQUE (usuario_id, turma_id);
  END IF;
END$$;

-- 4) Índices úteis (idempotentes)
CREATE INDEX IF NOT EXISTS idx_inscricoes_usuario ON inscricoes (usuario_id);
CREATE INDEX IF NOT EXISTS idx_turmas_evento     ON turmas (evento_id);

COMMIT;

-- =========================== [Opcional] ===============================
-- Rollback manual:
--   BEGIN;
--   DROP TRIGGER IF EXISTS trg_bloquear_inscricao_multipla ON inscricoes;
--   DROP FUNCTION IF EXISTS fn_bloquear_inscricao_multipla();
--   -- ALTER TABLE inscricoes DROP CONSTRAINT IF EXISTS uk_inscricoes_usuario_turma;
--   COMMIT;
