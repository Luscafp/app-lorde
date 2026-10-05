import { alterarSituacaoSchema, listarUsuariosQuerySchema } from './schemas'

function campos(resultado: { error?: { issues: { path: PropertyKey[] }[] } }): string[] {
  return (resultado.error?.issues ?? []).map(({ path }) => path.join('.'))
}

describe('listarUsuariosQuerySchema', () => {
  it('sem parâmetros: página 1, limite 20', () => {
    expect(listarUsuariosQuerySchema.parse({})).toEqual({ page: 1, limit: 20 })
  })

  it('converte page/limit da query string e aplica trim na busca', () => {
    expect(
      listarUsuariosQuerySchema.parse({
        busca: '  jose ',
        papel: 'DIRETOR',
        situacao: 'DESATIVADO',
        page: '2',
        limit: '50',
      }),
    ).toEqual({ busca: 'jose', papel: 'DIRETOR', situacao: 'DESATIVADO', page: 2, limit: 50 })
  })

  it.each([
    [{ busca: 'a' }, 'busca'],
    [{ busca: ' a ' }, 'busca'],
    [{ busca: 'x'.repeat(101) }, 'busca'],
    [{ papel: 'CAPITAO' }, 'papel'],
    [{ situacao: 'EXCLUIDO' }, 'situacao'],
    [{ limit: '51' }, 'limit'],
    [{ page: '0' }, 'page'],
    [{ ordem: 'nome' }, ''],
  ])('rejeita %o', (query, campo) => {
    expect(campos(listarUsuariosQuerySchema.safeParse(query))).toEqual([campo])
  })
})

describe('alterarSituacaoSchema', () => {
  it.each([true, false])('aceita { ativo: %s }', (ativo) => {
    expect(alterarSituacaoSchema.parse({ ativo })).toEqual({ ativo })
  })

  it.each([{}, { ativo: 'false' }, { ativo: false, papel: 'ATLETA' }])('rejeita %o', (corpo) => {
    expect(alterarSituacaoSchema.safeParse(corpo).success).toBe(false)
  })
})
