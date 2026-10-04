import { zodResolver } from '@hookform/resolvers/zod'
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { useForm } from 'react-hook-form'
import { View } from 'react-native'
import Toast from 'react-native-toast-message'
import { z } from 'zod'
import { Botao, Campo, toastConfig } from '@/components/ui'

describe('Botao', () => {
  it('tem papel e rótulo de acessibilidade', async () => {
    const onPress = jest.fn()
    await render(<Botao titulo="Salvar" onPress={onPress} />)
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar' }))
    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('carregando mostra o spinner e não aceita toques', async () => {
    const onPress = jest.fn()
    await render(<Botao titulo="Salvar" carregando onPress={onPress} />)
    const botao = screen.getByRole('button', { name: 'Salvar' })

    await fireEvent.press(botao)

    expect(screen.getByTestId('botao-spinner')).toBeOnTheScreen()
    expect(botao).toBeDisabled()
    expect(botao).toBeBusy()
    expect(onPress).not.toHaveBeenCalled()
  })

  it('disabled não aceita toques', async () => {
    const onPress = jest.fn()
    await render(<Botao titulo="Salvar" disabled onPress={onPress} />)
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar' }))
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled()
    expect(onPress).not.toHaveBeenCalled()
  })

  it('muda a aparência ao encostar o dedo (onPressIn)', async () => {
    await render(<Botao titulo="Salvar" />)
    const botao = screen.getByRole('button', { name: 'Salvar' })
    expect(botao).toHaveStyle({ opacity: 1 })
    await fireEvent(botao, 'pressIn')
    expect(botao).toHaveStyle({ opacity: 0.7 })
    await fireEvent(botao, 'pressOut')
    expect(botao).toHaveStyle({ opacity: 1 })
  })
})

const schema = z.object({ email: z.email('Informe um e-mail válido.') })
type Dados = z.infer<typeof schema>

function Formulario({ aoEnviar }: { aoEnviar: (dados: Dados) => void }) {
  const form = useForm({
    resolver: zodResolver(schema),
    mode: 'onBlur',
    defaultValues: { email: '' },
  })
  return (
    <View>
      <Campo controle={form.control} nome="email" rotulo="E-mail" />
      <Botao titulo="Enviar" onPress={() => void form.handleSubmit(aoEnviar)()} />
    </View>
  )
}

describe('Campo', () => {
  it('mostra o erro do Zod abaixo do campo e mantém o valor digitado', async () => {
    const aoEnviar = jest.fn()
    await render(<Formulario aoEnviar={aoEnviar} />)

    await fireEvent.changeText(screen.getByLabelText('E-mail'), 'invalido')
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar' }))

    expect(await screen.findByText('Informe um e-mail válido.')).toBeOnTheScreen()
    expect(screen.getByLabelText('E-mail')).toHaveDisplayValue('invalido')
    expect(aoEnviar).not.toHaveBeenCalled()
  })

  it('envia com valor válido', async () => {
    const aoEnviar = jest.fn<void, [Dados]>()
    await render(<Formulario aoEnviar={aoEnviar} />)

    await fireEvent.changeText(screen.getByLabelText('E-mail'), 'ana@exemplo.com')
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar' }))

    await waitFor(() => expect(aoEnviar).toHaveBeenCalled())
    expect(aoEnviar.mock.calls[0]?.[0]).toEqual({ email: 'ana@exemplo.com' })
    expect(screen.queryByText('Informe um e-mail válido.')).toBeNull()
  })
})

describe('toastConfig', () => {
  it.each([
    ['sucesso', 'Sucesso'],
    ['erro', 'Erro'],
    ['info', 'Aviso'],
  ] as const)('renderiza a variante %s com texto e rótulo acessível', async (tipo, prefixo) => {
    const renderizar = toastConfig[tipo]
    if (!renderizar) throw new Error(`variante ausente: ${tipo}`)
    await render(
      <>
        {renderizar({
          type: tipo,
          text1: 'Mensagem',
          position: 'top',
          isVisible: true,
          visibilityTime: 4000,
          props: {},
          show: Toast.show,
          hide: Toast.hide,
          onPress: jest.fn(),
        })}
      </>,
    )

    expect(screen.getByRole('alert', { name: `${prefixo}: Mensagem` })).toBeOnTheScreen()
  })
})
