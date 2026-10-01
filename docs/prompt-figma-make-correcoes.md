# Prompts para o Figma Make — correções do protótipo

Base: Documento de Requisitos v1.2 e a análise do protótipo gerado pelos prompts de `prompt-figma-make-telas.md`. Cole os prompts **em sequência, no mesmo projeto do protótipo atual**, esperando cada um terminar antes do próximo. O Prompt 1 muda o modelo de dados e precisa vir primeiro; os demais dependem dele.

Ao final há um roteiro de verificação para conferir se cada correção foi aplicada.

---

## Prompt 1 — Modelo de dados, estado compartilhado e bugs técnicos

```
Vamos corrigir este protótipo sem mudar a identidade visual (tema escuro, tokens do objeto C, fontes Sora/Inter/JetBrains Mono, moldura de celular e abas Início, Agenda, Times, Perfil). Todo texto em português do Brasil. Neste passo, mude apenas dados, estado e bugs; as telas serão ajustadas nos próximos passos.

1. Estado compartilhado: crie src/store.tsx com um contexto React que guarda e altera eventos, participações, times, membros de time, modalidades, solicitações, notícias, banners, usuários, auditoria e o usuário logado. Todas as telas (atleta e painel) devem ler e gravar nesse store, para que uma alteração feita no painel apareça imediatamente nas telas do atleta e vice-versa. Remova os useState locais que hoje copiam EVENTOS, TIMES, NOTICIAS etc.

2. Modelo de dados (src/types.ts e src/data.ts):
   - ATLETICA ganha id: 'lorde'. Substitua todo literal 'lorde' no código por ATLETICA.id e todo texto fixo com "Lorde" ("Time da Lorde", "Lorde (nossa)") por textos montados com ATLETICA.nome (ex.: "Time da Atlética Lorde", "Nossa atlética").
   - Evento: renomeie timeLordeId para timeId e timeAdvId para timeAdversarioId; troque placar {lorde, adv} por placarTime e placarAdversario; remova o campo confirmados. Crie a função resultadoDoEvento(ev) que devolve 'VITORIA' | 'EMPATE' | 'DERROTA' a partir do placar.
   - Participacao (nova): { eventoId, usuarioId, confirmado: boolean | null, respondidoEm?: string, presente: boolean | null }. confirmado é a resposta do atleta ("Vou" = true, "Não vou" = false, sem resposta = null). presente é o registro feito pela diretoria. São coisas diferentes e nunca devem se misturar.
   - Usuario: remova timeId. Os times do usuário vêm de MembroTime.
   - MembroTime (novo): { timeId, usuarioId, entradaEm }. O elenco de um time é a lista de MembroTime dele.
   - Time: remova treino, local e atletas (strings); troque capitao (nome) por capitaoId (id de usuário); adicione ativo: boolean.
   - Modalidade: adicione ativa: boolean.
   - Solicitacao: status passa a ser 'PENDENTE' | 'APROVADA' | 'REJEITADA' | 'CANCELADA'.
   - Noticia: adicione autorId e publicadaEm (definida no momento da publicação).
   - AuditLog: adicione entidade ('Evento' | 'Resultado' | 'Presença' | 'Time' | 'Elenco' | 'Modalidade' | 'Solicitação' | 'Notícia' | 'Banner' | 'Usuário' | 'Cargo').

3. Dados de exemplo:
   - Cadastre em USUARIOS todos os atletas que hoje aparecem como nomes nos elencos e crie os MembroTime correspondentes. Gabriel Lima (u1) deve estar no elenco do Futsal Masculino. Defina capitaoId de cada time da Lorde.
   - Crie participações coerentes: em eventos agendados, alguns atletas com "Vou", alguns com "Não vou" e alguns sem resposta; em eventos finalizados, presenças registradas (incluindo alguém que confirmou e não foi, e alguém que foi sem ter confirmado). Deixe ao menos um evento finalizado sem presença registrada e um jogo finalizado sem resultado.
   - Corrija o jogo e12: Vôlei Feminino da Lorde deve enfrentar um time de Vôlei Feminino (ex.: Nexus).
   - Banners: link vazio ou começando com https:// (nada de '#').
   - Datas de notícias com hora (ex.: '2026-09-20T10:00:00').

4. Bugs técnicos:
   - Nunca declare um componente dentro de outro componente. Mova FInput (EventoForm e NewAdvSheet), PwField (ChangePassword), DemoSection e ScorePad para o nível do módulo ou para src/components/Field.tsx. Hoje os campos perdem o foco a cada tecla digitada.
   - Datas: crie em utils.ts uma função parseLocal(iso) que trate 'AAAA-MM-DD' como data local (hoje '2026-09-20' aparece como 19/09/2026 21:00) e use-a em todos os formatadores.
   - PerfilScreen: não chame useApp() dentro de if; chame no topo do componente.
   - Use um único Toast, um único ConfirmModal e um único OfflineBanner (os de src/components/shared.tsx) e apague as cópias duplicadas em App.tsx. Todo bottom sheet deve usar position absolute dentro da moldura do celular (o ConfirmSheet de SolicsSection usa fixed).
   - Toasts: verde para ações concluídas com sucesso (inclusive "Solicitação cancelada", "Você saiu do time", "Conta desativada"); vermelho apenas para erros e bloqueios.

5. Menu de demonstração: na tela de login e no Perfil, adicione um botão discreto "Demo" que abre um painel com interruptores: "Modo offline", "Simular carregamento", "Simular erro de conexão" e "Permissão de notificação negada". Com "Simular carregamento", as listas (Home, Agenda, Times, Notícias e listas do painel) mostram SkeletonList por 800 ms ao abrir; com "Simular erro", mostram ErrorState com "Tentar novamente"; com "Modo offline", aparece a faixa "Você está offline — exibindo os últimos dados" e ações de gravação mostram toast de erro "Sem conexão".
```

---

## Prompt 2 — Conta, Home e Agenda

```
Agora ajuste as telas de conta, Home e Agenda usando o store e o modelo do passo anterior.

CONTA
1. Login: o papel vem do usuário logado (campo role de USUARIOS). Troque o seletor "Demo: papel" por "Entrar como", que preenche e-mail e senha de um usuário de exemplo de cada papel (Atleta, Diretor, Vice-presidente, Presidente, Administrador).
2. Bloqueio após 5 tentativas falhas (não 3), por 15 minutos. Na 4ª falha, avise "Última tentativa antes do bloqueio". A mensagem de erro é sempre "E-mail ou senha incorretos".
3. Regra de senha (cadastro, nova senha na recuperação e alterar senha): mínimo de 8 caracteres, com pelo menos uma letra e um número. A barra de força é apenas informativa. A mensagem de erro deve dizer exatamente essa regra.
4. Cadastro aberto: rótulo "E-mail" (não "E-mail institucional") e placeholder "seu@email.com". Nos Termos de Uso, remova "destinado exclusivamente a alunos do curso" e "ao menos 18 anos" e adicione no topo do modal a etiqueta "Texto provisório".
5. Recuperar senha: código de demonstração 123456; código errado mostra "Código inválido ou expirado"; "Reenviar código" limitado a 3 envios por hora, com mensagem ao atingir o limite. A mensagem do passo 1 é sempre a mesma, exista ou não o e-mail.
6. A tela "Ativar notificações" aparece no primeiro login de cada usuário (não só após o cadastro). Com "Permissão de notificação negada" ligado no menu Demo, "Permitir" leva à Home com toast de aviso.

HOME
7. Os cards de "Próximos eventos" são tocáveis e abrem o mesmo detalhe de evento da Agenda (extraia o detalhe para src/components/EventoDetalhe.tsx). Cada card mostra selo do tipo, modalidade, times, data/hora e local.
8. Eventos cancelados continuam aparecendo até a data prevista, com selo "Cancelado" e título riscado.
9. Banner: avança sozinho a cada 5 s; tocar em um banner com link mostra toast "Abrindo <link>"; sem link, não faz nada.
10. O atalho "Placar" abre a Agenda já na aba Placar. O avatar do topo usa as iniciais do usuário logado.
11. No detalhe da notícia, o botão voltar retorna para a tela de origem (Home ou lista). O conteúdo renderiza **negrito**, listas com "- " e links [texto](url) inseridos pelo editor.

AGENDA
12. Aba Eventos: mostra eventos agendados e em andamento, além de cancelados até a data prevista. Cada card mostra a minha resposta quando eu sou do elenco: selo "Vou", "Não vou" ou "Responder".
13. Detalhe do evento — confirmação de participação:
    - Para membros do elenco em evento Agendado: dois botões lado a lado, "Vou" e "Não vou", sempre visíveis; o escolhido fica destacado; a resposta pode ser trocada até o início; abaixo, "Respondido em dd/mm/aaaa HH:mm".
    - Em andamento, finalizado ou cancelado: botões desabilitados, com o motivo.
    - Fora do elenco: sem botões, com o texto "Apenas membros do elenco podem confirmar participação".
    - Contadores "X vão · Y não vão · Z sem resposta" e a lista "Quem vai" com os nomes (nunca ids).
    - Use sempre a palavra "participação" para a resposta do atleta; "presença" é só o registro da diretoria. Toasts: "Participação confirmada" e "Você marcou que não vai".
14. Aba Placar: só jogos finalizados, do mais recente ao mais antigo, com selo "Vitória", "Empate" ou "Derrota" (calculado por resultadoDoEvento). Jogo finalizado sem placar aparece com "Resultado pendente". Tocar no card abre o detalhe do jogo. Treinos não aparecem no Placar.
```

---

## Prompt 3 — Times e Perfil

```
Agora ajuste as telas Times e Perfil usando o store.

TIMES
1. A aba Times abre com a lista de modalidades ativas (ícone, nome e quantidade de times da atlética). Tocar em uma modalidade lista seus times ativos; tocar em um time abre o detalhe. Modalidade sem times: "Nenhum time cadastrado".
2. No card do time, troque o texto fixo de treino por "Próximo treino: sáb 04/10 · 18:00", calculado a partir dos eventos TREINO futuros do time (ou "Sem treinos agendados").
3. Detalhe do time:
   - Elenco a partir de MembroTime, com o capitão destacado (estrela).
   - "Próximos treinos": eventos TREINO agendados do time vindos do store (data/hora e local); tocar abre o detalhe do evento. Remova as datas fixas de exemplo.
   - O botão de ação deriva do store: se sou membro, "Você faz parte deste time" e "Sair do time" (com confirmação; remove o MembroTime); se tenho solicitação PENDENTE, "Solicitação pendente" e "Cancelar solicitação" (status CANCELADA); senão, "Solicitar entrada" (com confirmação; cria solicitação PENDENTE, que aparece no painel). Não permita duas solicitações pendentes para o mesmo time.

PERFIL
4. Mostre todos os times do usuário como chips. Sem time: card "Você ainda não faz parte de um time" com botão "Ver times".
5. Estatísticas calculadas apenas pelas presenças registradas (presente === true): jogos participados, treinos presentes e taxa de presença = presenças ÷ eventos finalizados do elenco com presença registrada. Mantenha a nota "Contam apenas presenças registradas pela diretoria". Nada de números fixos.
6. "Meus próximos eventos confirmados": eventos agendados em que respondi "Vou"; tocar abre o detalhe. Troque a seção "Confirmação de Presença" por "Responder participação", com "Vou" / "Não vou" apenas para eventos Agendados do meu elenco ainda sem resposta.
7. Sair: após a confirmação, volta para a tela de login e limpa o usuário logado.
8. Excluir conta:
   - Texto das consequências: "Seus dados pessoais serão anonimizados", "Você sairá de todos os times", "Suas solicitações pendentes serão canceladas", "Seu histórico de presenças e resultados será mantido de forma anônima". Remova "dados apagados permanentemente" e "confirmações serão removidas".
   - Se o usuário for o único Administrador ativo, bloqueie com a mensagem "Você é o único Administrador. Conceda o cargo a outra pessoa antes de excluir sua conta."
   - Senha correta: volta ao login com toast "Conta excluída".
9. Sobre: "Termos de Uso" e "Política de Privacidade" abrem o mesmo modal do cadastro.
10. Notificações: com o interruptor geral desligado, as categorias e a antecedência ficam desabilitadas (não só esmaecidas). O aviso de permissão negada aparece quando o menu Demo estiver com "Permissão de notificação negada".
11. Editar perfil: o botão da câmera abre um bottom sheet "Tirar foto", "Escolher da galeria" e "Remover foto" (simulado) e mostra a nota "A imagem será redimensionada para até 1080 px".
```

---

## Prompt 4 — Painel da Diretoria, Presidência e Administrador

```
Agora corrija o Painel usando o store. Toda ação de gravação no painel deve gerar um registro na auditoria (quem, o quê, entidade e quando).

EVENTOS
1. Validações do formulário: Jogo exige time adversário; Treino recorrente exige ao menos um dia da semana e "Repetir até" posterior à data de início e no máximo 6 meses depois (mensagem "A série pode ter no máximo 6 meses"). Mostre os erros nos campos.
2. Ao criar um treino recorrente, gere no store todas as ocorrências com o mesmo serieId (elas aparecem na Agenda e nos próximos treinos do time).
3. Editar uma ocorrência de série abre o modal "Aplicar alteração a: Somente este treino | Este e os seguintes", e a escolha é aplicada. O cancelamento de série também aplica a escolha. Toast de edição: "Evento atualizado — elenco notificado" (o de criação continua "Evento criado — elenco notificado").
4. Status: não permita alterar o status de evento Cancelado.
5. Registrar resultado: só para jogos não cancelados. Se o jogo não estiver Finalizado, mostre "O jogo precisa estar finalizado para registrar o resultado" com o botão "Marcar como finalizado" antes do formulário. Se já houver placar, o título é "Corrigir resultado" e o toast é "Resultado corrigido — registrado na auditoria".
6. Registrar presença: só para eventos Em andamento ou Finalizados (em Agendado, o botão fica desabilitado com "Disponível quando o evento começar"). A lista é o elenco (MembroTime); quem respondeu "Vou" vem pré-marcado com o selo "Confirmou", e quem respondeu "Não vou" mostra o selo "Disse que não ia". Salvar grava apenas Participacao.presente e nunca altera as respostas dos atletas. Contador "12 de 18 presentes".
7. Excluir evento (Presidente, Vice e Administrador): bloqueado, com mensagem, se houver qualquer resposta de participação, presença registrada ou resultado.
8. Visão geral: "Presenças a registrar" conta eventos Em andamento ou Finalizados sem nenhuma presença registrada. O atalho "Registrar resultado" abre a lista de eventos filtrada por jogos finalizados sem resultado.

TIMES E MODALIDADES
9. Modalidades: botões "Nova modalidade" e editar (nome e ícone/emoji). O interruptor "ativa" funciona e desativar é sempre permitido; modalidades inativas somem das telas do atleta e dos filtros. "Excluir" (Presidente, Vice e Administrador) só quando não houver times nem eventos vinculados; caso contrário, a mensagem é "Esta modalidade possui vínculos e não pode ser excluída. Desative-a." (RN26).
10. Times: interruptor "ativo" (times inativos somem das telas do atleta) e "Excluir" (Presidência) só para times sem eventos, com a mesma lógica. No formulário de time adversário, permita "+ Nova atlética" (nome e curso) sem sair da tela.
11. Elenco: remova "Adicionar atleta" por nome; atletas só entram no elenco por solicitação aprovada. Mantenha "Remover do elenco" (com confirmação) e "Definir capitão" (só entre membros, no máximo um). Mostre o atalho "Solicitações pendentes deste time (N)".

SOLICITAÇÕES
12. "Aceitar" muda o status para APROVADA e cria o MembroTime; "Rejeitar" muda para REJEITADA. O Histórico mostra APROVADA, REJEITADA e CANCELADA (canceladas pelo próprio atleta).

NOTÍCIAS, BANNERS E AVISOS
13. Notícias: ao publicar, grave publicadaEm e o autor (usuário logado); a lista mostra autor e data de publicação. No editor, Presidente, Vice e Administrador também veem "Excluir notícia".
14. Banners: "Excluir" (Presidente, Vice e Administrador) com confirmação.
15. Avisos: antes de enviar, mostre o modal "Enviar aviso para N usuários?" (todos os usuários ou membros do time escolhido).

USUÁRIOS, CARGOS E AUDITORIA
16. Hierarquia: Atleta = 0, Diretor = 1, Vice-presidente = Presidente = 2, Administrador = 3. Desativar ou reativar só é permitido quando o nível do alvo é menor que o meu; Presidente e Vice não podem agir um sobre o outro, e ninguém pode desativar a própria conta. Mostre a mensagem explicativa quando bloqueado.
17. Detalhe do usuário: times e estatísticas vêm do store (sem números fixos).
18. Alterar cargo (Administrador): ao escolher Presidente ou Vice-presidente quando já existir um, abra um modal de confirmação "Fulano é o atual Presidente e passará a Diretor. Confirmar?". Impeça remover o cargo do último Administrador ativo. Toast "Cargo alterado — usuário notificado".
19. Auditoria: os filtros passam a ser por entidade (Eventos, Resultados, Presenças, Times e elencos, Modalidades, Solicitações, Notícias, Banners, Usuários, Cargos) usando o campo entidade, e cada registro mostra quem, o quê, o alvo e dd/mm/aaaa HH:mm.

Em todas as telas do painel, respeite os estados do menu Demo (carregando, erro e offline).
```

---

## Roteiro de verificação

Depois de colar os quatro prompts, confira no protótipo:

| # | Como testar | Esperado | Regra |
|---|---|---|---|
| 1 | Digitar no campo "Local" do formulário de evento | O campo não perde o foco | — |
| 2 | Entrar como Atleta e abrir um jogo do Futsal Masculino | Botões "Vou" e "Não vou" visíveis; trocar resposta funciona | RF17, RN30 |
| 3 | Responder "Vou" na Agenda e abrir o Perfil | O evento aparece em "Meus próximos eventos confirmados" | Estado compartilhado |
| 4 | Painel > evento Agendado > Registrar presença | Botão desabilitado | RN31 |
| 5 | Registrar presença em evento finalizado | Quem disse "Vou" vem pré-marcado; as respostas não mudam | RN31, RN32 |
| 6 | Conferir o Perfil após registrar presença | Estatísticas mudam conforme a presença, não conforme a confirmação | RN32, RF26 |
| 7 | Criar Jogo sem adversário | Bloqueado | RN11 |
| 8 | Criar treino recorrente com 7 meses | Bloqueado | RN13 |
| 9 | Editar uma ocorrência de série | Modal "Somente este / Este e os seguintes" | RN13 |
| 10 | Desativar uma modalidade com eventos | Permitido; excluir é bloqueado | RN26 |
| 11 | Solicitar entrada, aceitar no painel e voltar ao time | "Você faz parte deste time" + "Sair do time" | RN28, UC14 |
| 12 | Entrar como Presidente e abrir o Vice em Usuários | Desativar bloqueado | RN05, UC23 A1 |
| 13 | Entrar como Administrador e tentar se desativar ou excluir a conta | Bloqueado | RN08 |
| 14 | Errar a senha 4 vezes e depois 5 | Aviso na 4ª, bloqueio na 5ª | RNF06 |
| 15 | Cadastrar com senha "abcdefgh" | Recusada (falta número) | UC06 |
| 16 | Tocar em um evento na Home | Abre o detalhe | UC01, RNF01 |
| 17 | Abrir a notícia de 20/09 | Data exibida 20/09/2026 | Fuso |
| 18 | Ligar "Modo offline" no menu Demo | Faixa offline visível | RNF19 |
| 19 | Sair pelo Perfil | Volta ao login | UC08 |
| 20 | Filtrar a Auditoria por "Cargos" | Mostra a alteração de cargo | RF43 |
