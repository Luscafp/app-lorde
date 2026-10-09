import type { INestApplicationContext } from '@nestjs/common'
import type { DispositivoPush, Prisma, Usuario } from '../../src/generated/prisma/client'
import { ClienteExpoPush } from '../../src/modules/notificacoes/envio/cliente-expo-push'
import { FakeExpoPush } from '../../src/modules/notificacoes/envio/fake-expo-push'
import { prismaTeste } from '../setup/prisma-teste'
import { proximaSequencia } from './sequencia'

/** Dispositivo Android com token único. */
export function criarDispositivo(
  usuario: Pick<Usuario, 'id'>,
  dados: Partial<Prisma.DispositivoPushUncheckedCreateInput> = {},
): Promise<DispositivoPush> {
  return prismaTeste.dispositivoPush.create({
    data: {
      usuarioId: usuario.id,
      tokenPush: `ExponentPushToken[teste-${proximaSequencia()}]`,
      plataforma: 'android',
      ...dados,
    },
  })
}

export function criarPreferencias(
  usuario: Pick<Usuario, 'id'>,
  dados: Omit<Prisma.PreferenciaNotificacaoUncheckedCreateInput, 'usuarioId'>,
) {
  return prismaTeste.preferenciaNotificacao.create({ data: { usuarioId: usuario.id, ...dados } })
}

/** O `FakeExpoPush` da aplicação (`NODE_ENV=test`); chame `limpar()` no `beforeEach`. */
export function fakeExpo(app: INestApplicationContext): FakeExpoPush {
  const cliente = app.get(ClienteExpoPush)
  if (!(cliente instanceof FakeExpoPush)) throw new Error('fakeExpo: cliente real em teste')
  return cliente
}
