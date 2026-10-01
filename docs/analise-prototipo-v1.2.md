# Análise do protótipo × Documento de Requisitos v1.2

Revisão do protótipo interativo (`docs/Prototipo interativo app atlética`) contra o Documento de Requisitos v1.2 (29/09/2026) e os diagramas de classes e de casos de uso. O protótipo foi corrigido para seguir o documento; esta nota lista o que estava divergente, o que mudou e o que continua fora do escopo de um protótipo.

## Resumo

O protótipo exportado do Figma Make tinha a identidade visual certa, mas o comportamento divergia do documento em quase todas as telas. A causa principal era o modelo de dados: elenco guardado como lista de nomes, `confirmados` misturando ids e nomes, `Usuario.timeId` em vez de `MembroTime`, nenhuma `Participacao` compartilhada e Perfil/Agenda lendo dados estáticos ou estado local. Por isso, o que se fazia no painel não aparecia nas telas do atleta e vice-versa.

A correção reescreveu o modelo conforme o diagrama de classes e centralizou as regras de negócio em `src/domain.ts`. A identidade visual, as abas e a moldura de celular foram mantidas.

## Divergências encontradas e correções

### Modelo de dados (seção 7)

| Antes | Agora | Referência |
|---|---|---|
| `Time.atletas: string[]`, `capitao: string` | `MembroTime { timeId, usuarioId, entradaEm, saidaEm }` e `Time.capitaoId` | 7.2, RN22, RN23 |
| `Evento.confirmados` (ids e nomes misturados), `placar { lorde, adv }`, `timeLordeId` | `Participacao { confirmado, presente }`, `placarTime`/`placarAdversario`, `timeId`/`timeAdversarioId` | 7.2, RN32 |
| `Usuario.timeId` (um time só) | Times do usuário vêm de `MembroTime` (vários) | RF24 |
| Literais `'lorde'` e textos "Lorde (nossa)" no código | `ATLETICA.id`/`ATLETICA.nome`; adversárias com `usaAplicativo: false` | RNF20, 8.4, RN21 |
| Jogo e12: Vôlei Feminino × Vôlei **Masculino** | Vôlei Feminino × Vôlei Feminino (Nexus) | RN11 |
| Banners com link `'#'` | Link vazio ou `https://` | RN34 |
| Datas `'2026-09-20'` exibidas como 19/09 21:00 (UTC) | `parseLocal` trata datas como horário local | 7.2 (fuso de São Luís) |
| Usuário logado escolhido por um seletor de papel | Papel vem da conta (`role` do usuário) | RN05, RN09 |

### Conta (UC06, UC07, UC08, UC09, UC13)

- Bloqueio após **3** falhas → **5 falhas em 15 min**, com aviso na 4ª (RNF06, UC07 A2).
- Regra de senha era "força média" → **mínimo de 8 caracteres, com letras e números**, com mensagem explícita (UC06). A barra de força ficou apenas informativa.
- Cadastro pedia "E-mail institucional" e os termos diziam "exclusivamente a alunos" e "ao menos 18 anos" → cadastro aberto (RN02), e-mail comum e termos marcados como **texto provisório** (8.5).
- Cadastro não criava conta → cria a conta como Atleta, autentica e abre a Home (UC06 passos 5 e 6).
- Recuperação aceitava qualquer código → código de demonstração, "Código inválido ou expirado", limite de 3 envios por hora e mesma mensagem exista ou não o e-mail (UC09).
- "Ativar notificações" só aparecia depois do cadastro → aparece no primeiro login de cada usuário (UC07 passo 4).
- "Sair" só mostrava um toast → encerra a sessão e volta ao login (UC08).
- Excluir conta prometia "dados apagados permanentemente" → texto da RN33 (anonimização, saída dos elencos, cancelamento de solicitações, histórico anônimo), com efeito real no estado e bloqueio do último Administrador (RN08).

### Home e Agenda (UC01, UC02, UC03, UC15)

- Cards de eventos da Home não eram tocáveis → abrem o detalhe (UC01 passo 5, RNF01).
- Banner não abria o link e não avançava → carrossel automático e toque abre o link (RF11).
- Atalho "Placar" abria a aba Eventos → abre a aba Placar. Avatar fixo "GL" → iniciais do usuário logado.
- Cancelados passados continuavam na agenda → visíveis com "Cancelado" **até a data prevista** (RN18).
- Confirmação de participação guardada em estado local, com "Não vou" só depois de "Vou" → "Vou"/"Não vou" sempre visíveis para o elenco, resposta alterável até o início, "Respondido em", contagem "X vão · Y não vão · Z sem resposta" e lista "Quem vai" com nomes (UC15, RN30).
- "Presença" e "participação" usadas como sinônimos → "participação" é a resposta do atleta; "presença" é o registro da diretoria (RN31, RN32).
- Placar listava jogo sem placar como derrota e trazia o texto "Treino finalizado" → apenas jogos finalizados, com Vitória/Empate/Derrota calculados (RN17) ou "Resultado pendente", tocáveis.

### Times (UC04, UC14)

- A aba listava times direto, com horário de treino em texto fixo → modalidades ativas → times → detalhe (UC04), com "Próximo treino" e "Próximos treinos" vindos dos eventos (RF21, RN20).
- Estado de membro/pendente era local: sair do time não alterava o elenco e aprovar não refletia → tudo vem do estado compartilhado (RN27, RN28, RF23).

### Perfil (UC10, UC11, UC12)

- Estatísticas fixas (14 jogos, 31 treinos) e taxa calculada sobre confirmações → calculadas **só pelas presenças registradas** (RN32, RF26).
- Lia os dados estáticos em vez do estado → "Meus próximos eventos confirmados" e "Responder participação" usam o estado compartilhado (UC10 passo 4).
- Sem time: nada → convite "Ver times" (UC10 A1).
- Termos/Privacidade em "Sobre" não abriam → abrem o modal. Notificações: categorias desligadas de fato com o geral desligado, e aviso de permissão negada (UC12 A1).
- Editar perfil não salvava o nome → salva. Foto com opções e nota de 1080 px / 5 MB (RNF04, UC11 A1).

### Painel (UC16 a UC25)

- Registrar presença usava a lista de nomes e misturava resposta e presença → elenco de `MembroTime`, pré-marcado com quem confirmou, com selos "Confirmou" / "Disse que não ia", e grava só `presente` (UC18, RN31).
- Excluir evento checava `confirmados` → bloqueia se houver qualquer resposta, presença ou resultado (UC16 A6, RN26).
- Treino recorrente: a edição e o cancelamento de uma ocorrência aplicam a escolha "Somente este / Este e os seguintes"; a criação gera as ocorrências e limita a série a 6 meses (RN13).
- Resultado: título e toast distinguem registro e correção; jogo não finalizado oferece "Marcar como finalizado" (UC17 A1, A2).
- Elenco: removido "adicionar por nome"; entrada só por solicitação aprovada (RN28). Remover do elenco e definir capitão só entre membros (RN22, RN23).
- Aprovar solicitação adicionava o nome ao array do time → cria `MembroTime`; o histórico mostra Aprovada/Rejeitada/Cancelada (UC20).
- Detalhe do usuário com estatísticas por contagem de eventos do time → estatísticas por presença. Hierarquia aplicada: ninguém altera nível igual ou superior, nem a própria conta (UC23 A1).
- Alterar cargo: substituição de Presidente/Vice pede confirmação e rebaixa o anterior a Diretor; o último Administrador não perde o cargo (RN07, RN08, UC24).
- Avisos contavam destinatários por nomes do array → membros reais do time, com confirmação "Enviar aviso para N usuários?" (UC25).
- Notícias: autor e data de publicação gravados ao publicar; despublicar volta a rascunho; Presidência exclui (UC21).

### Bugs técnicos

- Componentes declarados dentro de outros (`FInput`, `PwField`, `DemoSection`, `ScorePad`) faziam os campos **perderem o foco a cada tecla** → movidos para o nível do módulo (`components/shared.tsx`).
- `useApp()` chamado dentro de `if` no Perfil (violação das regras de hooks) → removido.
- Toast, ConfirmModal e OfflineBanner duplicados em `App.tsx` e `shared.tsx` → uma única versão. Bottom sheets agora são renderizados na moldura do celular (antes um usava `fixed` e outros ficavam presos à área rolável).
- Tocar na aba ou seção já ativa não voltava à lista → volta.
- O modo offline existia, mas não havia como ativá-lo → menu **Demo** (no login e no Perfil) com: modo offline (RNF19), carregamento, erro de conexão (UC01 A2/A3) e permissão de notificação negada (UC12 A1).

## Fora do escopo do protótipo

Estes itens são do backend ou da infraestrutura e não têm como ser demonstrados numa interface navegável: hash Argon2id, JWT/refresh token, HTTPS (RNF06), verificação de permissões no backend (RNF07), push real e fila pg-boss (3.5, RF42), envio de e-mail (RF06, UC09), upload para o R2 (RNF04), paginação da API (RNF14), backup, monitoramento e disponibilidade (RNF10, RNF16, RNF18). No protótipo, essas ações são simuladas com mensagens.

## Pontos para atualizar no Documento de Requisitos

1. **Seção 9** lista divergências que este ajuste resolveu (adversário em texto livre, treinos em texto, modalidade e time confundidos, notícias sem imagem, banners sem título/link, painel incompleto, datas em formatos variados). Vale substituir a lista por "protótipo alinhado à v1.2".
2. **Seção 8.5**: a pendência "Atualizar o protótipo de interface conforme este documento" pode ser marcada como concluída.
3. O `README.md` descreve o protótipo como "defasado em relação ao documento".
4. **A confirmar com a atlética:** a matriz 2.4 diz que a Diretoria "cadastra e edita elencos", e a RN28 diz que o atleta só entra no time por solicitação aprovada. O protótipo segue a RN28: a diretoria remove membros e define o capitão, mas não adiciona atletas diretamente. Se a diretoria precisar incluir alguém sem solicitação, a RN28 precisa de uma exceção.

## Como verificar

```bash
cd "docs/Prototipo interativo app atlética"
pnpm install   # ou npm install
pnpm dev
```

Na tela de login, use **"Entrar como…"** (senha de todas as contas: `lorde2026`). A recuperação de senha usa o código `123456`. O relógio da demonstração começa em 30/09/2026 15:00, para os dados de exemplo continuarem coerentes em qualquer data.

| Conta | Papel | O que testar |
|---|---|---|
| gabriel@email.com | Atleta | Vou/Não vou no jogo do Futsal Masculino; Perfil (1 jogo, 1 treino, 67%); solicitar entrada no Vôlei Masculino |
| juliana@email.com | Diretor | Aceitar a solicitação; registrar presença e resultado; criar treino recorrente |
| rafael@email.com | Presidente | Tentar desativar o Vice (bloqueado); excluir modalidade com vínculos (bloqueado) |
| carlos@email.com | Vice-presidente | Mesmas permissões do Presidente |
| admin@atleticalorde.com.br | Administrador | Alterar cargo (substituição de Presidente); último Admin não perde o cargo nem exclui a conta |

O roteiro de verificação de 20 itens preparado para as correções foi automatizado num navegador headless, com 69 verificações ao todo, e todas passaram. `tsc --noEmit` e `vite build` passam sem erros.
