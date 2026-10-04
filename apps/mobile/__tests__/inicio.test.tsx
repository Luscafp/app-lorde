import { render, screen } from '@testing-library/react-native'
import Inicio from '../app/index'

describe('Tela inicial provisória', () => {
  it('renderiza usando o paginacaoQuerySchema do @atletica/shared', async () => {
    await render(<Inicio />)
    expect(screen.getByText('Atlética')).toBeOnTheScreen()
    expect(screen.getByText('Paginação padrão: página 1, 20 itens')).toBeOnTheScreen()
  })
})
