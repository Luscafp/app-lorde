import { fireEvent, screen } from '@testing-library/react-native'
import { useState } from 'react'
import { TextInput } from 'react-native'
import { CampoCodigo } from '@/components/ui'
import { renderizar } from '../test-utils/renderizar'

const caixa = (posicao: number) => screen.getByLabelText(`Dígito ${posicao} de 6`)
const valores = () =>
  [1, 2, 3, 4, 5, 6].map((posicao) => (caixa(posicao).props as { value: string }).value)

function Controlado({
  aoMudar,
  inicial = '',
}: {
  aoMudar?: (v: string) => void
  inicial?: string
}) {
  const [valor, setValor] = useState(inicial)
  return (
    <>
      <CampoCodigo
        valor={valor}
        aoMudar={(novo) => {
          setValor(novo)
          aoMudar?.(novo)
        }}
      />
      <TextInput accessibilityLabel="limpar" onChangeText={() => setValor('')} />
    </>
  )
}

/** Rótulos das caixas que receberam foco, em ordem. */
const focadas: string[] = []
let foco: jest.SpyInstance

beforeEach(() => {
  foco = jest.spyOn(TextInput.prototype, 'focus').mockImplementation(function (this: TextInput) {
    focadas.push((this.props as { accessibilityLabel?: string }).accessibilityLabel ?? '')
  })
  focadas.length = 0
})

afterEach(() => foco.mockRestore())

describe('CampoCodigo', () => {
  it('tem 6 caixas numéricas com preenchimento automático de código', async () => {
    await renderizar(<Controlado />)

    for (let posicao = 1; posicao <= 6; posicao++) {
      expect(caixa(posicao).props).toMatchObject({
        keyboardType: 'number-pad',
        textContentType: 'oneTimeCode',
        autoComplete: 'sms-otp',
      })
    }
  })

  it('digitar avança o foco para a próxima caixa', async () => {
    const aoMudar = jest.fn()
    await renderizar(<Controlado aoMudar={aoMudar} />)

    await fireEvent.changeText(caixa(1), '4')
    await fireEvent.changeText(caixa(2), '8')

    expect(valores()).toEqual(['4', '8', '', '', '', ''])
    expect(aoMudar).toHaveBeenLastCalledWith('48')
    expect(focadas).toEqual(['Dígito 2 de 6', 'Dígito 3 de 6'])
  })

  it('digitar numa caixa preenchida troca o dígito', async () => {
    await renderizar(<Controlado inicial="12" />)

    await fireEvent.changeText(caixa(1), '19')

    expect(valores().slice(0, 2)).toEqual(['9', '2'])
  })

  it('ignora o que não é dígito', async () => {
    const aoMudar = jest.fn()
    await renderizar(<Controlado aoMudar={aoMudar} />)

    await fireEvent.changeText(caixa(1), 'a')

    expect(valores()[0]).toBe('')
  })

  it('backspace numa caixa vazia apaga a anterior e volta o foco', async () => {
    const aoMudar = jest.fn()
    await renderizar(<Controlado inicial="123" aoMudar={aoMudar} />)

    await fireEvent(caixa(4), 'keyPress', { nativeEvent: { key: 'Backspace' } })

    expect(valores()).toEqual(['1', '2', '', '', '', ''])
    expect(aoMudar).toHaveBeenLastCalledWith('12')
    expect(focadas).toEqual(['Dígito 3 de 6'])
  })

  it('backspace numa caixa preenchida só apaga ela', async () => {
    await renderizar(<Controlado inicial="123" />)

    // No aparelho, onKeyPress vem antes de onChangeText.
    await fireEvent(caixa(3), 'keyPress', { nativeEvent: { key: 'Backspace' } })
    await fireEvent.changeText(caixa(3), '')

    expect(valores()).toEqual(['1', '2', '', '', '', ''])
  })

  it('colar 6 dígitos em qualquer caixa preenche todas', async () => {
    const aoMudar = jest.fn()
    await renderizar(<Controlado aoMudar={aoMudar} />)

    await fireEvent.changeText(caixa(3), '048 213')

    expect(valores()).toEqual(['0', '4', '8', '2', '1', '3'])
    expect(aoMudar).toHaveBeenLastCalledWith('048213')
  })

  it('o pai limpar o valor esvazia as caixas', async () => {
    await renderizar(<Controlado inicial="048213" />)
    expect(valores()).toEqual(['0', '4', '8', '2', '1', '3'])

    await fireEvent.changeText(screen.getByLabelText('limpar'), 'x')

    expect(valores()).toEqual(['', '', '', '', '', ''])
  })
})
