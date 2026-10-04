import type { Algorithm, Options } from '@node-rs/argon2'

// `Algorithm` é um const enum ambiente: com `isolatedModules` só pode ser usado como tipo.
const ARGON2ID: Algorithm.Argon2id = 2

/** Parâmetros do Argon2id (convenções §5). */
export const CONFIG_SENHA = {
  algorithm: ARGON2ID,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const satisfies Options
