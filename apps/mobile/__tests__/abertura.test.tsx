/* eslint-disable @typescript-eslint/no-require-imports */
type Rntl = typeof import('@testing-library/react-native/pure')
type SentryMock = { startInactiveSpan: jest.Mock }
type RotaInicio = typeof import('../app/(app)/(abas)/index')

const DSN = 'https://chave@o1.ingest.sentry.io/1'
const ENV_ORIGINAL = { ...process.env }
const globais = globalThis as typeof globalThis & { __DEV__: boolean }

/** Registro de módulos novo a cada teste: o layout raiz inicia o span ao ser importado, como no app. */
function montarApp(dsn: string | undefined) {
  process.env = { ...ENV_ORIGINAL, EXPO_PUBLIC_SENTRY_DSN: dsn }
  const end = jest.fn()
  let app!: { startInactiveSpan: jest.Mock; Inicio: RotaInicio['default'] } & Rntl
  jest.isolateModules(() => {
    const { startInactiveSpan } = require('@sentry/react-native') as SentryMock
    startInactiveSpan.mockReturnValue({ end })
    require('../app/_layout')
    app = {
      ...(require('@testing-library/react-native/pure') as Rntl),
      startInactiveSpan,
      Inicio: (require('../app/(app)/(abas)/index') as RotaInicio).default,
    }
  })
  limpar = app.cleanup
  return { ...app, end }
}

let limpar: (() => unknown) | undefined

// O momento em que a Home fica pronta é testado em home.test.tsx; aqui, só a ligação do span.
jest.mock('@/features/home', () => {
  const { useMarcarHomePronta } =
    jest.requireActual<typeof import('@/infra/sentry')>('@/infra/sentry')
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native')
  return {
    TelaHome: () => {
      useMarcarHomePronta(true)
      return <Text>Início</Text>
    },
  }
})

beforeEach(() => jest.replaceProperty(globais, '__DEV__', false))
afterEach(async () => {
  await limpar?.()
  limpar = undefined
  process.env = { ...ENV_ORIGINAL }
  jest.restoreAllMocks()
})

describe('span inicio_home_pronta com o app montado (épico #30, critério 6)', () => {
  it('o layout raiz inicia o span uma vez e a Home o finaliza uma única vez', async () => {
    const { startInactiveSpan, end, Inicio, render } = montarApp(DSN)
    expect(startInactiveSpan).toHaveBeenCalledTimes(1)
    expect(startInactiveSpan).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'inicio_home_pronta' }),
    )

    const { rerender } = await render(<Inicio />)
    await rerender(<Inicio />)
    expect(end).toHaveBeenCalledTimes(1)
  })

  it('sem DSN nenhum span é criado e a Home renderiza sem falhar', async () => {
    const { startInactiveSpan, Inicio, render } = montarApp(undefined)
    const tela = await render(<Inicio />)

    expect(tela.queryByText('Início')).not.toBeNull()
    expect(startInactiveSpan).not.toHaveBeenCalled()
  })
})
