import { HttpStatus } from '@nestjs/common'
import type { StatusEvento } from '@atletica/shared'
import { ErroNegocio, erroDeCampo, type DetalheErro } from '../../common/erros/erro-negocio'

export function erroEventoNaoEncontrado(): ErroNegocio {
  return new ErroNegocio(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Evento não encontrado.')
}

/** Time inexistente ou de outra atlética, sem revelar qual (convenções §6). */
export function erroTimeInvalido(): ErroNegocio {
  const mensagem = 'Selecione um time da atlética.'
  return erroDeCampo(HttpStatus.UNPROCESSABLE_ENTITY, 'TIME_INVALIDO', 'timeId', mensagem)
}

export function erroTimeInativo(): ErroNegocio {
  const mensagem = 'Este time está inativo.'
  return erroDeCampo(HttpStatus.UNPROCESSABLE_ENTITY, 'TIME_INATIVO', 'timeId', mensagem)
}

export function erroModalidadeInativa(): ErroNegocio {
  const mensagem = 'A modalidade deste time está inativa.'
  return erroDeCampo(HttpStatus.UNPROCESSABLE_ENTITY, 'MODALIDADE_INATIVA', 'timeId', mensagem)
}

export function erroAdversarioInvalido(): ErroNegocio {
  const mensagem = 'Selecione um time ativo de outra atlética.'
  return erroDeCampo(
    HttpStatus.UNPROCESSABLE_ENTITY,
    'ADVERSARIO_INVALIDO',
    'timeAdversarioId',
    mensagem,
  )
}

export function erroModalidadesDiferentes(): ErroNegocio {
  const mensagem = 'O adversário deve ser da mesma modalidade do time.'
  return erroDeCampo(
    HttpStatus.UNPROCESSABLE_ENTITY,
    'MODALIDADES_DIFERENTES',
    'timeAdversarioId',
    mensagem,
  )
}

export function erroAdversarioEmTreino(): ErroNegocio {
  const mensagem = 'Treino não tem adversário.'
  return erroDeCampo(HttpStatus.BAD_REQUEST, 'VALIDATION_ERROR', 'timeAdversarioId', mensagem)
}

export function erroEventoCancelado(
  mensagem = 'Evento cancelado não pode ser editado.',
): ErroNegocio {
  return new ErroNegocio(HttpStatus.UNPROCESSABLE_ENTITY, 'EVENTO_CANCELADO', mensagem)
}

export function erroEventoFinalizado(mensagem: string): ErroNegocio {
  return new ErroNegocio(HttpStatus.UNPROCESSABLE_ENTITY, 'EVENTO_FINALIZADO', mensagem)
}

export function erroEventoJaCancelado(): ErroNegocio {
  return new ErroNegocio(
    HttpStatus.UNPROCESSABLE_ENTITY,
    'EVENTO_JA_CANCELADO',
    'Este evento já está cancelado.',
  )
}

/** Cancelamento a partir de um status que não o permite. */
export function erroCancelamento(status: StatusEvento): ErroNegocio {
  return status === 'FINALIZADO'
    ? erroEventoFinalizado('Evento finalizado não pode ser cancelado.')
    : erroEventoJaCancelado()
}

export function erroEventoComParticipacoes(): ErroNegocio {
  const mensagem = 'O evento já tem respostas do elenco; o time não pode ser trocado.'
  return erroDeCampo(HttpStatus.CONFLICT, 'EVENTO_COM_PARTICIPACOES', 'timeId', mensagem)
}

export function erroEventoComDependencias(details: DetalheErro[]): ErroNegocio {
  return new ErroNegocio(
    HttpStatus.CONFLICT,
    'EVENTO_COM_DEPENDENCIAS',
    'Este evento tem respostas, presenças ou resultado. Cancele-o em vez de excluir.',
    details,
  )
}

/** Fora de `TRANSICOES_STATUS` ou guarda violada; `details` traz `de → para` (épico #21 §7). */
export function erroTransicaoInvalida(
  de: StatusEvento,
  para: StatusEvento,
  motivo = 'Essa mudança de status não é permitida.',
): ErroNegocio {
  return new ErroNegocio(HttpStatus.UNPROCESSABLE_ENTITY, 'TRANSICAO_INVALIDA', motivo, [
    { field: 'status', message: `${de} → ${para} não é permitido` },
  ])
}

/** A atualização condicional não achou o evento no estado lido. */
export function erroConflitoStatus(): ErroNegocio {
  return new ErroNegocio(
    HttpStatus.CONFLICT,
    'CONFLITO_STATUS',
    'O evento foi alterado por outra pessoa. Recarregue e tente novamente.',
  )
}

/** O placar mudou entre a leitura e a gravação. */
export function erroConflitoPlacar(): ErroNegocio {
  return new ErroNegocio(
    HttpStatus.CONFLICT,
    'CONFLITO_CONCORRENTE',
    'O placar foi alterado por outra pessoa. Recarregue e tente novamente.',
  )
}

export function erroEventoNaoFinalizado(): ErroNegocio {
  return new ErroNegocio(
    HttpStatus.UNPROCESSABLE_ENTITY,
    'EVENTO_NAO_FINALIZADO',
    'Finalize o jogo para registrar o resultado.',
  )
}

export function erroSerieSemOcorrencias(): ErroNegocio {
  return erroDeCampo(
    HttpStatus.UNPROCESSABLE_ENTITY,
    'SERIE_SEM_OCORRENCIAS',
    'recorrencia.diasSemana',
    'Nenhuma data corresponde aos dias escolhidos.',
  )
}

export function erroEventoSemSerie(): ErroNegocio {
  return new ErroNegocio(
    HttpStatus.UNPROCESSABLE_ENTITY,
    'EVENTO_SEM_SERIE',
    'Este evento não faz parte de um treino recorrente.',
  )
}

export function erroEventoNaoEJogo(): ErroNegocio {
  return new ErroNegocio(
    HttpStatus.UNPROCESSABLE_ENTITY,
    'EVENTO_NAO_E_JOGO',
    'Treino não tem placar.',
  )
}
