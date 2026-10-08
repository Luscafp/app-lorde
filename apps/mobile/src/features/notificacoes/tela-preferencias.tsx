import type { Preferencias } from '@atletica/shared'
import type { ReactNode } from 'react'
import { ScrollView, View } from 'react-native'
import { TelaDados } from '@/components/estado'
import { Texto } from '@/components/ui'
import { features } from '@/config/features'
import { useTemNivelMinimo } from '@/infra/sessao/use-tem-nivel-minimo'
import { AvisoPermissao } from './components/aviso-permissao'
import { LinhaPreferencia } from './components/linha-preferencia'
import { SeletorAntecedencia } from './components/seletor-antecedencia'
import { useAtualizarPreferencia, usePreferencias } from './hooks'
import { usePermissaoNotificacoes, type FontePermissao } from './permissao'

export const MENSAGEM_CARGO_SEMPRE = 'Avisos sobre alteração do seu cargo são sempre enviados.'

type Categoria = keyof Omit<Preferencias, 'pushAtivo' | 'antecedenciaLembreteHoras'>

type Linha = { campo: Categoria; titulo: string; descricao: string }

/** Textos da seção 3.4; Solicitações muda por papel e Avisos depende da #38. */
function categorias(ehDiretoria: boolean): Linha[] {
  return [
    {
      campo: 'novosEventos',
      titulo: 'Novos eventos',
      descricao: 'Aviso de jogos e treinos criados para os meus times.',
    },
    {
      campo: 'alteracoesEventos',
      titulo: 'Alterações e cancelamentos',
      descricao: 'Mudança de data, horário ou local e cancelamentos',
    },
    {
      campo: 'lembretes',
      titulo: 'Lembretes',
      descricao:
        'Lembrete antes dos eventos em que confirmei participação e aviso de confirmação pendente.',
    },
    {
      campo: 'resultados',
      titulo: 'Resultados',
      descricao: 'Aviso quando o resultado de um jogo for registrado.',
    },
    {
      campo: 'noticias',
      titulo: 'Notícias',
      descricao: 'Aviso quando uma notícia for publicada.',
    },
    {
      campo: 'solicitacoes',
      titulo: 'Solicitações',
      descricao: ehDiretoria
        ? 'Resposta às minhas solicitações de entrada e novas solicitações.'
        : 'Resposta às minhas solicitações de entrada.',
    },
    ...(features.avisosHabilitados
      ? [
          {
            campo: 'avisos' as const,
            titulo: 'Avisos da diretoria',
            descricao: 'Avisos enviados pela diretoria da atlética.',
          },
        ]
      : []),
  ]
}

function Grupo({ children }: { children: ReactNode }) {
  return (
    <View className="overflow-hidden rounded-2xl border border-borda bg-cartao">{children}</View>
  )
}

/** UC12: cada toque salva na hora; `permissao` vem da #88 e só aparece com a flag ligada. */
export function TelaPreferenciasNotificacao({ permissao }: { permissao?: FontePermissao }) {
  const consulta = usePreferencias()
  const salvar = useAtualizarPreferencia()
  const ehDiretoria = useTemNivelMinimo('DIRETOR')
  const fonte = features.notificacoes ? permissao : undefined
  const { permissao: estadoPermissao, permitir } = usePermissaoNotificacoes(fonte)

  const bloqueado = !salvar.online

  return (
    <TelaDados consulta={consulta} esqueleto="lista">
      {(preferencias) => {
        const categoriasDesabilitadas = bloqueado || !preferencias.pushAtivo
        return (
          <ScrollView contentContainerClassName="gap-4 p-4">
            {fonte && (
              <AvisoPermissao permissao={estadoPermissao} aoPermitir={() => void permitir()} />
            )}
            <Grupo>
              <LinhaPreferencia
                titulo="Notificações push"
                descricao="Ativa ou desativa todas as notificações."
                valor={preferencias.pushAtivo}
                desabilitado={bloqueado}
                aoMudar={(pushAtivo) => salvar.mutate({ pushAtivo })}
              />
            </Grupo>
            <Grupo>
              {categorias(ehDiretoria).map(({ campo, titulo, descricao }, indice) => (
                <View key={campo} className={indice > 0 ? 'border-t border-borda' : ''}>
                  <LinhaPreferencia
                    titulo={titulo}
                    descricao={descricao}
                    valor={preferencias[campo]}
                    desabilitado={categoriasDesabilitadas}
                    aoMudar={(valor) => salvar.mutate({ [campo]: valor })}
                  />
                  {campo === 'lembretes' && (
                    <View className="border-t border-borda">
                      <SeletorAntecedencia
                        valor={preferencias.antecedenciaLembreteHoras}
                        desabilitado={categoriasDesabilitadas || !preferencias.lembretes}
                        aoMudar={(antecedenciaLembreteHoras) =>
                          salvar.mutate({ antecedenciaLembreteHoras })
                        }
                      />
                    </View>
                  )}
                </View>
              ))}
            </Grupo>
            <View className="gap-1 px-1">
              <Texto variante="legenda">{MENSAGEM_CARGO_SEMPRE}</Texto>
              {salvar.isSuccess && (
                <Texto variante="legenda" accessibilityLiveRegion="polite">
                  Salvo
                </Texto>
              )}
            </View>
          </ScrollView>
        )
      }}
    </TelaDados>
  )
}
