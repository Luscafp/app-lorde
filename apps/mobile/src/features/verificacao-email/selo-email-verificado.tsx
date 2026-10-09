import { Selo } from '@/components/ui'
import { paleta } from '@/features/atletica'

export function SeloEmailVerificado({ verificado }: { verificado: boolean }) {
  return verificado ? (
    <Selo texto="E-mail verificado" cor={paleta.sucesso} />
  ) : (
    <Selo texto="E-mail não verificado" cor={paleta.alerta} />
  )
}
