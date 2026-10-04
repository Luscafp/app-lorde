import Ionicons from '@expo/vector-icons/Ionicons'
import { Text, View } from 'react-native'
import type { ToastConfig, ToastConfigParams } from 'react-native-toast-message'
import { paleta, useAtletica } from '@/features/atletica'

type VarianteToast = 'sucesso' | 'erro' | 'info'

const APARENCIA = {
  sucesso: { icone: 'checkmark-circle', prefixo: 'Sucesso' },
  erro: { icone: 'alert-circle', prefixo: 'Erro' },
  info: { icone: 'information-circle', prefixo: 'Aviso' },
} as const

function useCor(variante: VarianteToast) {
  const { corPrimaria } = useAtletica()
  if (variante === 'sucesso') return paleta.sucesso
  if (variante === 'erro') return paleta.erro
  return corPrimaria
}

function AvisoToast({ variante, text1 }: { variante: VarianteToast; text1?: string }) {
  const cor = useCor(variante)
  const { icone, prefixo } = APARENCIA[variante]

  return (
    <View
      testID={`toast-${variante}`}
      accessible
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      accessibilityLabel={`${prefixo}: ${text1 ?? ''}`}
      className="mx-4 w-11/12 flex-row items-center gap-3 rounded-2xl border bg-cartao px-4 py-3"
      style={{ borderColor: cor }}
    >
      <Ionicons name={icone} size={22} color={cor} />
      <Text className="flex-1 text-sm font-semibold text-texto">{text1}</Text>
    </View>
  )
}

export const toastConfig: ToastConfig = {
  sucesso: ({ text1 }: ToastConfigParams<unknown>) => (
    <AvisoToast variante="sucesso" text1={text1} />
  ),
  erro: ({ text1 }: ToastConfigParams<unknown>) => <AvisoToast variante="erro" text1={text1} />,
  info: ({ text1 }: ToastConfigParams<unknown>) => <AvisoToast variante="info" text1={text1} />,
}
