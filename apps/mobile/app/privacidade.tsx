import { politicaDePrivacidade } from '@atletica/shared'
import { TelaDocumentoLegal } from '@/features/legal'

export default function Privacidade() {
  return <TelaDocumentoLegal documento={politicaDePrivacidade} />
}
