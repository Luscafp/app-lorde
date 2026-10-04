import { HttpStatus } from '@nestjs/common'
import { ErroNegocio } from '../../common/erros/erro-negocio'

export function erroNaoAutenticado(): ErroNegocio {
  return new ErroNegocio(
    HttpStatus.UNAUTHORIZED,
    'UNAUTHENTICATED',
    'Sessão inválida. Entre novamente.',
  )
}

export function erroTokenExpirado(): ErroNegocio {
  return new ErroNegocio(HttpStatus.UNAUTHORIZED, 'TOKEN_EXPIRED', 'Sessão expirada.')
}

/** No login, com o nome da atlética (RN36); no guard, sem ele. */
export function erroContaDesativada(nomeAtletica?: string): ErroNegocio {
  const diretoria = nomeAtletica ? `a diretoria da ${nomeAtletica}` : 'a diretoria'
  return new ErroNegocio(
    HttpStatus.UNAUTHORIZED,
    'CONTA_DESATIVADA',
    `Sua conta está desativada. Procure ${diretoria}.`,
  )
}

export function erroSemPermissao(): ErroNegocio {
  return new ErroNegocio(
    HttpStatus.FORBIDDEN,
    'FORBIDDEN',
    'Você não tem permissão para esta ação.',
  )
}

/** Mesma resposta para e-mail inexistente e senha errada (UC07 A1). */
export function erroCredenciaisInvalidas(ultimaTentativa = false): ErroNegocio {
  return new ErroNegocio(
    HttpStatus.UNAUTHORIZED,
    'CREDENCIAIS_INVALIDAS',
    ultimaTentativa
      ? 'E-mail ou senha incorretos. Última tentativa antes do bloqueio.'
      : 'E-mail ou senha incorretos.',
  )
}

const EMAIL_JA_CADASTRADO = 'Este e-mail já está cadastrado.'

export function erroEmailJaCadastrado(): ErroNegocio {
  return new ErroNegocio(HttpStatus.CONFLICT, 'EMAIL_JA_CADASTRADO', EMAIL_JA_CADASTRADO, [
    { field: 'email', message: EMAIL_JA_CADASTRADO },
  ])
}

/** Formato inválido, sessão inexistente ou expirada (convenções §11.2). */
export function erroRefreshInvalido(): ErroNegocio {
  return new ErroNegocio(
    HttpStatus.UNAUTHORIZED,
    'REFRESH_INVALIDO',
    'Sessão inválida. Entre novamente.',
  )
}

/** Sessão revogada, inclusive por reuso do refresh token. */
export function erroSessaoRevogada(): ErroNegocio {
  return new ErroNegocio(
    HttpStatus.UNAUTHORIZED,
    'SESSAO_REVOGADA',
    'Sua sessão foi encerrada. Entre novamente.',
  )
}

/** Token anterior reapresentado dentro da janela de concorrência; a sessão continua ativa. */
export function erroRefreshJaRotacionado(): ErroNegocio {
  return new ErroNegocio(
    HttpStatus.UNAUTHORIZED,
    'REFRESH_JA_ROTACIONADO',
    'Esta sessão acabou de ser renovada.',
  )
}

export function erroTermosDesatualizados(): ErroNegocio {
  return new ErroNegocio(
    HttpStatus.CONFLICT,
    'TERMOS_DESATUALIZADOS',
    'Os Termos de Uso foram atualizados. Leia e aceite a versão vigente.',
  )
}

/** Código errado, expirado, usado, substituído ou e-mail sem código: mesma resposta (UC09 A1). */
export function erroCodigoInvalido(): ErroNegocio {
  return new ErroNegocio(HttpStatus.BAD_REQUEST, 'CODIGO_INVALIDO', 'Código inválido ou expirado.')
}
