import { chaves } from '@/infra/query/chaves'

const f = { modalidadeId: 'm1' }

// Tabela da convenção §10.4: cada fábrica produz exatamente este array.
describe('chaves', () => {
  it.each([
    ['atletica()', chaves.atletica(), ['atletica']],
    ['me()', chaves.me(), ['me']],
    ['me.estatisticas()', chaves.me.estatisticas(), ['me', 'estatisticas']],
    ['me.preferencias()', chaves.me.preferencias(), ['me', 'preferencias-notificacao']],
    ['modalidades()', chaves.modalidades(), ['modalidades', undefined]],
    ['modalidades(f)', chaves.modalidades(f), ['modalidades', f]],
    ['times.todos()', chaves.times.todos(), ['times']],
    ['times.lista(f)', chaves.times.lista(f), ['times', 'lista', f]],
    ['times.detalhe(id)', chaves.times.detalhe('x'), ['times', 'detalhe', 'x']],
    ['times.elenco(id)', chaves.times.elenco('x'), ['times', 'detalhe', 'x', 'elenco']],
    ['eventos.todos()', chaves.eventos.todos(), ['eventos']],
    ['eventos.lista(f)', chaves.eventos.lista(f), ['eventos', 'lista', f]],
    ['eventos.detalhe(id)', chaves.eventos.detalhe('e1'), ['eventos', 'detalhe', 'e1']],
    [
      'eventos.presencas(id)',
      chaves.eventos.presencas('e1'),
      ['eventos', 'detalhe', 'e1', 'presencas'],
    ],
    ['noticias.todos()', chaves.noticias.todos(), ['noticias']],
    ['noticias.lista(f)', chaves.noticias.lista(f), ['noticias', 'lista', f]],
    ['noticias.detalhe(id)', chaves.noticias.detalhe('n1'), ['noticias', 'detalhe', 'n1']],
    ['tags(f)', chaves.tags(f), ['tags', f]],
    ['banners()', chaves.banners(), ['banners']],
    ['solicitacoes(f)', chaves.solicitacoes(f), ['solicitacoes', f]],
    ['painel.todos()', chaves.painel.todos(), ['painel']],
    ['painel.noticias.todos()', chaves.painel.noticias.todos(), ['painel', 'noticias']],
    [
      'painel.noticias.lista(f)',
      chaves.painel.noticias.lista(f),
      ['painel', 'noticias', 'lista', f],
    ],
    [
      'painel.noticias.detalhe(id)',
      chaves.painel.noticias.detalhe('n1'),
      ['painel', 'noticias', 'detalhe', 'n1'],
    ],
    ['painel.banners.lista()', chaves.painel.banners.lista(), ['painel', 'banners', 'lista']],
    [
      'painel.banners.detalhe(id)',
      chaves.painel.banners.detalhe('b1'),
      ['painel', 'banners', 'detalhe', 'b1'],
    ],
    [
      'painel.adversarias.lista(f)',
      chaves.painel.adversarias.lista(f),
      ['painel', 'atleticas-adversarias', 'lista', f],
    ],
    [
      'painel.adversarias.detalhe(id)',
      chaves.painel.adversarias.detalhe('a1'),
      ['painel', 'atleticas-adversarias', 'detalhe', 'a1'],
    ],
    ['painel.alcanceAviso(f)', chaves.painel.alcanceAviso(f), ['painel', 'avisos', 'alcance', f]],
    ['usuarios.todos()', chaves.usuarios.todos(), ['usuarios']],
    ['usuarios.lista(f)', chaves.usuarios.lista(f), ['usuarios', 'lista', f]],
    ['usuarios.detalhe(id)', chaves.usuarios.detalhe('u1'), ['usuarios', 'detalhe', 'u1']],
    ['auditoria(f)', chaves.auditoria(f), ['auditoria', f]],
    ['auditoria.detalhe(id)', chaves.auditoria.detalhe('a1'), ['auditoria', 'detalhe', 'a1']],
  ])('chaves.%s', (_nome, chave, esperada) => {
    expect(chave).toEqual(esperada)
  })

  it('o prefixo de um recurso cobre listas e detalhes', () => {
    const prefixo = chaves.eventos.todos()
    for (const chave of [chaves.eventos.lista(f), chaves.eventos.presencas('e1')]) {
      expect(chave.slice(0, prefixo.length)).toEqual(prefixo)
    }
  })
})
