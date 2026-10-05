import {
  alterarSenhaFormSchema,
  alterarSenhaSchema,
  alterarSituacaoSchema,
  atualizarFotoSchema,
  atualizarPerfilSchema,
  listarUsuariosQuerySchema,
  usuarioIdParamSchema,
} from './schemas'

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

describe('usuarioIdParamSchema', () => {
  it('exige UUID', () => {
    expect(usuarioIdParamSchema.safeParse({ id: 'abc' }).success).toBe(false)
    expect(
      usuarioIdParamSchema.safeParse({ id: '6f1c2a7e-2f5b-4c39-9a0e-3f3b1b8d2c11' }).success,
    ).toBe(true)
  })
})

describe('atualizarPerfilSchema', () => {
  it('aplica trim no nome', () => {
    expect(atualizarPerfilSchema.parse({ nome: '  Ana Souza  ' })).toEqual({ nome: 'Ana Souza' })
  })

  it.each([
    [{ nome: 'A' }, 'nome'],
    [{ nome: 'x'.repeat(81) }, 'nome'],
    [{ nome: 'Ana', papel: 'ADMINISTRADOR' }, ''],
    [{ nome: 'Ana', email: 'outro@ex.com' }, ''],
  ])('rejeita %o', (corpo, campo) => {
    expect(campos(atualizarPerfilSchema.safeParse(corpo))).toEqual([campo])
  })
})

describe('atualizarFotoSchema', () => {
  it('limita a chave a 300 caracteres e rejeita campos extras', () => {
    expect(atualizarFotoSchema.safeParse({ fotoKey: 'usuarios/a/perfil/b.jpg' }).success).toBe(true)
    expect(atualizarFotoSchema.safeParse({ fotoKey: 'x'.repeat(301) }).success).toBe(false)
    expect(atualizarFotoSchema.safeParse({ fotoKey: 'k', usuarioId: 'x' }).success).toBe(false)
  })
})

describe('alterarSenhaSchema', () => {
  it('nova senha segue a política do cadastro', () => {
    expect(
      campos(alterarSenhaSchema.safeParse({ senhaAtual: 'x', novaSenha: 'semnumero' })),
    ).toEqual(['novaSenha'])
  })

  it('exige a senha atual', () => {
    expect(
      campos(alterarSenhaSchema.safeParse({ senhaAtual: '', novaSenha: 'novaSenha9' })),
    ).toEqual(['senhaAtual'])
  })

  it('formulário: confirmação divergente no campo confirmarSenha', () => {
    const resultado = alterarSenhaFormSchema.safeParse({
      senhaAtual: 'lorde2026',
      novaSenha: 'novaSenha9',
      confirmarSenha: 'novaSenha8',
    })
    expect(campos(resultado)).toEqual(['confirmarSenha'])
  })
})
