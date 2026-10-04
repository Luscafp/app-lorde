import { Test } from '@nestjs/testing'
import { ClsService } from 'nestjs-cls'
import { ContextoAtletica, type StoreContexto } from './contexto-atletica.service'
import { ContextoModule } from './contexto.module'

describe('ContextoAtletica', () => {
  let contexto: ContextoAtletica
  let cls: ClsService<StoreContexto>

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({ imports: [ContextoModule] }).compile()
    contexto = modulo.get(ContextoAtletica)
    cls = modulo.get(ClsService)
  })

  it('fora de um contexto CLS, tudo é undefined', () => {
    expect(contexto.atleticaId()).toBeUndefined()
    expect(contexto.usuarioId()).toBeUndefined()
    expect(contexto.requestId()).toBeUndefined()
  })

  it('definir grava atlética e usuário no contexto ativo', () => {
    cls.run(() => {
      contexto.definir({ atleticaId: 'a', usuarioId: 'u' })
      expect(contexto.atleticaId()).toBe('a')
      expect(contexto.usuarioId()).toBe('u')
    })
    expect(contexto.atleticaId()).toBeUndefined()
  })

  it('requestId lê o valor gravado no CLS (#48)', () => {
    cls.run(() => {
      cls.set('requestId', 'req-1')
      expect(contexto.requestId()).toBe('req-1')
    })
  })

  it('executarComAtletica abre um contexto próprio e devolve o resultado de fn', async () => {
    const resultado = await contexto.executarComAtletica('a', async () => {
      await Promise.resolve()
      return contexto.atleticaId()
    })
    expect(resultado).toBe('a')
    expect(contexto.atleticaId()).toBeUndefined()
  })

  it('contextos aninhados ficam isolados e o externo volta intacto', async () => {
    await contexto.executarComAtletica('a', async () => {
      await contexto.executarComAtletica('b', async () => {
        await Promise.resolve()
        expect(contexto.atleticaId()).toBe('b')
      })
      expect(contexto.atleticaId()).toBe('a')
    })
  })

  it('execuções concorrentes não se misturam', async () => {
    const ler = (atleticaId: string, atraso: number) =>
      contexto.executarComAtletica(atleticaId, async () => {
        await new Promise((resolver) => setTimeout(resolver, atraso))
        return contexto.atleticaId()
      })
    expect(await Promise.all([ler('a', 20), ler('b', 5), ler('c', 10)])).toEqual(['a', 'b', 'c'])
  })

  it('herda usuarioId e requestId do contexto externo', async () => {
    await cls.run(async () => {
      contexto.definir({ atleticaId: 'a', usuarioId: 'u' })
      cls.set('requestId', 'req-1')
      await contexto.executarComAtletica('b', () => {
        expect(contexto.atleticaId()).toBe('b')
        expect(contexto.usuarioId()).toBe('u')
        expect(contexto.requestId()).toBe('req-1')
      })
      expect(contexto.atleticaId()).toBe('a')
    })
  })

  it('aguarda dentro do contexto um resultado preguiçoso (como a PrismaPromise)', async () => {
    const preguicoso = {
      then: (resolver: (valor: unknown) => void) => resolver(contexto.atleticaId()),
    }
    expect(await contexto.executarComAtletica('a', () => preguicoso)).toBe('a')
  })
})
