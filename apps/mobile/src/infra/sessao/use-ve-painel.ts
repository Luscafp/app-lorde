import { Papel } from '@atletica/shared'
import { useTemNivelMinimo } from './use-tem-nivel-minimo'

export function useVePainel(): boolean {
  return useTemNivelMinimo(Papel.DIRETOR)
}
