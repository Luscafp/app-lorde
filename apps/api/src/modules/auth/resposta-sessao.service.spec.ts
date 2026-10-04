import { Papel } from '@atletica/shared'
import type { ConfigService } from '@nestjs/config'
import type { Env } from '../../config/env.schema'
import { RespostaSessaoService, type UsuarioParaSessao } from './resposta-sessao.service'
import type { TokenAcessoService } from './token-acesso.service'

const tokens = {
  assinar: () => ({ accessToken: 'jwt', accessTokenExpiraEm: '2026-10-04T12:15:00.000Z' }),
} as unknown as TokenAcessoService

const servico = (base?: string) =>
  new RespostaSessaoService(tokens, { get: () => base } as unknown as ConfigService<Env, true>)

const usuario = (fotoKey: string | null): UsuarioParaSessao => ({
  id: 'u1',
  nome: 'Ana',
  email: 'ana@ex.com',
  fotoKey,
  papel: Papel.ATLETA,
  atleticaId: 'a1',
})

const sessao = { sessaoId: 's1', refreshToken: 's1.segredo' }

describe('RespostaSessaoService', () => {
  it('monta o contrato com o token assinado', () => {
    expect(servico().montar(usuario(null), sessao)).toEqual({
      accessToken: 'jwt',
      refreshToken: 's1.segredo',
      accessTokenExpiraEm: '2026-10-04T12:15:00.000Z',
      usuario: {
        id: 'u1',
        nome: 'Ana',
        email: 'ana@ex.com',
        fotoUrl: null,
        papel: Papel.ATLETA,
        atleticaId: 'a1',
      },
    })
  })

  it('fotoUrl = R2_PUBLIC_BASE_URL/fotoKey', () => {
    const resposta = servico('https://cdn.ex.com/').montar(usuario('usuarios/u1.jpg'), sessao)
    expect(resposta.usuario.fotoUrl).toBe('https://cdn.ex.com/usuarios/u1.jpg')
  })

  it('sem fotoKey ou sem base → fotoUrl null', () => {
    expect(servico('https://cdn.ex.com').montar(usuario(null), sessao).usuario.fotoUrl).toBeNull()
    expect(servico().montar(usuario('usuarios/u1.jpg'), sessao).usuario.fotoUrl).toBeNull()
  })
})
