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

export function erroEmailJaCadastrado(): ErroNegocio {
  return new ErroNegocio(
    HttpStatus.CONFLICT,
    'EMAIL_JA_CADASTRADO',
    'Este e-mail já está cadastrado.',
    [{ field: 'email', message: 'Este e-mail já está cadastrado.' }],
  )
}

export function erroTermosDesatualizados(): ErroNegocio {
  return new ErroNegocio(
    HttpStatus.CONFLICT,
    'TERMOS_DESATUALIZADOS',
    'Os Termos de Uso foram atualizados. Leia e aceite a versão vigente.',
  )
}
