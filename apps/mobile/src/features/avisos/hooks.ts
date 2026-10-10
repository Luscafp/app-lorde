import type { AlcanceAvisoQuery, AvisoEnviado, EnviarAviso } from '@atletica/shared'
import { useQuery } from '@tanstack/react-query'
import type { ApiErro } from '@/infra/api/cliente'
import { chaves } from '@/infra/query/chaves'
import { useAcaoOnline } from '@/infra/query/use-acao-online'
import { buscarAlcanceAviso, enviarAviso } from './api'

export const ERROS_DO_FORMULARIO = ['VALIDATION_ERROR', 'NOT_FOUND', 'TIME_INVALIDO_AVISO']

/** Prévia de alcance; não persistida (muda com preferências e aparelhos). `null` não consulta. */
export function useAlcanceAviso(consulta: AlcanceAvisoQuery | null) {
  return useQuery({
    queryKey: chaves.painel.alcanceAviso(consulta ?? {}),
    queryFn: ({ signal }) => buscarAlcanceAviso(consulta as AlcanceAvisoQuery, signal),
    enabled: consulta !== null,
  })
}

export function useEnviarAviso() {
  return useAcaoOnline<AvisoEnviado, ApiErro, EnviarAviso>({
    mutationFn: (aviso) => enviarAviso(aviso),
    meta: { errosNaTela: ERROS_DO_FORMULARIO },
  })
}
