import Ionicons from '@expo/vector-icons/Ionicons'
import {
  BUSCA_MIN,
  formatarDataHora,
  ROTULO_SISTEMA,
  rotuloAcao,
  rotuloEntidade,
  type AlteracaoCampo,
  type AutorAuditoria,
  type RegistroAuditoriaResumo,
} from '@atletica/shared'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Pressable, ScrollView, View } from 'react-native'
import { CampoBusca, Texto } from '@/components/ui'
import { paleta } from '@/features/atletica'
import { listarUsuarios } from '@/features/usuarios/api'
import { chaves } from '@/infra/query/chaves'
import { useValorAtrasado } from '@/infra/use-valor-atrasado'
import type { FiltroAtivo } from './filtros'

const ATRASO_BUSCA_MS = 300
const SUGESTOES = 5

export function nomeDoAutor(autor: AutorAuditoria): string {
  return autor?.nome ?? ROTULO_SISTEMA
}

export function descricaoDoRegistro({ entidade, rotuloRegistro }: RegistroAuditoriaResumo) {
  const nome = rotuloEntidade(entidade)
  return rotuloRegistro ? `${nome} · ${rotuloRegistro}` : nome
}

export function ItemAuditoria({
  registro,
  aoAbrir,
}: {
  registro: RegistroAuditoriaResumo
  aoAbrir: (id: string) => void
}) {
  const acao = rotuloAcao(registro.acao)
  const autor = nomeDoAutor(registro.autor)
  const quando = formatarDataHora(registro.criadoEm)
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${acao}, ${descricaoDoRegistro(registro)}, por ${autor}, ${quando}`}
      onPress={() => aoAbrir(registro.id)}
      className="min-h-[44px] gap-1 border-b border-borda px-4 py-3"
    >
      <Texto className="font-semibold">{acao}</Texto>
      <Texto variante="legenda" numberOfLines={2}>
        {descricaoDoRegistro(registro)}
      </Texto>
      <Texto variante="legenda">{`${autor} · ${quando}`}</Texto>
    </Pressable>
  )
}

export function ChipsFiltrosAtivos({
  filtros,
  aoRemover,
}: {
  filtros: FiltroAtivo[]
  aoRemover: (filtro: FiltroAtivo) => void
}) {
  if (filtros.length === 0) return null
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
      {filtros.map((filtro) => (
        <Pressable
          key={filtro.chave}
          accessibilityRole="button"
          accessibilityLabel={`Remover filtro ${filtro.rotulo}`}
          onPress={() => aoRemover(filtro)}
          className="min-h-[44px] flex-row items-center gap-1 rounded-full border border-borda bg-cartao px-4"
        >
          <Texto variante="rotulo">{filtro.rotulo}</Texto>
          <Ionicons name="close" size={16} color={paleta['texto-suave']} />
        </Pressable>
      ))}
    </ScrollView>
  )
}

function Celula({ texto, rotulo }: { texto: string; rotulo: string }) {
  return (
    <View className="flex-1" accessibilityLabel={`${rotulo}: ${texto}`}>
      <Texto variante="legenda">{rotulo}</Texto>
      <Texto>{texto}</Texto>
    </View>
  )
}

export function TabelaAlteracoes({ alteracoes }: { alteracoes: AlteracaoCampo[] }) {
  return (
    <View className="gap-3">
      {alteracoes.map(({ campo, rotulo, antes, depois }) => (
        <View key={campo} className="gap-1 border-b border-borda pb-3">
          <Texto className="font-semibold">{rotulo}</Texto>
          <View className="flex-row gap-3">
            <Celula rotulo="Antes" texto={antes} />
            <Celula rotulo="Depois" texto={depois} />
          </View>
        </View>
      ))}
    </View>
  )
}

/** Autocomplete sobre `GET /usuarios?busca=` (#27), com debounce de 300 ms. */
export function BuscaUsuario({
  aoEscolher,
}: {
  aoEscolher: (usuario: { id: string; nome: string }) => void
}) {
  const [termo, setTermo] = useState('')
  const busca = useValorAtrasado(termo.trim(), ATRASO_BUSCA_MS)
  const consulta = useQuery({
    queryKey: chaves.usuarios.lista({ busca, autocompletar: true }),
    queryFn: ({ signal }) => listarUsuarios({ busca }, 1, signal),
    enabled: busca.length >= BUSCA_MIN,
  })
  const sugestoes = busca.length >= BUSCA_MIN ? (consulta.data?.items ?? []) : []

  return (
    <View className="gap-2">
      <CampoBusca rotulo="Buscar autor por nome ou e-mail" valor={termo} aoMudar={setTermo} />
      {sugestoes.slice(0, SUGESTOES).map((usuario) => (
        <Pressable
          key={usuario.id}
          accessibilityRole="button"
          accessibilityLabel={`Filtrar por ${usuario.nome}`}
          onPress={() => {
            aoEscolher({ id: usuario.id, nome: usuario.nome })
            setTermo('')
          }}
          className="min-h-[44px] justify-center rounded-xl border border-borda px-3"
        >
          <Texto>{usuario.nome}</Texto>
        </Pressable>
      ))}
      {consulta.isSuccess && busca.length >= BUSCA_MIN && sugestoes.length === 0 && (
        <Texto variante="legenda">Nenhum usuário encontrado.</Texto>
      )}
    </View>
  )
}
