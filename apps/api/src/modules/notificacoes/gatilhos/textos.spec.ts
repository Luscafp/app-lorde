import {
  textoCargo,
  textoEventoCriado,
  textoEventosAlterados,
  textoEventosCancelados,
  textoNoticia,
  textoNovaSolicitacao,
  textoResultado,
  textoSerieCriada,
  textoSolicitacaoAvaliada,
  type EventoExibido,
} from './textos'

const JOGO: EventoExibido = {
  tipo: 'JOGO',
  inicio: new Date('2026-10-12T22:00:00.000Z'),
  local: 'Ginásio Central',
  time: 'Futsal Masculino',
  adversario: 'Atlética Medicina',
}

const TREINO: EventoExibido = { ...JOGO, tipo: 'TREINO', adversario: null }

const emDias = (evento: EventoExibido, dias: number): EventoExibido => ({
  ...evento,
  inicio: new Date(evento.inicio.getTime() + dias * 24 * 60 * 60 * 1000),
})

describe('textos dos gatilhos', () => {
  it('jogo e treino criados, com data em America/Fortaleza', () => {
    expect(textoEventoCriado(JOGO)).toEqual({
      titulo: 'Novo jogo: Futsal Masculino',
      corpo: 'vs Atlética Medicina · 12/10 19:00 · Ginásio Central',
    })
    expect(textoEventoCriado(TREINO)).toEqual({
      titulo: 'Novo treino: Futsal Masculino',
      corpo: '12/10 19:00 · Ginásio Central',
    })
  })

  it('série criada lista os dias, o horário e a data final', () => {
    const serie = {
      time: 'Vôlei',
      horario: '19:00',
      dataFim: new Date('2027-03-31'),
      local: 'Quadra 2',
    }
    expect(textoSerieCriada({ ...serie, diasSemana: [1, 3] })).toEqual({
      titulo: 'Novo treino recorrente: Vôlei',
      corpo: 'Seg e qua às 19:00, até 31/03/2027 · Quadra 2',
    })
    expect(textoSerieCriada({ ...serie, diasSemana: [0, 2, 6] }).corpo).toMatch(/^Dom, ter e sáb/)
    expect(textoSerieCriada({ ...serie, diasSemana: [5] }).corpo).toMatch(/^Sex às/)
  })

  it('alteração: singular com o novo horário, plural com a quantidade', () => {
    expect(textoEventosAlterados([{ ...JOGO, inicio: new Date('2026-10-12T23:00:00Z') }])).toEqual({
      titulo: 'Evento alterado: Jogo de Futsal Masculino',
      corpo: 'Agora em 12/10 20:00 · Ginásio Central',
    })
    expect(textoEventosAlterados([TREINO, emDias(TREINO, 2), emDias(TREINO, 7)])).toEqual({
      titulo: 'Treinos de Futsal Masculino alterados',
      corpo: '3 treinos a partir de 12/10 foram alterados.',
    })
  })

  it('cancelamento: singular descreve o evento, plural conta as ocorrências', () => {
    expect(textoEventosCancelados([JOGO])).toEqual({
      titulo: 'Evento cancelado',
      corpo: 'Jogo vs Atlética Medicina de Futsal Masculino em 12/10 19:00 foi cancelado.',
    })
    expect(textoEventosCancelados([TREINO]).corpo).toBe(
      'Treino de Futsal Masculino em 12/10 19:00 foi cancelado.',
    )
    expect(textoEventosCancelados([TREINO, emDias(JOGO, 1)])).toEqual({
      titulo: 'Eventos de Futsal Masculino cancelados',
      corpo: '2 eventos a partir de 12/10 foram cancelados.',
    })
  })

  it('resultado usa a sigla da atlética e o placar', () => {
    const jogo = { ...JOGO, placarTime: 3, placarAdversario: 1 }
    expect(textoResultado('LRD', { ...jogo, resultado: 'VITORIA' })).toEqual({
      titulo: 'Vitória da LRD',
      corpo: 'Futsal Masculino 3 x 1 Atlética Medicina',
    })
    expect(textoResultado('ABC', { ...jogo, resultado: 'EMPATE' }).titulo).toBe('Empate da ABC')
    expect(textoResultado('ABC', { ...jogo, resultado: 'DERROTA' }).titulo).toBe('Derrota da ABC')
  })

  it('notícia, solicitações e cargo', () => {
    expect(textoNoticia('LRD', 'Inscrições abertas')).toEqual({
      titulo: 'LRD publicou uma notícia',
      corpo: 'Inscrições abertas',
    })
    expect(textoNovaSolicitacao('Ana', 'Vôlei')).toEqual({
      titulo: 'Nova solicitação de entrada',
      corpo: 'Ana quer entrar em Vôlei.',
    })
    expect(textoSolicitacaoAvaliada('APROVADA', 'Vôlei')).toEqual({
      titulo: 'Solicitação aprovada',
      corpo: 'Você agora faz parte de Vôlei.',
    })
    expect(textoSolicitacaoAvaliada('REJEITADA', 'Vôlei')).toEqual({
      titulo: 'Solicitação não aceita',
      corpo: 'Sua solicitação para Vôlei não foi aceita.',
    })
    expect(textoCargo('PRESIDENTE')).toEqual({
      titulo: 'Seu cargo foi alterado',
      corpo: 'Agora você é Presidente.',
    })
  })
})
