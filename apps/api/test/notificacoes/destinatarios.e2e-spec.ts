import { Papel } from '@atletica/shared'
import { ContextoAtletica } from '../../src/infra/contexto/contexto-atletica.service'
import { DestinatariosService } from '../../src/modules/notificacoes/destinatarios.service'
import { criarAtletica } from '../fabricas/atletica'
import { adicionarMembro, criarTime } from '../fabricas/times'
import { criarUsuario } from '../fabricas/usuario'
import { criarApp, type AppDeTeste } from '../setup/criar-app'

describe('Destinatários dos gatilhos (#87)', () => {
  let contexto: AppDeTeste
  let destinatarios: DestinatariosService
  let atleticaId: string

  const naAtletica = <T>(fn: () => Promise<T>) =>
    contexto.app.get(ContextoAtletica).executarComAtletica(atleticaId, fn)
  const ordenados = (ids: string[]) => [...ids].sort()

  beforeAll(async () => {
    contexto = await criarApp()
    destinatarios = contexto.app.get(DestinatariosService)
  })

  beforeEach(async () => {
    atleticaId = (await criarAtletica()).id
  })

  afterAll(async () => {
    await contexto.app.close()
  })

  it('elencoDoTime: só quem não saiu do time', async () => {
    const time = await criarTime({ atleticaId })
    const atual = await criarUsuario({ atleticaId })
    const saiu = await criarUsuario({ atleticaId })
    await adicionarMembro(time, atual)
    await adicionarMembro(time, saiu, { saidaEm: new Date() })

    expect(await naAtletica(() => destinatarios.elencoDoTime(time.id))).toEqual([atual.id])
  })

  it('diretoria: vínculos ativos com papel ≥ DIRETOR, só da atlética informada', async () => {
    const diretor = await criarUsuario({ atleticaId, papel: Papel.DIRETOR })
    const presidente = await criarUsuario({ atleticaId, papel: Papel.PRESIDENTE })
    await criarUsuario({ atleticaId, papel: Papel.ATLETA })
    await criarUsuario({ atleticaId, papel: Papel.DIRETOR, vinculoAtivo: false })
    await criarUsuario({ papel: Papel.PRESIDENTE })

    const ids = await naAtletica(() => destinatarios.diretoria(atleticaId))

    expect(ordenados(ids)).toEqual(ordenados([diretor.id, presidente.id]))
  })

  it('todosDaAtletica: todos os vínculos ativos, só da atlética informada', async () => {
    const atleta = await criarUsuario({ atleticaId })
    const diretor = await criarUsuario({ atleticaId, papel: Papel.DIRETOR })
    await criarUsuario({ atleticaId, vinculoAtivo: false })
    await criarUsuario()

    const ids = await naAtletica(() => destinatarios.todosDaAtletica(atleticaId))

    expect(ordenados(ids)).toEqual(ordenados([atleta.id, diretor.id]))
  })
})
