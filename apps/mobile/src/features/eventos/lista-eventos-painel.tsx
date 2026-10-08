import { FiltroResultado, PeriodoEventos, StatusEvento, TipoEvento } from '@atletica/shared'
import { useState } from 'react'
import { View } from 'react-native'
import { TelaDados } from '@/components/estado'
import { Fab, Pilula, Pilulas, Segmentos, Selo, type Segmento } from '@/components/ui'
import { paleta } from '@/features/atletica'
import { vazioEventos } from './agenda'
import { ListaEventosPorDia } from './components'
import { resultadoPendente } from './formatacao'
import { useEventosPainel, type FiltrosEventosPainel } from './hooks'
import { MENSAGEM_RESULTADO_PENDENTE, OPCOES_STATUS, OPCOES_TIPO } from './rotulos'

const MENSAGEM_SEM_EVENTOS_PAINEL = 'Nenhum evento cadastrado'
const MENSAGEM_ERRO_EVENTOS_PAINEL = 'Não foi possível carregar os eventos'

const OPCOES_PERIODO: readonly Segmento<PeriodoEventos>[] = [
  { valor: PeriodoEventos.PROXIMOS, rotulo: 'Próximos' },
  { valor: PeriodoEventos.PASSADOS, rotulo: 'Passados' },
  { valor: PeriodoEventos.TODOS, rotulo: 'Todos' },
]

const FILTROS_INICIAIS: FiltrosEventosPainel = { periodo: PeriodoEventos.PROXIMOS }

/** Épico #21 §6: jogos finalizados sem placar, em qualquer data. */
const FILTROS_PENDENTES: FiltrosEventosPainel = {
  tipo: TipoEvento.JOGO,
  status: StatusEvento.FINALIZADO,
  resultado: FiltroResultado.PENDENTE,
  periodo: PeriodoEventos.TODOS,
}

export type NavegacaoEventos = {
  novo: () => void
  abrir: (id: string) => void
}

export function ListaEventosPainel({ ir }: { ir: NavegacaoEventos }) {
  const [filtros, setFiltros] = useState(FILTROS_INICIAIS)
  const [pendentes, setPendentes] = useState(false)
  const consulta = useEventosPainel(pendentes ? FILTROS_PENDENTES : filtros)
  const { periodo, ...filtrosDaLista } = filtros
  const mudar = (parcial: Partial<FiltrosEventosPainel>) => setFiltros({ ...filtros, ...parcial })
  const limpar = () => {
    setPendentes(false)
    setFiltros({ periodo })
  }

  return (
    <View className="flex-1 bg-fundo">
      <View className="gap-2 p-4">
        {!pendentes && (
          <>
            <Segmentos
              opcoes={OPCOES_PERIODO}
              valor={periodo}
              aoMudar={(novoPeriodo) => mudar({ periodo: novoPeriodo })}
            />
            <Pilulas
              rotulo="Tipo de evento"
              opcoes={OPCOES_TIPO}
              valor={filtros.tipo}
              aoMudar={(tipo) => mudar({ tipo })}
            />
            <Pilulas
              rotulo="Status"
              opcoes={OPCOES_STATUS}
              valor={filtros.status}
              aoMudar={(status) => mudar({ status })}
            />
          </>
        )}
        <Pilula
          papel="checkbox"
          rotulo={MENSAGEM_RESULTADO_PENDENTE}
          ativa={pendentes}
          cor={paleta.alerta}
          aoPressionar={() => setPendentes(!pendentes)}
          className="self-start"
        />
      </View>
      <TelaDados
        consulta={consulta}
        esqueleto="cartoes"
        vazio={(eventos) => eventos.length === 0}
        {...vazioEventos(pendentes ? FILTROS_PENDENTES : filtrosDaLista, limpar, {
          mensagem: MENSAGEM_SEM_EVENTOS_PAINEL,
          acao: { titulo: 'Novo evento', onPress: ir.novo },
        })}
        mensagemErro={MENSAGEM_ERRO_EVENTOS_PAINEL}
      >
        {(eventos) => (
          <ListaEventosPorDia
            testID="lista-eventos-painel"
            consulta={consulta}
            eventos={eventos}
            contentContainerClassName="gap-2 px-4 pb-24"
            aoAbrir={({ id }) => ir.abrir(id)}
            selos={(evento) => (
              <>
                {!!evento.serieId && <Selo texto="RECORRENTE" />}
                {resultadoPendente(evento) && (
                  <Selo texto={MENSAGEM_RESULTADO_PENDENTE.toUpperCase()} cor={paleta.alerta} />
                )}
              </>
            )}
          />
        )}
      </TelaDados>
      <Fab rotulo="Novo evento" onPress={ir.novo} />
    </View>
  )
}
