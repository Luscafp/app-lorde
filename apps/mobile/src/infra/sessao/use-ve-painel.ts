import { Papel, temNivelMinimo } from '@atletica/shared'
import { useSessao } from './store'

/** Ocultação só visual (convenções §10.1); a autorização real é da API. */
export function useTemNivelMinimo(minimo: Papel): boolean {
  return useSessao((estado) => !!estado.usuario && temNivelMinimo(estado.usuario.papel, minimo))
}

export function useVePainel(): boolean {
  return useTemNivelMinimo(Papel.DIRETOR)
}
