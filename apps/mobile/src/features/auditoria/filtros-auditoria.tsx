import {
  AcaoAuditoria,
  ACOES_POR_ENTIDADE,
  EntidadeAuditoria,
  listarAuditoriaQuerySchema,
  rotuloAcao,
  rotuloEntidade,
} from '@atletica/shared'
import { useState } from 'react'
import { Modal, ScrollView, TextInput, View } from 'react-native'
import { Botao, mascararData, Pilulas, Texto, type Opcao } from '@/components/ui'
import { paleta } from '@/features/atletica'
import { BuscaUsuario, ChipsFiltrosAtivos } from './componentes'
import {
  dataDigitadaParaIso,
  FILTROS_PADRAO,
  isoParaDataDigitada,
  PERIODO_PADRAO,
  PERIODOS,
  ROTULO_PERIODO,
  type FiltrosTela,
  type PeriodoAuditoria,
} from './filtros'

const OPCOES_PERIODO: readonly Opcao<PeriodoAuditoria>[] = PERIODOS.map((periodo) => ({
  valor: periodo,
  rotulo: ROTULO_PERIODO[periodo],
}))

const OPCOES_ENTIDADE: readonly Opcao<EntidadeAuditoria>[] = [
  { valor: undefined, rotulo: 'Todas' },
  ...Object.values(EntidadeAuditoria).map((entidade) => ({
    valor: entidade,
    rotulo: rotuloEntidade(entidade),
  })),
]

function acoesDe(entidade: EntidadeAuditoria | undefined): readonly AcaoAuditoria[] {
  return entidade ? ACOES_POR_ENTIDADE[entidade] : Object.values(AcaoAuditoria)
}

function opcoesAcao(entidade: EntidadeAuditoria | undefined): readonly Opcao<AcaoAuditoria>[] {
  return [
    { valor: undefined, rotulo: 'Todas' },
    ...acoesDe(entidade).map((acao) => ({ valor: acao, rotulo: rotuloAcao(acao) })),
  ]
}

function CampoData({
  rotulo,
  valor,
  aoMudar,
}: {
  rotulo: string
  valor: string
  aoMudar: (texto: string) => void
}) {
  return (
    <View className="flex-1 gap-1">
      <Texto variante="rotulo">{rotulo}</Texto>
      <TextInput
        value={valor}
        onChangeText={(texto) => aoMudar(mascararData(texto))}
        accessibilityLabel={rotulo}
        placeholder="dd/mm/aaaa"
        placeholderTextColor={paleta['texto-suave']}
        keyboardType="number-pad"
        className="min-h-[44px] rounded-xl border border-borda bg-superficie px-3 py-2 text-base text-texto"
      />
    </View>
  )
}

/** Mensagem do período personalizado, com as mesmas regras da API. */
function erroDoPeriodo(de: string, ate: string): string | null {
  const inicio = dataDigitadaParaIso(de)
  if (!inicio) return 'Informe a data inicial no formato dd/mm/aaaa.'
  const fim = ate ? dataDigitadaParaIso(ate) : undefined
  if (fim === null) return 'Informe a data final no formato dd/mm/aaaa.'
  const resultado = listarAuditoriaQuerySchema.safeParse({ de: inicio, ate: fim })
  return resultado.error?.issues[0]?.message ?? null
}

type Props = {
  filtros: FiltrosTela
  aoAplicar: (filtros: FiltrosTela) => void
  aoFechar: () => void
}

export function FiltrosAuditoriaSheet({ filtros, aoAplicar, aoFechar }: Props) {
  const [rascunho, setRascunho] = useState(filtros)
  const [de, setDe] = useState(isoParaDataDigitada(filtros.de))
  const [ate, setAte] = useState(isoParaDataDigitada(filtros.ate))
  const personalizado = rascunho.periodo === 'PERSONALIZADO'
  const erroPeriodo = personalizado ? erroDoPeriodo(de, ate) : null

  const mudarEntidade = (entidade: EntidadeAuditoria | undefined) =>
    setRascunho((atual) => {
      if (atual.entidade === entidade) return atual
      const acao = atual.acao && acoesDe(entidade).includes(atual.acao) ? atual.acao : undefined
      return { ...atual, entidade, entidadeId: undefined, acao }
    })

  const aplicar = () => {
    if (erroPeriodo) return
    aoAplicar(
      personalizado
        ? {
            ...rascunho,
            de: dataDigitadaParaIso(de) ?? undefined,
            ate: dataDigitadaParaIso(ate) ?? undefined,
          }
        : { ...rascunho, de: undefined, ate: undefined },
    )
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={aoFechar}>
      <View className="flex-1 justify-end bg-black/60">
        <View className="max-h-[90%] rounded-t-3xl bg-superficie">
          <ScrollView
            contentContainerClassName="gap-4 p-4 pb-8"
            keyboardShouldPersistTaps="handled"
          >
            <Texto variante="subtitulo">Filtros</Texto>

            <View className="gap-2">
              <Texto variante="rotulo">Período</Texto>
              <Pilulas
                rotulo="Período"
                opcoes={OPCOES_PERIODO}
                valor={rascunho.periodo}
                aoMudar={(periodo = PERIODO_PADRAO) => setRascunho({ ...rascunho, periodo })}
              />
              {personalizado && (
                <>
                  <View className="flex-row gap-3">
                    <CampoData rotulo="De" valor={de} aoMudar={setDe} />
                    <CampoData rotulo="Até (opcional)" valor={ate} aoMudar={setAte} />
                  </View>
                  {erroPeriodo && <Texto variante="erro">{erroPeriodo}</Texto>}
                </>
              )}
            </View>

            <View className="gap-2">
              <Texto variante="rotulo">Entidade</Texto>
              <Pilulas
                rotulo="Entidade"
                opcoes={OPCOES_ENTIDADE}
                valor={rascunho.entidade}
                aoMudar={mudarEntidade}
              />
            </View>

            <View className="gap-2">
              <Texto variante="rotulo">Ação</Texto>
              <Pilulas
                rotulo="Ação"
                opcoes={opcoesAcao(rascunho.entidade)}
                valor={rascunho.acao}
                aoMudar={(acao) => setRascunho({ ...rascunho, acao })}
              />
            </View>

            <View className="gap-2">
              <Texto variante="rotulo">Autor</Texto>
              {rascunho.usuarioId ? (
                <ChipsFiltrosAtivos
                  filtros={[{ chave: 'usuarioId', rotulo: rascunho.usuarioNome ?? 'Selecionado' }]}
                  aoRemover={() =>
                    setRascunho({ ...rascunho, usuarioId: undefined, usuarioNome: undefined })
                  }
                />
              ) : (
                <BuscaUsuario
                  aoEscolher={({ id, nome }) =>
                    setRascunho({ ...rascunho, usuarioId: id, usuarioNome: nome })
                  }
                />
              )}
            </View>

            <Botao titulo="Aplicar" disabled={!!erroPeriodo} onPress={aplicar} />
            <Botao
              titulo="Limpar filtros"
              variante="secundaria"
              onPress={() => aoAplicar(FILTROS_PADRAO)}
            />
            <Botao titulo="Fechar" variante="secundaria" onPress={aoFechar} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}
