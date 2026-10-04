import { PrismaPg } from '@prisma/adapter-pg'
import { ClsServiceManager } from 'nestjs-cls'
import { PrismaClient, type Prisma } from '../src/generated/prisma/client'
import {
  ContextoAtletica,
  type StoreContexto,
} from '../src/infra/contexto/contexto-atletica.service'
import { extensaoAtletica } from '../src/infra/prisma/extensao-atletica'
import type { TransacaoComEscopo } from '../src/infra/prisma/prisma.service'
import { SenhaService } from '../src/infra/senha/senha.service'
import { semearDemo, SENHA_DEMO } from './seed-demo'
import { ErroSeed, validarEnvSeed, type EnvSeed } from './seed-env'
import { garantirUsuarioComVinculo } from './seed-usuario'

// Cores do protótipo e contato vazio até a decisão em #97.
export const LORDE = {
  slug: 'lorde',
  nome: 'Atlética Lorde',
  sigla: 'LORDE',
  curso: 'Ciência da Computação e Inteligência Artificial',
  corPrimaria: '#E11D48',
  corSecundaria: '#2563EB',
  usaAplicativo: true,
} as const satisfies Prisma.AtleticaCreateInput

// Lista a confirmar em #97; ícones do catálogo `ICONES_MODALIDADE` da #15.
export const MODALIDADES_BASICAS = [
  { nome: 'Futsal', icone: 'soccer' },
  { nome: 'Futebol Society', icone: 'soccer' },
  { nome: 'Vôlei', icone: 'volleyball' },
  { nome: 'Basquete', icone: 'basketball' },
  { nome: 'Handebol', icone: 'handball' },
  { nome: 'Tênis de Mesa', icone: 'table-tennis' },
  { nome: 'Xadrez', icone: 'chess-knight' },
  { nome: 'E-sports', icone: 'gamepad-variant' },
] as const

export interface ResumoSeed {
  atleticaId: string
  adminCriado: boolean
  modalidadesCriadas: number
  demo: boolean
}

/** Seed idempotente (épico #3 §8.5): pode rodar várias vezes sem duplicar nem sobrescrever. */
export async function executarSeed(
  variaveis: Record<string, string | undefined> = process.env,
): Promise<ResumoSeed> {
  const env = validarEnvSeed(variaveis)
  const semEscopo = new PrismaClient({
    adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
  })
  const contexto = new ContextoAtletica(ClsServiceManager.getClsService<StoreContexto>())
  const db = semEscopo.$extends(extensaoAtletica(contexto))
  const senha = new SenhaService()

  try {
    const senhaAdminHash = await senha.hash(env.SEED_ADMIN_SENHA)
    const senhaDemoHash = env.SEED_DEMO ? await senha.hash(SENHA_DEMO) : undefined

    return await db.$transaction(async (tx) => {
      const lorde = await semearLorde(tx)
      return contexto.executarComAtletica(lorde.id, async () => {
        const adminCriado = await semearAdmin(tx, lorde.id, env, senhaAdminHash)
        const modalidades = await semearModalidades(tx)
        if (senhaDemoHash) await semearDemo(tx, lorde.id, modalidades.ids, senhaDemoHash)
        return {
          atleticaId: lorde.id,
          adminCriado,
          modalidadesCriadas: modalidades.criadas,
          demo: senhaDemoHash !== undefined,
        }
      })
    })
  } finally {
    await semEscopo.$disconnect()
  }
}

async function semearLorde(tx: TransacaoComEscopo) {
  const outra = await tx.atletica.findFirst({
    where: { usaAplicativo: true, slug: { not: LORDE.slug } },
    select: { nome: true },
  })
  if (outra) {
    throw new ErroSeed(
      `Seed abortado, nada foi gravado: a atlética "${outra.nome}" também tem usaAplicativo = true. ` +
        'A Lorde deve ser a única atlética que usa o aplicativo.',
    )
  }
  return tx.atletica.upsert({ where: { slug: LORDE.slug }, create: LORDE, update: {} })
}

/** Cria o administrador só se a Lorde ainda não tiver um; nunca altera um usuário existente. */
async function semearAdmin(
  tx: TransacaoComEscopo,
  atleticaId: string,
  env: EnvSeed,
  senhaHash: string,
): Promise<boolean> {
  if (await tx.vinculoAtletica.findFirst({ where: { papel: 'ADMINISTRADOR' } })) return false

  if (await tx.usuario.findUnique({ where: { email: env.SEED_ADMIN_EMAIL } })) {
    throw new ErroSeed(
      'Seed abortado: SEED_ADMIN_EMAIL já pertence a um usuário sem vínculo ADMINISTRADOR ' +
        'na Lorde. Use outro e-mail para o administrador inicial.',
    )
  }
  await garantirUsuarioComVinculo(
    tx,
    atleticaId,
    { email: env.SEED_ADMIN_EMAIL, nome: env.SEED_ADMIN_NOME, papel: 'ADMINISTRADOR' },
    senhaHash,
  )
  return true
}

/**
 * Modalidade já existente (mesmo nome, sem diferenciar maiúsculas) é mantida como está.
 * Sem `upsert`: a unicidade é o índice `lower(nome)`, que o Prisma não aceita como alvo.
 */
async function semearModalidades(tx: TransacaoComEscopo) {
  const ids = new Map<string, string>()
  let criadas = 0
  for (const { nome, icone } of MODALIDADES_BASICAS) {
    let modalidade = await tx.modalidade.findFirst({
      where: { nome: { equals: nome, mode: 'insensitive' } },
    })
    if (!modalidade) {
      modalidade = await tx.modalidade.create({ data: { nome, icone } })
      criadas += 1
    }
    ids.set(nome, modalidade.id)
  }
  return { ids, criadas }
}

if (require.main === module) {
  void executarSeed()
    .then((resumo) => {
      process.stdout.write(
        `Seed concluído: atlética ${resumo.atleticaId}; administrador ` +
          `${resumo.adminCriado ? 'criado' : 'já existente (mantido)'}; ` +
          `${resumo.modalidadesCriadas} modalidade(s) criada(s)` +
          `${resumo.demo ? '; dados de demonstração gravados' : ''}.\n`,
      )
    })
    .catch((erro: unknown) => {
      process.stderr.write(`${erro instanceof Error ? erro.message : String(erro)}\n`)
      process.exitCode = 1
    })
}
