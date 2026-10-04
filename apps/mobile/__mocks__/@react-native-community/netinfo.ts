type Ouvinte = (estado: object) => void

const ouvintes = new Set<Ouvinte>()
let estadoAtual: object | null = null

/** Como o NetInfo real, um ouvinte novo recebe o estado atual. `__emitir` simula uma mudança. */
const NetInfo = {
  addEventListener: jest.fn((ouvinte: Ouvinte) => {
    ouvintes.add(ouvinte)
    if (estadoAtual) ouvinte(estadoAtual)
    return () => ouvintes.delete(ouvinte)
  }),
  fetch: jest.fn(() => Promise.resolve(estadoAtual)),
  __emitir: (estado: object) => {
    estadoAtual = estado
    ouvintes.forEach((ouvinte) => ouvinte(estado))
  },
}

export default NetInfo
