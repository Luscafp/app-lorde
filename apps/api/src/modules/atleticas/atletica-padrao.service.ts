import { atleticaPublicaSchema, type AtleticaPublica } from '@atletica/shared'
import { Injectable, type OnModuleInit } from '@nestjs/common'
import { PrismaService } from '../../infra/prisma/prisma.service'
import { ErroAtleticaPadrao } from './erros'

const CAMPOS_PUBLICOS = Object.fromEntries(
  Object.keys(atleticaPublicaSchema.shape).map((campo) => [campo, true]),
) as Record<keyof AtleticaPublica, true>

/**
 * A única `Atletica` com `usaAplicativo = true` (épico #6 §7), resolvida na inicialização.
 * Usada pelo cadastro/login (#57) e por rotas públicas via `executarComAtletica(id(), fn)`.
 */
@Injectable()
export class AtleticaPadraoService implements OnModuleInit {
  private atleticaId: string | undefined

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    const atleticas = await this.prisma.db.atletica.findMany({
      where: { usaAplicativo: true },
      select: { id: true, nome: true },
      orderBy: { nome: 'asc' },
    })
    const [unica, ...outras] = atleticas
    if (!unica || outras.length > 0) throw new ErroAtleticaPadrao(atleticas.map((a) => a.nome))
    this.atleticaId = unica.id
  }

  id(): string {
    if (!this.atleticaId) throw new Error('AtleticaPadraoService usado antes da inicialização.')
    return this.atleticaId
  }

  /** Marca e contato público, lidos do banco a cada chamada (mudanças valem sem reiniciar). */
  async obter(): Promise<AtleticaPublica> {
    const atletica = await this.prisma.db.atletica.findUniqueOrThrow({
      where: { id: this.id() },
      select: CAMPOS_PUBLICOS,
    })
    return atleticaPublicaSchema.parse(atletica)
  }
}
