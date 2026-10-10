import { router } from 'expo-router'
import { useEffect } from 'react'
import { features } from '@/config/features'
import { estadoPermissao, marcarPermissaoPerguntada, permissaoJaPerguntada } from './registro-push'

export const ROTA_ATIVAR_NOTIFICACOES = '/ativar-notificacoes'

/** Concedida ou negada fora do app também contam como resposta. */
async function deveOferecer(): Promise<boolean> {
  if (await permissaoJaPerguntada()) return false
  const { permissao } = await estadoPermissao()
  if (permissao === 'nao-perguntada') return true
  await marcarPermissaoPerguntada()
  return false
}

/** Abre a pré-permissão na primeira entrada autenticada do aparelho. */
export function useOferecerAtivacao(): void {
  useEffect(() => {
    if (!features.notificacoes) return
    let ativo = true
    void deveOferecer()
      .then((oferecer) => {
        if (ativo && oferecer) router.push(ROTA_ATIVAR_NOTIFICACOES)
      })
      .catch(() => undefined)
    return () => {
      ativo = false
    }
  }, [])
}
