import type { ElencoDto, MembroElencoDto } from '@atletica/shared'
import type { UseQueryResult } from '@tanstack/react-query'
import { View } from 'react-native'
import { TelaDados } from '@/components/estado'
import { Imagem } from '@/components/imagem'
import { CartaoLinha, Selo, Texto } from '@/components/ui'
import { useAtletica } from '@/features/atletica'
import { useSessao } from '@/infra/sessao/store'
import { porNome } from './formatacao'

export const MENSAGEM_ELENCO_VAZIO = 'Elenco ainda vazio'

const capitaoPrimeiro = (a: MembroElencoDto, b: MembroElencoDto) =>
  Number(b.capitao) - Number(a.capitao) || porNome(a, b)

function ItemElenco({ membro, ehVoce }: { membro: MembroElencoDto; ehVoce: boolean }) {
  const { corPrimaria } = useAtletica()

  return (
    <CartaoLinha className="min-h-[44px]">
      <Imagem uri={membro.fotoUrl} nome={membro.nome} className="h-10 w-10 rounded-full" />
      <Texto testID="nome-membro" className="flex-1">
        {ehVoce ? `${membro.nome} (você)` : membro.nome}
      </Texto>
      {membro.capitao && (
        <View accessible accessibilityLabel="Capitão">
          <Selo texto="CAPITÃO" cor={corPrimaria} />
        </View>
      )}
    </CartaoLinha>
  )
}

/** Seção com estado próprio: a falha do elenco não esconde o cabeçalho do time. */
export function ListaElenco({ consulta }: { consulta: UseQueryResult<ElencoDto> }) {
  const meuId = useSessao((estado) => estado.usuario?.id)

  return (
    <View className="gap-2">
      <Texto variante="subtitulo">Elenco</Texto>
      <TelaDados
        consulta={consulta}
        esqueleto="lista"
        faixaOffline={false}
        vazio={({ items }) => items.length === 0}
        mensagemVazio={MENSAGEM_ELENCO_VAZIO}
      >
        {({ items }) => (
          <View className="gap-2">
            {[...items].sort(capitaoPrimeiro).map((membro) => (
              <ItemElenco
                key={membro.usuarioId}
                membro={membro}
                ehVoce={membro.usuarioId === meuId}
              />
            ))}
          </View>
        )}
      </TelaDados>
    </View>
  )
}
