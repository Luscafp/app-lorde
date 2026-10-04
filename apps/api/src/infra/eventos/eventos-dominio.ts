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
}

export type NomeEventoDominio = keyof EventosDominio
