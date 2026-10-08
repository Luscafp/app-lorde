import { LIMITE_BANNERS_ATIVOS } from '@atletica/shared'
import { HttpStatus } from '@nestjs/common'
import { ErroNegocio } from '../../common/erros/erro-negocio'

/** Inexistente e de outra atlética respondem igual (convenções §6). */
export function erroBannerNaoEncontrado(): ErroNegocio {
  return new ErroNegocio(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Banner não encontrado.')
}

export function erroLimiteBannersAtivos(): ErroNegocio {
  const mensagem = `Já existem ${LIMITE_BANNERS_ATIVOS} banners ativos. Desative um antes.`
  return new ErroNegocio(HttpStatus.CONFLICT, 'LIMITE_BANNERS_ATIVOS', mensagem, [
    { field: 'ativo', message: mensagem },
  ])
}

export function erroOrdemIncompleta(): ErroNegocio {
  const mensagem = 'A lista deve conter todos os banners, sem repetição.'
  return new ErroNegocio(HttpStatus.BAD_REQUEST, 'ORDEM_INCOMPLETA', mensagem, [
    { field: 'ids', message: mensagem },
  ])
}
