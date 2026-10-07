import { zodResolver } from '@hookform/resolvers/zod'
import { OBSERVACOES_EVENTO_MAX, StatusEvento, TipoEvento, type EventoDto } from '@atletica/shared'
import { useState, type ReactNode } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { ScrollView, View } from 'react-native'
import { FaixaOffline } from '@/components/estado'
import {
  Alerta,
  Botao,
  Campo,
  confirmar,
  mascararData,
  mascararHora,
  Texto,
  toast,
} from '@/components/ui'
import { OpcaoRadio } from '@/features/times'
import { aplicarErrosDaApi } from '@/infra/api/aplicar-erros'
import type { ApiErro } from '@/infra/api/cliente'
import { mostrarErroDaMutacao } from '@/infra/query/query-client'
import { ROTULO_TIPO } from '../formatacao'
import { useAtualizarEvento, useCriarEvento } from '../hooks'
import {
  CAMPO_DO_FORM,
  eventoFormSchema,
  observacoesFormSchema,
  paraEdicao,
  valoresIniciais,
  type EventoFormEntrada,
  type EventoFormSaida,
} from '../schemas'
import { SeletorAdversario } from './seletor-adversario'
import { SeletorTimeEvento, type TimeEscolhido } from './seletor-time-evento'

const TIPOS = [TipoEvento.JOGO, TipoEvento.TREINO]

type Props = {
  /** Sem ele, cadastra um novo. */
  evento?: EventoDto
  aoSalvar: (evento: EventoDto) => void
  /** Abaixo de Data/Horário. */
  aposDataHora?: ReactNode
}

export function EventoForm({ evento, aoSalvar, aposDataHora }: Props) {
  const criar = useCriarEvento()
  const atualizar = useAtualizarEvento()
  const salvar = evento ? atualizar : criar
  const somenteObservacoes = evento?.status === StatusEvento.FINALIZADO
  const [modalidade, setModalidade] = useState(evento?.modalidade)
  const form = useForm<EventoFormEntrada, unknown, EventoFormSaida>({
    resolver: zodResolver(somenteObservacoes ? observacoesFormSchema : eventoFormSchema),
    mode: 'onBlur',
    defaultValues: valoresIniciais(evento),
  })
  const [tipo, observacoes] = useWatch({ control: form.control, name: ['tipo', 'observacoes'] })

  const callbacksDeSalvar = (mensagem: string) => ({
    onSuccess: (salvo: EventoDto) => {
      toast.sucesso(mensagem)
      aoSalvar(salvo)
    },
    onError: (erro: ApiErro) => {
      if (!aplicarErrosDaApi(form, erro, CAMPO_DO_FORM)) mostrarErroDaMutacao(erro)
    },
  })

  function gravar(dados: EventoFormSaida) {
    if (!evento) {
      if ('tipo' in dados) criar.mutate(dados, callbacksDeSalvar('Evento cadastrado'))
      return
    }
    const mudancas = paraEdicao(dados, evento)
    if (Object.keys(mudancas).length === 0) return aoSalvar(evento)
    atualizar.mutate({ id: evento.id, dados: mudancas }, callbacksDeSalvar('Evento atualizado'))
  }

  function confirmarSeNoPassado(dados: EventoFormSaida) {
    const inicioMudou =
      'inicio' in dados && (!evento || Date.parse(dados.inicio) !== Date.parse(evento.inicio))
    if (!inicioMudou || Date.parse(dados.inicio) >= Date.now()) return gravar(dados)
    confirmar({
      titulo: 'Evento no passado',
      mensagem: 'Este evento está no passado. Deseja salvar mesmo assim?',
      acao: 'Salvar',
      destrutiva: false,
      aoConfirmar: () => gravar(dados),
    })
  }

  /** Adversário de outra modalidade deixa de valer (RN11). */
  function escolherTime(escolha: TimeEscolhido, aoMudar: (id: string) => void) {
    aoMudar(escolha.time.id)
    if (escolha.modalidade.id !== modalidade?.id) form.setValue('timeAdversarioId', null)
    setModalidade(escolha.modalidade)
  }

  return (
    <View className="flex-1">
      {/* Na edição, a faixa vem do `TelaDados` da rota. */}
      {!evento && !salvar.online && <FaixaOffline />}
      <ScrollView contentContainerClassName="gap-4 p-4" keyboardShouldPersistTaps="handled">
        {somenteObservacoes && (
          <Alerta variante="alerta">
            Evento finalizado: só as observações podem ser alteradas.
          </Alerta>
        )}
        <Controller
          control={form.control}
          name="tipo"
          render={({ field }) => (
            <View className="gap-2">
              <Texto variante="rotulo">Tipo</Texto>
              <View accessibilityRole="radiogroup" className="flex-row gap-2">
                {TIPOS.map((opcao) => (
                  <View key={opcao} className="flex-1">
                    <OpcaoRadio
                      rotulo={ROTULO_TIPO[opcao]}
                      marcada={field.value === opcao}
                      desabilitada={!!evento}
                      aoEscolher={() => {
                        field.onChange(opcao)
                        if (opcao === TipoEvento.TREINO) form.setValue('timeAdversarioId', null)
                      }}
                    />
                  </View>
                ))}
              </View>
            </View>
          )}
        />
        <Controller
          control={form.control}
          name="timeId"
          render={({ field, fieldState }) => (
            <SeletorTimeEvento
              valor={field.value}
              aoMudar={(escolha) => escolherTime(escolha, field.onChange)}
              atual={evento}
              desabilitado={somenteObservacoes}
              erro={fieldState.error?.message}
            />
          )}
        />
        {tipo === TipoEvento.JOGO && (
          <Controller
            control={form.control}
            name="timeAdversarioId"
            render={({ field, fieldState }) => (
              <SeletorAdversario
                valor={field.value}
                aoMudar={field.onChange}
                modalidade={modalidade}
                inicial={evento?.timeAdversario}
                desabilitado={somenteObservacoes}
                erro={fieldState.error?.message}
              />
            )}
          />
        )}
        <View className="flex-row gap-3">
          <View className="flex-1">
            <Campo
              controle={form.control}
              nome="data"
              rotulo="Data"
              placeholder="dd/mm/aaaa"
              keyboardType="number-pad"
              maxLength={10}
              mascara={mascararData}
              editable={!somenteObservacoes}
            />
          </View>
          <View className="flex-1">
            <Campo
              controle={form.control}
              nome="hora"
              rotulo="Horário"
              placeholder="HH:mm"
              keyboardType="number-pad"
              maxLength={5}
              mascara={mascararHora}
              editable={!somenteObservacoes}
            />
          </View>
        </View>
        {aposDataHora}
        <Campo controle={form.control} nome="local" rotulo="Local" editable={!somenteObservacoes} />
        <View className="gap-1">
          <Campo
            controle={form.control}
            nome="observacoes"
            rotulo="Observações"
            multiline
            textAlignVertical="top"
            style={{ minHeight: 100 }}
          />
          <Texto variante="legenda" className="text-right">
            {`${observacoes.length}/${OBSERVACOES_EVENTO_MAX}`}
          </Texto>
        </View>
        <Botao
          titulo="Salvar"
          carregando={salvar.isPending || form.formState.isSubmitting}
          disabled={!salvar.online}
          onPress={() => void form.handleSubmit(confirmarSeNoPassado)()}
        />
      </ScrollView>
    </View>
  )
}
