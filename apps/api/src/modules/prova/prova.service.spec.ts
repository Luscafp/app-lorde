import { ProvaService } from './prova.service'

it('cobre só um método', () => {
  expect(new ProvaService().sinal(1)).toBe('positivo')
})
