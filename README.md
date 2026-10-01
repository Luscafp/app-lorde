# Atlética Lorde App

Aplicativo mobile para gestão de treinos, jogos e informações da **Atlética Lorde** — associação atlética do curso de Ciência da Computação e Inteligência Artificial (ABI) da UFMA (Universidade Federal do Maranhão).

Hoje a organização da atlética é feita por grupos de WhatsApp; o objetivo do app é centralizar agenda de jogos e treinos, notícias, times/modalidades e a gestão administrativa da diretoria em um único lugar.

## 📌 Status

🚧 Em desenvolvimento

## 📱 Sobre o projeto

- **Plataforma:** Android (React Native + Expo)
- **Stack:** Expo/TypeScript no app · Node.js + NestJS + Prisma na API · PostgreSQL · Cloudflare R2 (imagens) · Expo Push/FCM (notificações)
- **Níveis de acesso:** Atleta < Diretoria < Presidência (Presidente e Vice, mesmas permissões) < Administrador
- **Multi-atlética:** hoje só a Lorde usa o app, mas o código deve nascer preparado para outras atléticas (`atleticaId` nas tabelas, papel por atlética, nada da Lorde fixo no código) — ver seção 8.4 do documento
- **Documentação completa:** ver `/docs` (Documento de Requisitos v1.2, diagramas de classes, casos de uso e arquitetura)

## 🎯 Funcionalidades

**Autenticação e conta**
- Login, cadastro aberto, logout, recuperação de senha e exclusão de conta

**Home**
- Próximos jogos e treinos, notícias com imagem e tags, carrossel de banners

**Agenda**
- Jogos e treinos (filtro por modalidade e tipo), aba Placar (vitória/empate/derrota) e confirmação de participação

**Modalidades e times**
- Modalidades (esporte) e times (grupo de pessoas), elenco com capitão, treinos do time, solicitação de entrada

**Perfil**
- Dados do usuário, estatísticas baseadas em presença registrada, configurações e preferências de notificação

**Diretoria**
- Eventos (jogo ou treino, avulso ou recorrente), status, resultados, presenças, times/adversários, modalidades, solicitações, notícias, banners e avisos

**Administração**
- Presidência: gerenciar usuários e auditoria · Administrador: conceder cargos da diretoria e da presidência

## 📄 Documentação

- Documento de Requisitos (`docs/Documento_Requisitos-Aplicativo.docx`): RFs com prioridade (MVP/R2/R3), RNFs, regras de negócio, restrições, casos de uso especificados, modelo de dados e arquitetura técnica
- Diagrama de Classes (`docs/diagrama-classes.mermaid`)
- Diagrama de Casos de Uso (`docs/diagrama-casos-uso.mermaid`)
- Diagrama de Arquitetura (`docs/diagrama-arquitetura.mermaid`)
- Protótipo de interface (`docs/Prototipo interativo app atlética`) — referência visual, defasado em relação ao documento

## 🗺️ Roadmap de desenvolvimento

1. **MVP (R1):** monorepo, CI, banco (Prisma) a partir do Diagrama de Classes, autenticação JWT, agenda de jogos e treinos, times e solicitações, confirmação de participação, placar, notícias, usuários e cargos
2. **R2:** notificações push, registro de presença e estatísticas, banners, tags, verificação de e-mail
3. **R3:** avisos manuais e consulta à auditoria

## 🤝 Contribuindo

1. Crie uma branch a partir de `main`: `git checkout -b feature/nome-da-feature`
2. Faça commit das alterações seguindo o padrão do time
3. Abra um Pull Request descrevendo o que foi feito e qual RF/UC ele atende

## 👥 Equipe

- Lucas — Desenvolvimento

## 📃 Licença

A definir pela equipe.
