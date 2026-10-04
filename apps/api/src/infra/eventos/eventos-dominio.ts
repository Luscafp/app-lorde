/** Todo payload tem `autorId` (`null` = sistema) e `atleticaId` quando aplicável (§11.8). */
export interface PayloadBase {
  atleticaId?: string
  autorId: string | null
}

/** Nome → payload dos eventos de domínio (convenções §8); cada issue emissora acrescenta o seu. */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- preenchida pelas emissoras
export interface EventosDominio {}

export type NomeEventoDominio = keyof EventosDominio
