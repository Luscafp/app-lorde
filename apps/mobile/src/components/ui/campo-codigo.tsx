import { useRef, useState } from 'react'
import { TextInput, View } from 'react-native'

export const DIGITOS_CODIGO = 6

type Props = {
  valor: string
  aoMudar: (codigo: string) => void
  erro?: boolean
  autoFocus?: boolean
}

const vazio = () => Array.from({ length: DIGITOS_CODIGO }, () => '')

function digitosDe(valor: string): string[] {
  return vazio().map((_, indice) => valor[indice] ?? '')
}

/** Código numérico em 6 caixas; colar ou o preenchimento automático distribuem os dígitos. */
export function CampoCodigo({ valor, aoMudar, erro = false, autoFocus }: Props) {
  const [digitos, setDigitos] = useState(() => digitosDe(valor))
  const caixas = useRef<(TextInput | null)[]>([])

  // O pai trocou o valor (ex.: limpar após CODIGO_INVALIDO).
  if (valor !== digitos.join('')) setDigitos(digitosDe(valor))

  function atualizar(novos: string[], foco: number) {
    setDigitos(novos)
    aoMudar(novos.join(''))
    caixas.current[Math.min(Math.max(foco, 0), DIGITOS_CODIGO - 1)]?.focus()
  }

  function aoDigitar(indice: number, texto: string) {
    const anterior = digitos[indice] ?? ''
    let numeros = texto.replace(/\D/g, '')
    // Caixa já preenchida recebe o dígito antigo + o novo: fica o novo.
    if (numeros.length === 2 && anterior) {
      numeros = numeros.startsWith(anterior) ? numeros.slice(1) : numeros.slice(0, 1)
    }

    const novos = [...digitos]
    if (numeros.length === 0) {
      novos[indice] = ''
      atualizar(novos, indice)
      return
    }
    const inicio = numeros.length >= DIGITOS_CODIGO ? 0 : indice
    const colados = numeros.slice(0, DIGITOS_CODIGO - inicio).split('')
    colados.forEach((digito, deslocamento) => (novos[inicio + deslocamento] = digito))
    atualizar(novos, inicio + colados.length)
  }

  function aoApagar(indice: number) {
    if (digitos[indice] || indice === 0) return
    const novos = [...digitos]
    novos[indice - 1] = ''
    atualizar(novos, indice - 1)
  }

  return (
    <View className="flex-row justify-between gap-2" accessibilityRole="none">
      {digitos.map((digito, indice) => (
        <TextInput
          key={indice}
          ref={(caixa) => {
            caixas.current[indice] = caixa
          }}
          value={digito}
          onChangeText={(texto) => aoDigitar(indice, texto)}
          onKeyPress={({ nativeEvent }) => {
            if (nativeEvent.key === 'Backspace') aoApagar(indice)
          }}
          autoFocus={autoFocus && indice === 0}
          keyboardType="number-pad"
          // Sem maxLength=1: o sistema cortaria o código colado ou preenchido automaticamente.
          maxLength={DIGITOS_CODIGO}
          textContentType="oneTimeCode"
          autoComplete="sms-otp"
          selectTextOnFocus
          accessibilityLabel={`Dígito ${indice + 1} de ${DIGITOS_CODIGO}`}
          className={`h-14 flex-1 rounded-xl border bg-superficie text-center text-2xl font-semibold text-texto ${
            erro ? 'border-erro' : 'border-borda'
          }`}
        />
      ))}
    </View>
  )
}
