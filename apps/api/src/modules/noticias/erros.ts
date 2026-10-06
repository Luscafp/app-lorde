import { CAPA_OBRIGATORIA, CONTEUDO_OBRIGATORIO } from '@atletica/shared'
import { HttpStatus } from '@nestjs/common'
import { ErroNegocio } from '../../common/erros/erro-negocio'

/** Inexistente, rascunho, excluída e de outra atlética respondem igual (RN24, convenções §6). */
export function erroNoticiaNaoEncontrada(): ErroNegocio {
  return new ErroNegocio(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Notícia não encontrada.')
}

export function erroCapaObrigatoria(): ErroNegocio {
  return new ErroNegocio(HttpStatus.UNPROCESSABLE_ENTITY, 'CAPA_OBRIGATORIA', CAPA_OBRIGATORIA, [
    { field: 'imagemCapaKey', message: CAPA_OBRIGATORIA },
  ])
}

export function erroConteudoObrigatorio(): ErroNegocio {
  return new ErroNegocio(
    HttpStatus.UNPROCESSABLE_ENTITY,
    'CONTEUDO_OBRIGATORIO',
    CONTEUDO_OBRIGATORIO,
    [{ field: 'conteudo', message: CONTEUDO_OBRIGATORIO }],
  )
}
