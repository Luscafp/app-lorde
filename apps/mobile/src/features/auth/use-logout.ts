import { useMutation } from '@tanstack/react-query'
import { sair } from './logout'

/** Exceção ao `useAcaoOnline` (convenções §10.5): o logout também funciona offline. */
export function useLogout() {
  const { mutate, isPending } = useMutation({ mutationFn: sair, networkMode: 'always' })
  return { sair: () => mutate(), saindo: isPending }
}
