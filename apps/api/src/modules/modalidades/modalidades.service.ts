import {
  normalizarNomeModalidade,
  type Modalidade,
  type ModalidadeAtualizacao,
  type ModalidadeCriacao,
} from '@atletica/shared'
import { Injectable } from '@nestjs/common'
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client'
import { PrismaService, type TransacaoComEscopo } from '../../infra/prisma/prisma.service'
import { AuditoriaService, type EntradaAuditoria } from '../auditoria/auditoria.service'
import { diferenca, type DiferencaAuditoria } from '../auditoria/diferenca'
import {
  erroModalidadeComDependencias,
  erroModalidadeDuplicada,
  erroModalidadeNaoEncontrada,
} from './erros'

const CAMPOS = { id: true, nome: true, icone: true, ativa: true } as const

const ordemAlfabetica = new Intl.Collator('pt-BR', { sensitivity: 'base' })

type EntradaModalidade = Extract<EntradaAuditoria, { entidade: 'Modalidade' }>

function semId({ nome, icone, ativa }: Modalidade) {
  return { nome, icone, ativa }
}

/** Separa a troca de `ativa` (ATIVADA/DESATIVADA) da troca de nome/ícone (ALTERADA). */
function entradasDaAlteracao(id: string, diff: DiferencaAuditoria): EntradaModalidade[] {
  const { ativa: ativaAntes, ...antes } = diff.antes
  const { ativa: ativaDepois, ...depois } = diff.depois
  const entradas: EntradaModalidade[] = []
  const base = { entidade: 'Modalidade', entidadeId: id } as const

  if (Object.keys(depois).length > 0) {
    entradas.push({ ...base, acao: 'MODALIDADE_ALTERADA', dados: { antes, depois } })
  }
  if (ativaDepois !== undefined) {
    entradas.push({
      ...base,
      acao: ativaDepois ? 'MODALIDADE_ATIVADA' : 'MODALIDADE_DESATIVADA',
      dados: { antes: { ativa: ativaAntes }, depois: { ativa: ativaDepois } },
    })
  }
  return entradas
}

/** Catálogo global de modalidades (RF34); `Modalidade` não tem escopo de atlética. */
@Injectable()
export class ModalidadesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async listar(incluirInativas: boolean): Promise<Modalidade[]> {
    const modalidades = await this.prisma.db.modalidade.findMany({
      where: incluirInativas ? undefined : { ativa: true },
      select: CAMPOS,
    })
    return modalidades.sort((a, b) => ordemAlfabetica.compare(a.nome, b.nome))
  }

  criar(entrada: ModalidadeCriacao): Promise<Modalidade> {
    const dados = { ...entrada, nome: normalizarNomeModalidade(entrada.nome) }
    return this.gravar(async (tx) => {
      await this.garantirNomeLivre(tx, dados.nome)
      const criada = await tx.modalidade.create({ data: dados, select: CAMPOS })
      await this.auditoria.registrar(tx, {
        entidade: 'Modalidade',
        acao: 'MODALIDADE_CRIADA',
        entidadeId: criada.id,
        dados: { antes: null, depois: semId(criada) },
      })
      return criada
    })
  }

  /** Sem mudança: devolve a modalidade sem gravar nem auditar (convenções §7). */
  atualizar(id: string, entrada: ModalidadeAtualizacao): Promise<Modalidade> {
    const dados =
      entrada.nome === undefined
        ? entrada
        : { ...entrada, nome: normalizarNomeModalidade(entrada.nome) }
    return this.gravar(async (tx) => {
      const antes = await this.buscar(tx, id)
      const diff = diferenca(antes, { ...antes, ...dados }, ['nome', 'icone', 'ativa'])
      if (!diff) return antes

      if (dados.nome !== undefined) await this.garantirNomeLivre(tx, dados.nome, id)
      const depois = await tx.modalidade.update({ where: { id }, data: dados, select: CAMPOS })
      await this.auditoria.registrarVarios(tx, entradasDaAlteracao(id, diff))
      return depois
    })
  }

  /** Exclusão física só sem times (RN26); a FK `Restrict` cobre times fora do escopo. */
  async excluir(id: string): Promise<void> {
    await this.gravar(async (tx) => {
      const antes = await this.buscar(tx, id)
      const times = await tx.time.count({ where: { modalidadeId: id } })
      if (times > 0) throw erroModalidadeComDependencias()

      await tx.modalidade.delete({ where: { id } })
      await this.auditoria.registrar(tx, {
        entidade: 'Modalidade',
        acao: 'MODALIDADE_EXCLUIDA',
        entidadeId: id,
        dados: { antes: semId(antes), depois: null },
      })
    })
  }

  private async gravar<T>(fn: (tx: TransacaoComEscopo) => Promise<T>): Promise<T> {
    try {
      return await this.prisma.db.$transaction(fn)
    } catch (erro) {
      if (erro instanceof PrismaClientKnownRequestError) {
        if (erro.code === 'P2002') throw erroModalidadeDuplicada()
        if (erro.code === 'P2003') throw erroModalidadeComDependencias()
      }
      throw erro
    }
  }

  private async buscar(tx: TransacaoComEscopo, id: string): Promise<Modalidade> {
    const modalidade = await tx.modalidade.findUnique({ where: { id }, select: CAMPOS })
    if (!modalidade) throw erroModalidadeNaoEncontrada()
    return modalidade
  }

  /** Mesma regra do índice `modalidade_nome_unico` (`lower(nome)`); a própria não conta. */
  private async garantirNomeLivre(tx: TransacaoComEscopo, nome: string, id?: string) {
    const existentes = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM "Modalidade" WHERE lower(nome) = lower(${nome})`
    if (existentes.some((existente) => existente.id !== id)) throw erroModalidadeDuplicada()
  }
}
