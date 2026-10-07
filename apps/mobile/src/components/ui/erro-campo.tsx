import { Texto } from './texto'

export function ErroCampo({ mensagem }: { mensagem?: string }) {
  if (!mensagem) return null
  return (
    <Texto variante="erro" accessibilityLiveRegion="polite">
      {mensagem}
    </Texto>
  )
}
