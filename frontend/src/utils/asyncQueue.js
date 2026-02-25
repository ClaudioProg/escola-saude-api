// ✅ src/utils/asyncQueue.js
export function createAsyncQueue(concurrency = 4) {
    let running = 0;
    const q = [];
  
    const runNext = () => {
      if (running >= concurrency) return;
      const job = q.shift();
      if (!job) return;
  
      running++;
      Promise.resolve()
        .then(job.fn)
        .then(job.resolve, job.reject)
        .finally(() => {
          running--;
          runNext();
        });
    };
  
    return (fn) =>
      new Promise((resolve, reject) => {
        q.push({ fn, resolve, reject });
        runNext();
      });
  }