import type { DocumentoLegal } from './documento'

export const termosDeUso: DocumentoLegal = {
  titulo: 'Termos de Uso',
  provisorio: true,
  secoes: [
    {
      titulo: '1. Sobre o aplicativo',
      paragrafos: [
        'O aplicativo reúne a agenda de treinos e jogos, os times, as notícias e os avisos da atlética. O uso é gratuito e destinado a estudantes e membros da comunidade acadêmica.',
      ],
    },
    {
      titulo: '2. Conta',
      paragrafos: [
        'Para usar o aplicativo é preciso criar uma conta com nome, e-mail e senha. Você é responsável por manter a senha em sigilo e pelas ações feitas com a sua conta.',
        'A diretoria da atlética pode desativar contas que descumpram estes Termos.',
      ],
    },
    {
      titulo: '3. Uso adequado',
      paragrafos: [
        'Não é permitido publicar conteúdo ofensivo, discriminatório ou ilegal, nem tentar acessar dados de outras pessoas ou funções sem permissão.',
      ],
    },
    {
      titulo: '4. Alterações',
      paragrafos: [
        'Estes Termos podem ser atualizados. Quando isso acontecer, a nova versão será apresentada no aplicativo.',
      ],
    },
    {
      titulo: '5. Contato',
      paragrafos: [
        'Dúvidas podem ser enviadas à diretoria da atlética pelos canais informados no aplicativo.',
      ],
    },
  ],
}
