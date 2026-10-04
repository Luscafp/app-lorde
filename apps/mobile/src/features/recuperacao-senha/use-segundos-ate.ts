import { useEffect, useState } from 'react'

const segundosAte = (instante: number | null) =>
  instante === null ? 0 : Math.max(Math.ceil((instante - Date.now()) / 1000), 0)

/** Contagem regressiva em segundos até `instante` (ms); 0 quando passou ou é `null`. */
export function useSegundosAte(instante: number | null): number {
  const [segundos, setSegundos] = useState(() => segundosAte(instante))

  useEffect(() => {
    setSegundos(segundosAte(instante))
    if (instante === null) return
    const relogio = setInterval(() => {
      const restantes = segundosAte(instante)
      setSegundos(restantes)
      if (restantes === 0) clearInterval(relogio)
    }, 1000)
    return () => clearInterval(relogio)
  }, [instante])

  return segundos
}

/** `125` → `"02:05"`. */
export function formatarMinutos(segundos: number): string {
  const mm = String(Math.floor(segundos / 60)).padStart(2, '0')
  const ss = String(segundos % 60).padStart(2, '0')
  return `${mm}:${ss}`
}
