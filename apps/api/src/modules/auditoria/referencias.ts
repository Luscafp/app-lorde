import {
  formatarDataHora,
  formatarValorAuditoria,
  ROTULO_AUTOR_EXCLUIDO,
  type RegistroAuditoriaDetalhe,
} from '@atletica/shared'
import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../infra/prisma/prisma.service'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Referencias = RegistroAuditoriaDetalhe['referencias']
type Rotulado = readonly [id: string, rotulo: string]

/** UUIDs em qualquer nível de `dados`. */
export function idsCitados(valor: unknown, ids = new Set<string>()): Set<string> {
  if (typeof valor === 'string' && UUID.test(valor)) ids.add(valor.toLowerCase())
  else if (Array.isArray(valor)) valor.forEach((item) => idsCitados(item, ids))
  else if (typeof valor === 'object' && valor !== null) {
    Object.values(valor).forEach((item) => idsCitados(item, ids))
  }
  return ids
}

export const nomeDe = (usuario: { nome: string; excluidoEm: Date | null }) =>
  usuario.excluidoEm ? ROTULO_AUTOR_EXCLUIDO : usuario.nome

const comNome = (linhas: { id: string; nome: string }[]): Rotulado[] =>
  linhas.map((l) => [l.id, l.nome])

const comTitulo = (linhas: { id: string; titulo: string }[]): Rotulado[] =>
  linhas.map((l) => [l.id, l.titulo])

const pessoaNoTime = (
  linhas: {
    id: string
    usuario: { nome: string; excluidoEm: Date | null }
    time: { nome: string }
  }[],
): Rotulado[] => linhas.map((l) => [l.id, `${nomeDe(l.usuario)} · ${l.time.nome}`])

/** Os modelos com escopo só devolvem registros da atlética ativa; usuários só com vínculo nela. */
@Injectable()
export class ReferenciasAuditoria {
  constructor(private readonly prisma: PrismaService) {}

  async resolver(ids: Iterable<string>): Promise<Referencias> {
    const lista = [...new Set(ids)]
    if (lista.length === 0) return { usuarios: {}, registros: {} }
    const db = this.prisma.db
    const em = { in: lista }
    const usuario = { select: { nome: true, excluidoEm: true } }
    const time = { select: { nome: true } }

    const [usuarios, ...registros] = await Promise.all([
      db.vinculoAtletica
        .findMany({ where: { usuarioId: em }, select: { usuarioId: true, usuario } })
        .then((linhas) => linhas.map((l): Rotulado => [l.usuarioId, nomeDe(l.usuario)])),
      db.time.findMany({ where: { id: em }, select: { id: true, nome: true } }).then(comNome),
      db.evento
        .findMany({ where: { id: em }, select: { id: true, tipo: true, inicio: true, time } })
        .then((linhas) =>
          linhas.map((l): Rotulado => [
            l.id,
            `${formatarValorAuditoria('tipo', l.tipo)} ${l.time.nome} ${formatarDataHora(l.inicio)}`,
          ]),
        ),
      db.serieRecorrencia
        .findMany({ where: { id: em }, select: { id: true, horario: true, time } })
        .then((linhas) => linhas.map((l): Rotulado => [l.id, `${l.time.nome} ${l.horario}`])),
      db.membroTime
        .findMany({ where: { id: em }, select: { id: true, usuario, time } })
        .then(pessoaNoTime),
      db.solicitacaoEntrada
        .findMany({ where: { id: em }, select: { id: true, usuario, time } })
        .then(pessoaNoTime),
      db.modalidade.findMany({ where: { id: em }, select: { id: true, nome: true } }).then(comNome),
      db.atletica.findMany({ where: { id: em }, select: { id: true, nome: true } }).then(comNome),
      db.noticia
        .findMany({ where: { id: em }, select: { id: true, titulo: true } })
        .then(comTitulo),
      db.banner.findMany({ where: { id: em }, select: { id: true, titulo: true } }).then(comTitulo),
    ])
    return {
      usuarios: Object.fromEntries(usuarios),
      registros: Object.fromEntries(registros.flat()),
    }
  }
}
