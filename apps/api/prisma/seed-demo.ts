import type { Papel } from '../src/generated/prisma/client'
import type { TransacaoComEscopo } from '../src/infra/prisma/prisma.service'
import { garantirUsuarioComVinculo, type UsuarioSeed } from './seed-usuario'

/** Senha conhecida de todos os usuários de demonstração (só com SEED_DEMO=true, nunca em produção). */
export const SENHA_DEMO = 'lorde2026'

const USUARIOS_DEMO: UsuarioSeed[] = [
  { email: 'presidente@demo.exemplo.com.br', nome: 'Paula Presidente', papel: 'PRESIDENTE' },
  { email: 'vice@demo.exemplo.com.br', nome: 'Victor Vice', papel: 'VICE_PRESIDENTE' },
  { email: 'diretor@demo.exemplo.com.br', nome: 'Diana Diretora', papel: 'DIRETOR' },
  { email: 'atleta1@demo.exemplo.com.br', nome: 'Artur Atleta', papel: 'ATLETA' },
  { email: 'atleta2@demo.exemplo.com.br', nome: 'Alice Atleta', papel: 'ATLETA' },
]
const CARGOS_UNICOS: Papel[] = ['PRESIDENTE', 'VICE_PRESIDENTE']

const ADVERSARIA = { slug: 'demo-adversaria', nome: 'Atlética Adversária (demo)' }
const DIA_MS = 24 * 60 * 60 * 1000

// Trocar por `FUSO_PADRAO` e pelos helpers de `shared/utils/datas.ts` quando a #50 entrar.
const FUSO = 'America/Fortaleza'
const relogioDoFuso = new Intl.DateTimeFormat('en-US', {
  timeZone: FUSO,
  hourCycle: 'h23',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
})

/** Data e hora de parede no fuso, expressas como se fossem UTC. */
function horaDeParede(instante: number): number {
  const partes = new Map(
    relogioDoFuso.formatToParts(instante).map(({ type, value }) => [type, Number(value)]),
  )
  const parte = (tipo: Intl.DateTimeFormatPartTypes) => partes.get(tipo) ?? 0
  return Date.UTC(
    parte('year'),
    parte('month') - 1,
    parte('day'),
    parte('hour'),
    parte('minute'),
    parte('second'),
  )
}

/** 19h no fuso da Lorde, `dias` a partir de hoje. */
function emDias(dias: number): Date {
  const dia = new Date(horaDeParede(Date.now() + dias * DIA_MS))
  const as19 = Date.UTC(dia.getUTCFullYear(), dia.getUTCMonth(), dia.getUTCDate(), 19)
  return new Date(as19 - (horaDeParede(as19) - as19))
}

/** Dados de homologação e do teste de carga (#83); cada bloco só é criado se ainda não existir. */
export async function semearDemo(
  tx: TransacaoComEscopo,
  atleticaId: string,
  modalidades: Map<string, string>,
  senhaHash: string,
): Promise<void> {
  const diretorId = await semearUsuarios(tx, atleticaId, senhaHash)

  const modalidadeId = modalidades.get('Futsal')
  if (!modalidadeId) return
  const adversaria = await tx.atletica.upsert({
    where: { slug: ADVERSARIA.slug },
    create: { ...ADVERSARIA, usaAplicativo: false },
    update: {},
  })
  const timeLorde = await garantirTime(tx, atleticaId, modalidadeId, 'Lorde Futsal (demo)')
  const timeAdversario = await garantirTime(
    tx,
    adversaria.id,
    modalidadeId,
    'Adversária Futsal (demo)',
  )

  await semearEventos(tx, atleticaId, diretorId, timeLorde.id, timeAdversario.id)
  await semearNoticias(tx, atleticaId, diretorId)
}

async function semearEventos(
  tx: TransacaoComEscopo,
  atleticaId: string,
  criadoPorId: string,
  timeId: string,
  timeAdversarioId: string,
): Promise<void> {
  if ((await tx.evento.count({ where: { timeId } })) > 0) return
  const comum = { atleticaId, timeId, criadoPorId }
  const jogo = { ...comum, tipo: 'JOGO', timeAdversarioId, local: 'Quadra central' } as const
  await tx.evento.createMany({
    data: [
      { ...comum, tipo: 'TREINO', inicio: emDias(3), local: 'Ginásio da universidade' },
      { ...jogo, inicio: emDias(10) },
      {
        ...jogo,
        inicio: emDias(-7),
        status: 'FINALIZADO',
        placarTime: 3,
        placarAdversario: 1,
        resultado: 'VITORIA',
      },
    ],
  })
}

async function semearNoticias(
  tx: TransacaoComEscopo,
  atleticaId: string,
  autorId: string,
): Promise<void> {
  for (const titulo of ['Bem-vindos ao app da Lorde!', 'Vitória no amistoso de futsal']) {
    if (await tx.noticia.findFirst({ where: { titulo } })) continue
    await tx.noticia.create({
      data: {
        atleticaId,
        autorId,
        titulo,
        conteudo: `${titulo} (notícia de demonstração).`,
        status: 'PUBLICADA',
        publicadaEm: new Date(),
      },
    })
  }
}

/** Devolve o id do diretor de demonstração. Cargo único já ocupado (RN07) não é recriado. */
async function semearUsuarios(
  tx: TransacaoComEscopo,
  atleticaId: string,
  senhaHash: string,
): Promise<string> {
  let diretorId: string | undefined
  for (const dados of USUARIOS_DEMO) {
    const ocupante = CARGOS_UNICOS.includes(dados.papel)
      ? await tx.vinculoAtletica.findFirst({
          where: { papel: dados.papel },
          include: { usuario: true },
        })
      : null
    if (ocupante && ocupante.usuario.email !== dados.email) continue

    const usuarioId = await garantirUsuarioComVinculo(tx, atleticaId, dados, senhaHash)
    if (dados.papel === 'DIRETOR') diretorId = usuarioId
  }
  if (!diretorId) throw new Error('semearDemo: diretor de demonstração não criado')
  return diretorId
}

async function garantirTime(
  tx: TransacaoComEscopo,
  atleticaId: string,
  modalidadeId: string,
  nome: string,
) {
  const existente = await tx.time.findFirst({ where: { atleticaId, modalidadeId, nome } })
  return existente ?? tx.time.create({ data: { atleticaId, modalidadeId, nome } })
}
