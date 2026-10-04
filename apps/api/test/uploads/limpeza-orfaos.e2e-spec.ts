import { DeleteObjectsCommand, ListObjectsV2Command } from '@aws-sdk/client-s3'
import { FUSO_PADRAO } from '@atletica/shared'
import { SchedulerRegistry } from '@nestjs/schedule'
import { gerarChave } from '../../src/modules/uploads/chaves'
import {
  IDADE_MINIMA_ORFAO_MS,
  JOB_LIMPEZA_ORFAOS,
  LimpezaOrfaosService,
} from '../../src/modules/uploads/limpeza-orfaos.service'
import { simularArmazenamento, type ArmazenamentoSimulado } from '../fabricas/uploads'
import { criarUsuario } from '../fabricas/usuario'
import { criarApp, type AppDeTeste } from '../setup/criar-app'
import { prismaTeste } from '../setup/prisma-teste'

const AGORA = new Date('2026-10-04T06:30:00.000Z')
const VELHO = new Date(AGORA.getTime() - IDADE_MINIMA_ORFAO_MS - 1)

describe('Limpeza de órfãos (#56)', () => {
  let contexto: AppDeTeste
  let armazenamento: ArmazenamentoSimulado

  beforeAll(async () => {
    armazenamento = simularArmazenamento()
    contexto = await criarApp({ ajustar: armazenamento.ajustar })
  })

  afterAll(async () => {
    await contexto.app.close()
  })

  it('registra o job no ScheduleModule, às 03:30 de America/Fortaleza', () => {
    const job = contexto.app.get(SchedulerRegistry).getCronJob(JOB_LIMPEZA_ORFAOS)

    expect(job.cronTime.source).toBe('30 3 * * *')
    expect(job.cronTime.timeZone).toBe(FUSO_PADRAO)
    expect(FUSO_PADRAO).toBe('America/Fortaleza')
  })

  it('mantém as chaves de Usuario, Noticia (inclusive excluída) e Banner de várias atléticas', async () => {
    const autorA = await criarUsuario({ papel: 'DIRETOR' })
    const autorB = await criarUsuario({ papel: 'DIRETOR' })
    const dono = (autor: typeof autorA) => ({ usuarioId: autor.id, atleticaId: autor.atleticaId })

    const foto = gerarChave('PERFIL', 'image/jpeg', dono(autorA))
    const capaExcluida = gerarChave('NOTICIA', 'image/png', dono(autorA))
    const imagemBanner = gerarChave('BANNER', 'image/webp', dono(autorB))
    const orfas = [
      gerarChave('PERFIL', 'image/jpeg', dono(autorB)),
      gerarChave('NOTICIA', 'image/jpeg', dono(autorB)),
      gerarChave('BANNER', 'image/jpeg', dono(autorA)),
    ]

    await prismaTeste.usuario.update({ where: { id: autorA.id }, data: { fotoKey: foto } })
    await prismaTeste.noticia.create({
      data: {
        atleticaId: autorA.atleticaId,
        autorId: autorA.id,
        titulo: 'Excluída',
        imagemCapaKey: capaExcluida,
        excluidoEm: VELHO,
      },
    })
    await prismaTeste.banner.create({
      data: { atleticaId: autorB.atleticaId, titulo: 'Banner', imagemKey: imagemBanner },
    })

    armazenamento.s3.send.mockImplementation((comando: unknown) => {
      if (comando instanceof ListObjectsV2Command) {
        const keys = [foto, capaExcluida, imagemBanner, ...orfas]
        return Promise.resolve({ Contents: keys.map((Key) => ({ Key, LastModified: VELHO })) })
      }
      if (comando instanceof DeleteObjectsCommand) return Promise.resolve({})
      throw new Error('comando inesperado')
    })

    const resultado = await contexto.app.get(LimpezaOrfaosService).executar(AGORA)

    const apagadas = armazenamento.s3.send.mock.calls
      .map(([comando]: [unknown]) => comando)
      .filter((comando): comando is DeleteObjectsCommand => comando instanceof DeleteObjectsCommand)
      .flatMap(({ input }) => (input.Delete?.Objects ?? []).map(({ Key }) => Key))
    expect(apagadas.sort()).toEqual([...orfas].sort())
    expect(resultado).toEqual({ listados: 6, referenciados: 3, removidos: 3, falhas: 0 })
  })
})
