/** Catálogo único de ações por entidade (convenções §7). Nova ação: altere aqui e na §7. */
export const ACOES_POR_ENTIDADE = {
  Modalidade: [
    'MODALIDADE_CRIADA',
    'MODALIDADE_ALTERADA',
    'MODALIDADE_ATIVADA',
    'MODALIDADE_DESATIVADA',
    'MODALIDADE_EXCLUIDA',
  ],
  /** Atlética adversária. */
  Atletica: ['ATLETICA_ADVERSARIA_CRIADA', 'ATLETICA_ADVERSARIA_ALTERADA'],
  Time: [
    'TIME_CRIADO',
    'TIME_ALTERADO',
    'TIME_ATIVADO',
    'TIME_DESATIVADO',
    'TIME_EXCLUIDO',
    'CAPITAO_DEFINIDO',
    'CAPITAO_REMOVIDO',
  ],
  MembroTime: [
    'MEMBRO_ADICIONADO',
    'MEMBRO_REMOVIDO',
    'MEMBRO_REMOVIDO_EXCLUSAO_CONTA',
    'MEMBRO_SAIU',
  ],
  SolicitacaoEntrada: ['SOLICITACAO_APROVADA', 'SOLICITACAO_REJEITADA'],
  Evento: [
    'EVENTO_CRIADO',
    'EVENTO_ALTERADO',
    'EVENTO_CANCELADO',
    'EVENTO_EXCLUIDO',
    'EVENTO_STATUS_ALTERADO',
    'RESULTADO_REGISTRADO',
    'RESULTADO_CORRIGIDO',
  ],
  SerieRecorrencia: ['SERIE_CRIADA', 'SERIE_ALTERADA', 'SERIE_DIVIDIDA'],
  /** `entidadeId` = `eventoId`; os `usuarioId` vão em `dados`. */
  Participacao: ['PRESENCAS_REGISTRADAS'],
  Noticia: [
    'NOTICIA_CRIADA',
    'NOTICIA_ALTERADA',
    'NOTICIA_PUBLICADA',
    'NOTICIA_DESPUBLICADA',
    'NOTICIA_EXCLUIDA',
  ],
  Banner: ['BANNER_CRIADO', 'BANNER_ALTERADO', 'BANNER_REORDENADO', 'BANNER_EXCLUIDO'],
  VinculoAtletica: ['USUARIO_DESATIVADO', 'USUARIO_REATIVADO', 'CARGO_ALTERADO'],
  /** Um registro por atlética da conta. */
  Usuario: ['CONTA_EXCLUIDA'],
  /** Sem tabela: `entidadeId` é um UUID gerado para o aviso. */
  Aviso: ['AVISO_ENVIADO'],
} as const

export type EntidadeAuditoria = keyof typeof ACOES_POR_ENTIDADE

export type AcaoDaEntidade<E extends EntidadeAuditoria> = (typeof ACOES_POR_ENTIDADE)[E][number]

export type AcaoAuditoria = AcaoDaEntidade<EntidadeAuditoria>

function indexar<T extends string>(valores: readonly T[]): { readonly [K in T]: K } {
  return Object.fromEntries(valores.map((valor) => [valor, valor])) as { [K in T]: K }
}

const entidades = Object.keys(ACOES_POR_ENTIDADE) as EntidadeAuditoria[]

export const EntidadeAuditoria = indexar(entidades)

export const AcaoAuditoria = indexar(entidades.flatMap((entidade) => ACOES_POR_ENTIDADE[entidade]))
