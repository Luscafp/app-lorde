import { Injectable } from '@nestjs/common'
import { hash, verify } from '@node-rs/argon2'
import { CONFIG_SENHA } from './senha.config'

const PREFIXO_ATUAL =
  `$argon2id$v=19$m=${CONFIG_SENHA.memoryCost},t=${CONFIG_SENHA.timeCost},` +
  `p=${CONFIG_SENHA.parallelism}$`

/** Hash de senhas com Argon2id (dono: #45; usado pelo seed, #57, #11, #12 e #13). */
@Injectable()
export class SenhaService {
  /** Hash gerado com parâmetros diferentes dos atuais: refazer no próximo login (`needsRehash`). */
  precisaRefazerHash(senhaHash: string): boolean {
    return !senhaHash.startsWith(PREFIXO_ATUAL)
  }

  hash(senha: string): Promise<string> {
    return hash(senha, CONFIG_SENHA)
  }

  /** `false` também para hash malformado: nunca autentica, nem derruba o login. */
  async verificar(senhaHash: string, senha: string): Promise<boolean> {
    try {
      return await verify(senhaHash, senha)
    } catch {
      return false
    }
  }
}
