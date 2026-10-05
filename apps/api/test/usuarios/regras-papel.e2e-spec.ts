import type { INestApplicationContext } from '@nestjs/common'
import { ErroNegocio } from '../../src/common/erros/erro-negocio'
import { ContextoAtletica } from '../../src/infra/contexto/contexto-atletica.service'
import { TransacaoService } from '../../src/infra/eventos/apos-commit'
import type { TransacaoComEscopo } from '../../src/infra/prisma/prisma.service'
import { AtleticaPadraoService } from '../../src/modules/atleticas/atletica-padrao.service'
import {
  bloquearPapeis,
  ehUltimoAdministrador,
  garantirNaoUltimoAdministrador,
} from '../../src/modules/usuarios/regras-papel'
import { criarAtletica } from '../fabricas/atletica'
import { criarUsuario } from '../fabricas/usuario'
import { criarApp, type AppDeTeste } from '../setup/criar-app'
import { prismaTeste } from '../setup/prisma-teste'

const esperar = (ms: number) => new Promise((resolver) => setTimeout(resolver, ms))

function naAtletica<T>(
  app: INestApplicationContext,
  atleticaId: string,
  fn: (tx: TransacaoComEscopo) => Promise<T>,
): Promise<T> {
  return app
    .get(ContextoAtletica)
    .executarComAtletica(atleticaId, () => app.get(TransacaoService).executar(fn))
}

describe('regras-papel (#27 §7.4)', () => {
  let contexto: AppDeTeste
  let padraoId: string

  beforeAll(async () => {
    contexto = await criarApp()
    padraoId = contexto.app.get(AtleticaPadraoService).id()
  })

  beforeEach(async () => {
    await criarAtletica({ id: padraoId })
  })

  afterAll(async () => {
    await contexto.app.close()
  })

  describe('garantirNaoUltimoAdministrador (critério 18a)', () => {
    const garantir = (usuarioId: string) =>
      naAtletica(contexto.app, padraoId, async (tx) => {
        await bloquearPapeis(tx, padraoId)
        await garantirNaoUltimoAdministrador(tx, padraoId, usuarioId)
      })

    async function codigo(usuarioId: string): Promise<string | null> {
      try {
        await garantir(usuarioId)
        return null
      } catch (erro) {
        if (erro instanceof ErroNegocio) return `${erro.statusCode} ${erro.code}`
        throw erro
      }
    }

    it('único Administrador → 409 ULTIMO_ADMINISTRADOR', async () => {
      const admin = await criarUsuario({ atleticaId: padraoId, papel: 'ADMINISTRADOR' })
      await expect(codigo(admin.id)).resolves.toBe('409 ULTIMO_ADMINISTRADOR')
    })

    it('com outro Administrador ativo → passa', async () => {
      const admin = await criarUsuario({ atleticaId: padraoId, papel: 'ADMINISTRADOR' })
      await criarUsuario({ atleticaId: padraoId, papel: 'ADMINISTRADOR' })
      await expect(codigo(admin.id)).resolves.toBeNull()
    })

    it('o outro Administrador desativado ou excluído não conta', async () => {
      const admin = await criarUsuario({ atleticaId: padraoId, papel: 'ADMINISTRADOR' })
      await criarUsuario({ atleticaId: padraoId, papel: 'ADMINISTRADOR', vinculoAtivo: false })
      const excluido = await criarUsuario({ atleticaId: padraoId, papel: 'ADMINISTRADOR' })
      await prismaTeste.usuario.update({
        where: { id: excluido.id },
        data: { excluidoEm: new Date() },
      })
      await expect(codigo(admin.id)).resolves.toBe('409 ULTIMO_ADMINISTRADOR')
    })

    it('Administrador de outra atlética não conta', async () => {
      const admin = await criarUsuario({ atleticaId: padraoId, papel: 'ADMINISTRADOR' })
      await criarUsuario({ papel: 'ADMINISTRADOR' })
      await expect(
        naAtletica(contexto.app, padraoId, (tx) => ehUltimoAdministrador(tx, padraoId, admin.id)),
      ).resolves.toBe(true)
    })
  })

  describe('bloquearPapeis', () => {
    async function concorrer(atleticaA: string, atleticaB: string): Promise<string[]> {
      const ordem: string[] = []
      const primeira = naAtletica(contexto.app, atleticaA, async (tx) => {
        await bloquearPapeis(tx, atleticaA)
        ordem.push('1-inicio')
        await esperar(200)
        ordem.push('1-fim')
      })
      await esperar(50)
      const segunda = naAtletica(contexto.app, atleticaB, async (tx) => {
        await bloquearPapeis(tx, atleticaB)
        ordem.push('2')
      })
      await Promise.all([primeira, segunda])
      return ordem
    }

    it('serializa transações da mesma atlética', async () => {
      await expect(concorrer(padraoId, padraoId)).resolves.toEqual(['1-inicio', '1-fim', '2'])
    })

    it('não bloqueia atléticas diferentes', async () => {
      const outra = await criarAtletica()
      await expect(concorrer(padraoId, outra.id)).resolves.toEqual(['1-inicio', '2', '1-fim'])
    })
  })
})
