import { zodResolver } from '@hookform/resolvers/zod'
import { nomeTimeSchema, type EventoDto, type TimeDto } from '@atletica/shared'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { Modal, ScrollView, View } from 'react-native'
import { z } from 'zod'
import { FaixaOffline } from '@/components/estado'
import { Botao, Campo, Texto, toast } from '@/components/ui'
import { BuscaAdversaria, useCriarTime, type AtleticaEscolhida } from '@/features/times'
import { aplicarErrosDaApi } from '@/infra/api/aplicar-erros'
import type { ApiErro } from '@/infra/api/cliente'
import { mostrarErroDaMutacao } from '@/infra/query/query-client'

const adversarioRapidoSchema = z.object({
  atleticaAdversariaId: z.uuid({ error: 'Escolha a atlética adversária.' }),
  nome: nomeTimeSchema,
})

type Props = {
  /** Fixa: a do time da atlética (RN11). */
  modalidade: EventoDto['modalidade']
  aoCriar: (time: TimeDto) => void
  aoFechar: () => void
}

/** UC16 A4: a atlética nova é gravada pelo `FormAtleticaAdversaria` (#65) antes do time. */
export function AdversarioRapidoSheet({ modalidade, aoCriar, aoFechar }: Props) {
  const criar = useCriarTime()
  const [atletica, setAtletica] = useState<AtleticaEscolhida | null>(null)
  const form = useForm<
    z.input<typeof adversarioRapidoSchema>,
    unknown,
    z.output<typeof adversarioRapidoSchema>
  >({
    resolver: zodResolver(adversarioRapidoSchema),
    mode: 'onBlur',
    defaultValues: { atleticaAdversariaId: '', nome: '' },
  })

  function enviar({ atleticaAdversariaId, nome }: z.output<typeof adversarioRapidoSchema>) {
    criar.mutate(
      { nome, modalidadeId: modalidade.id, atleticaAdversariaId },
      {
        onSuccess: (time) => {
          toast.sucesso('Adversário cadastrado')
          aoCriar(time)
        },
        onError: (erro: ApiErro) => {
          if (!aplicarErrosDaApi(form, erro)) mostrarErroDaMutacao(erro)
        },
      },
    )
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={aoFechar}>
      <View className="flex-1 justify-end bg-black/60">
        <ScrollView
          className="max-h-[90%] grow-0 rounded-t-3xl bg-superficie"
          contentContainerClassName="gap-4 p-4 pb-8"
          keyboardShouldPersistTaps="handled"
        >
          <Texto variante="subtitulo">Cadastrar adversário</Texto>
          {!criar.online && <FaixaOffline />}
          <Texto variante="legenda">{`Modalidade: ${modalidade.nome}`}</Texto>
          <Controller
            control={form.control}
            name="atleticaAdversariaId"
            render={({ field, fieldState }) => (
              <View className="gap-1">
                <Texto variante="rotulo">Atlética adversária</Texto>
                <BuscaAdversaria
                  selecionada={atletica}
                  aoSelecionar={(escolhida) => {
                    setAtletica(escolhida)
                    field.onChange(escolhida.id)
                  }}
                />
                {fieldState.error?.message && (
                  <Texto variante="erro" accessibilityLiveRegion="polite">
                    {fieldState.error.message}
                  </Texto>
                )}
              </View>
            )}
          />
          <Campo controle={form.control} nome="nome" rotulo="Nome do time" autoCapitalize="words" />
          <View className="flex-row gap-3">
            <Botao titulo="Cancelar" variante="secundaria" className="flex-1" onPress={aoFechar} />
            <Botao
              titulo="Salvar adversário"
              className="flex-1"
              carregando={criar.isPending}
              disabled={!criar.online}
              onPress={() => void form.handleSubmit(enviar)()}
            />
          </View>
        </ScrollView>
      </View>
    </Modal>
  )
}
