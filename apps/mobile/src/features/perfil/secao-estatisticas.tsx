import { TelaDados } from '@/components/estado'
import { BlocoEstatisticas, CartaoEstatisticas } from './cartao-estatisticas'
import { useEstatisticas } from './consultas'

export const MENSAGEM_ERRO_ESTATISTICAS = 'Não foi possível carregar suas estatísticas'

/** Perfil (UC10 passo 3): estado próprio, sem afetar o restante da tela. */
export function SecaoEstatisticas() {
  const consulta = useEstatisticas()
  return (
    <BlocoEstatisticas testID="secao-estatisticas">
      <TelaDados
        consulta={consulta}
        esqueleto="cartao"
        faixaOffline={false}
        mensagemErro={MENSAGEM_ERRO_ESTATISTICAS}
      >
        {(estatisticas) => <CartaoEstatisticas estatisticas={estatisticas} />}
      </TelaDados>
    </BlocoEstatisticas>
  )
}
