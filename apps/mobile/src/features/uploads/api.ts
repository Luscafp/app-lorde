import { presignPedidoSchema, type PresignPedido, type PresignResposta } from '@atletica/shared'
import { api } from '@/infra/api/cliente'

export function pedirPresign(pedido: PresignPedido): Promise<PresignResposta> {
  return api.post<PresignResposta>('/uploads/presign', presignPedidoSchema.parse(pedido))
}
