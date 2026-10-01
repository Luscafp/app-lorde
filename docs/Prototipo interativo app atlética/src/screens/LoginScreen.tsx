import { useState, useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import type { DemoFlags, Usuario } from '../types'
import { C, ATLETICA } from '../theme'
import { DEMO_SENHA, DEMO_CODIGO } from '../data'
import { ROLE_LABEL, SENHA_REGRA, senhaValida, emailValido } from '../utils'
import { IcoShield, IcoBack, IcoCheck, IcoBell, IcoAlert } from '../components/atoms'
import { Field, PasswordField, StrBar, ErrorBox, TermsModal, DemoButton } from '../components/shared'

type LView = 'login' | 'cadastro' | 'reset-email' | 'reset-code' | 'reset-pw' | 'reset-ok' | 'notif'

// "Entrar como": uma conta de exemplo por papel
const CONTAS_DEMO = ['u1', 'u2', 'u4', 'u3', 'u6']

const MAX_FALHAS = 5               // RNF06: 5 falhas em 15 minutos
const JANELA_MS = 15 * 60 * 1000
const MAX_ENVIOS_CODIGO = 3        // UC09 A1: até 3 envios por hora

function AlertBox({ type, title, children }: { type: 'error' | 'warn'; title: string; children: ReactNode }) {
  const colors = type === 'error'
    ? { bg: '#450a0a', border: 'rgba(244,63,94,.3)', icon: '#f87171', title: '#f87171' }
    : { bg: '#1c1209', border: 'rgba(234,179,8,.3)', icon: C.yellow, title: C.yellow }
  return (
    <div className="flex items-start gap-3 p-4 rounded-2xl" style={{ background: colors.bg, border: `1px solid ${colors.border}` }}>
      <IcoAlert size={18} color={colors.icon} />
      <div>
        <p className="f-sora font-bold text-sm mb-0.5" style={{ color: colors.title }}>{title}</p>
        <div className="f-mono text-xs leading-relaxed" style={{ color: C.muted }}>{children}</div>
      </div>
    </div>
  )
}

function Btn({ label, onClick, disabled }: { label: string; onClick?: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="w-full py-4 rounded-2xl f-sora font-bold text-sm active:scale-95 transition-all"
      style={{ background: disabled ? C.dim : C.red, color: '#fff', boxShadow: disabled ? 'none' : '0 4px 20px rgba(225,29,72,.4)' }}>
      {label}
    </button>
  )
}

function Logo({ sub }: { sub: string }) {
  return (
    <div className="text-center mb-7">
      <div className="flex items-center justify-center gap-2 mb-2">
        <IcoShield size={28} color={C.red} />
        <span className="f-sora font-black text-2xl" style={{ color: C.text }}>{ATLETICA.sigla}</span>
      </div>
      <p className="f-mono text-xs" style={{ color: C.muted }}>{sub}</p>
    </div>
  )
}

function Passos({ atual }: { atual: 1 | 2 | 3 }) {
  return (
    <div className="flex items-center gap-2 mt-3">
      {[1, 2, 3].map(i => (
        <div key={i} className="h-0.5 flex-1 rounded-full" style={{ background: i <= atual ? C.red : C.dim }} />
      ))}
      <span className="f-mono text-[9px] shrink-0" style={{ color: C.dim }}>{atual} / 3</span>
    </div>
  )
}

function EntrarComo({ usuarios, onPick }: { usuarios: Usuario[]; onPick: (u: Usuario) => void }) {
  const [open, setOpen] = useState(false)
  const contas = CONTAS_DEMO.map(id => usuarios.find(u => u.id === id)).filter((u): u is Usuario => !!u && !u.excluido)
  return (
    <div className="mt-5">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2 rounded-xl f-mono text-[10px]"
        style={{ background: C.card2, color: C.dim, border: `1px solid ${C.bdr}` }}>
        <span>// Entrar como…</span>
        <span style={{ display: 'inline-block', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>▾</span>
      </button>
      {open && (
        <div className="mt-1 rounded-2xl overflow-hidden" style={{ border: `1px solid ${C.bdr}` }}>
          {contas.map((u, i) => (
            <button key={u.id} onClick={() => { onPick(u); setOpen(false) }}
              className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left"
              style={{ background: C.card2, borderBottom: i < contas.length - 1 ? `1px solid ${C.bdr}` : 'none' }}>
              <div>
                <div className="f-sora font-semibold text-xs" style={{ color: C.text }}>{ROLE_LABEL[u.role]}</div>
                <div className="f-mono text-[9px]" style={{ color: C.muted }}>{u.nome} · {u.email}</div>
              </div>
            </button>
          ))}
          <p className="f-mono text-[9px] px-4 py-2" style={{ background: C.card2, color: C.dim, borderTop: `1px solid ${C.bdr}` }}>
            Senha de todas as contas: {DEMO_SENHA}
          </p>
        </div>
      )}
    </div>
  )
}

type Props = {
  usuarios: Usuario[]
  senhaCorreta: (usuarioId: string, senha: string) => boolean
  alterarSenha: (usuarioId: string, senha: string) => void
  primeiroAcesso: (usuarioId: string) => boolean
  onCadastro: (nome: string, email: string, senha: string) => Usuario
  onLogin: (usuarioId: string) => void
  onDemo: () => void
  demo: DemoFlags
  showToast: (message: string, type: 'success' | 'error') => void
}

export default function LoginScreen({ usuarios, senhaCorreta, alterarSenha, primeiroAcesso, onCadastro, onLogin, onDemo, demo, showToast }: Props) {
  const [view, setView] = useState<LView>('login')
  const [modal, setModal] = useState<'termos' | 'privacidade' | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)

  // Login
  const [lEmail, setLEmail] = useState('')
  const [lPw, setLPw] = useState('')
  const [lError, setLError] = useState<string | null>(null)
  const [falhas, setFalhas] = useState<number[]>([])
  const [bloqueadoAte, setBloqueadoAte] = useState<number | null>(null)
  const [agora, setAgora] = useState(Date.now())

  // Cadastro
  const [cNome, setCNome] = useState('')
  const [cEmail, setCEmail] = useState('')
  const [cPw, setCPw] = useState('')
  const [cConf, setCConf] = useState('')
  const [cTerms, setCTerms] = useState(false)
  const [cErrors, setCErrors] = useState<Record<string, string>>({})
  const [cExiste, setCExiste] = useState(false)

  // Recuperação
  const [rEmail, setREmail] = useState('')
  const [rCode, setRCode] = useState(['', '', '', '', '', ''])
  const [rCodeErr, setRCodeErr] = useState<string | null>(null)
  const [rEnvios, setREnvios] = useState(0)
  const [rPw, setRPw] = useState('')
  const [rConf, setRConf] = useState('')
  const [rErr, setRErr] = useState<string | null>(null)
  const [rExpira, setRExpira] = useState(0)
  const codeRefs = useRef<(HTMLInputElement | null)[]>([])

  const bloqueado = bloqueadoAte !== null && agora < bloqueadoAte

  // Relógio para contagens regressivas (bloqueio e validade do código)
  useEffect(() => {
    if (!bloqueado && view !== 'reset-code') return
    const t = setInterval(() => setAgora(Date.now()), 1000)
    return () => clearInterval(t)
  }, [bloqueado, view])

  useEffect(() => {
    if (bloqueadoAte !== null && agora >= bloqueadoAte) { setBloqueadoAte(null); setFalhas([]) }
  }, [agora, bloqueadoAte])

  const fmtTime = (ms: number) => {
    const s = Math.max(0, Math.ceil(ms / 1000))
    return `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`
  }

  function concluirAcesso(id: string) {
    if (primeiroAcesso(id)) { setPendingId(id); setView('notif') }
    else onLogin(id)
  }

  function submitLogin() {
    if (bloqueado) return
    const user = usuarios.find(u => !u.excluido && u.email.toLowerCase() === lEmail.trim().toLowerCase())
    if (!user || !senhaCorreta(user.id, lPw)) {
      const t = Date.now()
      const recentes = [...falhas.filter(f => t - f < JANELA_MS), t]
      setFalhas(recentes)
      if (recentes.length >= MAX_FALHAS) {
        setBloqueadoAte(t + JANELA_MS); setAgora(t); setLError(null)
        return
      }
      // A1: mensagem genérica; na 4ª falha, aviso de bloqueio
      setLError(`E-mail ou senha incorretos.${recentes.length === MAX_FALHAS - 1 ? ' Última tentativa antes do bloqueio.' : ''}`)
      return
    }
    if (!user.ativo) { setLError('__disabled__'); return }
    setLError(null); setFalhas([])
    concluirAcesso(user.id)
  }

  function submitCadastro() {
    const errs: Record<string, string> = {}
    if (!cNome.trim()) errs.nome = 'Informe seu nome'
    if (!emailValido(cEmail)) errs.email = 'Informe um e-mail válido'
    if (!senhaValida(cPw)) errs.senha = SENHA_REGRA
    if (cPw !== cConf) errs.conf = 'As senhas não coincidem'
    setCErrors(errs)
    if (Object.keys(errs).length) return
    if (usuarios.some(u => !u.excluido && u.email.toLowerCase() === cEmail.trim().toLowerCase())) { setCExiste(true); return }
    setCExiste(false)
    const novo = onCadastro(cNome, cEmail, cPw)
    showToast('Conta criada — enviamos um e-mail de verificação', 'success')
    concluirAcesso(novo.id)
  }

  function enviarCodigo() {
    setRCode(['', '', '', '', '', '']); setRCodeErr(null)
    setREnvios(1); setRExpira(Date.now() + JANELA_MS); setAgora(Date.now())
    setView('reset-code')
  }

  function reenviarCodigo() {
    if (rEnvios >= MAX_ENVIOS_CODIGO) {
      setRCodeErr('Limite de 3 envios por hora atingido. Tente novamente mais tarde.')
      return
    }
    setREnvios(n => n + 1); setRExpira(Date.now() + JANELA_MS); setAgora(Date.now())
    setRCode(['', '', '', '', '', '']); setRCodeErr(null)
    codeRefs.current[0]?.focus()
    showToast('Código reenviado', 'success')
  }

  function verificarCodigo() {
    if (rCode.join('') !== DEMO_CODIGO || agora >= rExpira) { setRCodeErr('Código inválido ou expirado'); return }
    setRCodeErr(null); setView('reset-pw')
  }

  function redefinirSenha() {
    if (!senhaValida(rPw)) { setRErr(SENHA_REGRA); return }
    if (rPw !== rConf) { setRErr('As senhas não coincidem'); return }
    const user = usuarios.find(u => !u.excluido && u.email.toLowerCase() === rEmail.trim().toLowerCase())
    if (user) alterarSenha(user.id, rPw)
    setRErr(null); setView('reset-ok')
  }

  function handleCodeInput(i: number, val: string) {
    const d = val.replace(/\D/g, '').slice(-1)
    const next = [...rCode]; next[i] = d; setRCode(next)
    if (d && i < 5) setTimeout(() => codeRefs.current[i + 1]?.focus(), 0)
  }
  function handleCodeKey(i: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !rCode[i] && i > 0) codeRefs.current[i - 1]?.focus()
  }

  // ─── LOGIN ────────────────────────────────────────────────────────────────
  if (view === 'login') return (
    <div className="flex flex-col h-full px-6 py-10 overflow-y-auto a-up">
      <Logo sub={`// Bem-vindo à ${ATLETICA.nome}`} />
      <div className="flex flex-col gap-4">
        {bloqueado && bloqueadoAte && (
          <AlertBox type="error" title="Login bloqueado temporariamente">
            Foram 5 tentativas incorretas. Tente novamente em <span style={{ color: C.yellow }}>{fmtTime(bloqueadoAte - agora)}</span>.
          </AlertBox>
        )}
        {!bloqueado && lError === '__disabled__' && (
          <AlertBox type="warn" title="Conta desativada">
            Sua conta está desativada. Procure a diretoria da atlética para reativá-la.
          </AlertBox>
        )}
        {!bloqueado && lError && lError !== '__disabled__' && <ErrorBox message={lError} />}
        <Field label="E-mail" type="email" value={lEmail} onChange={setLEmail}
          placeholder="seu@email.com" disabled={bloqueado} />
        <div>
          <PasswordField label="Senha" value={lPw} onChange={setLPw} disabled={bloqueado} />
          <div className="flex justify-end items-center mt-2">
            <button onClick={() => { setView('reset-email'); setREmail(lEmail) }}
              className="f-mono text-[10px]" style={{ color: C.muted }}>
              Esqueci minha senha
            </button>
          </div>
        </div>
      </div>
      <div className="mt-6">
        <Btn label="Entrar" onClick={submitLogin} disabled={!lEmail || !lPw || bloqueado} />
      </div>
      <p className="f-mono text-xs text-center mt-4" style={{ color: C.muted }}>
        Não tem conta?{' '}
        <button onClick={() => setView('cadastro')} style={{ color: C.blueL }}>Criar conta</button>
      </p>
      <EntrarComo usuarios={usuarios} onPick={u => { setLEmail(u.email); setLPw(DEMO_SENHA); setLError(null) }} />
      <div className="flex justify-center mt-4"><DemoButton onClick={onDemo} /></div>
    </div>
  )

  // ─── CADASTRO (UC06) ──────────────────────────────────────────────────────
  if (view === 'cadastro') {
    const preenchido = !!(cNome && cEmail && cPw && cConf)
    return (
      <div className="flex flex-col h-full px-6 py-8 overflow-y-auto a-up relative">
        <button onClick={() => setView('login')} className="flex items-center gap-2 mb-5" style={{ color: C.muted }}>
          <IcoBack /> <span className="f-mono text-xs">Voltar ao login</span>
        </button>
        <Logo sub="// Crie sua conta" />
        <div className="flex flex-col gap-4">
          {cExiste && (
            <AlertBox type="warn" title="E-mail já cadastrado">
              <span>Este e-mail já possui uma conta.{' '}</span>
              <button onClick={() => { setCExiste(false); setLEmail(cEmail); setView('login') }} style={{ color: C.blueL }}>Fazer login</button>
              {' · '}
              <button onClick={() => { setCExiste(false); setREmail(cEmail); setView('reset-email') }} style={{ color: C.muted }}>Recuperar senha</button>
            </AlertBox>
          )}
          <Field label="Nome" value={cNome} onChange={setCNome} placeholder="Seu nome" error={cErrors.nome} />
          <Field label="E-mail" type="email" value={cEmail} onChange={setCEmail} placeholder="seu@email.com" error={cErrors.email} />
          <div>
            <PasswordField label="Senha" value={cPw} onChange={setCPw} placeholder="Mín. 8 caracteres, letras e números"
              error={cErrors.senha} hint={SENHA_REGRA} />
            <StrBar pw={cPw} />
          </div>
          <PasswordField label="Confirmar senha" value={cConf} onChange={setCConf} placeholder="Repita a senha"
            error={cErrors.conf ?? (cConf && cPw !== cConf ? 'As senhas não coincidem' : undefined)} />
          <div className="flex items-start gap-3">
            <button onClick={() => setCTerms(v => !v)}
              className="shrink-0 mt-0.5 rounded-lg flex items-center justify-center transition-all"
              style={{ width: 20, height: 20, background: cTerms ? C.green : C.card2, border: `1.5px solid ${cTerms ? C.green : C.dim}` }}>
              {cTerms && <IcoCheck size={12} color="#fff" />}
            </button>
            <p className="f-mono text-[10px] leading-loose" style={{ color: C.muted }}>
              Li e aceito os{' '}
              <button onClick={() => setModal('termos')} style={{ color: C.blueL }}>Termos de Uso</button>
              {' '}e a{' '}
              <button onClick={() => setModal('privacidade')} style={{ color: C.blueL }}>Política de Privacidade</button>
            </p>
          </div>
        </div>
        <div className="mt-6">
          {/* A3: sem aceite dos termos o botão fica desabilitado */}
          <Btn label="Criar conta" onClick={submitCadastro} disabled={!preenchido || !cTerms} />
        </div>
        {modal && <TermsModal type={modal} onClose={() => setModal(null)} />}
      </div>
    )
  }

  // ─── RECUPERAR SENHA 1: E-MAIL ────────────────────────────────────────────
  if (view === 'reset-email') return (
    <div className="flex flex-col h-full px-6 py-10 a-up">
      <button onClick={() => setView('login')} className="flex items-center gap-2 mb-8" style={{ color: C.muted }}>
        <IcoBack /> <span className="f-mono text-xs">Voltar ao login</span>
      </button>
      <div className="text-center mb-8">
        <div className="flex items-center justify-center rounded-3xl mb-5 mx-auto text-3xl"
          style={{ width: 64, height: 64, background: C.blue + '1a', border: `1px solid ${C.bdrB}` }}>✉️</div>
        <h2 className="f-sora font-black text-2xl mb-2" style={{ color: C.text }}>Recuperar senha</h2>
        <p className="f-mono text-xs" style={{ color: C.muted }}>
          Informe seu e-mail para receber um código de verificação
        </p>
      </div>
      <Field label="E-mail" type="email" value={rEmail} onChange={setREmail} placeholder="seu@email.com" />
      <div className="mt-6">
        <Btn label="Enviar código" onClick={enviarCodigo} disabled={!emailValido(rEmail)} />
      </div>
      <Passos atual={1} />
    </div>
  )

  // ─── RECUPERAR SENHA 2: CÓDIGO ────────────────────────────────────────────
  if (view === 'reset-code') return (
    <div className="flex flex-col h-full px-6 py-10 a-up">
      <button onClick={() => setView('reset-email')} className="flex items-center gap-2 mb-8" style={{ color: C.muted }}>
        <IcoBack /> <span className="f-mono text-xs">Voltar</span>
      </button>
      <div className="text-center mb-6">
        <div className="flex items-center justify-center rounded-3xl mb-5 mx-auto text-3xl"
          style={{ width: 64, height: 64, background: C.red + '1a', border: `1px solid ${C.bdrR}` }}>🔐</div>
        <h2 className="f-sora font-black text-2xl mb-2" style={{ color: C.text }}>Verifique seu e-mail</h2>
        {/* Mesma mensagem, exista ou não o e-mail (UC09 passo 3) */}
        <p className="f-mono text-xs mb-2 leading-relaxed" style={{ color: C.muted }}>
          Se houver uma conta para <span style={{ color: C.text }}>{rEmail}</span>, enviamos um código de 6 dígitos.
        </p>
        <p className="f-mono text-xs font-semibold" style={{ color: rExpira - agora < 120000 ? '#f87171' : C.muted }}>
          Válido por <span className="f-mono font-bold">{fmtTime(rExpira - agora)}</span>
        </p>
        <p className="f-mono text-[10px] mt-1" style={{ color: C.dim }}>Código de demonstração: {DEMO_CODIGO}</p>
      </div>
      <div className="flex gap-2 justify-center mb-4">
        {[0, 1, 2, 3, 4, 5].map(i => (
          <input key={i} ref={el => { codeRefs.current[i] = el }}
            type="text" inputMode="numeric" maxLength={1}
            value={rCode[i]}
            onChange={e => handleCodeInput(i, e.target.value)}
            onKeyDown={e => handleCodeKey(i, e)}
            className="f-mono font-bold text-2xl text-center rounded-2xl outline-none transition-all"
            style={{
              width: 44, height: 54,
              background: rCode[i] ? C.red + '18' : C.card2,
              border: `1.5px solid ${rCodeErr ? '#f43f5e' : rCode[i] ? C.red : C.bdr}`,
              color: C.text, caretColor: C.red,
            }} />
        ))}
      </div>
      {rCodeErr && <div className="mb-4"><ErrorBox message={rCodeErr} /></div>}
      <Btn label="Verificar código" onClick={verificarCodigo} disabled={rCode.some(d => !d)} />
      <button onClick={reenviarCodigo}
        className="w-full mt-3 py-3 f-mono text-xs" style={{ color: C.muted }}>
        Reenviar código ({rEnvios}/{MAX_ENVIOS_CODIGO} envios nesta hora)
      </button>
      <Passos atual={2} />
    </div>
  )

  // ─── RECUPERAR SENHA 3: NOVA SENHA ────────────────────────────────────────
  if (view === 'reset-pw') return (
    <div className="flex flex-col h-full px-6 py-10 a-up">
      <button onClick={() => setView('reset-code')} className="flex items-center gap-2 mb-8" style={{ color: C.muted }}>
        <IcoBack /> <span className="f-mono text-xs">Voltar</span>
      </button>
      <div className="text-center mb-8">
        <h2 className="f-sora font-black text-2xl mb-2" style={{ color: C.text }}>Nova senha</h2>
        <p className="f-mono text-xs" style={{ color: C.muted }}>{SENHA_REGRA}</p>
      </div>
      <div className="flex flex-col gap-4">
        {rErr && <ErrorBox message={rErr} />}
        <div>
          <PasswordField label="Nova senha" value={rPw} onChange={setRPw} placeholder="Mín. 8 caracteres, letras e números" />
          <StrBar pw={rPw} />
        </div>
        <PasswordField label="Confirmar nova senha" value={rConf} onChange={setRConf} placeholder="Repita a senha"
          error={rConf && rPw !== rConf ? 'As senhas não coincidem' : undefined} />
      </div>
      <div className="mt-6">
        <Btn label="Redefinir senha" onClick={redefinirSenha} disabled={!rPw || !rConf} />
      </div>
      <Passos atual={3} />
    </div>
  )

  // ─── RECUPERAÇÃO CONCLUÍDA ────────────────────────────────────────────────
  if (view === 'reset-ok') return (
    <div className="flex flex-col items-center justify-center h-full px-6 text-center a-up">
      <div className="flex items-center justify-center rounded-full mb-6"
        style={{ width: 80, height: 80, background: C.green + '18', border: `2px solid ${C.green}44` }}>
        <IcoCheck size={38} color={C.green} />
      </div>
      <h2 className="f-sora font-black text-2xl mb-3" style={{ color: C.text }}>Senha alterada!</h2>
      <p className="f-mono text-sm mb-10 leading-relaxed" style={{ color: C.muted }}>
        Sua senha foi redefinida e as outras sessões foram encerradas.<br />Faça login com a nova senha.
      </p>
      <Btn label="Ir para o login" onClick={() => { setLEmail(rEmail); setLPw(''); setView('login'); setRPw(''); setRConf('') }} />
    </div>
  )

  // ─── PERMISSÃO DE NOTIFICAÇÕES (primeiro acesso) ──────────────────────────
  if (view === 'notif' && pendingId) return (
    <div className="flex flex-col items-center justify-center h-full px-6 text-center a-up">
      <div className="flex items-center justify-center rounded-3xl mb-6"
        style={{ width: 80, height: 80, background: C.red + '1a', border: `2px solid ${C.bdrR}` }}>
        <IcoBell size={36} color={C.red} />
      </div>
      <h2 className="f-sora font-black text-2xl mb-3" style={{ color: C.text }}>Ativar notificações</h2>
      <p className="f-mono text-sm mb-6 leading-relaxed" style={{ color: C.muted }}>
        Receba avisos da {ATLETICA.nome} no seu celular.
      </p>
      <ul className="text-left w-full mb-8 space-y-3">
        {[
          'Novos jogos e treinos dos seus times',
          'Lembretes antes dos eventos confirmados',
          'Resultados e notícias',
          'Respostas às suas solicitações de entrada',
        ].map(item => (
          <li key={item} className="flex items-center gap-3">
            <div className="flex items-center justify-center rounded-full shrink-0"
              style={{ width: 24, height: 24, background: C.green + '1a' }}>
              <IcoCheck size={12} color={C.green} />
            </div>
            <span className="f-mono text-xs" style={{ color: C.muted }}>{item}</span>
          </li>
        ))}
      </ul>
      <Btn label="Permitir notificações" onClick={() => {
        if (demo.notifNegada) showToast('Permissão negada no Android — ative nas configurações do sistema', 'error')
        else showToast('Notificações ativadas', 'success')
        onLogin(pendingId)
      }} />
      <button onClick={() => onLogin(pendingId)} className="w-full mt-3 py-3 f-mono text-sm" style={{ color: C.dim }}>
        Agora não
      </button>
    </div>
  )

  return null
}
