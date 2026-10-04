// Teste de carga RNF05 (200 atletas simultâneos mantendo o RNF03) — épico #30 §3.6, issue #83.
// Uso e variáveis: tests/carga/README.md.
import { check, sleep } from 'k6'
import http from 'k6/http'

const API_URL = (__ENV.API_URL || 'http://localhost:3000').replace(/\/+$/, '')
const BASE = `${API_URL}/api/v1`
const CARGA_SENHA = __ENV.CARGA_SENHA
const VUS = Number(__ENV.VUS || 200)
const USUARIOS = Number(__ENV.USUARIOS || 200)
const RAMPA = __ENV.RAMPA || '2m'
const DURACAO = __ENV.DURACAO || '10m'
const DESCIDA = __ENV.DESCIDA || '1m'
const LIMITE_P95_CONSULTA = Number(__ENV.LIMITE_P95_CONSULTA || 500)
const LIMITE_P95_GRAVACAO = Number(__ENV.LIMITE_P95_GRAVACAO || 1000)
const LOGINS_POR_MINUTO = Number(__ENV.LOGINS_POR_MINUTO || 0)

const cenarios = {
  atletas: {
    executor: 'ramping-vus',
    exec: 'atleta',
    startVUs: 0,
    stages: [
      { duration: RAMPA, target: VUS },
      { duration: DURACAO, target: VUS },
      { duration: DESCIDA, target: 0 },
    ],
    gracefulRampDown: '30s',
  },
}
// Opcional [Sugestão]: mede o custo do Argon2id com logins reais, fora dos thresholds.
if (LOGINS_POR_MINUTO > 0) {
  cenarios.logins = {
    executor: 'constant-arrival-rate',
    exec: 'login',
    rate: LOGINS_POR_MINUTO,
    timeUnit: '1m',
    duration: DURACAO,
    startTime: RAMPA,
    preAllocatedVUs: 2,
    maxVUs: 10,
  }
}

const ROTAS = [
  'GET /eventos',
  'GET /eventos/:id',
  'GET /eventos (placar)',
  'GET /noticias',
  'GET /me',
  'GET /atletica',
  'GET /times',
  'PUT /eventos/:id/participacao',
  'POST /auth/refresh',
  'POST /auth/login',
]
// O k6 só reporta submétricas citadas em thresholds: `max>=0` nunca falha e põe p50/p95/p99 de
// cada rota no resumo exportado.
const porRota = Object.fromEntries(
  ROTAS.map((rota) => [`http_req_duration{rota:${rota}}`, ['max>=0']]),
)

export const options = {
  scenarios: cenarios,
  setupTimeout: '10m',
  thresholds: {
    'http_req_duration{tipo:consulta}': [`p(95)<${LIMITE_P95_CONSULTA}`],
    'http_req_duration{tipo:gravacao}': [`p(95)<${LIMITE_P95_GRAVACAO}`],
    http_req_failed: ['rate<0.01'],
    checks: ['rate>0.99'],
    ...porRota,
    ...(LOGINS_POR_MINUTO > 0 && { 'http_req_duration{tipo:login}': ['max>=0'] }),
  },
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
}

const JSON_HEADERS = { 'Content-Type': 'application/json' }
const LOTE_LOGIN = 10

const emailCarga = (n) => `carga+${String(n).padStart(3, '0')}@teste.local`
const corpoLogin = (n) => JSON.stringify({ email: emailCarga(n), senha: CARGA_SENHA })

function sessaoDe(resposta) {
  const corpo = resposta.json()
  return {
    accessToken: corpo.accessToken,
    refreshToken: corpo.refreshToken,
    expiraEm: Date.parse(corpo.accessTokenExpiraEm),
  }
}

// Uma sessão por VU (o refresh rotaciona o token: VUs não podem compartilhar sessão). O login
// acontece só aqui, para não medir o Argon2id a cada iteração.
export function setup() {
  if (!CARGA_SENHA) throw new Error('Defina CARGA_SENHA (a mesma usada no seed-carga).')
  const sessoes = []
  for (let inicio = 0; inicio < VUS; inicio += LOTE_LOGIN) {
    const lote = []
    for (let i = inicio; i < Math.min(inicio + LOTE_LOGIN, VUS); i += 1) {
      lote.push({
        method: 'POST',
        url: `${BASE}/auth/login`,
        body: corpoLogin((i % USUARIOS) + 1),
        params: { headers: JSON_HEADERS, tags: { tipo: 'setup', rota: 'POST /auth/login' } },
      })
    }
    for (const resposta of http.batch(lote)) {
      if (resposta.status !== 200) {
        throw new Error(
          `Login da massa de carga falhou (HTTP ${resposta.status}): rode o seed-carga.`,
        )
      }
      sessoes.push(sessaoDe(resposta))
    }
  }
  return { sessoes }
}

// Estado de cada VU (cada VU tem o próprio runtime JS).
let sessao
let meusTimes = []
let eventosVistos = []
let eventosParaResponder = []

function params(tipo, rota) {
  return {
    headers: { ...JSON_HEADERS, Authorization: `Bearer ${sessao.accessToken}` },
    tags: { tipo, rota },
  }
}

function consultar(rota, caminho) {
  const resposta = http.get(`${BASE}${caminho}`, params('consulta', rota))
  check(resposta, { [`${rota} → 200`]: (r) => r.status === 200 })
  return resposta
}

function itens(resposta) {
  return resposta.status === 200 ? resposta.json('items') || [] : []
}

function renovarSessao() {
  const resposta = http.post(
    `${BASE}/auth/refresh`,
    JSON.stringify({ refreshToken: sessao.refreshToken }),
    { headers: JSON_HEADERS, tags: { tipo: 'gravacao', rota: 'POST /auth/refresh' } },
  )
  if (check(resposta, { 'POST /auth/refresh → 200': (r) => r.status === 200 })) {
    sessao = sessaoDe(resposta)
  }
}

function listarEventos() {
  eventosVistos = itens(consultar('GET /eventos', '/eventos?page=1&limit=20'))
}

function detalharEvento() {
  if (eventosVistos.length === 0) listarEventos()
  const evento = eventosVistos[Math.floor(Math.random() * eventosVistos.length)]
  if (evento) consultar('GET /eventos/:id', `/eventos/${evento.id}`)
}

function carregarMe() {
  const resposta = consultar('GET /me', '/me')
  if (resposta.status === 200) meusTimes = (resposta.json('times') || []).map((t) => t.id)
}

// Só eventos futuros AGENDADO do próprio time aceitam resposta (#24).
function responderParticipacao() {
  if (meusTimes.length === 0) carregarMe()
  if (eventosParaResponder.length === 0 && meusTimes.length > 0) {
    const timeId = meusTimes[Math.floor(Math.random() * meusTimes.length)]
    const agora = Date.now() + 60_000
    eventosParaResponder = itens(
      consultar('GET /eventos', `/eventos?status=AGENDADO&timeId=${timeId}&page=1&limit=20`),
    ).filter((e) => e.souMembro && Date.parse(e.inicio) > agora)
  }
  const evento = eventosParaResponder[Math.floor(Math.random() * eventosParaResponder.length)]
  if (!evento) return
  const resposta = http.put(
    `${BASE}/eventos/${evento.id}/participacao`,
    JSON.stringify({ confirmado: Math.random() < 0.7 }),
    params('gravacao', 'PUT /eventos/:id/participacao'),
  )
  check(resposta, { 'PUT /eventos/:id/participacao → 200': (r) => r.status === 200 })
}

// Pesos da tabela do épico #30 §3.6 (soma 100).
const ACOES = [
  [25, listarEventos],
  [15, detalharEvento],
  [15, () => consultar('GET /noticias', '/noticias?page=1&limit=20')],
  [10, () => consultar('GET /eventos (placar)', '/eventos?periodo=PASSADOS&status=FINALIZADO')],
  [10, carregarMe],
  [5, () => consultar('GET /atletica', '/atletica')],
  [5, () => consultar('GET /times', '/times')],
  [10, responderParticipacao],
  [5, renovarSessao],
]
const PESO_TOTAL = ACOES.reduce((soma, [peso]) => soma + peso, 0)

function sortearAcao() {
  let sorteio = Math.random() * PESO_TOTAL
  for (const [peso, acao] of ACOES) {
    sorteio -= peso
    if (sorteio < 0) return acao
  }
  return ACOES[0][1]
}

export function atleta(dados) {
  sessao ??= dados.sessoes[(__VU - 1) % dados.sessoes.length]
  if (Date.now() > sessao.expiraEm - 60_000) renovarSessao()
  sortearAcao()()
  sleep(3 + Math.random() * 5)
}

export function login() {
  const n = Math.floor(Math.random() * USUARIOS) + 1
  const resposta = http.post(`${BASE}/auth/login`, corpoLogin(n), {
    headers: JSON_HEADERS,
    tags: { tipo: 'login', rota: 'POST /auth/login' },
  })
  check(resposta, { 'POST /auth/login → 200': (r) => r.status === 200 })
}
