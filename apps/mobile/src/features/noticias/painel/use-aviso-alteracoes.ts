import { useNavigation } from 'expo-router'
import { useCallback, useEffect, useRef } from 'react'
import { Alert } from 'react-native'

/** Confirma antes de sair com alterações; devolve a liberação para a saída após salvar. */
export function useAvisoAlteracoes(alterado: boolean): () => void {
  const navegacao = useNavigation()
  const liberado = useRef(false)

  useEffect(() => {
    if (!alterado) return
    return navegacao.addListener('beforeRemove', (evento) => {
      if (liberado.current) return
      evento.preventDefault()
      Alert.alert('Descartar alterações?', 'As alterações não salvas serão perdidas.', [
        { text: 'Continuar editando', style: 'cancel' },
        {
          text: 'Descartar',
          style: 'destructive',
          onPress: () => navegacao.dispatch(evento.data.action),
        },
      ])
    })
  }, [alterado, navegacao])

  return useCallback(() => {
    liberado.current = true
  }, [])
}
