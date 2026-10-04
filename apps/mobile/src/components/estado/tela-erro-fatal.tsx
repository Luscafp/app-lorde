import * as Updates from 'expo-updates'
import { EstadoErro } from './estado-erro'

export function TelaErroFatal() {
  return (
    <EstadoErro
      mensagem="Algo deu errado. Tente reabrir o aplicativo."
      icone="warning-outline"
      tituloBotao="Recarregar"
      onTentarNovamente={() => void Updates.reloadAsync()}
    />
  )
}
