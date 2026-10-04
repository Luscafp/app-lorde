/** Todo payload tem `autorId` (`null` = sistema) e `atleticaId` quando aplicável (§11.8). */
export interface PayloadBase {
  atleticaId?: string
  autorId: string | null
}

/**
 * Nome → payload dos eventos de domínio (convenções §8). Cada issue emissora acrescenta o seu:
 * `'evento.criado': PayloadBase & { atleticaId: string; eventoId: string; ... }`.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- preenchida pelas emissoras
export interface EventosDominio {}

export type NomeEventoDominio = keyof EventosDominio
