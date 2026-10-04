import { Papel } from '@atletica/shared'
import type { ExecutionContext } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { codigoDoErro } from '../../../../test/suporte/codigo-do-erro'
import { PapelMinimo } from '../decorators/papel-minimo.decorator'
import { Publico } from '../decorators/publico.decorator'
import type { UsuarioAutenticado } from '../tipos'
import { PapelGuard } from './papel.guard'

@PapelMinimo(Papel.PRESIDENTE)
class ControllerPresidencia {
  herdado(): void {}

  @PapelMinimo(Papel.DIRETOR)
  sobrescrito(): void {}

  @Publico()
  publico(): void {}
}

class ControllerLivre {
  livre(): void {}
}

function contexto(
  classe: new () => object,
  metodo: string,
  usuario?: Pick<UsuarioAutenticado, 'papel'>,
): ExecutionContext {
  const handler = (classe.prototype as Record<string, () => void>)[metodo]
  return {
    getHandler: () => handler,
    getClass: () => classe,
    switchToHttp: () => ({ getRequest: () => ({ usuario }) }),
  } as unknown as ExecutionContext
}

function resultado(ctx: ExecutionContext): string | true {
  return codigoDoErro(() => new PapelGuard(new Reflector()).canActivate(ctx)) ?? true
}

describe('PapelGuard', () => {
  it('sem @PapelMinimo, libera qualquer autenticado', () => {
    expect(resultado(contexto(ControllerLivre, 'livre', { papel: 'ATLETA' }))).toBe(true)
  })

  it('usa o metadado da classe quando o handler não tem', () => {
    expect(resultado(contexto(ControllerPresidencia, 'herdado', { papel: 'DIRETOR' }))).toBe(
      '403 FORBIDDEN',
    )
    expect(
      resultado(contexto(ControllerPresidencia, 'herdado', { papel: 'VICE_PRESIDENTE' })),
    ).toBe(true)
  })

  it('o handler sobrepõe a classe', () => {
    expect(resultado(contexto(ControllerPresidencia, 'sobrescrito', { papel: 'DIRETOR' }))).toBe(
      true,
    )
    expect(resultado(contexto(ControllerPresidencia, 'sobrescrito', { papel: 'ATLETA' }))).toBe(
      '403 FORBIDDEN',
    )
  })

  it('rota @Publico() é ignorada', () => {
    expect(resultado(contexto(ControllerPresidencia, 'publico'))).toBe(true)
  })

  it('com @PapelMinimo e sem usuário na requisição → 401', () => {
    expect(resultado(contexto(ControllerPresidencia, 'herdado'))).toBe('401 UNAUTHENTICATED')
  })
})
