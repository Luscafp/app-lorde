import { escaparHtml, renderizar, type DadosEmail, type TemplateEmail } from './base'

interface DadosExemplo extends DadosEmail {
  codigo: string
}

const exemplo: TemplateEmail<DadosExemplo> = {
  assunto: ({ atletica }) => `Seu código — ${atletica.sigla}`,
  html: ({ codigo }) => `<p>Código: <strong>${escaparHtml(codigo)}</strong></p>`,
  texto: ({ codigo }) => `Código: ${codigo}`,
}

const atletica = { nome: 'Atlética Teste', sigla: 'ATT' }

describe('renderizar (template base)', () => {
  const email = renderizar(exemplo, { atletica, codigo: '048213' })

  it('monta o assunto pelo template', () => {
    expect(email.assunto).toBe('Seu código — ATT')
  })

  it('HTML e texto contêm o nome da atlética e o conteúdo do template', () => {
    for (const corpo of [email.html, email.texto]) {
      expect(corpo).toContain('Atlética Teste')
      expect(corpo).toContain('ATT')
      expect(corpo).toContain('048213')
    }
    expect(email.html).toContain('<strong>048213</strong>')
    expect(email.html).toMatch(/^<!doctype html>/)
  })

  it('não tem "Lorde" fixo', () => {
    expect(`${email.assunto}${email.html}${email.texto}`).not.toMatch(/lorde/i)
  })

  it('texto não tem marcação HTML', () => {
    expect(email.texto).not.toMatch(/<[a-z]/i)
  })

  it('escapa nome e sigla da atlética no HTML', () => {
    const { html } = renderizar(exemplo, {
      atletica: { nome: 'A&B <script>', sigla: '"X"' },
      codigo: '1',
    })
    expect(html).toContain('A&amp;B &lt;script&gt;')
    expect(html).toContain('&quot;X&quot;')
    expect(html).not.toContain('<script>')
  })

  it('usa a cor primária válida e cai no cinza padrão quando inválida ou ausente', () => {
    const comCor = renderizar(exemplo, {
      atletica: { ...atletica, corPrimaria: '#123ABC' },
      codigo: '1',
    })
    expect(comCor.html).toContain('background:#123ABC')

    const invalida = renderizar(exemplo, {
      atletica: { ...atletica, corPrimaria: 'red;background:url(x)' },
      codigo: '1',
    })
    expect(invalida.html).toContain('background:#6B7280')
    expect(invalida.html).not.toContain('url(x)')
    expect(email.html).toContain('background:#6B7280')
  })
})

describe('escaparHtml', () => {
  it('escapa & < > " e apóstrofo', () => {
    expect(escaparHtml(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&#39;')
  })
})
