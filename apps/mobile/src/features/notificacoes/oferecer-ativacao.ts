import { router } from 'expo-router'
import { features } from '@/config/features'
import { estadoPermissao, marcarPermissaoPerguntada, permissaoJaPerguntada } from './registro-push'

/** Concedida ou negada fora do app também contam como resposta. */
async function deveOferecer(): Promise<boolean> {
  if (await permissaoJaPerguntada()) return false
  const { permissao } = await estadoPermissao()
  if (permissao === 'nao-perguntada') return true
  await marcarPermissaoPerguntada()
  return false
}

/** Chamada após o login: abre a pré-permissão sobre a tela atual, se o aparelho nunca respondeu. */
export async function oferecerAtivacaoNotificacoes(): Promise<void> {
  if (!features.notificacoes) return
  if (await deveOferecer().catch(() => false)) router.push('/ativar-notificacoes')
}
