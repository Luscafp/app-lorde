import { useCallback, useEffect, useState } from 'react'

const SEGUNDO_MS = 1000

/** `125` → `"02:05"`. */
export function formatarMinutosSegundos(totalSegundos: number): string {
  const segundos = Math.max(0, totalSegundos)
  const mm = String(Math.floor(segundos / 60)).padStart(2, '0')
  const ss = String(segundos % 60).padStart(2, '0')
  return `${mm}:${ss}`
}

/** Segundos restantes até o fim; recalculado pelo relógio para não acumular atraso. */
export function useContagemRegressiva() {
  const [fim, setFim] = useState<number | null>(null)
  const [restantes, setRestantes] = useState(0)

  const iniciar = useCallback((segundos: number) => {
    setFim(Date.now() + segundos * SEGUNDO_MS)
    setRestantes(segundos)
  }, [])

  useEffect(() => {
    if (fim === null) return
    const relogio = setInterval(() => {
      const faltam = Math.max(0, Math.ceil((fim - Date.now()) / SEGUNDO_MS))
      setRestantes(faltam)
      if (faltam === 0) setFim(null)
    }, SEGUNDO_MS)
    return () => clearInterval(relogio)
  }, [fim])

  return { restantes, ativa: restantes > 0, iniciar }
}
