# Atlética Lorde App

Aplicativo mobile para gestão de treinos, jogos e informações da **Atlética Lorde** — associação atlética do curso de Ciência da Computação e Inteligência Artificial (ABI) da UFMA (Universidade Federal do Maranhão).

Hoje a organização da atlética é feita por grupos de WhatsApp; o objetivo do app é centralizar agenda de jogos e treinos, notícias, times/modalidades e a gestão administrativa da diretoria em um único lugar.

## 📌 Status

🚧 Em desenvolvimento

## 📱 Sobre o projeto

- **Plataforma:** Android (React Native)
- **Atores:** Usuário Atleta e Usuário Administrador
- **Documentação completa:** ver `/docs` (Documento de Requisitos, Diagrama de Classes, Diagrama de Casos de Uso)

## 🎯 Funcionalidades

**Autenticação**
- Login, cadastro, alternância entre as telas e logout

**Home**
- Próximos jogos e treinos, notícias com tags, times em destaque em carrossel

**Agenda**
- Aba Jogos (com filtro por modalidade) e aba Placar (resultados com vitória/empate/derrota)

**Modalidades**
- Lista de modalidades e times, elenco com capitão, horários/locais de treino, solicitação de entrada em time

**Perfil**
- Dados do usuário, estatísticas (jogos participados e treinos presentes), configurações, notificações e confirmação de participação em jogos/treinos

**Administração** (apenas Administrador)
- Gerenciar usuários, times, jogos, resultados, notícias e banners da Home; aceitar ou rejeitar solicitações de entrada em times

## 📄 Documentação

- Documento de Requisitos (RFs, RNFs, Regras de Negócio, Restrições)
- Diagrama de Classes (`docs/diagrama-classes.mermaid`)
- Diagrama de Casos de Uso (`docs/diagrama-casos-uso.mermaid`)

## 🗺️ Roadmap de desenvolvimento

1. Modelagem do banco de dados a partir do Diagrama de Classes
2. Backend com autenticação (JWT)
3. Navegação e telas do app (Home, Agenda, Modalidades, Perfil)
4. Painel administrativo
5. Notificações push

## 🤝 Contribuindo

1. Crie uma branch a partir de `main`: `git checkout -b feature/nome-da-feature`
2. Faça commit das alterações seguindo o padrão do time
3. Abra um Pull Request descrevendo o que foi feito e qual RF/UC ele atende

## 👥 Equipe

- Lucas — Desenvolvimento

## 📃 Licença

A definir pela equipe.
