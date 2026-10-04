import { useEffect, useState } from 'react'

/** Valor que só muda depois de `atrasoMs` sem novas alterações. */
export function useValorAtrasado<T>(valor: T, atrasoMs: number): T {
  const [atrasado, setAtrasado] = useState(valor)
  useEffect(() => {
    const temporizador = setTimeout(() => setAtrasado(valor), atrasoMs)
    return () => clearTimeout(temporizador)
  }, [valor, atrasoMs])
  return atrasado
}
