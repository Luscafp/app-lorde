import type { Papel, Usuario, VinculoAtletica } from '../../src/generated/prisma/client'
import { prismaTeste } from '../setup/prisma-teste'
import { criarAtletica } from './atletica'
import { proximaSequencia } from './sequencia'

/**
 * Hash fictício: não corresponde a nenhuma senha. Quem precisa de login real (#57) passa
 * `senhaHash` gerado pelo `SenhaService` (#45).
 */
export const SENHA_HASH_FICTICIO = '$argon2id$v=19$m=19456,t=2,p=1$ZmljdGljaW8$ZmljdGljaW8'

export interface DadosUsuario {
  papel?: Papel
  /** Atlética do vínculo; sem ela, cria uma atlética que usa o aplicativo. */
  atleticaId?: string
  nome?: string
  /** Gravado em minúsculas (RN01, `CHECK usuario_email_minusculo`). */
  email?: string
  /** `Usuario.ativo` (conta). */
  ativo?: boolean
  /** `VinculoAtletica.ativo` (vínculo com a atlética). */
  vinculoAtivo?: boolean
  senhaHash?: string
}

export type UsuarioCriado = Usuario & { atleticaId: string; vinculo: VinculoAtletica }

/** Cria um `Usuario` com e-mail único e o `VinculoAtletica` com o papel (padrão `ATLETA`). */
export async function criarUsuario(dados: DadosUsuario = {}): Promise<UsuarioCriado> {
  const n = proximaSequencia()
  const atleticaId = dados.atleticaId ?? (await criarAtletica()).id

  const { vinculos, ...usuario } = await prismaTeste.usuario.create({
    data: {
      nome: dados.nome ?? `Usuário ${n}`,
      email: (dados.email ?? `usuario${n}@teste.local`).toLowerCase(),
      senhaHash: dados.senhaHash ?? SENHA_HASH_FICTICIO,
      ativo: dados.ativo ?? true,
      vinculos: {
        create: { atleticaId, papel: dados.papel ?? 'ATLETA', ativo: dados.vinculoAtivo ?? true },
      },
    },
    include: { vinculos: true },
  })
  const [vinculo] = vinculos
  if (!vinculo) throw new Error('criarUsuario: vínculo não criado')
  return { ...usuario, atleticaId, vinculo }
}
