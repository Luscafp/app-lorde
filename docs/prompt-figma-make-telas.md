# Prompts para o Figma Make — telas faltantes do protótipo

Base: Documento de Requisitos v1.2. Cole os prompts **em sequência, no mesmo projeto do protótipo atual**, esperando cada um terminar antes do próximo. Dividir em três etapas evita que o Figma Make perca instruções.

---

## Prompt 1 — Ajustes gerais, papéis e dados de exemplo

```
Vamos evoluir este protótipo do app da Atlética Lorde sem mudar a identidade visual. Mantenha o tema escuro, os tokens de cor do objeto C, as fontes Sora (títulos), Inter (texto) e JetBrains Mono (números e rótulos), a moldura de celular e a barra de abas inferior (Início, Agenda, Times, Perfil). Todo texto em português do Brasil. Pode separar o código em arquivos dentro de src/screens e src/components.

1. Identidade da atlética: crie um objeto ATLETICA = { nome: "Atlética Lorde", sigla: "LORDE", curso: "Ciência da Computação e IA", corPrimaria: C.red, corSecundaria: C.blue } e use-o em todos os textos e cores que hoje citam a Lorde diretamente (ex.: "Vitória da Lorde" deve vir de ATLETICA.nome). Nada da Lorde fixo nas telas.

2. Papéis: substitua os papéis atleta/admin por cinco: Atleta, Diretor, Vice-presidente, Presidente e Administrador. Presidente e Vice-presidente têm exatamente as mesmas permissões. Na tela de login, troque os botões de demonstração por um seletor "Entrar como" com os cinco papéis. Regras de acesso:
   - Atleta: só as abas do app.
   - Diretor: + Painel da Diretoria (eventos, resultados, presenças, times e modalidades, solicitações, notícias, banners, avisos).
   - Presidente/Vice: + Usuários (desativar/reativar contas) e Auditoria, e podem excluir registros.
   - Administrador: + Cargos.
   O acesso ao painel fica no Perfil e no atalho da Home, visível só para Diretor ou superior. Mostre o cargo do usuário como selo no Perfil.

3. Dados de exemplo (substitua os atuais):
   - MODALIDADES (esporte): Futsal, Vôlei, Basquete, Handebol, cada uma com ícone/emoji.
   - ATLETICAS adversárias: Falcão (Eng. Civil), Nexus (TI), Tubarão (Direito), Lince (Medicina), Escorpião (Letras).
   - TIMES (grupo de pessoas): cada time tem nome, modalidade, atlética, capitão e elenco. Ex.: "Futsal Masculino" e "Futsal Feminino" (modalidade Futsal, atlética Lorde). Times adversários pertencem às atléticas adversárias e não têm elenco.
   - EVENTOS: cada evento tem tipo (JOGO ou TREINO), time da Lorde, time adversário (só em jogo), inicio (um único campo de data e hora), local, status (Agendado, Em andamento, Finalizado, Cancelado), placar (só jogos finalizados) e confirmados. Inclua jogos, treinos avulsos, treinos de uma série recorrente, um evento cancelado e jogos finalizados com vitória, empate e derrota.
   - NOTICIAS com imagem de capa (use gradientes ou imagens de placeholder), título, conteúdo, data, status (Rascunho/Publicada) e várias tags.
   - BANNERS com título, imagem, link opcional, ordem e ativo.

4. Remova do protótipo: vagas por time, tipo de jogo CAMA/amistoso, "times em destaque" e o campo matrícula.

5. Datas e horários sempre no formato dd/mm/aaaa HH:mm (em cards pode abreviar para "sáb 16/08 · 15:00").

6. Crie componentes reutilizáveis para os estados: carregando (skeleton), lista vazia (ícone + mensagem + ação), erro (mensagem + "Tentar novamente"), faixa "Você está offline — exibindo os últimos dados", toast de sucesso/erro e modal de confirmação.
```

---

## Prompt 2 — Telas do atleta (conta, Home, Agenda, Times, Perfil)

```
Agora crie ou ajuste as telas do atleta, usando os dados e componentes do passo anterior.

CONTA
1. Cadastro: nome, e-mail, senha, confirmar senha (mínimo 8 caracteres, letras e números, com indicador de força), checkbox "Li e aceito os Termos de Uso e a Política de Privacidade" (links abrem um modal de texto). Botão desabilitado até aceitar. Mostre erro de "e-mail já cadastrado" com atalhos para login e recuperação de senha.
2. Login: e-mail, senha, link "Esqueci minha senha", mensagem genérica "E-mail ou senha incorretos", estado de bloqueio "Muitas tentativas. Tente novamente em 15 minutos" e aviso de conta desativada.
3. Recuperar senha em 3 passos: informar e-mail → digitar código de 6 dígitos (campos separados, contador de 15 min, "Reenviar código") → nova senha e confirmação → sucesso e volta ao login.
4. Pedido de permissão de notificações após o primeiro login (tela explicativa com "Permitir" e "Agora não").

HOME
5. Carrossel de banners (título, imagem, indicador de páginas; tocar abre o link).
6. "Próximos eventos": cards de jogos e treinos com selo do tipo, modalidade, adversário (jogo), data/hora, local e status; evento cancelado aparece com selo "Cancelado" riscado.
7. "Notícias": cards com imagem de capa, título, data e tags; "Ver todas".
8. Lista de notícias com filtro por tags (chips) e tela de detalhe da notícia (imagem, título, data, tags, conteúdo).

AGENDA
9. Aba Eventos: filtros por tipo (Todos, Jogos, Treinos) e por modalidade; lista agrupada por dia.
10. Detalhe do evento: tipo, times (Lorde x adversário), modalidade, data/hora, local, status, número de confirmados e botões "Vou" / "Não vou" (resposta pode ser trocada; desabilitados se o evento começou ou foi cancelado; ocultos para quem não é do elenco, com texto "Apenas membros do elenco podem confirmar").
11. Aba Placar: jogos finalizados, mais recentes primeiro, placar e selo V/E/D (verde/amarelo/vermelho), filtro por modalidade.

TIMES
12. Lista de modalidades → lista de times da Lorde da modalidade → detalhe do time: elenco com capitão destacado (estrela), próximos treinos (data/hora e local) e botão de ação com quatro estados: "Solicitar entrada" → modal de confirmação → "Solicitação pendente" (com "Cancelar solicitação") → se aprovado, "Você faz parte deste time" com opção "Sair do time" (com confirmação).

PERFIL
13. Perfil: foto, nome, e-mail, selo do cargo, times, estatísticas (jogos participados, treinos presentes, taxa de presença em %, com nota "Contam apenas presenças registradas pela diretoria") e "Meus próximos eventos confirmados".
14. Configurações com as seções:
    - Conta: Editar perfil (nome e foto, com escolha de imagem e recorte), Alterar senha (senha atual, nova, confirmar).
    - Notificações: interruptor geral "Notificações push" e interruptores por categoria (Novos eventos, Alterações e cancelamentos, Lembretes, Resultados, Notícias, Solicitações, Avisos da diretoria), seletor "Antecedência do lembrete" (1 h, 2 h, 6 h, 24 h; padrão 2 h). Se o geral estiver desligado, as categorias ficam desabilitadas. Mostre aviso quando a permissão do Android estiver negada, com botão "Abrir configurações".
    - Sobre: Termos de Uso, Política de Privacidade, versão do app e contato da diretoria.
    - Sair (com confirmação).
    - Excluir conta (em vermelho): tela explicando as consequências (dados pessoais anonimizados, saída dos times, solicitações canceladas), campo de senha e confirmação final.
```

---

## Prompt 3 — Painel da Diretoria, Presidência e Administrador

```
Agora crie o Painel da Diretoria, substituindo a tela de administração atual. Ele abre em tela cheia (sem a barra de abas), com botão voltar e um menu de seções visível conforme o papel escolhido no login.

VISÃO GERAL
1. Cards com contadores (próximos eventos, solicitações pendentes, presenças a registrar, notícias em rascunho) e atalhos: "Novo evento", "Registrar resultado", "Ver solicitações", "Publicar notícia".

EVENTOS (Diretor ou superior)
2. Lista de eventos com filtros (tipo, modalidade, status) e botão "Novo evento".
3. Formulário de evento:
   - Seletor segmentado "Jogo | Treino" no topo.
   - Time da Lorde (lista de times) — a modalidade é a do time.
   - Se Jogo: "Time adversário" (busca entre times adversários da mesma modalidade) com opção "+ Cadastrar atlética/time adversário" que abre um formulário rápido em bottom sheet (nome da atlética, curso, nome do time).
   - Data, horário e local.
   - Se Treino: interruptor "Treino recorrente" (desligado por padrão = avulso). Ligado, mostra chips dos dias da semana e "Repetir até" (data final, máximo 6 meses), com prévia "Serão criados 16 treinos".
   - Botão salvar e toast "Evento criado — elenco notificado".
4. Ao editar um treino recorrente, modal: "Aplicar alteração a: Somente este treino | Este e os seguintes".
5. Ações do evento: alterar status (Agendado, Em andamento, Finalizado), cancelar (modal de confirmação) e excluir (só Presidente/Vice/Administrador; bloqueado com mensagem se houver confirmações, presenças ou resultado).
6. Registrar resultado (jogo finalizado): placar da Lorde x placar do adversário com botões +/−, prévia do resultado (Vitória/Empate/Derrota). Se o jogo não estiver finalizado, oferecer "Marcar como finalizado".
7. Registrar presença (evento em andamento ou finalizado): lista do elenco com checkboxes, quem confirmou vem pré-marcado com selo "Confirmou", contador "12 de 18 presentes", botão salvar.

TIMES E MODALIDADES
8. Abas "Modalidades" (nome e ícone, ativar/desativar) e "Times" com filtro "Lorde | Adversários".
9. Formulário de time (nome, modalidade, atlética).
10. Gerenciar elenco de time da Lorde: lista de membros, definir capitão (estrela, só um por time, só entre membros) e remover membro (confirmação). Times ou modalidades com eventos só podem ser desativados.

SOLICITAÇÕES
11. Abas "Pendentes" e "Histórico". Card com foto, nome, time, data e botões "Aceitar" / "Rejeitar" (com confirmação). Contador de pendentes no menu.

NOTÍCIAS
12. Lista com filtro Rascunho/Publicada.
13. Editor: imagem de capa (upload com prévia), título, conteúdo (texto com formatação simples: negrito, lista, link), tags (chips com adicionar/remover), botões "Salvar rascunho" e "Publicar". Em notícia publicada, opção "Despublicar". Excluir só para Presidente/Vice/Administrador.

BANNERS
14. Lista ordenável (arrastar ou setas), com prévia, título e interruptor ativo.
15. Formulário: título, imagem, link opcional (validar que começa com https://), ativo.

AVISOS
16. Enviar aviso: título, mensagem, destinatários ("Todos os usuários" ou um time), prévia da notificação e confirmação.

USUÁRIOS (Presidente, Vice-presidente e Administrador)
17. Busca por nome ou e-mail, lista com selo de cargo e situação (ativa/desativada).
18. Detalhe do usuário: perfil, times, estatísticas, botão "Desativar conta" / "Reativar conta". Bloqueie a ação em usuários de nível igual ou superior (inclusive entre Presidente e Vice) com mensagem explicativa.
19. Auditoria: lista cronológica "quem, o quê, quando" com filtro por tipo de registro.

CARGOS (somente Administrador)
20. No detalhe do usuário, botão "Alterar cargo" abre seletor: Atleta, Diretor, Vice-presidente, Presidente, Administrador.
21. Se já existir Presidente (ou Vice), mostrar modal: "Fulano é o atual Presidente e passará a Diretor. Confirmar?".
22. Impedir remover o último Administrador, com mensagem explicativa.
23. Toast "Cargo alterado — usuário notificado".

Em todas as telas do painel, use os estados de carregando, vazio, erro e toasts criados no primeiro passo.
```
