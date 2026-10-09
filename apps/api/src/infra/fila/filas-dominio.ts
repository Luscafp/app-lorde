/** Nome (`dominio.acao-kebab`, convenções §2) → payload; cada issue acrescenta as suas filas. */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- preenchida pelas issues consumidoras
export interface FilasDominio {}

export type NomeFila = Extract<keyof FilasDominio, string>
