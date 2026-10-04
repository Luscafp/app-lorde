import Ionicons from '@expo/vector-icons/Ionicons'
import { Text, View } from 'react-native'
import type { ToastConfig, ToastConfigParams } from 'react-native-toast-message'
import { paleta, useAtletica } from '@/features/atletica'

const APARENCIA = {
  sucesso: { icone: 'checkmark-circle', prefixo: 'Sucesso', cor: () => paleta.sucesso },
  erro: { icone: 'alert-circle', prefixo: 'Erro', cor: () => paleta.erro },
  info: {
    icone: 'information-circle',
    prefixo: 'Aviso',
    cor: (corPrimaria: string) => corPrimaria,
  },
} as const

type VarianteToast = keyof typeof APARENCIA

function AvisoToast({ variante, text1 }: { variante: VarianteToast; text1?: string }) {
  const { corPrimaria } = useAtletica()
  const { icone, prefixo, cor: corDaVariante } = APARENCIA[variante]
  const cor = corDaVariante(corPrimaria)

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

export const toastConfig: ToastConfig = Object.fromEntries(
  (Object.keys(APARENCIA) as VarianteToast[]).map((variante) => [
    variante,
    ({ text1 }: ToastConfigParams<unknown>) => <AvisoToast variante={variante} text1={text1} />,
  ]),
)
