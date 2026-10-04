import { criarClientesSeed } from '../../apps/api/prisma/seed-cliente'
import {
  executarComoScript,
  FILTRO_EMAIL_CARGA,
  PREFIXO_CARGA,
  SLUG_ADVERSARIA_CARGA,
  validarAmbienteDeCarga,
  type EnvCarga,
} from './massa-carga'

export interface ResumoLimpezaCarga {
  usuarios: number
  times: number
  eventos: number
  noticias: number
}

/**
 * Remove a massa de carga: usuários `carga+*@teste.local`, times `[Carga] *` da atlética padrão e
 * da adversária `carga-adversaria`, e o que depende deles (participações, eventos, elencos,
 * solicitações, notícias). Uma transação, na ordem das FKs; nada fora da massa é tocado.
 */
export async function executarLimpezaCarga(
  env: EnvCarga = process.env,
): Promise<ResumoLimpezaCarga> {
  const databaseUrl = validarAmbienteDeCarga(env)
  const { semEscopo } = criarClientesSeed(databaseUrl)

  try {
    return await semEscopo.$transaction(
      async (tx) => {
        const usuarioIds = (
          await tx.usuario.findMany({ where: { email: FILTRO_EMAIL_CARGA }, select: { id: true } })
        ).map(({ id }) => id)
        const timeIds = (
          await tx.time.findMany({
            where: {
              OR: [
                { nome: { startsWith: PREFIXO_CARGA }, atletica: { usaAplicativo: true } },
                { atletica: { slug: SLUG_ADVERSARIA_CARGA } },
              ],
            },
            select: { id: true },
          })
        ).map(({ id }) => id)
        const eventoIds = (
          await tx.evento.findMany({
            where: {
              OR: [
                { timeId: { in: timeIds } },
                { timeAdversarioId: { in: timeIds } },
                { criadoPorId: { in: usuarioIds } },
              ],
            },
            select: { id: true },
          })
        ).map(({ id }) => id)

        await tx.participacao.deleteMany({
          where: {
            OR: [
              { eventoId: { in: eventoIds } },
              { usuarioId: { in: usuarioIds } },
              { presencaRegistradaPorId: { in: usuarioIds } },
            ],
          },
        })
        const eventos = await tx.evento.deleteMany({ where: { id: { in: eventoIds } } })
        await tx.serieRecorrencia.deleteMany({
          where: { OR: [{ timeId: { in: timeIds } }, { criadoPorId: { in: usuarioIds } }] },
        })
        await tx.membroTime.deleteMany({
          where: { OR: [{ timeId: { in: timeIds } }, { usuarioId: { in: usuarioIds } }] },
        })
        await tx.solicitacaoEntrada.deleteMany({
          where: {
            OR: [
              { timeId: { in: timeIds } },
              { usuarioId: { in: usuarioIds } },
              { avaliadoPorId: { in: usuarioIds } },
            ],
          },
        })
        const noticias = await tx.noticia.deleteMany({ where: { autorId: { in: usuarioIds } } })
        const times = await tx.time.deleteMany({ where: { id: { in: timeIds } } })
        await tx.aceiteTermos.deleteMany({ where: { usuarioId: { in: usuarioIds } } })
        await tx.vinculoAtletica.deleteMany({ where: { usuarioId: { in: usuarioIds } } })
        const usuarios = await tx.usuario.deleteMany({ where: { id: { in: usuarioIds } } })
        await tx.atletica.deleteMany({ where: { slug: SLUG_ADVERSARIA_CARGA } })

        return {
          usuarios: usuarios.count,
          times: times.count,
          eventos: eventos.count,
          noticias: noticias.count,
        }
      },
      { timeout: 120_000 },
    )
  } finally {
    await semEscopo.$disconnect()
  }
}

if (require.main === module) {
  executarComoScript(
    () => executarLimpezaCarga(),
    (r) =>
      `Massa de carga removida: ${r.usuarios} usuários, ${r.times} times, ` +
      `${r.eventos} eventos e ${r.noticias} notícias.`,
  )
}
