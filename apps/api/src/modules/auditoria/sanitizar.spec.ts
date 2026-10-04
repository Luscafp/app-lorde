import { CAMPOS_PROIBIDOS, sanitizar } from './sanitizar'

describe('sanitizar', () => {
  it.each([...CAMPOS_PROIBIDOS])('remove %s', (campo) => {
    const { valor, removidos } = sanitizar({ depois: { [campo]: 'x', papel: 'DIRETOR' } })
    expect(valor).toEqual({ depois: { papel: 'DIRETOR' } })
    expect(removidos).toEqual([`depois.${campo}`])
  })

  it('remove qualquer campo terminado em Hash', () => {
    expect(sanitizar({ antes: { outroHash: 'h', status: 'A' } }).valor).toEqual({
      antes: { status: 'A' },
    })
  })

  it('remove em qualquer nível, inclusive dentro de arrays', () => {
    const { valor, removidos } = sanitizar({
      antes: null,
      depois: { membros: [{ usuarioId: 'u1', email: 'a@b.c' }] },
      contexto: { autor: { usuarioId: 'u2', nome: 'Ana', fotoKey: 'k' } },
    })
    expect(valor).toEqual({
      antes: null,
      depois: { membros: [{ usuarioId: 'u1' }] },
      contexto: { autor: { usuarioId: 'u2' } },
    })
    expect(removidos).toEqual([
      'depois.membros[0].email',
      'contexto.autor.nome',
      'contexto.autor.fotoKey',
    ])
  })

  it('mantém os demais campos e valores (datas, booleanos, null)', () => {
    const inicio = new Date('2026-10-01T22:00:00.000Z')
    const dados = { antes: { inicio, ativo: true, local: null }, depois: { inicio, ativo: false } }
    expect(sanitizar(dados)).toEqual({ valor: dados, removidos: [] })
  })

  it('nomeDeDominio mantém só antes.nome e depois.nome', () => {
    const { valor, removidos } = sanitizar(
      {
        antes: { nome: 'Futsal' },
        depois: { nome: 'Futebol', email: 'x', capitao: { nome: 'Ana' } },
        contexto: { nome: 'Bia' },
      },
      true,
    )
    expect(valor).toEqual({
      antes: { nome: 'Futsal' },
      depois: { nome: 'Futebol', capitao: {} },
      contexto: {},
    })
    expect(removidos).toEqual(['depois.email', 'depois.capitao.nome', 'contexto.nome'])
  })
})
