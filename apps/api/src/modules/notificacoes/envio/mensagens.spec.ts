import { MENSAGEM_AVISO_MAX } from '@atletica/shared'
import {
  dividirEmLotes,
  formatarDataCurta,
  LIMITE_CORPO,
  LIMITE_TITULO,
  montarMensagem,
  truncar,
  type ConteudoNotificacao,
} from './mensagens'

const CONTEUDO: ConteudoNotificacao = {
  categoria: 'NOTICIAS',
  titulo: 'LRD publicou uma notícia',
  corpo: 'Inscrições abertas',
  url: '/noticias/0f8b2c4e-1a3d-4e5f-9a7b-6c5d4e3f2a1b',
  chave: 'noticia.publicada:0f8b2c4e-1a3d-4e5f-9a7b-6c5d4e3f2a1b',
}

describe('truncar', () => {
  it('mantém o texto dentro do limite', () => {
    expect(truncar('Novo jogo: Futsal', 65)).toBe('Novo jogo: Futsal')
    expect(truncar('a'.repeat(65), 65)).toBe('a'.repeat(65))
  })

  it('corta com reticências sem passar do limite', () => {
    const resultado = truncar('a'.repeat(70), 65)
    expect(Array.from(resultado)).toHaveLength(65)
    expect(resultado.endsWith('…')).toBe(true)
  })

  it('conta emoji como um caractere e não deixa espaço antes das reticências', () => {
    expect(truncar('🏆'.repeat(10), 10)).toBe('🏆'.repeat(10))
    expect(truncar('abc def', 5)).toBe('abc…')
  })
})

describe('formatarDataCurta', () => {
  it('usa dd/mm HH:mm em America/Fortaleza', () => {
    expect(formatarDataCurta('2026-10-12T22:00:00.000Z')).toBe('12/10 19:00')
    expect(formatarDataCurta('2027-01-01T02:30:00.000Z')).toBe('31/12 23:30')
  })
})

describe('montarMensagem', () => {
  it('monta a mensagem do Expo para um token', () => {
    expect(montarMensagem('ExponentPushToken[a]', CONTEUDO)).toEqual({
      to: 'ExponentPushToken[a]',
      title: CONTEUDO.titulo,
      body: CONTEUDO.corpo,
      data: { url: CONTEUDO.url, tipo: 'NOTICIAS', id: CONTEUDO.chave },
      channelId: 'padrao',
      sound: 'default',
      priority: 'high',
    })
  })

  it('trunca título e corpo e repassa o ttl', () => {
    const mensagem = montarMensagem('ExpoPushToken[b]', {
      ...CONTEUDO,
      titulo: 't'.repeat(100),
      corpo: 'c'.repeat(300),
      ttl: 3600,
    })
    expect(Array.from(mensagem.title)).toHaveLength(LIMITE_TITULO)
    expect(Array.from(mensagem.body)).toHaveLength(LIMITE_CORPO)
    expect(mensagem.ttl).toBe(3600)
  })

  it('mantém o aviso manual inteiro até o limite da mensagem', () => {
    const corpo = 'c'.repeat(MENSAGEM_AVISO_MAX)
    const mensagem = montarMensagem('ExpoPushToken[c]', { ...CONTEUDO, categoria: 'AVISOS', corpo })
    expect(mensagem.body).toBe(corpo)
  })
})

describe('dividirEmLotes', () => {
  it('divide 250 itens em 100, 100 e 50', () => {
    const lotes = dividirEmLotes(Array.from({ length: 250 }, (_, i) => i))
    expect(lotes.map((lote) => lote.length)).toEqual([100, 100, 50])
    expect(lotes.flat()).toEqual(Array.from({ length: 250 }, (_, i) => i))
  })

  it('lista vazia não gera lote', () => {
    expect(dividirEmLotes([])).toEqual([])
  })
})
