// ✅ src/utils/asyncQueue.js — PREMIUM++
export function createAsyncQueue(concurrency = 4) {
  const maxConcurrency = Number.isFinite(Number(concurrency))
    ? Math.max(1, Math.trunc(Number(concurrency)))
    : 4;

  let running = 0;
  const q = [];

  const runNext = () => {
    while (running < maxConcurrency && q.length > 0) {
      const job = q.shift();
      if (!job) break;

      running++;

      Promise.resolve()
        .then(() => job.fn())
        .then(job.resolve, job.reject)
        .finally(() => {
          running--;
          runNext();
        });
    }
  };

  const enqueue = (fn) =>
    new Promise((resolve, reject) => {
      if (typeof fn !== "function") {
        reject(new TypeError("createAsyncQueue: o item enfileirado deve ser uma função."));
        return;
      }

      q.push({ fn, resolve, reject });
      runNext();
    });

  enqueue.size = () => q.length;
  enqueue.running = () => running;
  enqueue.concurrency = () => maxConcurrency;
  enqueue.idle = () => running === 0 && q.length === 0;

  return enqueue;
}