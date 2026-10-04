import type { AppDeTeste } from '../setup/criar-app'

export interface AppEmAmbiente extends AppDeTeste {
  /** Fecha a aplicação e devolve o `APP_ENV` original. */
  encerrar(): Promise<void>
}

/**
 * O `ConditionalModule` decide ao importar o `AppModule`: o arquivo de teste não pode importá-lo
 * estaticamente. Um ambiente por arquivo (registro de módulos próprio, Prisma carregado uma vez).
 */
export async function criarAppEm(appEnv: string): Promise<AppEmAmbiente> {
  const original = process.env.APP_ENV
  process.env.APP_ENV = appEnv
  const { criarApp } = jest.requireActual<typeof import('../setup/criar-app')>('../setup/criar-app')
  const contexto = await criarApp()
  return {
    ...contexto,
    encerrar: async () => {
      await contexto.app.close()
      if (original === undefined) delete process.env.APP_ENV
      else process.env.APP_ENV = original
    },
  }
}
