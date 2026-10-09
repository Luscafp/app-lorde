import type { DispositivoRegistrado, RegistrarDispositivo } from '@atletica/shared'
import { Injectable, Logger, NotFoundException, type OnModuleInit } from '@nestjs/common'
import { DIA_MS } from '../../../common/tempo'
import { FilaService } from '../../../infra/fila/fila.service'
import { PrismaService } from '../../../infra/prisma/prisma.service'
import type { UsuarioAutenticado } from '../../auth/tipos'

const FILA_LIMPEZA = 'dispositivos.limpeza'
export const RETENCAO_DISPOSITIVOS_MS = 90 * DIA_MS

/** `DispositivoPush` pertence à conta (sem `atleticaId`); só o dono o altera. */
@Injectable()
export class DispositivosService implements OnModuleInit {
  private readonly logger = new Logger(DispositivosService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly fila: FilaService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.fila.criarFila(FILA_LIMPEZA)
    await this.fila.trabalhar(FILA_LIMPEZA, async () => {
      await this.limparInativos()
    })
    await this.fila.agendar(FILA_LIMPEZA, '0 4 * * *')
  }

  /** Upsert por `tokenPush`: o mesmo aparelho em outra conta passa para o usuário atual. */
  async registrar(
    usuario: Pick<UsuarioAutenticado, 'id' | 'sessaoId'>,
    { tokenPush, plataforma }: RegistrarDispositivo,
  ): Promise<DispositivoRegistrado> {
    const dados = { usuarioId: usuario.id, sessaoId: usuario.sessaoId, plataforma }
    const dispositivo = await this.prisma.db.dispositivoPush.upsert({
      where: { tokenPush },
      create: { ...dados, tokenPush },
      update: { ...dados, ultimoUsoEm: new Date() },
      select: { id: true, ultimoUsoEm: true },
    })
    return { id: dispositivo.id, ultimoUsoEm: dispositivo.ultimoUsoEm.toISOString() }
  }

  /** @throws `404 NOT_FOUND` dispositivo inexistente ou de outro usuário */
  async remover(usuarioId: string, id: string): Promise<void> {
    const { count } = await this.prisma.db.dispositivoPush.deleteMany({ where: { id, usuarioId } })
    if (count === 0) throw new NotFoundException()
  }

  /** Aparelhos das sessões encerradas; `todos` inclui os sem sessão (exclusão de conta). */
  async removerDasSessoes(usuarioId: string, sessaoIds: string[], todos: boolean): Promise<number> {
    const { count } = await this.prisma.db.dispositivoPush.deleteMany({
      where: { usuarioId, ...(!todos && { sessaoId: { in: sessaoIds } }) },
    })
    return count
  }

  async limparInativos(agora: Date = new Date()): Promise<number> {
    const limite = new Date(agora.getTime() - RETENCAO_DISPOSITIVOS_MS)
    const { count } = await this.prisma.db.dispositivoPush.deleteMany({
      where: { ultimoUsoEm: { lt: limite } },
    })
    this.logger.log({ job: FILA_LIMPEZA, dispositivos: count }, 'Dispositivos inativos removidos')
    return count
  }
}
