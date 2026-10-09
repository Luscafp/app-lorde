import { renderizar } from './base'
import { verificacaoEmail } from './verificacao-email'

const atletica = { nome: 'Atlética Teste', sigla: 'ATT' }

describe('template verificacao-email', () => {
  const email = renderizar(verificacaoEmail, { atletica, codigo: '048213', validadeHoras: 24 })

  it('assunto com a sigla da atlética', () => {
    expect(email.assunto).toBe('ATT: confirme seu e-mail')
  })

  it('HTML e texto têm o código, a validade, o nome da atlética e o aviso', () => {
    for (const corpo of [email.html, email.texto]) {
      expect(corpo).toContain('048213')
      expect(corpo).toContain('válido por 24 horas')
      expect(corpo).toContain('Atlética Teste')
      expect(corpo).toContain('Se você não criou esta conta, ignore este e-mail.')
    }
  })

  it('não tem "Lorde" fixo nem link', () => {
    const tudo = `${email.assunto}${email.html}${email.texto}`
    expect(tudo).not.toMatch(/lorde/i)
    expect(email.html).not.toMatch(/<a[\s>]/i)
  })
})
