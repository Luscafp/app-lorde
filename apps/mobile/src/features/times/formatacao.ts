import type { TimeDto } from '@atletica/shared'

export const rotuloAtletica = ({ nome, sigla }: { nome: string; sigla: string | null }) =>
  sigla ? `${nome} (${sigla})` : nome

export const porNome = (a: { nome: string }, b: { nome: string }) =>
  a.nome.localeCompare(b.nome, 'pt-BR')

export const contar = (total: number, singular: string, plural: string) =>
  `${total} ${total === 1 ? singular : plural}`

export function resumoElenco({ totalMembros, capitao }: Pick<TimeDto, 'totalMembros' | 'capitao'>) {
  const membros = contar(totalMembros, 'membro', 'membros')
  return capitao ? `${membros} · Capitão: ${capitao.nome}` : `${membros} · Sem capitão`
}
