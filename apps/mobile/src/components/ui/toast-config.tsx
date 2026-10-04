import Ionicons from '@expo/vector-icons/Ionicons'
import { Pressable, Text, View } from 'react-native'
import Toast, { type ToastConfig, type ToastConfigParams } from 'react-native-toast-message'
import { paleta, useAtletica } from '@/features/atletica'
import type { AcaoToast } from './toast'

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

type PropsAviso = { variante: VarianteToast; text1?: string; acao?: AcaoToast }

function AvisoToast({ variante, text1, acao }: PropsAviso) {
  const { corPrimaria } = useAtletica()
  const { icone, prefixo, cor: corDaVariante } = APARENCIA[variante]
  const cor = corDaVariante(corPrimaria)

  return (
    <View
      testID={`toast-${variante}`}
      // Com ação, o botão precisa ser focável separadamente pelo leitor de tela.
      accessible={!acao}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      accessibilityLabel={`${prefixo}: ${text1 ?? ''}`}
      className="mx-4 w-11/12 flex-row items-center gap-3 rounded-2xl border bg-cartao px-4 py-3"
      style={{ borderColor: cor }}
    >
      <Ionicons name={icone} size={22} color={cor} />
      <Text className="flex-1 text-sm font-semibold text-texto">{text1}</Text>
      {acao && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={acao.titulo}
          onPress={() => {
            Toast.hide()
            acao.onPress()
          }}
          className="min-h-[44px] justify-center px-2"
        >
          <Text className="text-sm font-semibold" style={{ color: cor }}>
            {acao.titulo}
          </Text>
        </Pressable>
      )}
    </View>
  )
}

type PropsToast = { acao?: AcaoToast } | undefined

export const toastConfig: ToastConfig = Object.fromEntries(
  (Object.keys(APARENCIA) as VarianteToast[]).map((variante) => [
    variante,
    ({ text1, props }: ToastConfigParams<PropsToast>) => (
      <AvisoToast variante={variante} text1={text1} acao={props?.acao} />
    ),
  ]),
)
