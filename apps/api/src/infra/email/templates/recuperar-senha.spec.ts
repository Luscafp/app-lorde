import { renderizar } from './base'
import { recuperarSenha } from './recuperar-senha'

const atletica = { nome: 'Atlética Teste', sigla: 'ATT' }

describe('template recuperar-senha', () => {
  const email = renderizar(recuperarSenha, { atletica, codigo: '048213', validadeMinutos: 15 })

  it('assunto com a sigla da atlética', () => {
    expect(email.assunto).toBe('Seu código para redefinir a senha — ATT')
  })

  it('HTML e texto têm o código, a validade, a sigla e o aviso', () => {
    for (const corpo of [email.html, email.texto]) {
      expect(corpo).toContain('048213')
      expect(corpo).toContain('válido por 15 minutos')
      expect(corpo).toContain('ATT')
      expect(corpo).toContain('Se você não pediu, ignore este e-mail')
    }
  })

  it('não tem "Lorde" fixo nem link', () => {
    const tudo = `${email.assunto}${email.html}${email.texto}`
    expect(tudo).not.toMatch(/lorde/i)
    expect(email.html).not.toMatch(/<a[\s>]/i)
  })
})
