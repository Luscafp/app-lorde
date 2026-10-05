import type { DocumentoLegal } from './documento'

export const politicaDePrivacidade: DocumentoLegal = {
  titulo: 'Política de Privacidade',
  provisorio: true,
  secoes: [
    {
      titulo: '1. Dados coletados',
      paragrafos: [
        'Coletamos apenas o necessário: nome, e-mail e senha (guardada de forma cifrada). Foto de perfil e participação em times e eventos são informadas por você ao usar o aplicativo.',
      ],
    },
    {
      titulo: '2. Uso dos dados',
      paragrafos: [
        'Os dados servem para identificar você, organizar treinos, jogos e times e enviar avisos da atlética. Não vendemos nem compartilhamos seus dados para fins de publicidade.',
      ],
    },
    {
      titulo: '3. Armazenamento e segurança',
      paragrafos: [
        'Os dados ficam em servidores com acesso restrito e conexão cifrada. Registros técnicos de acesso são mantidos pelo tempo necessário à segurança do serviço.',
      ],
    },
    {
      titulo: '4. Seus direitos',
      paragrafos: [
        'Conforme a LGPD, você pode consultar, corrigir e excluir seus dados. A exclusão da conta pode ser feita pelo próprio aplicativo.',
      ],
    },
    {
      titulo: '5. Contato',
      paragrafos: [
        'Solicitações sobre seus dados podem ser enviadas à diretoria da atlética pelos canais informados no aplicativo.',
      ],
    },
  ],
}
