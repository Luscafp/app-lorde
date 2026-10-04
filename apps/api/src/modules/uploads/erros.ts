import { HttpStatus } from '@nestjs/common'
import { ErroNegocio } from '../../common/erros/erro-negocio'

export function erroUploadInvalido(): ErroNegocio {
  return new ErroNegocio(
    HttpStatus.UNPROCESSABLE_ENTITY,
    'UPLOAD_INVALIDO',
    'Imagem inválida. Envie a imagem novamente.',
  )
}

export function erroUploadNaoEncontrado(): ErroNegocio {
  return new ErroNegocio(
    HttpStatus.UNPROCESSABLE_ENTITY,
    'UPLOAD_NAO_ENCONTRADO',
    'O envio da imagem não foi concluído. Tente novamente.',
  )
}

/** A causa segue para o log e o Sentry (5xx). */
export function erroArmazenamentoIndisponivel(causa: unknown): ErroNegocio {
  const erro = new ErroNegocio(
    HttpStatus.SERVICE_UNAVAILABLE,
    'ARMAZENAMENTO_INDISPONIVEL',
    'Não foi possível acessar o armazenamento de imagens. Tente novamente.',
  )
  erro.cause = causa
  return erro
}
