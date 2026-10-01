import { C } from './theme'
import type { Modalidade, AtleticaRef, Time, Evento, Noticia, Banner, Usuario, Solicitacao, AuditLog } from './types'

export const MODALIDADES: Modalidade[] = [
  { id: 'futsal',   nome: 'Futsal',   emoji: '⚽', cor: C.red,  ativa: true },
  { id: 'volei',    nome: 'Vôlei',    emoji: '🏐', cor: C.blue, ativa: true },
  { id: 'basquete', nome: 'Basquete', emoji: '🏀', cor: C.red,  ativa: true },
  { id: 'handebol', nome: 'Handebol', emoji: '🤾', cor: C.blue, ativa: true },
]

export const ATLETICAS: AtleticaRef[] = [
  { id: 'lorde',     nome: 'Atlética Lorde',    curso: 'Ciência da Computação e IA' },
  { id: 'falcao',    nome: 'Atlética Falcão',    curso: 'Engenharia Civil' },
  { id: 'nexus',     nome: 'Atlética Nexus',     curso: 'Tecnologia da Informação' },
  { id: 'tubarao',   nome: 'Atlética Tubarão',   curso: 'Direito' },
  { id: 'lince',     nome: 'Atlética Lince',     curso: 'Medicina' },
  { id: 'escorpiao', nome: 'Atlética Escorpião', curso: 'Letras' },
]

export const TIMES: Time[] = [
  // Times da Lorde
  { id: 'lorde-futsal-m', nome: 'Futsal Masculino', modalidadeId: 'futsal', atleticaId: 'lorde',
    capitao: 'Rafael Mendes', treino: 'Ter/Qui · 18h00', local: 'Quadra Coberta — Bloco B',
    atletas: ['Rafael Mendes','Lucas Sousa','Pedro Carvalho','Thiago Lima','Diego Costa','Bruno Alves','Mateus Rocha','Felipe Silva'] },
  { id: 'lorde-futsal-f', nome: 'Futsal Feminino', modalidadeId: 'futsal', atleticaId: 'lorde',
    capitao: 'Juliana Ramos', treino: 'Seg/Qua · 17h00', local: 'Ginásio Central UFMA',
    atletas: ['Juliana Ramos','Beatriz Lima','Fernanda Costa','Ana Clara','Mariana Dias','Larissa Ferreira'] },
  { id: 'lorde-volei-m', nome: 'Vôlei Masculino', modalidadeId: 'volei', atleticaId: 'lorde',
    capitao: 'Carlos Eduardo', treino: 'Seg/Qua · 19h00', local: 'Ginásio do CEB',
    atletas: ['Carlos Eduardo','Vinicius Moura','André Fonseca','Renato Pires','Guilherme Neto','Igor Santos'] },
  { id: 'lorde-volei-f', nome: 'Vôlei Feminino', modalidadeId: 'volei', atleticaId: 'lorde',
    capitao: 'Camila Torres', treino: 'Ter/Qui · 17h30', local: 'Ginásio Central UFMA',
    atletas: ['Camila Torres','Letícia Alves','Patrícia Gomes','Raquel Melo','Isabela Cruz','Nathalia Brito'] },
  { id: 'lorde-basquete-m', nome: 'Basquete Masculino', modalidadeId: 'basquete', atleticaId: 'lorde',
    capitao: 'Leandro Moraes', treino: 'Seg/Sex · 18h30', local: 'Quadra Coberta — Bloco A',
    atletas: ['Leandro Moraes','Cauã Barbosa','Nathan Oliveira','Samuel Rocha','Henrique Leal'] },
  { id: 'lorde-handebol-m', nome: 'Handebol Masculino', modalidadeId: 'handebol', atleticaId: 'lorde',
    capitao: 'Rodrigo Freitas', treino: 'Qua/Sex · 19h00', local: 'Ginásio do CEB',
    atletas: ['Rodrigo Freitas','Alex Cardoso','Marcos Vieira','Jonathan Lima','Túlio Neves','Welson Cruz','Paulo Sérgio'] },
  // Times adversários (sem elenco)
  { id: 'falcao-futsal-m',    nome: 'Futsal Masculino',  modalidadeId: 'futsal',   atleticaId: 'falcao'    },
  { id: 'falcao-futsal-f',    nome: 'Futsal Feminino',   modalidadeId: 'futsal',   atleticaId: 'falcao'    },
  { id: 'nexus-futsal-m',     nome: 'Futsal Masculino',  modalidadeId: 'futsal',   atleticaId: 'nexus'     },
  { id: 'nexus-volei-f',      nome: 'Vôlei Feminino',    modalidadeId: 'volei',    atleticaId: 'nexus'     },
  { id: 'tubarao-basquete-m', nome: 'Basquete Masculino',modalidadeId: 'basquete', atleticaId: 'tubarao'   },
  { id: 'lince-handebol-m',   nome: 'Handebol Masculino',modalidadeId: 'handebol', atleticaId: 'lince'     },
  { id: 'escorpiao-futsal-f', nome: 'Futsal Feminino',   modalidadeId: 'futsal',   atleticaId: 'escorpiao' },
  { id: 'escorpiao-volei-m',  nome: 'Vôlei Masculino',   modalidadeId: 'volei',    atleticaId: 'escorpiao' },
]

export const EVENTOS: Evento[] = [
  // Jogos agendados
  { id: 'e1', tipo: 'JOGO', timeLordeId: 'lorde-futsal-m', timeAdvId: 'falcao-futsal-m',
    inicio: '2026-10-04T15:00:00', local: 'Ginásio do CEB', status: 'Agendado', confirmados: ['u1','u4'] },
  { id: 'e2', tipo: 'JOGO', timeLordeId: 'lorde-volei-f', timeAdvId: 'nexus-volei-f',
    inicio: '2026-10-05T10:00:00', local: 'Ginásio Central UFMA', status: 'Agendado', confirmados: ['u2'] },
  { id: 'e3', tipo: 'JOGO', timeLordeId: 'lorde-basquete-m', timeAdvId: 'tubarao-basquete-m',
    inicio: '2026-10-07T17:30:00', local: 'Quadra Coberta — Bloco B', status: 'Agendado', confirmados: ['u5'] },
  { id: 'e4', tipo: 'JOGO', timeLordeId: 'lorde-handebol-m', timeAdvId: 'lince-handebol-m',
    inicio: '2026-10-09T09:00:00', local: 'Ginásio do CEB', status: 'Agendado', confirmados: [] },
  // Jogo em andamento
  { id: 'e0', tipo: 'JOGO', timeLordeId: 'lorde-futsal-f', timeAdvId: 'falcao-futsal-f',
    inicio: '2026-09-30T14:00:00', local: 'Ginásio Central UFMA', status: 'Em andamento', confirmados: ['u1','u2'] },
  // Treino avulso
  { id: 'e5', tipo: 'TREINO', timeLordeId: 'lorde-futsal-m',
    inicio: '2026-10-01T18:00:00', local: 'Quadra Coberta — Bloco B', status: 'Agendado', confirmados: ['u1','u4'] },
  { id: 'e6', tipo: 'TREINO', timeLordeId: 'lorde-volei-f',
    inicio: '2026-10-02T17:30:00', local: 'Ginásio Central UFMA', status: 'Agendado', confirmados: ['u2'] },
  // Série recorrente de treinos (Futsal M)
  { id: 'e7', tipo: 'TREINO', timeLordeId: 'lorde-futsal-m',
    inicio: '2026-10-08T18:00:00', local: 'Quadra Coberta — Bloco B', status: 'Agendado',
    confirmados: [], recorrente: true, serieId: 'serie-futsal-m' },
  { id: 'e8', tipo: 'TREINO', timeLordeId: 'lorde-futsal-m',
    inicio: '2026-10-15T18:00:00', local: 'Quadra Coberta — Bloco B', status: 'Agendado',
    confirmados: [], recorrente: true, serieId: 'serie-futsal-m' },
  { id: 'e9', tipo: 'TREINO', timeLordeId: 'lorde-futsal-m',
    inicio: '2026-10-22T18:00:00', local: 'Quadra Coberta — Bloco B', status: 'Agendado',
    confirmados: [], recorrente: true, serieId: 'serie-futsal-m' },
  // Evento cancelado
  { id: 'e10', tipo: 'JOGO', timeLordeId: 'lorde-futsal-f', timeAdvId: 'escorpiao-futsal-f',
    inicio: '2026-09-28T14:00:00', local: 'Ginásio Central UFMA', status: 'Cancelado', confirmados: [] },
  // Jogos finalizados — vitória, empate, derrota
  { id: 'e11', tipo: 'JOGO', timeLordeId: 'lorde-futsal-m', timeAdvId: 'nexus-futsal-m',
    inicio: '2026-09-20T15:00:00', local: 'Ginásio do CEB', status: 'Finalizado',
    placar: { lorde: 4, adv: 2 }, confirmados: ['u1','u4'] },
  { id: 'e12', tipo: 'JOGO', timeLordeId: 'lorde-volei-f', timeAdvId: 'escorpiao-volei-m',
    inicio: '2026-09-22T10:00:00', local: 'Ginásio Central UFMA', status: 'Finalizado',
    placar: { lorde: 2, adv: 2 }, confirmados: ['u2'] },
  { id: 'e13', tipo: 'JOGO', timeLordeId: 'lorde-handebol-m', timeAdvId: 'lince-handebol-m',
    inicio: '2026-09-25T09:00:00', local: 'Ginásio do CEB', status: 'Finalizado',
    placar: { lorde: 19, adv: 22 }, confirmados: [] },
  { id: 'e14', tipo: 'TREINO', timeLordeId: 'lorde-basquete-m',
    inicio: '2026-09-29T18:30:00', local: 'Quadra Coberta — Bloco A', status: 'Finalizado', confirmados: ['u5'] },
]

export const NOTICIAS: Noticia[] = [
  { id: 'n1', titulo: 'Vitória épica no Futsal: 4×2 sobre a Nexus',
    conteudo: 'Em partida emocionante disputada no Ginásio do CEB, o time de Futsal Masculino da Atlética Lorde venceu a Atlética Nexus por 4 a 2, mantendo a liderança na tabela geral.',
    imagem: 'linear-gradient(135deg, #e11d48 0%, #7c0021 60%, #0f1116 100%)',
    data: '2026-09-20', status: 'Publicada', tags: ['FUTSAL','VITÓRIA','DESTAQUE'] },
  { id: 'n2', titulo: 'Inscrições abertas para novos sócios — prazo 31/10',
    conteudo: 'A atlética abre as inscrições para novos associados. Preencha o formulário no app e garanta sua carteirinha 2026.',
    imagem: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 60%, #0f1116 100%)',
    data: '2026-09-15', status: 'Publicada', tags: ['SÓCIOS','UFMA'] },
  { id: 'n3', titulo: 'Novo uniforme 2026 disponível — garanta o seu',
    conteudo: 'A nova coleção de uniformes chegou! Disponível na loja oficial com frete grátis para o campus.',
    imagem: 'linear-gradient(135deg, #1e3a8a 0%, #e11d48 100%)',
    data: '2026-09-10', status: 'Publicada', tags: ['LOJA','UNIFORME'] },
  { id: 'n4', titulo: 'Convocação: Handebol Masc. x Lince — 09/10',
    conteudo: 'A comissão técnica convoca os atletas listados abaixo para o jogo de quinta-feira. Presença obrigatória no aquecimento às 08h30.',
    imagem: 'linear-gradient(135deg, #7c0021 0%, #e11d48 50%, #0f1116 100%)',
    data: '2026-09-28', status: 'Rascunho', tags: ['HANDEBOL','CONVOCAÇÃO'] },
]

export const BANNERS: Banner[] = [
  { id: 'b1', titulo: 'CAMA 2026 — Fase Final', imagem: 'linear-gradient(135deg,#e11d48 0%,#7c0021 45%,#1e3a8a 100%)', ordem: 1, ativo: true },
  { id: 'b2', titulo: 'Uniforme 2026 na loja oficial', imagem: 'linear-gradient(135deg,#1e3a8a 0%,#1d4ed8 60%,#e11d48 100%)', link: '#', ordem: 2, ativo: true },
  { id: 'b3', titulo: 'Inter-Atléticas UFMA — 15 Out', imagem: 'linear-gradient(135deg,#7c0021 0%,#e11d48 50%,#0c0c10 100%)', link: '#', ordem: 3, ativo: true },
  { id: 'b4', titulo: '[Rascunho] Festa de aniversário', imagem: 'linear-gradient(135deg,#131720,#1e2a3a)', ordem: 4, ativo: false },
]

export const USUARIOS: Usuario[] = [
  { id: 'u1', nome: 'Gabriel Lima',   email: 'gabriel@discente.ufma.br',   role: 'atleta',     ativo: true,  timeId: 'lorde-futsal-m' },
  { id: 'u2', nome: 'Juliana Ramos',  email: 'juliana@discente.ufma.br',   role: 'diretor',    ativo: true,  timeId: 'lorde-futsal-f' },
  { id: 'u3', nome: 'Rafael Mendes',  email: 'rafael@discente.ufma.br',    role: 'presidente', ativo: true,  timeId: 'lorde-futsal-m' },
  { id: 'u4', nome: 'Carlos Eduardo', email: 'carlos@discente.ufma.br',    role: 'vice',       ativo: true,  timeId: 'lorde-volei-m' },
  { id: 'u5', nome: 'Leandro Moraes', email: 'leandro@discente.ufma.br',   role: 'atleta',     ativo: false, timeId: 'lorde-basquete-m' },
  { id: 'u6', nome: 'Admin Sistema',  email: 'admin@atleticalorde.ufma.br', role: 'admin',     ativo: true },
]

export const SOLICITACOES: Solicitacao[] = [
  { id: 's1', usuarioId: 'x1', nomeUsuario: 'Carlos Pinto',  timeId: 'lorde-futsal-m',   status: 'PENDENTE', data: '2026-09-28' },
  { id: 's2', usuarioId: 'x2', nomeUsuario: 'Marina Souza',  timeId: 'lorde-volei-f',    status: 'PENDENTE', data: '2026-09-27' },
  { id: 's3', usuarioId: 'x3', nomeUsuario: 'Tiago Almeida', timeId: 'lorde-basquete-m', status: 'APROVADA', data: '2026-09-25' },
]

export const AUDIT_LOG: AuditLog[] = [
  { id: 'a1', usuarioId: 'u3', nomeUsuario: 'Rafael Mendes',  acao: 'Publicou notícia', entidade: 'Notícias', alvo: 'Vitória épica no Futsal', data: '2026-09-20T16:00:00' },
  { id: 'a2', usuarioId: 'u2', nomeUsuario: 'Juliana Ramos',  acao: 'Adicionou evento', entidade: 'Eventos', alvo: 'Jogo Futsal M × Falcão',  data: '2026-09-18T10:30:00' },
  { id: 'a3', usuarioId: 'u4', nomeUsuario: 'Carlos Eduardo', acao: 'Desativou usuário', entidade: 'Usuários', alvo: 'Leandro Moraes', data: '2026-09-17T09:15:00' },
  { id: 'a4', usuarioId: 'u2', nomeUsuario: 'Juliana Ramos',  acao: 'Aceitou solicitação', entidade: 'Solicitações', alvo: 'Tiago Almeida → Basquete M', data: '2026-09-25T11:00:00' },
  { id: 'a5', usuarioId: 'u6', nomeUsuario: 'Admin Sistema',  acao: 'Alterou cargo', entidade: 'Cargos', alvo: 'Juliana Ramos → Diretor', data: '2026-09-15T08:00:00' },
]
