import { Papel } from '@atletica/shared'
import {
  MENSAGEM_ALVO_PROPRIO,
  MENSAGEM_NIVEL_INSUFICIENTE,
  MENSAGEM_USUARIO_EXCLUIDO,
} from './erros'
import { calcularPermissoes, type AlvoPermissoes, type Solicitante } from './regras-papel'

const presidente: Solicitante = { id: 'p', papel: Papel.PRESIDENTE }
const administrador: Solicitante = { id: 'adm', papel: Papel.ADMINISTRADOR }

const alvo = (papel: Papel, extra: Partial<AlvoPermissoes> = {}): AlvoPermissoes => ({
  id: 'alvo',
  papel,
  excluido: false,
  ...extra,
})

describe('calcularPermissoes', () => {
  it('nível inferior: pode alterar a situação', () => {
    expect(calcularPermissoes(presidente, alvo(Papel.DIRETOR), false)).toEqual({
      podeAlterarSituacao: true,
      motivoBloqueio: null,
      podeAlterarPapel: false,
      ehUltimoAdministrador: false,
    })
  })

  it.each([Papel.VICE_PRESIDENTE, Papel.PRESIDENTE, Papel.ADMINISTRADOR])(
    'Presidente sobre %s: bloqueado por nível',
    (papel) => {
      expect(calcularPermissoes(presidente, alvo(papel), false)).toMatchObject({
        podeAlterarSituacao: false,
        motivoBloqueio: MENSAGEM_NIVEL_INSUFICIENTE,
      })
    },
  )

  it('si mesmo: bloqueado com mensagem própria e sem alterar papel', () => {
    expect(
      calcularPermissoes(administrador, alvo(Papel.ADMINISTRADOR, { id: 'adm' }), true),
    ).toEqual({
      podeAlterarSituacao: false,
      motivoBloqueio: MENSAGEM_ALVO_PROPRIO,
      podeAlterarPapel: false,
      ehUltimoAdministrador: true,
    })
  })

  it('conta excluída: tudo falso', () => {
    expect(calcularPermissoes(administrador, alvo(Papel.ATLETA, { excluido: true }), true)).toEqual(
      {
        podeAlterarSituacao: false,
        motivoBloqueio: MENSAGEM_USUARIO_EXCLUIDO,
        podeAlterarPapel: false,
        ehUltimoAdministrador: false,
      },
    )
  })

  it('Administrador: altera papel de outro usuário e situação até Presidente', () => {
    expect(calcularPermissoes(administrador, alvo(Papel.PRESIDENTE), false)).toEqual({
      podeAlterarSituacao: true,
      motivoBloqueio: null,
      podeAlterarPapel: true,
      ehUltimoAdministrador: false,
    })
  })

  it('Administrador sobre outro Administrador: papel sim, situação não', () => {
    expect(calcularPermissoes(administrador, alvo(Papel.ADMINISTRADOR), true)).toEqual({
      podeAlterarSituacao: false,
      motivoBloqueio: MENSAGEM_NIVEL_INSUFICIENTE,
      podeAlterarPapel: true,
      ehUltimoAdministrador: true,
    })
  })

  it.each([Papel.PRESIDENTE, Papel.VICE_PRESIDENTE])('%s nunca altera papel', (papel) => {
    expect(calcularPermissoes({ id: 'x', papel }, alvo(Papel.ATLETA), false).podeAlterarPapel).toBe(
      false,
    )
  })
})
