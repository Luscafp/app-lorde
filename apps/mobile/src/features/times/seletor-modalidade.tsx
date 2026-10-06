import type { TimeDto } from '@atletica/shared'
import { ActivityIndicator, View } from 'react-native'
import { Texto } from '@/components/ui'
import { paleta } from '@/features/atletica'
import { ModalidadeIcone, useModalidades } from '@/features/modalidades'
import { OpcaoRadio } from './opcao-radio'

type Props = {
  valor: string | undefined
  aoMudar: (id: string) => void
  /** Modalidade do time em edição: se estiver inativa, só é mantida, não oferecida. */
  atual?: TimeDto['modalidade']
  erro?: string
}

export function SeletorModalidade({ valor, aoMudar, atual, erro }: Props) {
  const { data: ativas, isError } = useModalidades()
  const atualInativa =
    !!atual && !!ativas && valor === atual.id && !ativas.some(({ id }) => id === atual.id)

  return (
    <View className="gap-2">
      <Texto variante="rotulo">Modalidade</Texto>
      {!ativas && !isError && <ActivityIndicator color={paleta['texto-suave']} />}
      {isError && <Texto variante="legenda">Não foi possível carregar as modalidades.</Texto>}
      {ativas?.length === 0 && (
        <Texto variante="legenda">Cadastre uma modalidade antes de criar o time.</Texto>
      )}
      {atualInativa && (
        <Texto variante="legenda">
          {`${atual.nome} está inativa. Para trocar, escolha uma das modalidades abaixo.`}
        </Texto>
      )}
      <View accessibilityRole="radiogroup" className="flex-row flex-wrap gap-2">
        {ativas?.map((modalidade) => (
          <OpcaoRadio
            key={modalidade.id}
            rotulo={modalidade.nome}
            marcada={modalidade.id === valor}
            aoEscolher={() => aoMudar(modalidade.id)}
            icone={(cor) => <ModalidadeIcone icone={modalidade.icone} tamanho={20} cor={cor} />}
          />
        ))}
      </View>
      {erro && (
        <Texto variante="erro" accessibilityLiveRegion="polite">
          {erro}
        </Texto>
      )}
    </View>
  )
}
