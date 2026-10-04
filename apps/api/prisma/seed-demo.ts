import type { Papel } from '../src/generated/prisma/client'
import type { TransacaoComEscopo } from '../src/infra/prisma/prisma.service'

/** Senha conhecida de todos os usuários de demonstração (só com SEED_DEMO=true, nunca em produção). */
export const SENHA_DEMO = 'lorde2026'

const USUARIOS_DEMO: { email: string; nome: string; papel: Papel }[] = [
  { email: 'presidente@demo.exemplo.com.br', nome: 'Paula Presidente', papel: 'PRESIDENTE' },
  { email: 'vice@demo.exemplo.com.br', nome: 'Victor Vice', papel: 'VICE_PRESIDENTE' },
  { email: 'diretor@demo.exemplo.com.br', nome: 'Diana Diretora', papel: 'DIRETOR' },
  { email: 'atleta1@demo.exemplo.com.br', nome: 'Artur Atleta', papel: 'ATLETA' },
  { email: 'atleta2@demo.exemplo.com.br', nome: 'Alice Atleta', papel: 'ATLETA' },
]
const CARGOS_UNICOS: Papel[] = ['PRESIDENTE', 'VICE_PRESIDENTE']

const ADVERSARIA = { slug: 'demo-adversaria', nome: 'Atlética Adversária (demo)' }
const DIA_MS = 24 * 60 * 60 * 1000

/** 19h em Fortaleza (UTC−3), `dias` a partir de hoje. */
function emDias(dias: number): Date {
  const data = new Date(Date.now() + dias * DIA_MS)
  data.setUTCHours(22, 0, 0, 0)
  return data
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

  if ((await tx.evento.count({ where: { timeId: timeLorde.id } })) === 0) {
    const comum = { atleticaId, timeId: timeLorde.id, criadoPorId: diretorId }
    await tx.evento.createMany({
      data: [
        { ...comum, tipo: 'TREINO', inicio: emDias(3), local: 'Ginásio da universidade' },
        {
          ...comum,
          tipo: 'JOGO',
          timeAdversarioId: timeAdversario.id,
          inicio: emDias(10),
          local: 'Quadra central',
        },
        {
          ...comum,
          tipo: 'JOGO',
          timeAdversarioId: timeAdversario.id,
          inicio: emDias(-7),
          local: 'Quadra central',
          status: 'FINALIZADO',
          placarTime: 3,
          placarAdversario: 1,
          resultado: 'VITORIA',
        },
      ],
    })
  }

  for (const titulo of ['Bem-vindos ao app da Lorde!', 'Vitória no amistoso de futsal']) {
    if (await tx.noticia.findFirst({ where: { titulo } })) continue
    await tx.noticia.create({
      data: {
        atleticaId,
        autorId: diretorId,
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
  for (const { email, nome, papel } of USUARIOS_DEMO) {
    const ocupante = CARGOS_UNICOS.includes(papel)
      ? await tx.vinculoAtletica.findFirst({ where: { papel }, include: { usuario: true } })
      : null
    if (ocupante && ocupante.usuario.email !== email) continue

    const usuario = await tx.usuario.upsert({
      where: { email },
      create: { email, nome, senhaHash, emailVerificado: true, preferencia: { create: {} } },
      update: {},
    })
    await tx.vinculoAtletica.upsert({
      where: { usuarioId_atleticaId: { usuarioId: usuario.id, atleticaId } },
      create: { usuarioId: usuario.id, atleticaId, papel },
      update: {},
    })
    if (papel === 'DIRETOR') diretorId = usuario.id
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
