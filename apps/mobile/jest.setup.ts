jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual<object>('@react-native-async-storage/async-storage/jest/async-storage-mock'),
)

jest.mock('expo-secure-store', () => {
  const itens = new Map<string, string>()
  return {
    __itens: itens,
    getItemAsync: jest.fn((chave: string) => Promise.resolve(itens.get(chave) ?? null)),
    setItemAsync: jest.fn((chave: string, valor: string) => {
      itens.set(chave, valor)
      return Promise.resolve()
    }),
    deleteItemAsync: jest.fn((chave: string) => {
      itens.delete(chave)
      return Promise.resolve()
    }),
  }
})
