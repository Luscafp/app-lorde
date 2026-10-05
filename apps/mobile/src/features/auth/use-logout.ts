import { useCallback, useRef, useState } from 'react'
import { sair } from './logout'

/** Exceção ao `useAcaoOnline` (convenções §10.5): o logout também funciona offline. */
export function useLogout() {
  const [saindo, setSaindo] = useState(false)
  const emAndamento = useRef(false)

  const executar = useCallback(async () => {
    if (emAndamento.current) return
    emAndamento.current = true
    setSaindo(true)
    try {
      await sair()
    } finally {
      emAndamento.current = false
      setSaindo(false)
    }
  }, [])

  return { sair: executar, saindo }
}
