import { C, ATLETICA } from './theme'
import type {
  Modalidade, Atletica, Time, MembroTime, Evento, Participacao, Noticia, Banner, Usuario, Solicitacao, AuditLog,
} from './types'

// Senha de todas as contas de exemplo (atende à regra: 8+ caracteres, com letras e números)
export const DEMO_SENHA = 'lorde2026'
// Código de recuperação de senha simulado (UC09)
export const DEMO_CODIGO = '123456'

export const MODALIDADES: Modalidade[] = [
  { id: 'futsal',   nome: 'Futsal',   emoji: '⚽', cor: C.red,  ativa: true },
  { id: 'volei',    nome: 'Vôlei',    emoji: '🏐', cor: C.blue, ativa: true },
  { id: 'basquete', nome: 'Basquete', emoji: '🏀', cor: C.red,  ativa: true },
  { id: 'handebol', nome: 'Handebol', emoji: '🤾', cor: C.blue, ativa: true },
]

export const ATLETICAS: Atletica[] = [
  { id: ATLETICA.id, nome: ATLETICA.nome, curso: ATLETICA.curso, usaAplicativo: true },
  { id: 'falcao',    nome: 'Atlética Falcão',    curso: 'Engenharia Civil',         usaAplicativo: false },
  { id: 'nexus',     nome: 'Atlética Nexus',     curso: 'Tecnologia da Informação', usaAplicativo: false },
  { id: 'tubarao',   nome: 'Atlética Tubarão',   curso: 'Direito',                  usaAplicativo: false },
  { id: 'lince',     nome: 'Atlética Lince',     curso: 'Medicina',                 usaAplicativo: false },
  { id: 'escorpiao', nome: 'Atlética Escorpião', curso: 'Letras',                   usaAplicativo: false },
]

const A = ATLETICA.id

export const TIMES: Time[] = [
  // Times da atlética (com elenco e capitão)
  { id: 'lorde-futsal-m',   nome: 'Futsal Masculino',   modalidadeId: 'futsal',   atleticaId: A, capitaoId: 'u3',  ativo: true },
  { id: 'lorde-futsal-f',   nome: 'Futsal Feminino',    modalidadeId: 'futsal',   atleticaId: A, capitaoId: 'u2',  ativo: true },
  { id: 'lorde-volei-m',    nome: 'Vôlei Masculino',    modalidadeId: 'volei',    atleticaId: A, capitaoId: 'u4',  ativo: true },
  { id: 'lorde-volei-f',    nome: 'Vôlei Feminino',     modalidadeId: 'volei',    atleticaId: A, capitaoId: 'a18', ativo: true },
  { id: 'lorde-basquete-m', nome: 'Basquete Masculino', modalidadeId: 'basquete', atleticaId: A, capitaoId: 'a24', ativo: true },
  { id: 'lorde-handebol-m', nome: 'Handebol Masculino', modalidadeId: 'handebol', atleticaId: A, capitaoId: 'a28', ativo: true },
  // Times adversários: sem elenco, capitão, treinos ou solicitações (RN21)
  { id: 'falcao-futsal-m',    nome: 'Futsal Masculino',   modalidadeId: 'futsal',   atleticaId: 'falcao',    ativo: true },
  { id: 'falcao-futsal-f',    nome: 'Futsal Feminino',    modalidadeId: 'futsal',   atleticaId: 'falcao',    ativo: true },
  { id: 'nexus-futsal-m',     nome: 'Futsal Masculino',   modalidadeId: 'futsal',   atleticaId: 'nexus',     ativo: true },
  { id: 'nexus-volei-f',      nome: 'Vôlei Feminino',     modalidadeId: 'volei',    atleticaId: 'nexus',     ativo: true },
  { id: 'tubarao-basquete-m', nome: 'Basquete Masculino', modalidadeId: 'basquete', atleticaId: 'tubarao',   ativo: true },
  { id: 'lince-handebol-m',   nome: 'Handebol Masculino', modalidadeId: 'handebol', atleticaId: 'lince',     ativo: true },
  { id: 'escorpiao-futsal-f', nome: 'Futsal Feminino',    modalidadeId: 'futsal',   atleticaId: 'escorpiao', ativo: true },
  { id: 'escorpiao-volei-m',  nome: 'Vôlei Masculino',    modalidadeId: 'volei',    atleticaId: 'escorpiao', ativo: true },
]

function email(nome: string) {
  return nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, '.') + '@email.com'
}

// [id, nome, times]
const ATLETAS: [string, string, string[]][] = [
  ['a01', 'Lucas Sousa',       ['lorde-futsal-m']],
  ['a02', 'Pedro Carvalho',    ['lorde-futsal-m']],
  ['a03', 'Thiago Lima',       ['lorde-futsal-m']],
  ['a04', 'Diego Costa',       ['lorde-futsal-m']],
  ['a05', 'Bruno Alves',       ['lorde-futsal-m']],
  ['a06', 'Mateus Rocha',      ['lorde-futsal-m']],
  ['a07', 'Felipe Silva',      ['lorde-futsal-m']],
  ['a08', 'Beatriz Lima',      ['lorde-futsal-f']],
  ['a09', 'Fernanda Costa',    ['lorde-futsal-f']],
  ['a10', 'Ana Clara',         ['lorde-futsal-f', 'lorde-volei-f']],
  ['a11', 'Mariana Dias',      ['lorde-futsal-f']],
  ['a12', 'Larissa Ferreira',  ['lorde-futsal-f']],
  ['a13', 'Vinicius Moura',    ['lorde-volei-m']],
  ['a14', 'André Fonseca',     ['lorde-volei-m']],
  ['a15', 'Renato Pires',      ['lorde-volei-m']],
  ['a16', 'Guilherme Neto',    ['lorde-volei-m']],
  ['a17', 'Igor Santos',       ['lorde-volei-m']],
  ['a18', 'Camila Torres',     ['lorde-volei-f']],
  ['a19', 'Letícia Alves',     ['lorde-volei-f']],
  ['a20', 'Patrícia Gomes',    ['lorde-volei-f']],
  ['a21', 'Raquel Melo',       ['lorde-volei-f']],
  ['a22', 'Isabela Cruz',      ['lorde-volei-f']],
  ['a23', 'Nathalia Brito',    ['lorde-volei-f']],
  ['a24', 'Cauã Barbosa',      ['lorde-basquete-m']],
  ['a25', 'Nathan Oliveira',   ['lorde-basquete-m']],
  ['a26', 'Samuel Rocha',      ['lorde-basquete-m']],
  ['a27', 'Henrique Leal',     ['lorde-basquete-m']],
  ['a28', 'Rodrigo Freitas',   ['lorde-handebol-m']],
  ['a29', 'Alex Cardoso',      ['lorde-handebol-m']],
  ['a30', 'Marcos Vieira',     ['lorde-handebol-m']],
  ['a31', 'Jonathan Lima',     ['lorde-handebol-m']],
  ['a32', 'Túlio Neves',       ['lorde-handebol-m']],
  ['a33', 'Welson Cruz',       ['lorde-handebol-m']],
  ['a34', 'Paulo Sérgio',      ['lorde-handebol-m']],
  ['x3',  'Tiago Almeida',     ['lorde-basquete-m']],
  ['x1',  'Carlos Pinto',      []],
  ['x2',  'Marina Souza',      []],
  ['a35', 'Sofia Martins',     []],
]

export const USUARIOS: Usuario[] = [
  // Uma conta de exemplo por papel ("Entrar como" na tela de login)
  { id: 'u1', nome: 'Gabriel Lima',   email: 'gabriel@email.com',            role: 'atleta',     ativo: true },
  { id: 'u2', nome: 'Juliana Ramos',  email: 'juliana@email.com',            role: 'diretor',    ativo: true },
  { id: 'u3', nome: 'Rafael Mendes',  email: 'rafael@email.com',             role: 'presidente', ativo: true },
  { id: 'u4', nome: 'Carlos Eduardo', email: 'carlos@email.com',             role: 'vice',       ativo: true },
  { id: 'u5', nome: 'Leandro Moraes', email: 'leandro@email.com',            role: 'atleta',     ativo: false },
  { id: 'u6', nome: 'Admin Sistema',  email: 'admin@atleticalorde.com.br',   role: 'admin',      ativo: true },
  ...ATLETAS.map(([id, nome]) => ({ id, nome, email: email(nome), role: 'atleta' as const, ativo: true })),
]

export const MEMBROS: MembroTime[] = [
  { timeId: 'lorde-futsal-m',   usuarioId: 'u3', entradaEm: '2026-02-10T10:00:00' },
  { timeId: 'lorde-futsal-m',   usuarioId: 'u1', entradaEm: '2026-03-02T10:00:00' },
  { timeId: 'lorde-handebol-m', usuarioId: 'u1', entradaEm: '2026-04-15T10:00:00' },
  { timeId: 'lorde-futsal-f',   usuarioId: 'u2', entradaEm: '2026-02-10T10:00:00' },
  { timeId: 'lorde-volei-m',    usuarioId: 'u4', entradaEm: '2026-02-10T10:00:00' },
  { timeId: 'lorde-basquete-m', usuarioId: 'u5', entradaEm: '2026-02-12T10:00:00' },
  ...ATLETAS.flatMap(([id, , times]) => times.map(timeId => ({
    timeId, usuarioId: id, entradaEm: id === 'x3' ? '2026-09-25T11:00:00' : '2026-03-05T10:00:00',
  }))),
]

export const EVENTOS: Evento[] = [
  // Em andamento
  { id: 'e0',  tipo: 'JOGO',   timeId: 'lorde-futsal-f', timeAdversarioId: 'falcao-futsal-f',
    inicio: '2026-09-30T14:00:00', local: 'Ginásio Central UFMA', status: 'Em andamento' },
  // Agendados
  { id: 'e5',  tipo: 'TREINO', timeId: 'lorde-futsal-m',
    inicio: '2026-10-01T18:00:00', local: 'Quadra Coberta — Bloco B', status: 'Agendado' },
  { id: 'e6',  tipo: 'TREINO', timeId: 'lorde-volei-f',
    inicio: '2026-10-02T17:30:00', local: 'Ginásio Central UFMA', status: 'Agendado' },
  { id: 'e10', tipo: 'JOGO',   timeId: 'lorde-futsal-f', timeAdversarioId: 'escorpiao-futsal-f',
    inicio: '2026-10-03T14:00:00', local: 'Ginásio Central UFMA', status: 'Cancelado' },
  { id: 'e1',  tipo: 'JOGO',   timeId: 'lorde-futsal-m', timeAdversarioId: 'falcao-futsal-m',
    inicio: '2026-10-04T15:00:00', local: 'Ginásio do CEB', status: 'Agendado' },
  { id: 'e2',  tipo: 'JOGO',   timeId: 'lorde-volei-f', timeAdversarioId: 'nexus-volei-f',
    inicio: '2026-10-05T10:00:00', local: 'Ginásio Central UFMA', status: 'Agendado' },
  { id: 'e3',  tipo: 'JOGO',   timeId: 'lorde-basquete-m', timeAdversarioId: 'tubarao-basquete-m',
    inicio: '2026-10-07T17:30:00', local: 'Quadra Coberta — Bloco A', status: 'Agendado' },
  { id: 'e4',  tipo: 'JOGO',   timeId: 'lorde-handebol-m', timeAdversarioId: 'lince-handebol-m',
    inicio: '2026-10-09T09:00:00', local: 'Ginásio do CEB', status: 'Agendado' },
  // Série recorrente de treinos do Futsal Masculino (quintas, 18:00)
  { id: 'e7',  tipo: 'TREINO', timeId: 'lorde-futsal-m', serieId: 'serie-futsal-m',
    inicio: '2026-10-08T18:00:00', local: 'Quadra Coberta — Bloco B', status: 'Agendado' },
  { id: 'e8',  tipo: 'TREINO', timeId: 'lorde-futsal-m', serieId: 'serie-futsal-m',
    inicio: '2026-10-15T18:00:00', local: 'Quadra Coberta — Bloco B', status: 'Agendado' },
  { id: 'e9',  tipo: 'TREINO', timeId: 'lorde-futsal-m', serieId: 'serie-futsal-m',
    inicio: '2026-10-22T18:00:00', local: 'Quadra Coberta — Bloco B', status: 'Agendado' },
  // Finalizados — vitória, derrota e empate
  { id: 'e11', tipo: 'JOGO',   timeId: 'lorde-futsal-m', timeAdversarioId: 'nexus-futsal-m',
    inicio: '2026-09-20T15:00:00', local: 'Ginásio do CEB', status: 'Finalizado', placarTime: 4, placarAdversario: 2 },
  { id: 'e12', tipo: 'JOGO',   timeId: 'lorde-volei-f', timeAdversarioId: 'nexus-volei-f',
    inicio: '2026-09-22T10:00:00', local: 'Ginásio Central UFMA', status: 'Finalizado', placarTime: 1, placarAdversario: 3 },
  { id: 'e13', tipo: 'JOGO',   timeId: 'lorde-handebol-m', timeAdversarioId: 'lince-handebol-m',
    inicio: '2026-09-25T09:00:00', local: 'Ginásio do CEB', status: 'Finalizado', placarTime: 22, placarAdversario: 22 },
  // Jogo finalizado ainda sem resultado
  { id: 'e15', tipo: 'JOGO',   timeId: 'lorde-basquete-m', timeAdversarioId: 'tubarao-basquete-m',
    inicio: '2026-09-27T16:00:00', local: 'Quadra Coberta — Bloco A', status: 'Finalizado' },
  // Treinos finalizados
  { id: 'e17', tipo: 'TREINO', timeId: 'lorde-futsal-m',
    inicio: '2026-09-17T18:00:00', local: 'Quadra Coberta — Bloco B', status: 'Finalizado' },
  { id: 'e16', tipo: 'TREINO', timeId: 'lorde-futsal-m',
    inicio: '2026-09-24T18:00:00', local: 'Quadra Coberta — Bloco B', status: 'Finalizado' },
  // Treino finalizado sem presença registrada
  { id: 'e14', tipo: 'TREINO', timeId: 'lorde-basquete-m',
    inicio: '2026-09-29T18:30:00', local: 'Quadra Coberta — Bloco A', status: 'Finalizado' },
]

// [eventoId, usuarioId, confirmado, presente]
const P: [string, string, boolean | null, boolean | null][] = [
  // Agendados: respostas dos atletas (sem presença)
  ['e1', 'u3', true, null], ['e1', 'a01', true, null], ['e1', 'a02', false, null], ['e1', 'a03', true, null], ['e1', 'a05', true, null],
  ['e5', 'u1', true, null], ['e5', 'u3', true, null], ['e5', 'a01', true, null], ['e5', 'a04', false, null],
  ['e2', 'a18', true, null], ['e2', 'a19', true, null], ['e2', 'a20', false, null], ['e2', 'a10', true, null],
  ['e6', 'a18', true, null],
  ['e3', 'a24', true, null], ['e3', 'x3', true, null],
  // Em andamento: respostas, presença ainda não registrada
  ['e0', 'u2', true, null], ['e0', 'a08', true, null], ['e0', 'a09', true, null], ['e0', 'a10', false, null],
  // Finalizados com presença registrada
  ['e11', 'u1', true, true], ['e11', 'u3', true, true], ['e11', 'a01', true, false], ['e11', 'a02', null, true],
  ['e11', 'a03', false, false], ['e11', 'a04', true, true], ['e11', 'a05', true, true], ['e11', 'a06', null, false], ['e11', 'a07', true, true],
  ['e17', 'u1', true, false], ['e17', 'u3', true, true], ['e17', 'a01', true, true], ['e17', 'a02', null, true],
  ['e16', 'u1', true, true], ['e16', 'u3', true, true], ['e16', 'a01', null, true], ['e16', 'a05', true, false],
  ['e12', 'a18', true, true], ['e12', 'a19', true, true], ['e12', 'a20', null, true], ['e12', 'a21', true, true], ['e12', 'a22', false, false], ['e12', 'a23', true, true],
  ['e13', 'a28', true, true], ['e13', 'a29', true, true], ['e13', 'a30', true, false], ['e13', 'a31', null, true], ['e13', 'a32', true, true], ['e13', 'a33', true, true], ['e13', 'a34', true, true],
  // Finalizados sem presença registrada (apenas respostas)
  ['e14', 'a24', true, null], ['e14', 'a25', true, null],
  ['e15', 'a24', true, null], ['e15', 'x3', true, null],
]

function respondidoEm(eventoId: string) {
  const ev = EVENTOS.find(e => e.id === eventoId)!
  const d = new Date(ev.inicio)
  d.setDate(d.getDate() - 2)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T19:30:00`
}

export const PARTICIPACOES: Participacao[] = P.map(([eventoId, usuarioId, confirmado, presente]) => ({
  eventoId, usuarioId, confirmado, presente,
  respondidoEm: confirmado === null ? undefined : respondidoEm(eventoId),
}))

export const NOTICIAS: Noticia[] = [
  { id: 'n1', titulo: 'Vitória épica no Futsal: 4×2 sobre a Nexus',
    conteudo: `Em partida emocionante disputada no Ginásio do CEB, o time de **Futsal Masculino** venceu a Atlética Nexus por 4 a 2.\n\nDestaques da partida:\n- Dois gols de Rafael Mendes\n- Defesa decisiva no último minuto\n\nVeja a agenda dos próximos jogos no app.`,
    imagem: 'linear-gradient(135deg, #e11d48 0%, #7c0021 60%, #0f1116 100%)',
    criadaEm: '2026-09-20T17:40:00', publicadaEm: '2026-09-20T18:00:00', autorId: 'u3',
    status: 'Publicada', tags: ['FUTSAL', 'VITÓRIA'] },
  { id: 'n2', titulo: 'Seletiva do Vôlei Feminino no dia 10/10',
    conteudo: `A diretoria convida todas as interessadas para a **seletiva do Vôlei Feminino**.\n\n- Local: Ginásio Central UFMA\n- Horário: 17:30\n\nSolicite entrada no time pela aba Times. Dúvidas: [fale com a diretoria](https://exemplo.com/contato).`,
    imagem: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 60%, #0f1116 100%)',
    criadaEm: '2026-09-15T09:00:00', publicadaEm: '2026-09-15T10:00:00', autorId: 'u2',
    status: 'Publicada', tags: ['VÔLEI', 'SELETIVA'] },
  { id: 'n3', titulo: 'Novo uniforme 2026 disponível',
    conteudo: 'A nova coleção de uniformes chegou! As encomendas podem ser feitas com a diretoria até o fim do mês.',
    imagem: 'linear-gradient(135deg, #1e3a8a 0%, #e11d48 100%)',
    criadaEm: '2026-09-10T08:00:00', publicadaEm: '2026-09-10T08:30:00', autorId: 'u2',
    status: 'Publicada', tags: ['UNIFORME'] },
  { id: 'n4', titulo: 'Convocação: Handebol Masculino x Lince — 09/10',
    conteudo: 'A comissão técnica convoca o elenco para o jogo de sexta-feira. Aquecimento às 08:30.',
    imagem: 'linear-gradient(135deg, #7c0021 0%, #e11d48 50%, #0f1116 100%)',
    criadaEm: '2026-09-28T11:00:00', status: 'Rascunho', tags: ['HANDEBOL', 'CONVOCAÇÃO'] },
]

// Link opcional e sempre HTTPS (RN34)
export const BANNERS: Banner[] = [
  { id: 'b1', titulo: 'Jogos da semana — confira a agenda', imagem: 'linear-gradient(135deg,#e11d48 0%,#7c0021 45%,#1e3a8a 100%)', ordem: 1, ativo: true },
  { id: 'b2', titulo: 'Uniforme 2026 — encomende já', imagem: 'linear-gradient(135deg,#1e3a8a 0%,#1d4ed8 60%,#e11d48 100%)', link: 'https://exemplo.com/uniforme-2026', ordem: 2, ativo: true },
  { id: 'b3', titulo: 'Inter-Atléticas UFMA — 15/10', imagem: 'linear-gradient(135deg,#7c0021 0%,#e11d48 50%,#0c0c10 100%)', link: 'https://exemplo.com/inter-atleticas', ordem: 3, ativo: true },
  { id: 'b4', titulo: 'Festa de aniversário da atlética', imagem: 'linear-gradient(135deg,#131720,#1e2a3a)', ordem: 4, ativo: false },
]

export const SOLICITACOES: Solicitacao[] = [
  { id: 's1', usuarioId: 'x1',  timeId: 'lorde-futsal-m',   status: 'PENDENTE',  criadaEm: '2026-09-28T09:12:00' },
  { id: 's2', usuarioId: 'x2',  timeId: 'lorde-volei-f',    status: 'PENDENTE',  criadaEm: '2026-09-27T20:40:00' },
  { id: 's3', usuarioId: 'x3',  timeId: 'lorde-basquete-m', status: 'APROVADA',  criadaEm: '2026-09-24T14:00:00', avaliadaEm: '2026-09-25T11:00:00' },
  { id: 's4', usuarioId: 'a35', timeId: 'lorde-futsal-f',   status: 'REJEITADA', criadaEm: '2026-09-20T08:00:00', avaliadaEm: '2026-09-21T10:15:00' },
  { id: 's5', usuarioId: 'a35', timeId: 'lorde-volei-f',    status: 'CANCELADA', criadaEm: '2026-09-22T12:00:00', avaliadaEm: '2026-09-23T09:00:00' },
]

export const AUDIT_LOG: AuditLog[] = [
  { id: 'a1', usuarioId: 'u3', nomeUsuario: 'Rafael Mendes',  acao: 'Publicou notícia',     entidade: 'Notícias',        alvo: 'Vitória épica no Futsal',          data: '2026-09-20T18:00:00' },
  { id: 'a2', usuarioId: 'u2', nomeUsuario: 'Juliana Ramos',  acao: 'Criou evento',         entidade: 'Eventos',         alvo: 'Jogo Futsal Masculino × Falcão',   data: '2026-09-18T10:30:00' },
  { id: 'a3', usuarioId: 'u4', nomeUsuario: 'Carlos Eduardo', acao: 'Desativou usuário',    entidade: 'Usuários',        alvo: 'Leandro Moraes',                   data: '2026-09-17T09:15:00' },
  { id: 'a4', usuarioId: 'u2', nomeUsuario: 'Juliana Ramos',  acao: 'Aprovou solicitação',  entidade: 'Solicitações',    alvo: 'Tiago Almeida → Basquete Masculino', data: '2026-09-25T11:00:00' },
  { id: 'a5', usuarioId: 'u6', nomeUsuario: 'Admin Sistema',  acao: 'Alterou cargo',        entidade: 'Cargos',          alvo: 'Juliana Ramos → Diretor',          data: '2026-09-15T08:00:00' },
  { id: 'a6', usuarioId: 'u2', nomeUsuario: 'Juliana Ramos',  acao: 'Registrou resultado',  entidade: 'Resultados',      alvo: 'Futsal Masculino 4 × 2 Nexus',     data: '2026-09-20T17:30:00' },
  { id: 'a7', usuarioId: 'u2', nomeUsuario: 'Juliana Ramos',  acao: 'Registrou presença',   entidade: 'Presenças',       alvo: 'Treino Futsal Masculino · 24/09',  data: '2026-09-24T20:00:00' },
]
