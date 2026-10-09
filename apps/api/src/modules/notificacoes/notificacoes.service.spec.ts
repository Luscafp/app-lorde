import type { FilaService } from '../../infra/fila/fila.service'
import type { PrismaService } from '../../infra/prisma/prisma.service'
import { NotificacoesService, type EntradaNotificacao } from './notificacoes.service'

const ENTRADA: EntradaNotificacao = {
  atleticaId: 'atl-1',
  categoria: 'NOTICIAS',
  usuarioIds: ['u1', 'u2', 'u1'],
  titulo: 'LRD publicou uma notícia',
  corpo: 'Inscrições abertas',
  url: '/',
  chave: 'noticia.publicada:n1',
}

function preparar(usuarios: { dispositivos: { id: string; tokenPush: string }[] }[] = []) {
  const usuario = {
    findMany: jest.fn().mockResolvedValue(usuarios),
    count: jest.fn().mockResolvedValue(usuarios.length),
  }
  const fila = { enviar: jest.fn().mockResolvedValue('job') }
  const servico = new NotificacoesService(
    { db: { usuario } } as unknown as PrismaService,
    fila as unknown as FilaService,
  )
  return { servico, usuario, fila }
}

const comDispositivos = (quantidade: number) => ({
  dispositivos: Array.from({ length: quantidade }, (_, i) => ({
    id: `d${i}`,
    tokenPush: `ExpoPushToken[${i}]`,
  })),
})

describe('NotificacoesService', () => {
  it('filtra por conta, vínculo, dispositivo e coluna da categoria, sem ids repetidos', async () => {
    const { servico, usuario } = preparar()

    await servico.contarElegiveis(ENTRADA)

    expect(usuario.count).toHaveBeenCalledWith({
      where: {
        id: { in: ['u1', 'u2'] },
        ativo: true,
        excluidoEm: null,
        vinculos: { some: { atleticaId: 'atl-1', ativo: true } },
        dispositivos: { some: {} },
        OR: [
          { preferencia: { is: null } },
          { preferencia: { is: { pushAtivo: true, noticias: true } } },
        ],
      },
    })
  })

  it('CARGO ignora pushAtivo e categorias (RN35)', async () => {
    const { servico, usuario } = preparar()

    await servico.contarElegiveis({ ...ENTRADA, categoria: 'CARGO' })

    const [{ where }] = usuario.count.mock.calls[0] as [{ where: object }]
    expect(where).not.toHaveProperty('OR')
    expect(where).toMatchObject({ ativo: true, vinculos: { some: { atleticaId: 'atl-1' } } })
  })

  it('sem usuários não consulta nem enfileira', async () => {
    const { servico, usuario, fila } = preparar()

    expect(await servico.notificar({ ...ENTRADA, usuarioIds: [] })).toEqual({ destinatarios: 0 })
    expect(await servico.contarElegiveis({ ...ENTRADA, usuarioIds: [] })).toBe(0)
    expect(usuario.findMany).not.toHaveBeenCalled()
    expect(fila.enviar).not.toHaveBeenCalled()
  })

  it('uma mensagem por aparelho e um job por lote de 100, com singletonKey <chave>:<n>', async () => {
    const { servico, fila } = preparar([comDispositivos(150), comDispositivos(100)])

    const resultado = await servico.notificar(ENTRADA)

    expect(resultado).toEqual({ destinatarios: 2 })
    expect(fila.enviar).toHaveBeenCalledTimes(3)
    const chamadas = fila.enviar.mock.calls as [
      string,
      { mensagens: unknown[]; dispositivoIds: string[] },
      { singletonKey: string },
    ][]
    expect(chamadas.map(([nome]) => nome)).toEqual(Array(3).fill('notificacao.enviar-lote'))
    expect(chamadas.map(([, payload]) => payload.mensagens.length)).toEqual([100, 100, 50])
    expect(chamadas.map(([, payload]) => payload.dispositivoIds.length)).toEqual([100, 100, 50])
    expect(chamadas.map(([, , opcoes]) => opcoes.singletonKey)).toEqual([
      'noticia.publicada:n1:0',
      'noticia.publicada:n1:1',
      'noticia.publicada:n1:2',
    ])
  })
})
