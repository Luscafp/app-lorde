import { useState, useEffect, useRef } from 'react'
import type { Role } from '../types'
import { C, ATLETICA } from '../theme'
import { USUARIOS } from '../data'
import { ROLE_LABEL } from '../utils'
import { IcoShield, IcoBack, IcoCheck, IcoX, IcoBell, IcoAlert } from '../components/atoms'

type LView = 'login' | 'cadastro' | 'reset-email' | 'reset-code' | 'reset-pw' | 'reset-ok' | 'notif'

const ROLES: { v: Role; label: string; desc: string }[] = [
  { v: 'atleta',     label: 'Atleta',         desc: 'Acesso às abas do app' },
  { v: 'diretor',    label: 'Diretor',         desc: '+ Painel da Diretoria' },
  { v: 'vice',       label: 'Vice-presidente', desc: '+ Usuários e Auditoria' },
  { v: 'presidente', label: 'Presidente',      desc: '+ Usuários e Auditoria' },
  { v: 'admin',      label: 'Administrador',   desc: '+ Cargos' },
]

function IcoEye({ open }: { open: boolean }) {
  return open ? (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
    </svg>
  ) : (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path d="M17.94 17.94A10 10 0 0 1 12 20c-7 0-11-8-11-8a18.5 18.5 0 0 1 5.06-5.94M9.9 4.24A9 9 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  )
}

function pwScore(p: string): 0 | 1 | 2 | 3 {
  if (!p) return 0
  let s = 0
  if (p.length >= 8) s++
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) s++
  if (/\d/.test(p)) s++
  if (/[^A-Za-z0-9]/.test(p)) s++
  return Math.min(3, Math.max(1, s)) as 1 | 2 | 3
}

const PW_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: 'Fraca', color: '#f43f5e' },
  2: { label: 'Média', color: C.yellow },
  3: { label: 'Forte', color: C.green },
}

function StrBar({ pw }: { pw: string }) {
  if (!pw) return null
  const s = pwScore(pw)
  const cfg = PW_LABELS[s]
  return (
    <div className="mt-2">
      <div className="flex gap-1 mb-1">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-1 flex-1 rounded-full transition-all"
            style={{ background: i <= s ? cfg.color : C.dim }} />
        ))}
      </div>
      <span className="f-mono text-[9px]" style={{ color: cfg.color }}>{cfg.label}</span>
    </div>
  )
}

function TermsModal({ type, onClose }: { type: 'termos' | 'privacidade'; onClose: () => void }) {
  const termos = (
    <>
      <strong style={{ color: C.text }}>1. Uso do aplicativo</strong>{'\n'}
      O app Atlética Lorde é destinado exclusivamente a alunos do curso de {ATLETICA.curso} da UFMA.{'\n\n'}
      <strong style={{ color: C.text }}>2. Cadastro</strong>{'\n'}
      Ao criar conta você declara ter ao menos 18 anos e que as informações fornecidas são verdadeiras.{'\n\n'}
      <strong style={{ color: C.text }}>3. Responsabilidades</strong>{'\n'}
      Uso indevido pode resultar em suspensão sem aviso. Cuide das suas credenciais — você é responsável por elas.{'\n\n'}
      <strong style={{ color: C.text }}>4. Alterações</strong>{'\n'}
      A atlética pode modificar estes termos com aviso prévio de 15 dias.
    </>
  )
  const priv = (
    <>
      <strong style={{ color: C.text }}>1. Dados coletados</strong>{'\n'}
      Nome, e-mail e participação em eventos/times para fins operacionais da atlética.{'\n\n'}
      <strong style={{ color: C.text }}>2. Uso dos dados</strong>{'\n'}
      Usados para gestão de participação e notificações. Não compartilhamos com terceiros.{'\n\n'}
      <strong style={{ color: C.text }}>3. Seus direitos</strong>{'\n'}
      Solicite acesso, correção ou exclusão a qualquer momento via configurações ou e-mail da diretoria.{'\n\n'}
      <strong style={{ color: C.text }}>4. Retenção</strong>{'\n'}
      Dados retidos pelo período de associação + 90 dias, salvo obrigação legal.
    </>
  )
  return (
    <div className="absolute inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,.75)', backdropFilter: 'blur(6px)' }}>
      <div className="w-full rounded-t-3xl flex flex-col" style={{ background: C.card, border: `1px solid ${C.bdr}`, maxHeight: '82%' }}>
        <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: `1px solid ${C.bdr}` }}>
          <h3 className="f-sora font-black text-base" style={{ color: C.text }}>
            {type === 'termos' ? 'Termos de Uso' : 'Política de Privacidade'}
          </h3>
          <button onClick={onClose} style={{ color: C.muted }}><IcoX size={18} /></button>
        </div>
        <div className="overflow-y-auto flex-1 p-5">
          <p className="f-mono text-xs leading-loose whitespace-pre-line" style={{ color: C.muted }}>
            {type === 'termos' ? termos : priv}
          </p>
        </div>
        <div className="p-4 shrink-0">
          <button onClick={onClose} className="w-full py-3.5 rounded-2xl f-sora font-bold text-sm active:scale-95"
            style={{ background: C.red, color: '#fff' }}>
            Entendido
          </button>
        </div>
      </div>
    </div>
  )
}

function FInput({ label, type = 'text', value, onChange, placeholder, showToggle, onToggle, error, disabled }:
  { label: string; type?: string; value: string; onChange: (v: string) => void; placeholder?: string; showToggle?: boolean; onToggle?: () => void; error?: string; disabled?: boolean }) {
  return (
    <div>
      <label className="f-mono text-[10px] uppercase tracking-wider mb-1.5 block" style={{ color: C.muted }}>{label}</label>
      <div className="relative">
        <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} disabled={disabled}
          className="w-full px-4 py-3 rounded-2xl f-sora text-sm outline-none transition-all"
          style={{ background: C.card2, border: `1px solid ${error ? '#f43f5e66' : C.bdr}`, color: C.text, caretColor: C.red, opacity: disabled ? .5 : 1 }} />
        {showToggle && onToggle && (
          <button type="button" onClick={onToggle} className="absolute right-4 top-1/2 -translate-y-1/2" style={{ color: C.muted }}>
            <IcoEye open={type === 'text'} />
          </button>
        )}
      </div>
      {error && <p className="f-mono text-[10px] mt-1.5" style={{ color: '#f87171' }}>{error}</p>}
    </div>
  )
}

function AlertBox({ type, title, children }: { type: 'error' | 'warn'; title: string; children: React.ReactNode }) {
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

function Btn({ label, onClick, disabled, style: s }: { label: string; onClick?: () => void; disabled?: boolean; style?: React.CSSProperties }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="w-full py-4 rounded-2xl f-sora font-bold text-sm active:scale-95 transition-all"
      style={{ background: disabled ? C.dim : C.red, color: '#fff', boxShadow: disabled ? 'none' : '0 4px 20px rgba(225,29,72,.4)', ...s }}>
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

export default function LoginScreen({ onLogin }: { onLogin: (role: Role) => void }) {
  const [view, setView] = useState<LView>('login')
  const [modal, setModal] = useState<'termos' | 'privacidade' | null>(null)

  // Demo selector
  const [demoOpen, setDemoOpen] = useState(false)
  const [demoRole, setDemoRole] = useState<Role>('atleta')
  const [pendingRole, setPendingRole] = useState<Role>('atleta')

  // Login
  const [lEmail, setLEmail] = useState('')
  const [lPw, setLPw] = useState('')
  const [lShowPw, setLShowPw] = useState(false)
  const [lError, setLError] = useState<string | null>(null)
  const [lAttempts, setLAttempts] = useState(0)
  const [locked, setLocked] = useState(false)
  const [lockDown, setLockDown] = useState(15 * 60)

  // Cadastro
  const [cNome, setCNome] = useState('')
  const [cEmail, setCEmail] = useState('')
  const [cPw, setCPw] = useState('')
  const [cConf, setCConf] = useState('')
  const [cShowPw, setCShowPw] = useState(false)
  const [cShowConf, setCShowConf] = useState(false)
  const [cTerms, setCTerms] = useState(false)
  const [cError, setCError] = useState<string | null>(null)

  // Reset
  const [rEmail, setREmail] = useState('')
  const [rCode, setRCode] = useState(['', '', '', '', '', ''])
  const [rPw, setRPw] = useState('')
  const [rConf, setRConf] = useState('')
  const [rShowPw, setRShowPw] = useState(false)
  const [rCountdown, setRCountdown] = useState(15 * 60)
  const codeRefs = useRef<(HTMLInputElement | null)[]>([])

  // Lockout countdown
  useEffect(() => {
    if (!locked) return
    const t = setInterval(() => setLockDown(c => {
      if (c <= 1) { setLocked(false); setLAttempts(0); return 15 * 60 }
      return c - 1
    }), 1000)
    return () => clearInterval(t)
  }, [locked])

  // Reset code countdown
  useEffect(() => {
    if (view !== 'reset-code') return
    setRCountdown(15 * 60)
    const t = setInterval(() => setRCountdown(c => Math.max(0, c - 1)), 1000)
    return () => clearInterval(t)
  }, [view])

  const fmtTime = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`

  function submitLogin() {
    if (locked) return
    const user = USUARIOS.find(u => u.email === lEmail.trim())
    if (!user || lPw !== '123456') {
      const next = lAttempts + 1
      setLAttempts(next)
      if (next >= 3) { setLocked(true); setLError(null); return }
      setLError(`E-mail ou senha incorretos.${next === 2 ? ' Última tentativa antes do bloqueio.' : ''}`)
      return
    }
    if (!user.ativo) { setLError('__disabled__'); return }
    setLError(null)
    onLogin(demoRole)
  }

  function submitCadastro() {
    const exists = USUARIOS.some(u => u.email === cEmail.trim())
    if (exists) { setCError('__exists__'); return }
    if (cPw !== cConf) { setCError('As senhas não coincidem.'); return }
    if (pwScore(cPw) < 2) { setCError('Senha muito fraca. Use letras maiúsculas, minúsculas e números.'); return }
    setCError(null)
    setPendingRole(demoRole)
    setView('notif')
  }

  function handleCodeInput(i: number, val: string) {
    const d = val.replace(/\D/g, '').slice(-1)
    const next = [...rCode]; next[i] = d; setRCode(next)
    if (d && i < 5) setTimeout(() => codeRefs.current[i + 1]?.focus(), 0)
  }
  function handleCodeKey(i: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !rCode[i] && i > 0) codeRefs.current[i - 1]?.focus()
  }

  function DemoSection() {
    return (
      <div className="mt-5">
        <button onClick={() => setDemoOpen(o => !o)}
          className="w-full flex items-center justify-between px-3 py-2 rounded-xl f-mono text-[10px]"
          style={{ background: C.card2, color: C.dim, border: `1px solid ${C.bdr}` }}>
          <span>// Demo: {ROLE_LABEL[demoRole]}</span>
          <span style={{ display: 'inline-block', transform: demoOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>▾</span>
        </button>
        {demoOpen && (
          <div className="mt-1 rounded-2xl overflow-hidden" style={{ border: `1px solid ${C.bdr}` }}>
            {ROLES.map((r, i) => (
              <button key={r.v} onClick={() => { setDemoRole(r.v); setDemoOpen(false) }}
                className="w-full flex items-start gap-3 px-4 py-2.5 text-left"
                style={{ background: demoRole === r.v ? C.red + '18' : C.card2, borderBottom: i < ROLES.length - 1 ? `1px solid ${C.bdr}` : 'none' }}>
                <div className="mt-0.5 rounded-full flex items-center justify-center shrink-0"
                  style={{ width: 16, height: 16, border: `2px solid ${demoRole === r.v ? C.red : C.dim}`, background: demoRole === r.v ? C.red : 'transparent' }}>
                  {demoRole === r.v && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />}
                </div>
                <div>
                  <div className="f-sora font-semibold text-xs" style={{ color: C.text }}>{r.label}</div>
                  <div className="f-mono text-[9px]" style={{ color: C.muted }}>{r.desc}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ─── LOGIN ────────────────────────────────────────────────────────────────
  if (view === 'login') return (
    <div className="flex flex-col justify-between h-full px-6 py-10 overflow-y-auto a-up">
      <div>
        <Logo sub={`// Bem-vindo à ${ATLETICA.nome}`} />
        <div className="flex flex-col gap-4">
          {locked && (
            <AlertBox type="error" title="Muitas tentativas">
              Tente novamente em <span style={{ color: C.yellow }}>{fmtTime(lockDown)}</span>
            </AlertBox>
          )}
          {!locked && lError === '__disabled__' && (
            <AlertBox type="warn" title="Conta desativada">
              Entre em contato com a diretoria para reativar sua conta.
            </AlertBox>
          )}
          {!locked && lError && lError !== '__disabled__' && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-2xl"
              style={{ background: '#450a0a', border: '1px solid rgba(244,63,94,.3)' }}>
              <IcoX size={14} color="#f87171" />
              <p className="f-mono text-xs" style={{ color: '#f87171' }}>{lError}</p>
            </div>
          )}
          <FInput label="E-mail" type="email" value={lEmail} onChange={setLEmail}
            placeholder="seu@discente.ufma.br" disabled={locked} />
          <div>
            <FInput label="Senha" type={lShowPw ? 'text' : 'password'} value={lPw} onChange={setLPw}
              placeholder="••••••••" showToggle onToggle={() => setLShowPw(v => !v)} disabled={locked} />
            <div className="flex justify-between items-center mt-2">
              <span className="f-mono text-[10px]" style={{ color: C.dim }}>Senha demo: 123456</span>
              <button onClick={() => { setView('reset-email'); setREmail(lEmail) }}
                className="f-mono text-[10px]" style={{ color: C.muted }}>
                Esqueci minha senha
              </button>
            </div>
          </div>
        </div>
        <div className="mt-6">
          <Btn label="Entrar" onClick={submitLogin} disabled={!lEmail || !lPw || locked} />
        </div>
        <p className="f-mono text-xs text-center mt-4" style={{ color: C.muted }}>
          Não tem conta?{' '}
          <button onClick={() => setView('cadastro')} style={{ color: C.blueL }}>Cadastrar-se</button>
        </p>
        <DemoSection />
      </div>
    </div>
  )

  // ─── CADASTRO ─────────────────────────────────────────────────────────────
  if (view === 'cadastro') {
    const canSubmit = !!(cNome && cEmail && cPw && cConf && cTerms && pwScore(cPw) >= 2 && cPw === cConf)
    return (
      <div className="flex flex-col h-full px-6 py-8 overflow-y-auto a-up">
        <button onClick={() => setView('login')} className="flex items-center gap-2 mb-5" style={{ color: C.muted }}>
          <IcoBack /> <span className="f-mono text-xs">Voltar ao login</span>
        </button>
        <Logo sub="// Crie sua conta" />
        <div className="flex flex-col gap-4">
          {cError && cError !== '__exists__' && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-2xl"
              style={{ background: '#450a0a', border: '1px solid rgba(244,63,94,.3)' }}>
              <IcoX size={14} color="#f87171" />
              <p className="f-mono text-xs" style={{ color: '#f87171' }}>{cError}</p>
            </div>
          )}
          {cError === '__exists__' && (
            <AlertBox type="warn" title="E-mail já cadastrado">
              <span>Este e-mail já possui uma conta.{' '}</span>
              <button onClick={() => { setCError(null); setView('login') }} style={{ color: C.blueL }}>Fazer login</button>
              {' · '}
              <button onClick={() => { setCError(null); setView('reset-email'); setREmail(cEmail) }} style={{ color: C.muted }}>Recuperar senha</button>
            </AlertBox>
          )}
          <FInput label="Nome completo" value={cNome} onChange={setCNome} placeholder="Seu nome" />
          <FInput label="E-mail institucional" type="email" value={cEmail} onChange={setCEmail} placeholder="seu@discente.ufma.br" />
          <div>
            <FInput label="Senha" type={cShowPw ? 'text' : 'password'} value={cPw} onChange={setCPw}
              placeholder="Mín. 8 caracteres" showToggle onToggle={() => setCShowPw(v => !v)} />
            <StrBar pw={cPw} />
          </div>
          <FInput label="Confirmar senha" type={cShowConf ? 'text' : 'password'} value={cConf} onChange={setCConf}
            placeholder="Repita a senha" showToggle onToggle={() => setCShowConf(v => !v)}
            error={cConf && cPw !== cConf ? 'As senhas não coincidem' : undefined} />
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
          <Btn label="Criar conta" onClick={submitCadastro} disabled={!canSubmit} />
        </div>
        <DemoSection />
        {modal && <TermsModal type={modal} onClose={() => setModal(null)} />}
      </div>
    )
  }

  // ─── RESET STEP 1: EMAIL ──────────────────────────────────────────────────
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
          Informe seu e-mail para receber o código de verificação
        </p>
      </div>
      <FInput label="E-mail" type="email" value={rEmail} onChange={setREmail} placeholder="seu@discente.ufma.br" />
      <div className="mt-6">
        <Btn label="Enviar código" onClick={() => setView('reset-code')} disabled={!rEmail.trim()} />
      </div>
      <div className="flex items-center gap-2 mt-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-0.5 flex-1 rounded-full"
            style={{ background: i === 1 ? C.red : C.dim }} />
        ))}
        <span className="f-mono text-[9px] shrink-0" style={{ color: C.dim }}>1 / 3</span>
      </div>
    </div>
  )

  // ─── RESET STEP 2: CODE ───────────────────────────────────────────────────
  if (view === 'reset-code') return (
    <div className="flex flex-col h-full px-6 py-10 a-up">
      <button onClick={() => setView('reset-email')} className="flex items-center gap-2 mb-8" style={{ color: C.muted }}>
        <IcoBack /> <span className="f-mono text-xs">Voltar</span>
      </button>
      <div className="text-center mb-8">
        <div className="flex items-center justify-center rounded-3xl mb-5 mx-auto text-3xl"
          style={{ width: 64, height: 64, background: C.red + '1a', border: `1px solid ${C.bdrR}` }}>🔐</div>
        <h2 className="f-sora font-black text-2xl mb-2" style={{ color: C.text }}>Código enviado</h2>
        <p className="f-mono text-xs mb-2" style={{ color: C.muted }}>
          Código de 6 dígitos enviado para<br/>
          <span style={{ color: C.text }}>{rEmail}</span>
        </p>
        <p className="f-mono text-xs font-semibold" style={{ color: rCountdown < 120 ? '#f87171' : C.muted }}>
          Expira em <span className="f-mono font-bold">{fmtTime(rCountdown)}</span>
        </p>
      </div>
      <div className="flex gap-2 justify-center mb-8">
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
              border: `1.5px solid ${rCode[i] ? C.red : C.bdr}`,
              color: C.text, caretColor: C.red,
            }} />
        ))}
      </div>
      <Btn label="Verificar código" onClick={() => setView('reset-pw')} disabled={rCode.some(d => !d)} />
      <button onClick={() => { setRCode(['', '', '', '', '', '']); setRCountdown(15 * 60); codeRefs.current[0]?.focus() }}
        className="w-full mt-3 py-3 f-mono text-xs" style={{ color: C.muted }}>
        Reenviar código
      </button>
      <div className="flex items-center gap-2 mt-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-0.5 flex-1 rounded-full" style={{ background: i <= 2 ? C.red : C.dim }} />
        ))}
        <span className="f-mono text-[9px] shrink-0" style={{ color: C.dim }}>2 / 3</span>
      </div>
    </div>
  )

  // ─── RESET STEP 3: NEW PASSWORD ───────────────────────────────────────────
  if (view === 'reset-pw') {
    const canReset = !!(rPw && rConf && rPw === rConf && pwScore(rPw) >= 2)
    return (
      <div className="flex flex-col h-full px-6 py-10 a-up">
        <button onClick={() => setView('reset-code')} className="flex items-center gap-2 mb-8" style={{ color: C.muted }}>
          <IcoBack /> <span className="f-mono text-xs">Voltar</span>
        </button>
        <div className="text-center mb-8">
          <h2 className="f-sora font-black text-2xl mb-2" style={{ color: C.text }}>Nova senha</h2>
          <p className="f-mono text-xs" style={{ color: C.muted }}>Escolha uma senha forte para sua conta</p>
        </div>
        <div className="flex flex-col gap-4">
          <div>
            <FInput label="Nova senha" type={rShowPw ? 'text' : 'password'} value={rPw} onChange={setRPw}
              placeholder="Mín. 8 caracteres" showToggle onToggle={() => setRShowPw(v => !v)} />
            <StrBar pw={rPw} />
          </div>
          <FInput label="Confirmar nova senha" type="password" value={rConf} onChange={setRConf}
            placeholder="Repita a senha"
            error={rConf && rPw !== rConf ? 'As senhas não coincidem' : undefined} />
        </div>
        <div className="mt-6">
          <Btn label="Redefinir senha" onClick={() => setView('reset-ok')} disabled={!canReset} />
        </div>
        <div className="flex items-center gap-2 mt-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-0.5 flex-1 rounded-full" style={{ background: C.red }} />
          ))}
          <span className="f-mono text-[9px] shrink-0" style={{ color: C.dim }}>3 / 3</span>
        </div>
      </div>
    )
  }

  // ─── RESET SUCCESS ────────────────────────────────────────────────────────
  if (view === 'reset-ok') return (
    <div className="flex flex-col items-center justify-center h-full px-6 text-center a-up">
      <div className="flex items-center justify-center rounded-full mb-6"
        style={{ width: 80, height: 80, background: C.green + '18', border: `2px solid ${C.green}44` }}>
        <IcoCheck size={38} color={C.green} />
      </div>
      <h2 className="f-sora font-black text-2xl mb-3" style={{ color: C.text }}>Senha alterada!</h2>
      <p className="f-mono text-sm mb-10 leading-relaxed" style={{ color: C.muted }}>
        Sua senha foi redefinida com sucesso.<br/>Faça login com a nova senha.
      </p>
      <Btn label="Ir para o login" onClick={() => { setView('login'); setRPw(''); setRConf('') }} />
    </div>
  )

  // ─── NOTIFICATION PERMISSION ──────────────────────────────────────────────
  if (view === 'notif') return (
    <div className="flex flex-col items-center justify-center h-full px-6 text-center a-up">
      <div className="flex items-center justify-center rounded-3xl mb-6"
        style={{ width: 80, height: 80, background: C.red + '1a', border: `2px solid ${C.bdrR}` }}>
        <IcoBell size={36} color={C.red} />
      </div>
      <h2 className="f-sora font-black text-2xl mb-3" style={{ color: C.text }}>Ativar notificações</h2>
      <p className="f-mono text-sm mb-6 leading-relaxed" style={{ color: C.muted }}>
        Fique por dentro de tudo que acontece na {ATLETICA.nome} em tempo real.
      </p>
      <ul className="text-left w-full mb-8 space-y-3">
        {[
          'Lembretes de eventos e treinos',
          'Resultados e placares ao vivo',
          'Comunicados da diretoria',
          'Aprovação de solicitações de times',
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
      <Btn label="Permitir notificações" onClick={() => onLogin(pendingRole)} />
      <button onClick={() => onLogin(pendingRole)} className="w-full mt-3 py-3 f-mono text-sm" style={{ color: C.dim }}>
        Agora não
      </button>
    </div>
  )

  return null
}
