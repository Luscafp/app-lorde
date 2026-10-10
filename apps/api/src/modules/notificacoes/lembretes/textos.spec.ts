import { textoConfirmacaoPendente, textoLembrete, type EventoDoTexto } from './textos'

const JOGO: EventoDoTexto = {
  tipo: 'JOGO',
  inicio: new Date('2026-10-12T22:00:00.000Z'),
  local: 'Ginásio Central',
  time: { nome: 'Futsal Masculino' },
}

describe('textos dos lembretes', () => {
  it('lembrete com a antecedência e a hora em America/Fortaleza', () => {
    expect(textoLembrete(JOGO, 2)).toEqual({
      titulo: 'Lembrete: jogo em 2 h',
      corpo: 'Futsal Masculino · 19:00 · Ginásio Central',
    })
    expect(textoLembrete({ ...JOGO, tipo: 'TREINO' }, 24).titulo).toBe('Lembrete: treino em 24 h')
  })

  it('confirmação pendente com dia e hora', () => {
    expect(textoConfirmacaoPendente({ ...JOGO, tipo: 'TREINO' })).toEqual({
      titulo: 'Você vai?',
      corpo: 'Confirme presença no treino de Futsal Masculino em 12/10 às 19:00.',
    })
  })
})
