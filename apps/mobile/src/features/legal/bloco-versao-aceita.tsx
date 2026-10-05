import { formatarData, TERMOS_VERSAO } from '@atletica/shared'
import { Cartao, Texto } from '@/components/ui'
import { useMe } from '@/features/perfil'

export const MENSAGEM_VERSAO_NOVA = 'Há uma versão mais recente destes termos.'

export function BlocoVersaoAceita() {
  const aceite = useMe().data?.termosAceitos
  if (!aceite) return null

  return (
    <Cartao>
      <Texto>
        Você aceitou a versão {aceite.versao} em {formatarData(aceite.aceitoEm)}
      </Texto>
      {aceite.versao !== TERMOS_VERSAO && <Texto variante="legenda">{MENSAGEM_VERSAO_NOVA}</Texto>}
    </Cartao>
  )
}
