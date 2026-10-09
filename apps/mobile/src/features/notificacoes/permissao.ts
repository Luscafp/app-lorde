import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState } from 'react-native'

export type Permissao = 'concedida' | 'negada' | 'nao-perguntada'

export type EstadoPermissao = { permissao: Permissao; registrado: boolean }

export type FontePermissao = {
  estado: () => Promise<EstadoPermissao>
  solicitarERegistrar: () => Promise<void>
}

/** Consulta ao abrir e ao voltar ao app; concedida sem registro tenta registrar uma vez. */
export function usePermissaoNotificacoes(fonte: FontePermissao | undefined) {
  const [permissao, setPermissao] = useState<Permissao>()
  const registroTentado = useRef(false)

  const consultar = useCallback(async () => {
    if (!fonte) return
    try {
      const { permissao: atual, registrado } = await fonte.estado()
      setPermissao(atual)
      if (atual !== 'concedida' || registrado || registroTentado.current) return
      registroTentado.current = true
      await fonte.solicitarERegistrar()
    } catch {
      setPermissao(undefined)
    }
  }, [fonte])

  useEffect(() => {
    void consultar()
    const assinatura = AppState.addEventListener('change', (status) => {
      if (status === 'active') void consultar()
    })
    return () => assinatura.remove()
  }, [consultar])

  const permitir = useCallback(async () => {
    if (!fonte) return
    await fonte.solicitarERegistrar().catch(() => undefined)
    await consultar()
  }, [fonte, consultar])

  return { permissao, permitir }
}
