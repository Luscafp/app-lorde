import { TERMOS_VERSAO } from '../legal'
import {
  cadastroFormSchema,
  cadastroSchema,
  emailSchema,
  loginSchema,
  nomeSchema,
  senhaSchema,
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
