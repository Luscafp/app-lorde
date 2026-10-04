import { ACOES_POR_ENTIDADE, AcaoAuditoria, EntidadeAuditoria } from './acoes'

describe('catálogo de auditoria', () => {
  it('é exatamente a tabela da convenção §7', () => {
    expect(ACOES_POR_ENTIDADE).toEqual({
      Modalidade: [
        'MODALIDADE_CRIADA',
        'MODALIDADE_ALTERADA',
        'MODALIDADE_ATIVADA',
        'MODALIDADE_DESATIVADA',
        'MODALIDADE_EXCLUIDA',
      ],
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
      Usuario: ['CONTA_EXCLUIDA'],
      Aviso: ['AVISO_ENVIADO'],
    })
  })

  it('não tem verbos genéricos nem ações repetidas', () => {
    const acoes = Object.values(AcaoAuditoria)
    expect(acoes).toHaveLength(45)
    expect(new Set(acoes).size).toBe(acoes.length)
    for (const generico of ['CRIAR', 'ATUALIZAR', 'EXCLUIR', 'ALTERAR', 'REMOVER']) {
      expect(acoes).not.toContain(generico)
    }
  })

  it('cabe na coluna VARCHAR(40)', () => {
    for (const valor of [...Object.values(AcaoAuditoria), ...Object.values(EntidadeAuditoria)]) {
      expect(valor.length).toBeLessThanOrEqual(40)
    }
  })

  it('objetos indexados devolvem o próprio nome', () => {
    expect(AcaoAuditoria.EVENTO_ALTERADO).toBe('EVENTO_ALTERADO')
    expect(EntidadeAuditoria.Participacao).toBe('Participacao')
    expect(Object.keys(EntidadeAuditoria)).toHaveLength(13)
  })
})
