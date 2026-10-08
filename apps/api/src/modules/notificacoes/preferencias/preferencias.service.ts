import type { AntecedenciaLembrete, AtualizarPreferencias, Preferencias } from '@atletica/shared'
import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../../infra/prisma/prisma.service'

const CAMPOS = {
  pushAtivo: true,
  novosEventos: true,
  alteracoesEventos: true,
  lembretes: true,
  antecedenciaLembreteHoras: true,
  resultados: true,
  noticias: true,
  solicitacoes: true,
  avisos: true,
} as const

type Registro = Omit<Preferencias, 'antecedenciaLembreteHoras'> & {
  antecedenciaLembreteHoras: number
}

/** O `CHECK preferencia_antecedencia` garante um dos valores de `ANTECEDENCIAS`. */
const paraDto = (registro: Registro): Preferencias => ({
  ...registro,
  antecedenciaLembreteHoras: registro.antecedenciaLembreteHoras as AntecedenciaLembrete,
})

/** Contas anteriores ao cadastro da #57 ganham os padrões do banco no primeiro acesso. */
@Injectable()
export class PreferenciasService {
  constructor(private readonly prisma: PrismaService) {}

  async obter(usuarioId: string): Promise<Preferencias> {
    const registro = await this.prisma.db.preferenciaNotificacao.findUnique({
      where: { usuarioId },
      select: CAMPOS,
    })
    return registro ? paraDto(registro) : this.gravar(usuarioId, {})
  }

  async atualizar(usuarioId: string, dados: AtualizarPreferencias): Promise<Preferencias> {
    return this.gravar(usuarioId, dados)
  }

  private async gravar(usuarioId: string, dados: AtualizarPreferencias): Promise<Preferencias> {
    const registro = await this.prisma.db.preferenciaNotificacao.upsert({
      where: { usuarioId },
      create: { usuarioId, ...dados },
      update: dados,
      select: CAMPOS,
    })
    return paraDto(registro)
  }
}
