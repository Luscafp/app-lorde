import { escaparHtml, type DadosEmail, type TemplateEmail } from './base'

export interface DadosRecuperarSenha extends DadosEmail {
  codigo: string
  validadeMinutos: number
}

const AVISO = 'Se você não pediu, ignore este e-mail; sua senha continua a mesma.'

/** Épico #11 §7.4: só o código, sem link clicável. */
export const recuperarSenha: TemplateEmail<DadosRecuperarSenha> = {
  assunto: ({ atletica }) => `Seu código para redefinir a senha — ${atletica.sigla}`,
  html: ({ codigo, validadeMinutos }) =>
    `<p>Use o código abaixo para redefinir a sua senha:</p>
<p style="font-size:32px;font-weight:bold;letter-spacing:8px;margin:24px 0;">${escaparHtml(codigo)}</p>
<p>O código é válido por ${validadeMinutos} minutos.</p>
<p style="color:#6b7280;">${escaparHtml(AVISO)}</p>`,
  texto: ({ codigo, validadeMinutos }) =>
    `Use o código abaixo para redefinir a sua senha:\n\n${codigo}\n\nO código é válido por ${validadeMinutos} minutos.\n\n${AVISO}`,
}
