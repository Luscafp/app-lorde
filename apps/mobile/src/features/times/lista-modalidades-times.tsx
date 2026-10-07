import Ionicons from '@expo/vector-icons/Ionicons'
import type { Modalidade, TimeDto } from '@atletica/shared'
import { useState } from 'react'
import { FlatList, Pressable, View } from 'react-native'
import { TelaDados } from '@/components/estado'
import { Texto } from '@/components/ui'
import { paleta, useAtletica } from '@/features/atletica'
import { ModalidadeIcone, useModalidades } from '@/features/modalidades'
import { combinarConsultas } from '@/infra/query/combinar-consultas'
import { CartaoTime } from './cartao-time'
import { contar, porNome } from './formatacao'
import { useTimesProprios } from './hooks'

export const MENSAGEM_SEM_TIMES = 'Nenhum time cadastrado'

type Grupo = { modalidade: Modalidade; times: TimeDto[] }

function agruparPorModalidade(modalidades: Modalidade[], times: TimeDto[]): Grupo[] {
  return [...modalidades].sort(porNome).map((modalidade) => ({
    modalidade,
    times: times.filter((time) => time.modalidade.id === modalidade.id).sort(porNome),
  }))
}

function useGrupos() {
  const modalidades = useModalidades({ incluirInativas: false })
  const times = useTimesProprios()
  return {
    data:
      modalidades.data && times.data
        ? agruparPorModalidade(modalidades.data, times.data)
        : undefined,
    ...combinarConsultas([modalidades, times]),
  }
}

type PropsCabecalho = {
  modalidade: Modalidade
  total: number
  aberta: boolean
  aoTocar: () => void
}

function CabecalhoModalidade({ modalidade, total, aberta, aoTocar }: PropsCabecalho) {
  const { corPrimaria } = useAtletica()
  const times = contar(total, 'time', 'times')

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${modalidade.nome}, ${times}, ${aberta ? 'recolher' : 'expandir'}`}
      accessibilityState={{ expanded: aberta }}
      onPress={aoTocar}
      className="min-h-[44px] flex-row items-center gap-3 py-2"
    >
      <ModalidadeIcone icone={modalidade.icone} cor={corPrimaria} />
      <Texto variante="subtitulo" className="flex-1">
        {modalidade.nome}
      </Texto>
      <Texto variante="legenda">{times}</Texto>
      <Ionicons
        name={aberta ? 'chevron-up' : 'chevron-down'}
        size={20}
        color={paleta['texto-suave']}
      />
    </Pressable>
  )
}

type PropsAcordeao = {
  grupos: Grupo[]
  atualizando: boolean
  aoAtualizar: () => void
  aoAbrirTime: (id: string) => void
}

function Acordeao({ grupos, atualizando, aoAtualizar, aoAbrirTime }: PropsAcordeao) {
  const [abertas, setAbertas] = useState<ReadonlySet<string>>(() => {
    const primeira = grupos.find(({ times }) => times.length > 0)
    return new Set(primeira ? [primeira.modalidade.id] : [])
  })

  const alternar = (id: string) =>
    setAbertas((atuais) => {
      const novas = new Set(atuais)
      if (!novas.delete(id)) novas.add(id)
      return novas
    })

  return (
    <FlatList
      testID="lista-modalidades"
      data={grupos}
      keyExtractor={({ modalidade }) => modalidade.id}
      extraData={abertas}
      contentContainerClassName="gap-2 p-4"
      refreshing={atualizando}
      onRefresh={aoAtualizar}
      renderItem={({ item: { modalidade, times } }) => {
        const aberta = abertas.has(modalidade.id)
        return (
          <View className="gap-2">
            <CabecalhoModalidade
              modalidade={modalidade}
              total={times.length}
              aberta={aberta}
              aoTocar={() => alternar(modalidade.id)}
            />
            {aberta &&
              (times.length === 0 ? (
                <Texto variante="legenda">{MENSAGEM_SEM_TIMES}</Texto>
              ) : (
                times.map((time) => <CartaoTime key={time.id} time={time} aoAbrir={aoAbrirTime} />)
              ))}
          </View>
        )
      }}
    />
  )
}

/** Acordeão na mesma tela: o time fica no 2º toque a partir da Home (RNF01). */
export function ListaModalidadesTimes({ aoAbrirTime }: { aoAbrirTime: (id: string) => void }) {
  const consulta = useGrupos()

  return (
    <View className="flex-1 bg-fundo">
      <Texto variante="titulo" className="px-4 pt-4">
        Times
      </Texto>
      <TelaDados
        consulta={consulta}
        esqueleto="lista"
        vazio={(grupos) => grupos.length === 0}
        mensagemVazio="Nenhuma modalidade cadastrada"
      >
        {(grupos) => (
          <Acordeao
            grupos={grupos}
            atualizando={consulta.isRefetching}
            aoAtualizar={() => void consulta.refetch()}
            aoAbrirTime={aoAbrirTime}
          />
        )}
      </TelaDados>
    </View>
  )
}
