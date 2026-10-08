/**
 * Nome → payload das filas do pg-boss (convenções §2: `dominio.acao-kebab`); cada issue acrescenta
 * as suas (#87, #90). Payload com `atleticaId` roda o handler no contexto dessa atlética.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- preenchida pelas issues consumidoras
export interface FilasDominio {}

export type NomeFila = Extract<keyof FilasDominio, string>
