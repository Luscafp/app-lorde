import {
  formatarData,
  localParaUtc,
  MESES_MAX_SERIE,
  somarMeses,
  type Recorrencia,
} from '@atletica/shared'
import { Controller, type Control } from 'react-hook-form'
import { Pressable, Switch, Text, View } from 'react-native'
import { Campo, ErroCampo, mascararData, Texto } from '@/components/ui'
import { corTextoSobre, paleta, useAtletica } from '@/features/atletica'
import { contarTreinos, dataHoraComSemana } from '../formatacao'
import type { EventoFormEntrada, EventoFormSaida } from '../schemas'

const DIAS = [
  { sigla: 'D', nome: 'Domingo' },
  { sigla: 'S', nome: 'Segunda' },
  { sigla: 'T', nome: 'Terça' },
  { sigla: 'Q', nome: 'Quarta' },
  { sigla: 'Q', nome: 'Quinta' },
  { sigla: 'S', nome: 'Sexta' },
  { sigla: 'S', nome: 'Sábado' },
] as const

export type PreviaSerie = { total: number; primeira?: Date; ultima?: Date }

type Props = {
  controle: Control<EventoFormEntrada, unknown, EventoFormSaida>
  recorrente: boolean
  /** Sem ela (datas ou horário incompletos), não há prévia nem limite de data. */
  recorrencia?: Recorrencia
  previa?: PreviaSerie
}

function DiasSemana({ controle }: Pick<Props, 'controle'>) {
  const { corPrimaria } = useAtletica()
  return (
    <Controller
      control={controle}
      name="diasSemana"
      render={({ field, fieldState }) => (
        <View className="gap-2">
          <Texto variante="rotulo">Dias da semana</Texto>
          <View accessibilityLabel="Dias da semana" className="flex-row justify-between">
            {DIAS.map(({ sigla, nome }, dia) => {
              const marcado = field.value.includes(dia)
              return (
                <Pressable
                  key={nome}
                  accessibilityRole="checkbox"
                  accessibilityLabel={nome}
                  accessibilityState={{ checked: marcado }}
                  onPress={() =>
                    field.onChange(
                      marcado ? field.value.filter((d) => d !== dia) : [...field.value, dia],
                    )
                  }
                  className="h-11 w-11 items-center justify-center rounded-full border"
                  style={{
                    borderColor: marcado ? corPrimaria : paleta.borda,
                    backgroundColor: marcado ? corPrimaria : 'transparent',
                  }}
                >
                  <Text
                    className="font-semibold"
                    style={{ color: marcado ? corTextoSobre(corPrimaria) : paleta.texto }}
                  >
                    {sigla}
                  </Text>
                </Pressable>
              )
            })}
          </View>
          <ErroCampo mensagem={fieldState.error?.message} />
        </View>
      )}
    />
  )
}

function SeriePrevia({ previa }: { previa: PreviaSerie }) {
  const { total, primeira, ultima } = previa
  if (total === 0 || !primeira || !ultima) {
    return <Texto variante="legenda">Nenhuma data corresponde aos dias escolhidos</Texto>
  }
  return (
    <Texto accessibilityLiveRegion="polite">
      {`${contarTreinos(total)} · primeiro em ${dataHoraComSemana(primeira)} · último em ${dataHoraComSemana(ultima)}`}
    </Texto>
  )
}

/** RF30: desligado por padrão; ligado, revela dias, "Repetir até" e a prévia. */
export function RecorrenciaCampos({ controle, recorrente, recorrencia, previa }: Props) {
  const { corPrimaria } = useAtletica()
  const limite = recorrencia && somarMeses(recorrencia.dataInicio, MESES_MAX_SERIE)

  return (
    <View className="gap-4">
      <Controller
        control={controle}
        name="recorrente"
        render={({ field }) => (
          <View className="min-h-[44px] flex-row items-center justify-between">
            <Texto variante="rotulo">Treino recorrente</Texto>
            <Switch
              accessibilityLabel="Treino recorrente"
              value={field.value}
              onValueChange={field.onChange}
              trackColor={{ true: corPrimaria, false: paleta.borda }}
            />
          </View>
        )}
      />
      {recorrente && (
        <>
          <DiasSemana controle={controle} />
          <View className="gap-1">
            <Campo
              controle={controle}
              nome="dataFim"
              rotulo="Repetir até"
              placeholder="dd/mm/aaaa"
              keyboardType="number-pad"
              maxLength={10}
              mascara={mascararData}
            />
            {limite && (
              <Texto variante="legenda">
                {`No máximo ${MESES_MAX_SERIE} meses: até ${formatarData(localParaUtc(limite, '12:00'))}`}
              </Texto>
            )}
          </View>
          {previa && <SeriePrevia previa={previa} />}
        </>
      )}
    </View>
  )
}
