import { siglaOuNome } from '@atletica/shared'

/** Identidade da atlética no e-mail, sempre lida de `Atletica` (RNF20: nada fixo no código). */
export interface AtleticaEmail {
  nome: string
  sigla: string
  /** Hex `#RRGGBB`; ausente ou inválida → cinza neutro (convenções §10.8). */
  corPrimaria?: string | null
}

export function atleticaEmail({
  nome,
  sigla,
  corPrimaria,
}: Omit<AtleticaEmail, 'sigla'> & { sigla: string | null }): AtleticaEmail {
  return { nome, sigla: siglaOuNome({ nome, sigla }), corPrimaria }
}

/** Dados de qualquer template: os campos próprios + a atlética remetente. */
export interface DadosEmail {
  atletica: AtleticaEmail
}

/**
 * Template específico (ex.: `recuperar-senha` na #62, `verificacao-email` na #31).
 * `html` devolve só o miolo — já escapado com `escaparHtml` —, que o layout base envolve.
 */
export interface TemplateEmail<D extends DadosEmail> {
  assunto(dados: D): string
  html(dados: D): string
  texto(dados: D): string
}

export interface EmailRenderizado {
  assunto: string
  html: string
  texto: string
}

const COR_PADRAO = '#6B7280'
const COR_HEX = /^#[0-9a-f]{6}$/i

const ENTIDADES_HTML: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

/** Escapa texto para HTML. Todo dado interpolado num template passa por aqui. */
export function escaparHtml(texto: string): string {
  return texto.replace(/[&<>"']/g, (caractere) => ENTIDADES_HTML[caractere] ?? caractere)
}

/**
 * Monta assunto, HTML e texto de um template dentro do layout base. Uso:
 * `emailService.enviar({ para, ...renderizar(template, { atletica, ...dados }) })`.
 */
export function renderizar<D extends DadosEmail>(
  template: TemplateEmail<D>,
  dados: D,
): EmailRenderizado {
  const assunto = template.assunto(dados)
  return {
    assunto,
    html: layoutHtml(dados.atletica, assunto, template.html(dados)),
    texto: layoutTexto(dados.atletica, template.texto(dados)),
  }
}

function rodape(atletica: AtleticaEmail): string {
  return `Você recebeu este e-mail porque tem uma conta no aplicativo da ${atletica.nome}. Esta é uma mensagem automática; não responda.`
}

function layoutTexto(atletica: AtleticaEmail, conteudo: string): string {
  return `${atletica.nome} (${atletica.sigla})\n\n${conteudo.trim()}\n\n--\n${rodape(atletica)}\n`
}

/** HTML simples com tabelas e estilos inline (compatível com clientes de e-mail). */
function layoutHtml(atletica: AtleticaEmail, assunto: string, conteudo: string): string {
  const cor =
    atletica.corPrimaria && COR_HEX.test(atletica.corPrimaria) ? atletica.corPrimaria : COR_PADRAO
  const nome = escaparHtml(atletica.nome)
  const sigla = escaparHtml(atletica.sigla)
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escaparHtml(assunto)}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#111827;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:8px;overflow:hidden;">
<tr><td style="background:${cor};color:#ffffff;padding:20px 24px;font-size:20px;font-weight:bold;">${sigla}<div style="font-size:14px;font-weight:normal;">${nome}</div></td></tr>
<tr><td style="padding:24px;font-size:16px;line-height:1.5;">${conteudo}</td></tr>
<tr><td style="padding:16px 24px;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280;">${escaparHtml(rodape(atletica))}</td></tr>
</table>
</td></tr>
</table>
</body>
</html>
`
}
