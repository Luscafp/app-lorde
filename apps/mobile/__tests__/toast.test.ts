import Toast from 'react-native-toast-message'
import { toast } from '@/components/ui/toast'

jest.mock('react-native-toast-message', () => ({
  __esModule: true,
  default: { show: jest.fn(), hide: jest.fn() },
}))

describe('toast', () => {
  it.each(['sucesso', 'erro', 'info'] as const)('toast.%s mostra o tipo %s', (variante) => {
    toast[variante]('Mensagem')
    expect(Toast.show).toHaveBeenCalledWith({ type: variante, text1: 'Mensagem' })
  })

  it('com ação, mostra o texto da ação e o toque esconde o toast e chama aoTocar', () => {
    const aoTocar = jest.fn()
    toast.erro('Permissão negada.', { rotulo: 'Abrir configurações', aoTocar })

    const opcoes = jest.mocked(Toast.show).mock.lastCall?.[0]
    expect(opcoes).toMatchObject({
      type: 'erro',
      text1: 'Permissão negada.',
      text2: 'Abrir configurações',
    })
    opcoes?.onPress?.()
    expect(Toast.hide).toHaveBeenCalled()
    expect(aoTocar).toHaveBeenCalled()
  })
})
