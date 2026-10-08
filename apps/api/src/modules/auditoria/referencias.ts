import { formatarDataHora, ROTULO_AUTOR_EXCLUIDO, TipoEvento } from '@atletica/shared'
import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../infra/prisma/prisma.service'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const ROTULO_TIPO: Readonly<Record<TipoEvento, string>> = { JOGO: 'Jogo', TREINO: 'Treino' }

/** UUIDs em qualquer nível de `dados`. */
export function idsCitados(valor: unknown, ids = new Set<string>()): Set<string> {
  if (typeof valor === 'string' && UUID.test(valor)) ids.add(valor.toLowerCase())
  else if (Array.isArray(valor)) valor.forEach((item) => idsCitados(item, ids))
  else if (typeof valor === 'object' && valor !== null) {
    Object.values(valor).forEach((item) => idsCitados(item, ids))
  }
  return ids
}

const nomeDe = (usuario: { nome: string; excluidoEm: Date | null }) =>
  usuario.excluidoEm ? ROTULO_AUTOR_EXCLUIDO : usuario.nome

/**
 * Id → rótulo legível (usuário, time, evento...). Os modelos com escopo só devolvem registros
 * da atlética ativa; usuários só com vínculo nela.
 */
@Injectable()
export class ReferenciasAuditoria {
  constructor(private readonly prisma: PrismaService) {}

  async resolver(ids: Iterable<string>): Promise<Record<string, string>> {
    const lista = [...new Set(ids)]
    if (lista.length === 0) return {}
    const db = this.prisma.db
    const em = { in: lista }
    const usuario = { select: { nome: true, excluidoEm: true } }
    const time = { select: { nome: true } }

    const grupos = await Promise.all([
      db.vinculoAtletica
        .findMany({ where: { usuarioId: em }, select: { usuarioId: true, usuario } })
        .then((linhas) => linhas.map((l) => [l.usuarioId, nomeDe(l.usuario)] as const)),
      db.time
        .findMany({ where: { id: em }, select: { id: true, nome: true } })
        .then((linhas) => linhas.map((l) => [l.id, l.nome] as const)),
      db.evento
        .findMany({ where: { id: em }, select: { id: true, tipo: true, inicio: true, time } })
        .then((linhas) =>
          linhas.map(
            (l) =>
              [
                l.id,
                `${ROTULO_TIPO[l.tipo]} ${l.time.nome} ${formatarDataHora(l.inicio)}`,
              ] as const,
          ),
        ),
      db.serieRecorrencia
        .findMany({ where: { id: em }, select: { id: true, horario: true, time } })
        .then((linhas) => linhas.map((l) => [l.id, `${l.time.nome} ${l.horario}`] as const)),
      db.membroTime
        .findMany({ where: { id: em }, select: { id: true, usuario, time } })
        .then((linhas) =>
          linhas.map((l) => [l.id, `${nomeDe(l.usuario)} · ${l.time.nome}`] as const),
        ),
      db.solicitacaoEntrada
        .findMany({ where: { id: em }, select: { id: true, usuario, time } })
        .then((linhas) =>
          linhas.map((l) => [l.id, `${nomeDe(l.usuario)} · ${l.time.nome}`] as const),
        ),
      db.modalidade
        .findMany({ where: { id: em }, select: { id: true, nome: true } })
        .then((linhas) => linhas.map((l) => [l.id, l.nome] as const)),
      db.atletica
        .findMany({ where: { id: em }, select: { id: true, nome: true } })
        .then((linhas) => linhas.map((l) => [l.id, l.nome] as const)),
      db.noticia
        .findMany({ where: { id: em }, select: { id: true, titulo: true } })
        .then((linhas) => linhas.map((l) => [l.id, l.titulo] as const)),
      db.banner
        .findMany({ where: { id: em }, select: { id: true, titulo: true } })
        .then((linhas) => linhas.map((l) => [l.id, l.titulo] as const)),
    ])
    return Object.fromEntries(grupos.flat())
  }
}
