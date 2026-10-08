import type { Papel } from '@atletica/shared'

/** Todo payload tem `autorId` (`null` = sistema) e `atleticaId` quando aplicável (§11.8). */
export interface PayloadBase {
  atleticaId?: string
  autorId: string | null
}

/** Valores de `Sessao.motivoRevogacao` (convenções §11.2). */
export type MotivoRevogacao =
  | 'LOGOUT'
  | 'TROCA_SENHA'
  | 'RECUPERACAO_SENHA'
  | 'CONTA_DESATIVADA'
  | 'CONTA_EXCLUIDA'
  | 'REUSO_REFRESH'

/** Nome → payload dos eventos de domínio (convenções §8); cada issue emissora acrescenta o seu. */
export interface EventosDominio {
  /** #57; ouvido pela #31 (e-mail de verificação). */
  'usuario.cadastrado': PayloadBase & { usuarioId: string; atleticaId: string; autorId: string }
  /** #58 e quem usa `SessaoService.revogarTodas`; `sessaoIds` nunca vazio (§11.8). Ouvido pela #87. */
  'usuario.sessaoEncerrada': PayloadBase & {
    usuarioId: string
    sessaoIds: string[]
    motivo: MotivoRevogacao
  }
  /** #28, um por vínculo alterado; ouvido pela #89 (push de cargo, RN35). */
  'usuario.papelAlterado': PayloadBase & {
    atleticaId: string
    usuarioId: string
    papelAnterior: Papel
    papelNovo: Papel
    autorId: string
  }
  /** #68; `autorId` = solicitante. Ouvido pela #89 (push para a Diretoria). */
  'solicitacao.criada': PayloadBase & {
    atleticaId: string
    solicitacaoId: string
    timeId: string
    autorId: string
  }
  /** #69; `usuarioId` = solicitante, `autorId` = Diretor. Ouvido pela #89 (push ao solicitante). */
  'solicitacao.avaliada': PayloadBase & {
    atleticaId: string
    solicitacaoId: string
    timeId: string
    usuarioId: string
    status: StatusAvaliacao
    autorId: string
  }
  /** #80, só na primeira publicação; `autorId` = quem publicou. Ouvido pela #89 (push de notícia). */
  'noticia.publicada': PayloadBase & { atleticaId: string; noticiaId: string; autorId: string }
  /** Em série, `eventoId` é a 1ª ocorrência. */
  'evento.criado': PayloadBase & {
    atleticaId: string
    eventoId: string
    timeId: string
    serieId?: string
    autorId: string
  }
  /** Só notifica o elenco se `campos` tiver `inicio` ou `local`. */
  'evento.alterado': PayloadBase & {
    atleticaId: string
    eventoIds: string[]
    timeId: string
    campos: CampoAlteradoEvento[]
    autorId: string
  }
  /** Um por operação, com todos os ids cancelados. */
  'evento.cancelado': PayloadBase & {
    atleticaId: string
    eventoIds: string[]
    timeId: string
    autorId: string
  }
  /** #73, só no primeiro registro do placar (não na correção). */
  'evento.resultadoRegistrado': PayloadBase & {
    atleticaId: string
    eventoId: string
    autorId: string
  }
}

export type CampoAlteradoEvento = 'inicio' | 'local' | 'status'

export type StatusAvaliacao = 'APROVADA' | 'REJEITADA'

export type NomeEventoDominio = keyof EventosDominio
