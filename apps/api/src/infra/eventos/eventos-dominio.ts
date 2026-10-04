/** Todo payload tem `autorId` (`null` = sistema) e `atleticaId` quando aplicável (§11.8). */
export interface PayloadBase {
  atleticaId?: string
  autorId: string | null
}

/** Nome → payload dos eventos de domínio (convenções §8); cada issue emissora acrescenta o seu. */
export interface EventosDominio {
  /** #57; ouvido pela #31 (e-mail de verificação). */
  'usuario.cadastrado': PayloadBase & { usuarioId: string; atleticaId: string; autorId: string }
}

export type NomeEventoDominio = keyof EventosDominio
