import { vars } from 'nativewind'
import { useMemo, type ReactNode } from 'react'
import { View } from 'react-native'
import { hexParaRgb } from './cores'
import { useAtletica, type Atletica } from './use-atletica'

type CoresAtletica = Pick<Atletica, 'corPrimaria' | 'corSecundaria'>

export function variaveisTema(cores: CoresAtletica) {
  return {
    '--cor-primaria': hexParaRgb(cores.corPrimaria),
    '--cor-secundaria': hexParaRgb(cores.corSecundaria),
  }
}

export function ProvedorTema({ children }: { children: ReactNode }) {
  const { corPrimaria, corSecundaria } = useAtletica()
  const tema = useMemo(
    () => vars(variaveisTema({ corPrimaria, corSecundaria })),
    [corPrimaria, corSecundaria],
  )
  return (
    <View testID="provedor-tema" className="flex-1 bg-fundo" style={tema}>
      {children}
    </View>
  )
}
