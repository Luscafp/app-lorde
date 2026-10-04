import {
  presignPedidoSchema,
  presignRespostaSchema,
  type PresignPedido,
  type PresignResposta,
} from '@atletica/shared'
import { api } from '@/infra/api/cliente'

export async function pedirPresign(pedido: PresignPedido): Promise<PresignResposta> {
  const corpo = presignPedidoSchema.parse(pedido)
  return presignRespostaSchema.parse(await api.post('/uploads/presign', corpo))
}
