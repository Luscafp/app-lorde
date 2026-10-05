import type { AcaoDaEntidade, EntidadeAuditoria } from '@atletica/shared'
import type { DadosAuditoria, EntradaAuditoria } from './auditoria.service'
import type { DiferencaAuditoria } from './diferenca'

export interface AcoesDaAlteracao<E extends EntidadeAuditoria> {
  alteracao: AcaoDaEntidade<E>
  ativacao: AcaoDaEntidade<E>
  desativacao: AcaoDaEntidade<E>
}

/** Separa a troca do campo de ativação (ATIVADO/DESATIVADO) das demais (ALTERADO). */
export function entradasDaAlteracao<E extends EntidadeAuditoria>(
  entidade: E,
  entidadeId: string,
  diff: DiferencaAuditoria,
  campoAtivo: string,
  acoes: AcoesDaAlteracao<E>,
): EntradaAuditoria[] {
  const { [campoAtivo]: ativoAntes, ...antes } = diff.antes
  const { [campoAtivo]: ativoDepois, ...depois } = diff.depois
  const entrada = (acao: AcaoDaEntidade<E>, dados: DadosAuditoria) =>
    ({ entidade, entidadeId, acao, dados }) as EntradaAuditoria
  const entradas: EntradaAuditoria[] = []

  if (Object.keys(depois).length > 0) entradas.push(entrada(acoes.alteracao, { antes, depois }))
  if (ativoDepois !== undefined) {
    entradas.push(
      entrada(ativoDepois ? acoes.ativacao : acoes.desativacao, {
        antes: { [campoAtivo]: ativoAntes },
        depois: { [campoAtivo]: ativoDepois },
      }),
    )
  }
  return entradas
}
