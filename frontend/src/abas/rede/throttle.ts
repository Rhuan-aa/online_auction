/** Agrupa chamadas seguidas: `acionar` agenda `fn` uma vez dentro de `ms`; `cancelar` descarta a pendente. */
export function criarThrottle(fn: () => void, ms: number): { acionar(): void; cancelar(): void } {
  let timer: ReturnType<typeof setTimeout> | undefined
  return {
    acionar() {
      if (timer !== undefined) return
      timer = setTimeout(() => { timer = undefined; fn() }, ms)
    },
    cancelar() { clearTimeout(timer); timer = undefined },
  }
}
