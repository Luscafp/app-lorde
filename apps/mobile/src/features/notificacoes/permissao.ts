import { useCallback, useEffect, useState } from 'react'
import { AppState } from 'react-native'

export type Permissao = 'concedida' | 'negada' | 'nao-perguntada'

export type EstadoPermissao = { permissao: Permissao; registrado: boolean }

/** Contrato com a #88: `estadoPermissao()` e `solicitarPermissaoERegistrar()`. */
export type FontePermissao = {
  estado: () => Promise<EstadoPermissao>
  solicitarERegistrar: () => Promise<void>
}

/** Consulta ao abrir e ao voltar ao app (UC12 A1); concedida sem registro dispara o registro. */
export function usePermissaoNotificacoes(fonte: FontePermissao | undefined) {
  const [permissao, setPermissao] = useState<Permissao>()

  const consultar = useCallback(async () => {
    if (!fonte) return
    const { permissao: atual, registrado } = await fonte.estado()
    setPermissao(atual)
    if (atual === 'concedida' && !registrado) await fonte.solicitarERegistrar()
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
    await fonte.solicitarERegistrar()
    await consultar()
  }, [fonte, consultar])

  return { permissao, permitir }
}
