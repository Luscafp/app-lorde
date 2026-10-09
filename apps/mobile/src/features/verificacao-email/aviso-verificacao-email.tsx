import { View } from 'react-native'
import { Botao, Cartao, Texto } from '@/components/ui'
import { useVerificacaoEmailStore } from './store'

/** Exibido uma vez na Home após o cadastro. */
export function AvisoVerificacaoEmail({ aoVerificar }: { aoVerificar: () => void }) {
  const email = useVerificacaoEmailStore((estado) => estado.avisoPara)
  const dispensar = useVerificacaoEmailStore((estado) => estado.dispensarAviso)

  if (!email) return null

  function abrir() {
    dispensar()
    aoVerificar()
  }

  return (
    <Cartao className="gap-3">
      <Texto accessibilityLiveRegion="polite">
        {`Enviamos um código para ${email}. Verifique seu e-mail.`}
      </Texto>
      <View className="flex-row gap-2">
        <View className="flex-1">
          <Botao titulo="Verificar e-mail" onPress={abrir} />
        </View>
        <View className="flex-1">
          <Botao titulo="Agora não" variante="secundaria" onPress={dispensar} />
        </View>
      </View>
    </Cartao>
  )
}
