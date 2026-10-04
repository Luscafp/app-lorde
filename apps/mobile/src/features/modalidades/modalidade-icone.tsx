import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons'
import { ehIconeModalidade, ICONE_MODALIDADE_PADRAO } from '@atletica/shared'
import { paleta } from '@/features/atletica'

type Props = { icone: string; tamanho?: number; cor?: string }

/** Chave fora do catálogo (ex.: app desatualizado) cai no ícone genérico. */
export function ModalidadeIcone({ icone, tamanho = 24, cor = paleta.texto }: Props) {
  const nome = ehIconeModalidade(icone) ? icone : ICONE_MODALIDADE_PADRAO
  return <MaterialCommunityIcons testID={`icone-${nome}`} name={nome} size={tamanho} color={cor} />
}
