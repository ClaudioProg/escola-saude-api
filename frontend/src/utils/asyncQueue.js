// 📁 src/utils/asyncQueue.js — v2.0

/**
 * Cria uma fila assíncrona com limite de concorrência.
 *
 * Uso:
 * const queue = createAsyncQueue(4);
 *
 * await queue(() => fetchImagem(id));
 *
 * Funções auxiliares:
 * - queue.size()
 * - queue.running()
 * - queue.pending()
 * - queue.concurrency()
 * - queue.idle()
 * - queue.clear()
 *
 * Observação:
 * - Este arquivo não manipula datas.
 * - Não há risco de fuso horário.
 */

function normalizeConcurrency(value, fallback = 4) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return fallback;
  }

  return Math.min(Math.max(1, Math.trunc(number)), 20);
}

export function createAsyncQueue(concurrency = 4) {
  const maxConcurrency = normalizeConcurrency(concurrency, 4);

  let runningCount = 0;
  const queue = [];

  function runNext() {
    while (runningCount < maxConcurrency && queue.length > 0) {
      const job = queue.shift();

      if (!job) {
        break;
      }

      runningCount += 1;

      Promise.resolve()
        .then(() => job.fn())
        .then(job.resolve, job.reject)
        .finally(() => {
          runningCount = Math.max(0, runningCount - 1);
          runNext();
        });
    }
  }

  function enqueue(fn) {
    return new Promise((resolve, reject) => {
      if (typeof fn !== "function") {
        reject(
          new TypeError(
            "createAsyncQueue: o item enfileirado deve ser uma função."
          )
        );
        return;
      }

      queue.push({
        fn,
        resolve,
        reject,
      });

      runNext();
    });
  }

  enqueue.size = () => queue.length;
  enqueue.running = () => runningCount;
  enqueue.pending = () => queue.length + runningCount;
  enqueue.concurrency = () => maxConcurrency;
  enqueue.idle = () => runningCount === 0 && queue.length === 0;

  enqueue.clear = () => {
    const removed = queue.splice(0, queue.length);

    for (const job of removed) {
      job.reject(
        new Error("Fila assíncrona limpa antes da execução do item.")
      );
    }

    return removed.length;
  };

  return enqueue;
}