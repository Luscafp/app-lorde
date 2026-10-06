import { useNavigation } from 'expo-router'
import { useCallback, useEffect, useRef } from 'react'
import { confirmar } from '@/components/ui'

/** Confirma antes de sair com alterações; devolve a liberação para a saída após salvar. */
export function useAvisoAlteracoes(alterado: boolean): () => void {
  const navegacao = useNavigation()
  const liberado = useRef(false)

  useEffect(() => {
    if (!alterado) return
    return navegacao.addListener('beforeRemove', (evento) => {
      if (liberado.current) return
      evento.preventDefault()
      confirmar({
        titulo: 'Descartar alterações?',
        mensagem: 'As alterações não salvas serão perdidas.',
        acao: 'Descartar',
        cancelar: 'Continuar editando',
        aoConfirmar: () => navegacao.dispatch(evento.data.action),
      })
    })
  }, [alterado, navegacao])

  return useCallback(() => {
    liberado.current = true
  }, [])
}
