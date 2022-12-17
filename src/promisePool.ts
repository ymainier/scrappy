export function promisePool<T>(
  promiseGetters: Array<() => Promise<T>>,
  poolSize: number | undefined
): Promise<Array<PromiseSettledResult<T>>> {
  if (typeof poolSize === "undefined" || poolSize <= 0) {
    return Promise.allSettled(
      promiseGetters.map((promiseGetter) => promiseGetter())
    );
  }

  const length = promiseGetters.length;
  let next = 0;
  const result: Array<PromiseSettledResult<T>> = [];
  const pool: Array<Promise<void>> = [];

  function getNextOrResolve(): Promise<void> {
    const index = next;
    next++;
    if (index >= length) {
      return Promise.resolve();
    } else {
      return promiseGetters[index]()
        .then(
          (value) => {
            result[index] = { status: "fulfilled", value };
          },
          (reason) => {
            result[index] = { status: "rejected", reason };
          }
        )
        .then(getNextOrResolve);
    }
  }

  for (let i = 0; i < poolSize; i++) {
    pool.push(getNextOrResolve());
  }

  return Promise.all(pool)
    .catch((e) => {
      console.log("catch all", e);
    })
    .then(() => result);
}
