import {
  alcanceAvisoSchema,
  avisoEnviadoSchema,
  type AlcanceAvisoQuery,
  type AvisoEnviado,
  type EnviarAviso,
} from '@atletica/shared'
import { api } from '@/infra/api/cliente'

export async function buscarAlcanceAviso(
  consulta: AlcanceAvisoQuery,
  sinal?: AbortSignal,
): Promise<number> {
  return alcanceAvisoSchema.parse(await api.get('/avisos/alcance', { consulta, sinal }))
    .destinatarios
}

export async function enviarAviso(aviso: EnviarAviso): Promise<AvisoEnviado> {
  return avisoEnviadoSchema.parse(await api.post('/avisos', aviso))
}
