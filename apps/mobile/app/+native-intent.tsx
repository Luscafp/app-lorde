import { guardarDestinoAposLogin } from '@/infra/sessao/destino'
import { useSessao } from '@/infra/sessao/store'

export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  if (useSessao.getState().status !== 'autenticado') guardarDestinoAposLogin(path)
  return path
}
