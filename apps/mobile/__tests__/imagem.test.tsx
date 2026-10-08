import { fireEvent, screen } from '@testing-library/react-native'
import { Imagem, iniciais, TRANSICAO_IMAGEM_MS } from '@/components/imagem/imagem'
import { renderizar } from '../test-utils/renderizar'

const URL = 'https://img.exemplo.com/usuarios/u1/perfil/a.jpg'

describe('Imagem', () => {
  it('usa expo-image com cache em memória e disco e transição de 150 ms', async () => {
    await renderizar(<Imagem uri={URL} rotulo="Foto de perfil" />)

    const imagem = screen.getByTestId('imagem')
    expect(imagem.props).toMatchObject({
      source: { uri: URL },
      cachePolicy: 'memory-disk',
      transition: TRANSICAO_IMAGEM_MS,
    })
    expect(TRANSICAO_IMAGEM_MS).toBe(150)
    expect(screen.getByTestId('imagem-placeholder')).toBeOnTheScreen()
    expect(screen.getByRole('image', { name: 'Foto de perfil' })).toBeOnTheScreen()
  })

  it('sem URL mostra as iniciais do nome', async () => {
    await renderizar(<Imagem uri={null} nome="Ana Souza" />)

    expect(screen.queryByTestId('imagem')).toBeNull()
    expect(screen.getByText('AS')).toBeOnTheScreen()
  })

  it('erro ao carregar troca a imagem pelas iniciais', async () => {
    await renderizar(<Imagem uri={URL} nome="Bruno" />)

    await fireEvent(screen.getByTestId('imagem'), 'error')

    expect(screen.queryByTestId('imagem')).toBeNull()
    expect(screen.getByText('B')).toBeOnTheScreen()
  })

  it('textoFallback substitui as iniciais', async () => {
    await renderizar(<Imagem uri={null} nome="Atlética de Computação" textoFallback="AAC" />)
    expect(screen.getByText('AAC')).toBeOnTheScreen()
  })

  it('sem nome, o fallback é um placeholder neutro', async () => {
    await renderizar(<Imagem uri={undefined} />)
    expect(screen.getByTestId('imagem-fallback')).toBeOnTheScreen()
  })
})

describe('iniciais', () => {
  it.each([
    ['Ana', 'A'],
    ['ana souza', 'AS'],
    ['  Maria da   Silva ', 'MS'],
    ['', ''],
  ])('%p → %p', (nome, esperado) => {
    expect(iniciais(nome)).toBe(esperado)
  })
})
