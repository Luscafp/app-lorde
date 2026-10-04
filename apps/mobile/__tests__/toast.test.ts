import Toast from 'react-native-toast-message'
import { toast } from '@/components/ui/toast'

jest.mock('react-native-toast-message', () => ({ __esModule: true, default: { show: jest.fn() } }))

describe('toast', () => {
  it.each(['sucesso', 'erro', 'info'] as const)('toast.%s mostra o tipo %s', (variante) => {
    toast[variante]('Mensagem')
    expect(Toast.show).toHaveBeenCalledWith({ type: variante, text1: 'Mensagem' })
  })
})
