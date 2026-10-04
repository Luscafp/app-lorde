import { act, renderHook } from '@testing-library/react-native'
import { useForm } from 'react-hook-form'
import { aplicarErrosDaApi } from '@/infra/api/aplicar-erros'
import { ApiErro } from '@/infra/api/cliente'

type Formulario = { email: string; endereco: { cidade: string }; tags: string[] }

const erroDeValidacao = new ApiErro({
  status: 400,
  code: 'VALIDATION_ERROR',
  message: 'Dados inválidos.',
  details: [
    { field: 'email', message: 'E-mail inválido' },
    { field: 'endereco.cidade', message: 'Obrigatória' },
    { field: 'tags.0', message: 'Tag vazia' },
  ],
})

describe('aplicarErrosDaApi', () => {
  it('leva campos simples e em notação de ponto ao formulário', async () => {
    const { result } = await renderHook(() => useForm<Formulario>())

    let aplicou = false
    await act(() => {
      aplicou = aplicarErrosDaApi(result.current, erroDeValidacao)
    })

    expect(aplicou).toBe(true)
    const mensagem = (campo: 'email' | 'endereco.cidade' | 'tags.0') =>
      result.current.getFieldState(campo).error?.message
    expect(mensagem('email')).toBe('E-mail inválido')
    expect(mensagem('endereco.cidade')).toBe('Obrigatória')
    expect(mensagem('tags.0')).toBe('Tag vazia')
  })

  it('ignora erro sem details ou que não é ApiErro', () => {
    const form = { setError: jest.fn() }

    expect(aplicarErrosDaApi(form, new ApiErro({ status: 409, code: 'X', message: 'x' }))).toBe(
      false,
    )
    expect(aplicarErrosDaApi(form, new Error('x'))).toBe(false)
    expect(form.setError).not.toHaveBeenCalled()
  })
})
