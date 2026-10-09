import { TERMOS_VERSAO } from '../legal'
import {
  cadastroFormSchema,
  cadastroSchema,
  emailSchema,
  esqueciSenhaSchema,
  loginSchema,
  nomeSchema,
  novaSenhaFormSchema,
  redefinirSenhaSchema,
  refreshTokenSchema,
  senhaSchema,
  verificarCodigoSchema,
  verificarEmailSchema,
} from './schemas'

function mensagens(resultado: { error?: { issues: { message: string }[] } }): string[] {
  return resultado.error?.issues.map(({ message }) => message) ?? []
}

function campos(resultado: { error?: { issues: { path: PropertyKey[] }[] } }): string[] {
  return resultado.error?.issues.map(({ path }) => path.join('.')) ?? []
}

describe('senhaSchema', () => {
  it.each(['lorde2026', 'Árvore123', 'a1234567', 'x'.repeat(127) + '1'])('aceita %s', (senha) => {
    expect(senhaSchema.safeParse(senha).success).toBe(true)
  })

  it.each([
    ['sem número', 'abcdefgh', 'A senha deve ter ao menos um número.'],
    ['sem letra', '12345678', 'A senha deve ter ao menos uma letra.'],
    ['7 caracteres', 'abc1234', 'A senha deve ter ao menos 8 caracteres.'],
    ['129 caracteres', 'a'.repeat(128) + '1', 'A senha deve ter no máximo 128 caracteres.'],
  ])('rejeita senha %s', (_caso, senha, mensagem) => {
    expect(mensagens(senhaSchema.safeParse(senha))).toContain(mensagem)
  })
})

/** E-mail válido com `tamanho` caracteres (parte local de 64, rótulos de domínio de 60). */
function emailCom(tamanho: number): string {
  const dominio = `${'b'.repeat(60)}.`.repeat(3) + 'c'.repeat(tamanho - 65 - 183)
  return `${'a'.repeat(64)}@${dominio}`
}

describe('emailSchema', () => {
  it('normaliza espaços e caixa', () => {
    expect(emailSchema.parse('  Ana@Ex.COM ')).toBe('ana@ex.com')
  })

  it('aceita 254 caracteres', () => {
    expect(emailSchema.safeParse(emailCom(254)).success).toBe(true)
  })

  it.each([
    ['sem domínio', 'ana@', 'Informe um e-mail válido.'],
    ['vazio', '   ', 'Informe um e-mail válido.'],
    ['255 caracteres', emailCom(255), 'O e-mail deve ter no máximo 254 caracteres.'],
  ])('rejeita %s', (_caso, email, mensagem) => {
    expect(mensagens(emailSchema.safeParse(email))).toContain(mensagem)
  })
})

describe('nomeSchema', () => {
  it('remove espaços das pontas', () => {
    expect(nomeSchema.parse('  Ana Souza ')).toBe('Ana Souza')
  })

  it.each([
    ['só espaços', '     ', 'O nome deve ter ao menos 2 caracteres.'],
    ['1 caractere', 'A', 'O nome deve ter ao menos 2 caracteres.'],
    ['81 caracteres', 'a'.repeat(81), 'O nome deve ter no máximo 80 caracteres.'],
  ])('rejeita %s', (_caso, nome, mensagem) => {
    expect(mensagens(nomeSchema.safeParse(nome))).toContain(mensagem)
  })
})

describe('loginSchema', () => {
  it('normaliza o e-mail e não aplica a política de senha', () => {
    expect(loginSchema.parse({ email: ' Ana@Ex.com', senha: 'antiga' })).toEqual({
      email: 'ana@ex.com',
      senha: 'antiga',
    })
  })

  it('rejeita senha vazia e campos desconhecidos', () => {
    const resultado = loginSchema.safeParse({ email: 'ana@ex.com', senha: '', lembrar: true })
    expect(campos(resultado).sort()).toEqual(['', 'senha'])
  })
})

describe('cadastroSchema', () => {
  const valido = {
    nome: 'Ana Souza',
    email: '  Ana@Ex.com ',
    senha: 'lorde2026',
    aceiteTermos: true,
    versaoTermos: TERMOS_VERSAO,
  }

  it('aceita e normaliza', () => {
    expect(cadastroSchema.parse(valido)).toEqual({ ...valido, email: 'ana@ex.com' })
  })

  it('senha sem número → erro no campo senha', () => {
    expect(campos(cadastroSchema.safeParse({ ...valido, senha: 'abcdefgh' }))).toEqual(['senha'])
  })

  it('aceiteTermos false → erro no campo aceiteTermos', () => {
    const resultado = cadastroSchema.safeParse({ ...valido, aceiteTermos: false })
    expect(campos(resultado)).toEqual(['aceiteTermos'])
    expect(mensagens(resultado)).toEqual(['Aceite os Termos de Uso e a Política de Privacidade.'])
  })

  it('rejeita campo extra (mass assignment)', () => {
    expect(cadastroSchema.safeParse({ ...valido, papel: 'ADMINISTRADOR' }).success).toBe(false)
  })

  it('não confere a versão dos termos (a API responde 409)', () => {
    expect(cadastroSchema.safeParse({ ...valido, versaoTermos: '2000-01-01' }).success).toBe(true)
  })
})

describe('cadastroFormSchema', () => {
  const valido = {
    nome: 'Ana Souza',
    email: 'ana@ex.com',
    senha: 'lorde2026',
    confirmarSenha: 'lorde2026',
    aceiteTermos: true,
  }

  it('aceita sem versaoTermos (o app a acrescenta no envio)', () => {
    expect(cadastroFormSchema.safeParse(valido).success).toBe(true)
  })

  it('confirmação diferente → erro em confirmarSenha', () => {
    const resultado = cadastroFormSchema.safeParse({ ...valido, confirmarSenha: 'lorde2027' })
    expect(campos(resultado)).toEqual(['confirmarSenha'])
    expect(mensagens(resultado)).toEqual(['As senhas não conferem.'])
  })
})

describe('refreshTokenSchema', () => {
  it.each(['malformado', '', 'a'.repeat(500)])(
    'aceita qualquer texto (%#); o formato é conferido na API',
    (refreshToken) => {
      expect(refreshTokenSchema.safeParse({ refreshToken }).success).toBe(true)
    },
  )

  it.each([
    ['ausente', {}],
    ['com campo desconhecido', { refreshToken: 'a.b', usuarioId: 'x' }],
  ])('rejeita corpo %s', (_caso, corpo) => {
    expect(refreshTokenSchema.safeParse(corpo).success).toBe(false)
  })
})

describe('esqueciSenhaSchema', () => {
  it('normaliza o e-mail', () => {
    expect(esqueciSenhaSchema.parse({ email: ' ANA@ex.com ' })).toEqual({ email: 'ana@ex.com' })
  })

  it('rejeita campo desconhecido', () => {
    expect(esqueciSenhaSchema.safeParse({ email: 'ana@ex.com', x: 1 }).success).toBe(false)
  })
})

describe('verificarCodigoSchema', () => {
  it.each(['048213', '000000', '999999'])('aceita %s', (codigo) => {
    expect(verificarCodigoSchema.safeParse({ email: 'ana@ex.com', codigo }).success).toBe(true)
  })

  it.each(['48213', '0482130', '04821a', ' 048213', '０４８２１３'])('rejeita %p', (codigo) => {
    const resultado = verificarCodigoSchema.safeParse({ email: 'ana@ex.com', codigo })
    expect(campos(resultado)).toEqual(['codigo'])
    expect(mensagens(resultado)).toEqual(['Informe os 6 dígitos do código.'])
  })

  it('rejeita campo desconhecido', () => {
    const corpo = { email: 'ana@ex.com', codigo: '048213', novaSenha: 'lorde2026' }
    expect(verificarCodigoSchema.safeParse(corpo).success).toBe(false)
  })
})

describe('verificarEmailSchema', () => {
  it('aceita só o código', () => {
    expect(verificarEmailSchema.safeParse({ codigo: '000123' }).success).toBe(true)
  })

  it('rejeita formato inválido com a mensagem do código', () => {
    const resultado = verificarEmailSchema.safeParse({ codigo: '12345' })
    expect(campos(resultado)).toEqual(['codigo'])
    expect(mensagens(resultado)).toEqual(['Informe os 6 dígitos do código.'])
  })

  it('rejeita campo desconhecido', () => {
    expect(verificarEmailSchema.safeParse({ codigo: '000123', email: 'a@ex.com' }).success).toBe(
      false,
    )
  })
})

describe('redefinirSenhaSchema', () => {
  const valido = { email: 'ana@ex.com', codigo: '048213', novaSenha: 'novaSenha9' }

  it('aceita', () => {
    expect(redefinirSenhaSchema.parse(valido)).toEqual(valido)
  })

  it('senha fraca → erro em novaSenha', () => {
    const resultado = redefinirSenhaSchema.safeParse({ ...valido, novaSenha: 'abcdefgh' })
    expect(campos(resultado)).toEqual(['novaSenha'])
  })

  it('rejeita campo desconhecido', () => {
    expect(redefinirSenhaSchema.safeParse({ ...valido, usuarioId: 'x' }).success).toBe(false)
  })
})

describe('novaSenhaFormSchema', () => {
  it('confirmação diferente → erro em confirmarSenha', () => {
    const resultado = novaSenhaFormSchema.safeParse({
      novaSenha: 'novaSenha9',
      confirmarSenha: 'novaSenha8',
    })
    expect(campos(resultado)).toEqual(['confirmarSenha'])
  })
})
