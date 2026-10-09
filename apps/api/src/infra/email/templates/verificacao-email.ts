import { escaparHtml, type DadosEmail, type TemplateEmail } from './base'

export interface DadosVerificacaoEmail extends DadosEmail {
  codigo: string
  validadeHoras: number
}

const AVISO = 'Se você não criou esta conta, ignore este e-mail.'

/** #31: só o código, sem link clicável. */
export const verificacaoEmail: TemplateEmail<DadosVerificacaoEmail> = {
  assunto: ({ atletica }) => `${atletica.sigla}: confirme seu e-mail`,
  html: ({ codigo, validadeHoras }) =>
    `<p>Use o código abaixo no aplicativo para confirmar o seu e-mail:</p>
<p style="font-size:32px;font-weight:bold;letter-spacing:8px;margin:24px 0;">${escaparHtml(codigo)}</p>
<p>O código é válido por ${validadeHoras} horas.</p>
<p style="color:#6b7280;">${escaparHtml(AVISO)}</p>`,
  texto: ({ codigo, validadeHoras }) =>
    `Use o código abaixo no aplicativo para confirmar o seu e-mail:\n\n${codigo}\n\nO código é válido por ${validadeHoras} horas.\n\n${AVISO}`,
}
