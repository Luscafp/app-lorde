import { criarClientesSeed } from '../../apps/api/prisma/seed-cliente'
import type { Resultado } from '../../apps/api/src/generated/prisma/client'
import type { TransacaoComEscopo } from '../../apps/api/src/infra/prisma/prisma.service'
import { SenhaService } from '../../apps/api/src/infra/senha/senha.service'
import { senhaSchema } from '../../packages/shared/src/auth/schemas'
import {
  emailCarga,
  ErroCarga,
  executarComoScript,
  FILTRO_EMAIL_CARGA,
  MASSA,
  nomeAdversarioCarga,
  nomeTimeCarga,
  nomeUsuarioCarga,
  PREFIXO_CARGA,
  SLUG_ADVERSARIA_CARGA,
  tituloNoticiaCarga,
  validarAmbienteDeCarga,
  type EnvCarga,
  type ResumoMassaCarga,
} from './massa-carga'

const DIA_MS = 24 * 60 * 60 * 1000
const EVENTOS_FUTUROS_POR_TIME = 20
const JOGOS_FINALIZADOS_POR_TIME = MASSA.eventosPorTime - EVENTOS_FUTUROS_POR_TIME

/** Idempotente: completa o que falta e regrava a senha com `CARGA_SENHA`. */
export async function executarSeedCarga(env: EnvCarga = process.env): Promise<ResumoMassaCarga> {
  const databaseUrl = validarAmbienteDeCarga(env)
  const senha = senhaSchema.safeParse(env.CARGA_SENHA)
  if (!senha.success) {
    throw new ErroCarga(
      'CARGA_SENHA obrigatória, na política de senha do UC06: 8 a 128 caracteres, ' +
        'ao menos uma letra e um número.',
    )
  }
  const senhaHash = await new SenhaService().hash(senha.data)
  const { semEscopo, contexto, db } = criarClientesSeed(databaseUrl)

  try {
    return await db.$transaction(
      async (tx) => {
        const atleticaId = await buscarAtleticaPadrao(tx)
        return contexto.executarComAtletica(atleticaId, () =>
          semearMassa(tx, atleticaId, senhaHash),
        )
      },
      { timeout: 120_000 },
    )
  } finally {
    await semEscopo.$disconnect()
  }
}

async function buscarAtleticaPadrao(tx: TransacaoComEscopo): Promise<string> {
  const atleticas = await tx.atletica.findMany({ where: { usaAplicativo: true }, take: 2 })
  const [atletica] = atleticas
  if (!atletica || atleticas.length > 1) {
    throw new ErroCarga(
      'É preciso exatamente uma atlética com usaAplicativo = true: rode antes o seed ' +
        '(pnpm --filter api prisma:seed).',
    )
  }
  return atletica.id
}

async function semearMassa(
  tx: TransacaoComEscopo,
  atleticaId: string,
  senhaHash: string,
): Promise<ResumoMassaCarga> {
  const modalidadeIds = (
    await tx.modalidade.findMany({ where: { ativa: true }, orderBy: { nome: 'asc' } })
  ).map(({ id }) => id)
  if (modalidadeIds.length === 0) {
    throw new ErroCarga(
      'Nenhuma modalidade ativa: rode antes o seed (pnpm --filter api prisma:seed).',
    )
  }

  const usuarioIds = await semearUsuarios(tx, atleticaId, senhaHash)
  const times = await semearTimes(tx, atleticaId, modalidadeIds)
  const adversarios = await semearAdversarios(tx, modalidadeIds)
  await semearElenco(tx, atleticaId, times, usuarioIds)
  const [autorId] = usuarioIds
  if (!autorId) throw new ErroCarga('Usuários de carga não criados.')
  await semearEventos(tx, atleticaId, times, adversarios, autorId)
  await semearNoticias(tx, atleticaId, autorId)

  const timeIds = times.map(({ id }) => id)
  const [usuarios, eventos, noticias] = await Promise.all([
    tx.usuario.count({ where: { email: FILTRO_EMAIL_CARGA } }),
    tx.evento.count({ where: { timeId: { in: timeIds } } }),
    tx.noticia.count({ where: { titulo: { startsWith: PREFIXO_CARGA }, autorId } }),
  ])
  return { usuarios, times: times.length, eventos, noticias }
}

async function semearUsuarios(
  tx: TransacaoComEscopo,
  atleticaId: string,
  senhaHash: string,
): Promise<string[]> {
  const numeros = Array.from({ length: MASSA.usuarios }, (_, i) => i + 1)
  const emails = numeros.map(emailCarga)
  await tx.usuario.createMany({
    data: numeros.map((n) => ({
      email: emailCarga(n),
      nome: nomeUsuarioCarga(n),
      senhaHash,
      emailVerificado: true,
    })),
    skipDuplicates: true,
  })
  await tx.usuario.updateMany({ where: { email: { in: emails } }, data: { senhaHash } })

  const porEmail = new Map(
    (await tx.usuario.findMany({ where: { email: { in: emails } } })).map((u) => [u.email, u.id]),
  )
  const ids = emails.map((email) => {
    const id = porEmail.get(email)
    if (!id) throw new ErroCarga(`Usuário de carga ${email} não criado.`)
    return id
  })
  await tx.vinculoAtletica.createMany({
    data: ids.map((usuarioId) => ({ usuarioId, atleticaId, papel: 'ATLETA' as const })),
    skipDuplicates: true,
  })
  await tx.preferenciaNotificacao.createMany({
    data: ids.map((usuarioId) => ({ usuarioId })),
    skipDuplicates: true,
  })
  return ids
}

interface TimeCarga {
  id: string
  modalidadeId: string
}

async function garantirTime(
  tx: TransacaoComEscopo,
  atleticaId: string,
  modalidadeId: string,
  nome: string,
): Promise<TimeCarga> {
  const existente = await tx.time.findFirst({ where: { atleticaId, nome } })
  return existente ?? tx.time.create({ data: { atleticaId, modalidadeId, nome } })
}

async function semearTimes(
  tx: TransacaoComEscopo,
  atleticaId: string,
  modalidadeIds: string[],
): Promise<TimeCarga[]> {
  const times: TimeCarga[] = []
  for (let i = 0; i < MASSA.times; i += 1) {
    const modalidadeId = modalidadeIds[i % modalidadeIds.length] as string
    times.push(await garantirTime(tx, atleticaId, modalidadeId, nomeTimeCarga(i + 1)))
  }
  return times
}

/** Os jogos exigem adversário: um time por modalidade numa atlética sem app. */
async function semearAdversarios(
  tx: TransacaoComEscopo,
  modalidadeIds: string[],
): Promise<Map<string, string>> {
  const adversaria = await tx.atletica.upsert({
    where: { slug: SLUG_ADVERSARIA_CARGA },
    create: {
      slug: SLUG_ADVERSARIA_CARGA,
      nome: `${PREFIXO_CARGA} Adversária`,
      usaAplicativo: false,
    },
    update: {},
  })
  const adversarios = new Map<string, string>()
  for (const [i, modalidadeId] of modalidadeIds.entries()) {
    const nome = nomeAdversarioCarga(i + 1)
    adversarios.set(modalidadeId, (await garantirTime(tx, adversaria.id, modalidadeId, nome)).id)
  }
  return adversarios
}

async function semearElenco(
  tx: TransacaoComEscopo,
  atleticaId: string,
  times: TimeCarga[],
  usuarioIds: string[],
): Promise<void> {
  const ativos = await tx.membroTime.findMany({
    where: { timeId: { in: times.map(({ id }) => id) }, saidaEm: null },
  })
  const existentes = new Set(ativos.map((m) => `${m.timeId}:${m.usuarioId}`))
  const data = usuarioIds
    .map((usuarioId, i) => ({
      atleticaId,
      usuarioId,
      timeId: (times[i % times.length] as TimeCarga).id,
    }))
    .filter((m) => !existentes.has(`${m.timeId}:${m.usuarioId}`))
  await tx.membroTime.createMany({ data })
}

const faltam = (alvo: number, atual: number) => Math.max(0, alvo - atual)

function resultadoDe(placarTime: number, placarAdversario: number): Resultado {
  if (placarTime > placarAdversario) return 'VITORIA'
  return placarTime < placarAdversario ? 'DERROTA' : 'EMPATE'
}

/** Completa os eventos futuros que já venceram, para a massa servir a qualquer data. */
async function semearEventos(
  tx: TransacaoComEscopo,
  atleticaId: string,
  times: TimeCarga[],
  adversarios: Map<string, string>,
  criadoPorId: string,
): Promise<void> {
  const agora = new Date()
  const hoje = new Date(agora)
  hoje.setUTCHours(22, 0, 0, 0)
  const emDias = (dias: number) => new Date(hoje.getTime() + dias * DIA_MS)

  for (const [t, time] of times.entries()) {
    const [futuros, finalizados] = await Promise.all([
      tx.evento.count({ where: { timeId: time.id, status: 'AGENDADO', inicio: { gt: agora } } }),
      tx.evento.count({ where: { timeId: time.id, status: 'FINALIZADO' } }),
    ])
    const timeAdversarioId = adversarios.get(time.modalidadeId) as string
    const comum = { atleticaId, timeId: time.id, criadoPorId, local: `${PREFIXO_CARGA} Quadra` }

    const agendados = Array.from({ length: faltam(EVENTOS_FUTUROS_POR_TIME, futuros) }, (_, k) => {
      const inicio = emDias(1 + k * 3)
      return k % 2 === 0
        ? { ...comum, tipo: 'TREINO' as const, inicio }
        : { ...comum, tipo: 'JOGO' as const, inicio, timeAdversarioId }
    })
    const jogos = Array.from(
      { length: faltam(JOGOS_FINALIZADOS_POR_TIME, finalizados) },
      (_, k) => {
        const placarTime = (k + t) % 4
        const placarAdversario = (k * 3 + t) % 3
        return {
          ...comum,
          tipo: 'JOGO' as const,
          inicio: emDias(-3 * (k + 1)),
          timeAdversarioId,
          status: 'FINALIZADO' as const,
          placarTime,
          placarAdversario,
          resultado: resultadoDe(placarTime, placarAdversario),
        }
      },
    )
    await tx.evento.createMany({ data: [...agendados, ...jogos] })
  }
}

async function semearNoticias(
  tx: TransacaoComEscopo,
  atleticaId: string,
  autorId: string,
): Promise<void> {
  const existentes = new Set(
    (await tx.noticia.findMany({ where: { autorId, titulo: { startsWith: PREFIXO_CARGA } } })).map(
      ({ titulo }) => titulo,
    ),
  )
  const agora = Date.now()
  const data = Array.from({ length: MASSA.noticias }, (_, i) => i + 1)
    .filter((n) => !existentes.has(tituloNoticiaCarga(n)))
    .map((n) => ({
      atleticaId,
      autorId,
      titulo: tituloNoticiaCarga(n),
      conteudo: `Notícia ${n} da massa do teste de carga.`,
      status: 'PUBLICADA' as const,
      publicadaEm: new Date(agora - n * 60_000),
    }))
  await tx.noticia.createMany({ data })
}

if (require.main === module) {
  executarComoScript(
    () => executarSeedCarga(),
    (r) =>
      `Massa de carga pronta: ${r.usuarios} usuários, ${r.times} times, ` +
      `${r.eventos} eventos e ${r.noticias} notícias.`,
  )
}
