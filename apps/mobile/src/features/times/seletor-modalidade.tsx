import type { TimeDto } from '@atletica/shared'
import { ActivityIndicator, Pressable, View } from 'react-native'
import { Texto } from '@/components/ui'
import { paleta, useAtletica } from '@/features/atletica'
import { ModalidadeIcone, useModalidades } from '@/features/modalidades'

type Props = {
  valor: string | undefined
  aoMudar: (id: string) => void
  /** A do time em edição continua visível mesmo se tiver sido desativada. */
  atual?: TimeDto['modalidade']
  erro?: string
}

export function SeletorModalidade({ valor, aoMudar, atual, erro }: Props) {
  const { corPrimaria } = useAtletica()
  const { data: ativas, isError } = useModalidades()
  const opcoes =
    atual && ativas && !ativas.some(({ id }) => id === atual.id) ? [atual, ...ativas] : ativas

  return (
    <View className="gap-2">
      <Texto variante="rotulo">Modalidade</Texto>
      {!opcoes && !isError && <ActivityIndicator color={paleta['texto-suave']} />}
      {isError && <Texto variante="legenda">Não foi possível carregar as modalidades.</Texto>}
      {opcoes?.length === 0 && (
        <Texto variante="legenda">Cadastre uma modalidade antes de criar o time.</Texto>
      )}
      <View accessibilityRole="radiogroup" className="flex-row flex-wrap gap-2">
        {opcoes?.map((modalidade) => {
          const selecionada = modalidade.id === valor
          const cor = selecionada ? corPrimaria : paleta.texto
          return (
            <Pressable
              key={modalidade.id}
              accessibilityRole="radio"
              accessibilityLabel={modalidade.nome}
              accessibilityState={{ selected: selecionada }}
              onPress={() => aoMudar(modalidade.id)}
              className="min-h-[44px] flex-row items-center gap-2 rounded-xl border-2 bg-superficie px-3"
              style={{ borderColor: selecionada ? corPrimaria : paleta.borda }}
            >
              <ModalidadeIcone icone={modalidade.icone} tamanho={20} cor={cor} />
              <Texto style={{ color: cor }}>{modalidade.nome}</Texto>
            </Pressable>
          )
        })}
      </View>
      {erro && (
        <Texto variante="erro" accessibilityLiveRegion="polite">
          {erro}
        </Texto>
      )}
    </View>
  )
}
