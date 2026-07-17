import React, { useState, useMemo } from 'react';
import { registerUser, loginUser, setupParticipantAccount, participantHasAccount, getSecurityQuestion, resetPin, generateUserId } from '../db/database';
import { useAuth } from '../hooks/useAuth';
import { sounds } from '../logic/sounds';
import { ThemeToggle } from '../components/ui';
import { Delete } from 'lucide-react';

const SECURITY_QUESTIONS = [
  "What is your mother's maiden name?",
  "What was the name of your first pet?",
  "What city were you born in?",
  "What was the name of your primary school?",
  "What is your oldest sibling's middle name?",
];

function PinPad({ value, onChange, onComplete, loading }) {
  const handleKey = (k) => {
    if (loading) return;
    if (k === 'del') { onChange(value.slice(0, -1)); return; }
    if (value.length >= 4) return;
    const next = value + k;
    onChange(next);
    if (next.length === 4) setTimeout(() => onComplete?.(next), 120);
  };
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20, alignItems:'center' }}>
      <div style={{ display:'flex', gap:16 }}>
        {[0,1,2,3].map(i => (
          <div key={i} style={{
            width:18, height:18, borderRadius:'50%',
            border:`2px solid ${value.length > i ? 'var(--accent)' : 'var(--border2)'}`,
            background: value.length > i ? 'var(--accent)' : 'transparent',
            transition: 'transform 0.18s cubic-bezier(0.34,1.56,0.64,1)',
            transform: value.length > i ? 'scale(1.2)' : 'scale(1)',
          }} />
        ))}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, width:252 }}>
        {['1','2','3','4','5','6','7','8','9','','0','del'].map((k, i) => (
          <button key={i}
            className={`pin-key${k === '' ? ' empty' : k === 'del' ? ' del' : ''}`}
            style={{ width:76, height:76, fontSize: k === 'del' ? 'inherit' : 24 }}
            onClick={() => k !== '' && handleKey(k)}
            disabled={loading || k === ''}
          >
            {k === 'del' ? <Delete size={22} /> : k}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function AuthScreen() {
  const [mode, setMode]     = useState('login');
  const [step, setStep]     = useState('form');
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  // Login fields
  const [username, setUsername] = useState('');
  const [pin, setPin]           = useState('');

  // Register fields
  const [displayName, setDisplayName] = useState('');
  const [mobile, setMobile]           = useState('');
  const [secQ, setSecQ]               = useState(SECURITY_QUESTIONS[0]);
  const [secA, setSecA]               = useState('');
  const [confirmPin, setConfirmPin]   = useState('');
  const [pinStage, setPinStage]       = useState('set');

  // Auto-generate User ID from name + mobile
  const generatedUserId = useMemo(() => {
    if (!displayName.trim()) return '';
    return generateUserId(displayName.trim(), mobile.trim());
  }, [displayName, mobile]);

  // Forgot PIN fields
  const [fpStep, setFpStep]         = useState('id');
  const [fpQuestion, setFpQuestion] = useState('');
  const [fpAnswer, setFpAnswer]     = useState('');
  const [fpNewPin, setFpNewPin]     = useState('');

  // Participant first-time setup
  const [ptStep, setPtStep]     = useState('id');
  const [ptPid, setPtPid]       = useState('');
  const [ptName, setPtName]     = useState('');
  const [ptSecQ, setPtSecQ]     = useState(SECURITY_QUESTIONS[0]);
  const [ptSecA, setPtSecA]     = useState('');
  const [ptPin, setPtPin]       = useState('');
  const [ptConfirm, setPtConfirm] = useState('');
  const [ptStage, setPtStage]   = useState('set');

  const { login } = useAuth();

  const go = (m) => {
    setMode(m); setStep('form');
    setPin(''); setConfirmPin(''); setUsername('');
    setDisplayName(''); setSecA('');
    setError(''); setPinStage('set');
    setFpStep('id'); setFpAnswer(''); setFpNewPin(''); setFpQuestion('');
    setPtStep('id'); setPtPid(''); setPtPin(''); setPtConfirm('');
    setPtSecA(''); setPtStage('set');
  };

  const handleLogin = async (p) => {
    setLoading(true);
    try {
      const user = await loginUser({ username, pin: p });
      sounds.success();
      login(user);
    } catch(e) { sounds.error(); setError(e.message); setPin(''); }
    finally { setLoading(false); }
  };

  const handleRegister = async (p) => {
    setLoading(true);
    const finalUsername = generatedUserId || username;
    try {
      await registerUser({ username: finalUsername, pin: p, displayName, mobile, securityQuestion: secQ, securityAnswer: secA });
      const user = await loginUser({ username: finalUsername, pin: p });
      sounds.success();
      login(user);
    } catch(e) {
      sounds.error(); setError(e.message);
      setPin(''); setConfirmPin(''); setPinStage('set'); setStep('form');
    } finally { setLoading(false); }
  };

  const handleFpLookup = async () => {
    if (!username.trim()) { setError('Enter your User ID'); return; }
    setLoading(true);
    try {
      const q = await getSecurityQuestion(username);
      setFpQuestion(q); setFpStep('question'); setError('');
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const handleFpReset = async (p) => {
    setLoading(true);
    try {
      await resetPin({ username, securityAnswer: fpAnswer, newPin: p });
      const user = await loginUser({ username, pin: p });
      sounds.success(); login(user);
    } catch(e) { sounds.error(); setError(e.message); setFpNewPin(''); }
    finally { setLoading(false); }
  };

  const handlePtCheck = async () => {
    if (!ptPid.trim()) { setError('Enter your Participant ID'); return; }
    setLoading(true);
    try {
      const has = await participantHasAccount(ptPid.trim());
      if (has) setError('Account already set up — please Sign In with this ID.');
      else { setPtStep('setup'); setError(''); }
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const handlePtFinish = async (p) => {
    setLoading(true);
    try {
      await setupParticipantAccount({
        participant_id: ptPid.trim(), pin: p,
        displayName: ptName.trim(),
        securityQuestion: ptSecQ, securityAnswer: ptSecA,
      });
      const user = await loginUser({ username: ptPid.trim(), pin: p });
      sounds.success(); login(user);
    } catch(e) {
      sounds.error(); setError(e.message);
      setPtPin(''); setPtConfirm(''); setPtStage('set'); setPtStep('setup');
    } finally { setLoading(false); }
  };

  const Err = () => error ? (
    <div style={{ fontSize:13, color:'var(--red)', background:'var(--red-bg)', border:'1px solid var(--red)', borderRadius:0, padding:'9px 14px', textAlign:'center' }}>
      {error}
    </div>
  ) : null;

  return (
    <div className="auth-screen">
      <div style={{ position:'absolute', top:16, right:16 }}><ThemeToggle /></div>
      <div className="auth-logo">💠</div>
      <div className="auth-title">CompileDoc</div>

      {/* ══════════ LOGIN ══════════ */}
      {mode === 'login' && (
        <>
          <div className="auth-sub">
            {step === 'form' ? 'Sign in to your account' : `Enter PIN for @${username}`}
          </div>
          <div className="auth-form">
            {step === 'form' && (
              <>
                <div className="auth-tabs">
                  <button className="auth-tab active">Sign In</button>
                  <button className="auth-tab" onClick={() => go('register')}>Create Account</button>
                </div>
                <div className="input-group">
                  <div className="input-label">User ID / Username</div>
                  <input className="input" placeholder="your_username"
                    value={username} autoCapitalize="none" autoCorrect="off" autoFocus
                    onChange={e => { setUsername(e.target.value.toLowerCase().replace(/\s/g, '')); setError(''); }}
                    onKeyDown={e => e.key === 'Enter' && username.trim() && setStep('pin')} />
                </div>
                <Err />
                <button className="btn btn-primary" disabled={!username.trim()}
                  onClick={() => username.trim() && setStep('pin')}>
                  Continue →
                </button>
                <div style={{ display:'flex', gap:10 }}>
                  <button className="btn btn-secondary" style={{ flex:1, fontSize:13 }} onClick={() => go('forgot')}>Forgot PIN</button>
                  <button className="btn btn-secondary" style={{ flex:1, fontSize:13 }} onClick={() => go('participant')}>New Participant</button>
                </div>
              </>
            )}
            {step === 'pin' && (
              <>
                <PinPad value={pin} onChange={setPin} onComplete={handleLogin} loading={loading} />
                <Err />
                <button className="btn btn-ghost btn-sm" style={{ margin:'0 auto', width:'auto' }}
                  onClick={() => { setStep('form'); setPin(''); setError(''); }}>← Back</button>
              </>
            )}
          </div>
        </>
      )}

      {/* ══════════ REGISTER ══════════ */}
      {mode === 'register' && (
        <>
          <div className="auth-sub">
            {step === 'form' ? 'Create your account'
              : pinStage === 'set' ? 'Set a 4-digit PIN'
              : 'Confirm your PIN'}
          </div>
          <div className="auth-form">
            {step === 'form' && (
              <>
                <div className="auth-tabs">
                  <button className="auth-tab" onClick={() => go('login')}>Sign In</button>
                  <button className="auth-tab active">Create Account</button>
                </div>
                <div className="input-group">
                  <div className="input-label">Full Name</div>
                  <input className="input" placeholder="e.g. Gaurav Kumar"
                    value={displayName} autoFocus
                    onChange={e => { setDisplayName(e.target.value); setError(''); }} />
                </div>
                <div className="input-group">
                  <div className="input-label">Mobile Number</div>
                  <input className="input" type="tel" placeholder="10-digit mobile number"
                    value={mobile}
                    onChange={e => { setMobile(e.target.value.replace(/\D/g,'').slice(0,10)); setError(''); }} />
                </div>
                {generatedUserId && (
                  <div style={{ background:'var(--accent-bg)', border:'1px solid var(--accent)', borderRadius:0, padding:'12px 14px' }}>
                    <div style={{ fontSize:11, color:'var(--accent)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:6 }}>
                      Your User ID (save this!)
                    </div>
                    <div style={{ fontFamily:'monospace', fontSize:18, fontWeight:700, color:'var(--text)', letterSpacing:'0.04em' }}>
                      {generatedUserId}
                    </div>
                    <div style={{ fontSize:11, color:'var(--text3)', marginTop:5 }}>
                      You'll use this to sign in on any device
                    </div>
                  </div>
                )}
                <div className="input-group">
                  <div className="input-label">Security Question</div>
                  <select className="input" value={secQ} onChange={e => setSecQ(e.target.value)}>
                    {SECURITY_QUESTIONS.map(q => <option key={q} value={q}>{q}</option>)}
                  </select>
                </div>
                <div className="input-group">
                  <div className="input-label">Answer (used to reset PIN)</div>
                  <input className="input" placeholder="Your answer"
                    value={secA}
                    onChange={e => { setSecA(e.target.value); setError(''); }} />
                </div>
                <Err />
                <button className="btn btn-primary"
                  disabled={!displayName.trim() || !generatedUserId}
                  onClick={() => {
                    if (!displayName.trim()) { setError('Enter your full name'); return; }
                    if (!secA.trim()) { setError('Enter your security answer'); return; }
                    setError(''); setStep('pin');
                  }}>
                  Continue → Set PIN
                </button>
              </>
            )}
            {step === 'pin' && (
              <>
                <PinPad
                  value={pinStage === 'set' ? pin : confirmPin}
                  onChange={pinStage === 'set' ? setPin : setConfirmPin}
                  loading={loading}
                  onComplete={val => {
                    if (pinStage === 'set') {
                      setPinStage('confirm'); setConfirmPin(''); sounds.nav();
                    } else {
                      if (pin !== val) {
                        sounds.error(); setError('PINs do not match');
                        setConfirmPin(''); setPinStage('set'); setPin('');
                      } else {
                        handleRegister(val);
                      }
                    }
                  }}
                />
                <Err />
                <button className="btn btn-ghost btn-sm" style={{ margin:'0 auto', width:'auto' }}
                  onClick={() => { setStep('form'); setPin(''); setConfirmPin(''); setPinStage('set'); setError(''); }}>← Back</button>
              </>
            )}
          </div>
        </>
      )}

      {/* ══════════ FORGOT PIN ══════════ */}
      {mode === 'forgot' && (
        <>
          <div className="auth-sub">Reset PIN with your security answer</div>
          <div className="auth-form">
            {fpStep === 'id' && (
              <>
                <div className="input-group">
                  <div className="input-label">Your User ID</div>
                  <input className="input" placeholder="username or participant ID"
                    value={username} autoCapitalize="none" autoFocus
                    onChange={e => { setUsername(e.target.value.toLowerCase().replace(/\s/g, '')); setError(''); }} />
                </div>
                <Err />
                <button className="btn btn-primary" disabled={!username.trim() || loading} onClick={handleFpLookup}>
                  {loading ? 'Checking…' : 'Find Account →'}
                </button>
                <button className="btn btn-ghost btn-sm" style={{ margin:'0 auto', width:'auto' }} onClick={() => go('login')}>← Back to Sign In</button>
              </>
            )}
            {fpStep === 'question' && (
              <>
                <div className="card" style={{ background:'var(--accent-bg)', borderColor:'var(--accent)', fontSize:13, color:'var(--text2)' }}>
                  <div style={{ fontWeight:600, color:'var(--accent)', marginBottom:6 }}>Security Question</div>
                  {fpQuestion}
                </div>
                <div className="input-group">
                  <div className="input-label">Your Answer</div>
                  <input className="input" placeholder="Case-insensitive"
                    value={fpAnswer} autoFocus
                    onChange={e => { setFpAnswer(e.target.value); setError(''); }} />
                </div>
                <Err />
                <button className="btn btn-primary" disabled={!fpAnswer.trim()}
                  onClick={() => { if (!fpAnswer.trim()) { setError('Enter your answer'); return; } setError(''); setFpStep('newpin'); }}>
                  Continue → New PIN
                </button>
              </>
            )}
            {fpStep === 'newpin' && (
              <>
                <div className="auth-sub" style={{ marginBottom:0 }}>Set your new PIN</div>
                <PinPad value={fpNewPin} onChange={setFpNewPin} onComplete={handleFpReset} loading={loading} />
                <Err />
              </>
            )}
          </div>
        </>
      )}

      {/* ══════════ PARTICIPANT FIRST-TIME ══════════ */}
      {mode === 'participant' && (
        <>
          <div className="auth-sub">
            {ptStep === 'id' ? 'Set up your participant account'
              : ptStage === 'set' ? `Hi ${ptName || ''}! Set your PIN`
              : 'Confirm your PIN'}
          </div>
          <div className="auth-form">
            {ptStep === 'id' && (
              <>
                <div className="card" style={{ background:'var(--blue-bg)', borderColor:'var(--blue)', fontSize:13, color:'var(--text2)', lineHeight:1.6 }}>
                  <strong style={{ color:'var(--blue)' }}>ℹ️ For new participants</strong><br />
                  An admin added you and gave you a <strong>Participant ID</strong> (e.g.{' '}
                  <code style={{ background:'var(--surface3)', padding:'1px 5px', borderRadius:0, fontSize:12 }}>gaurav3231</code>).
                  Enter it here to create your account.
                </div>
                <div className="input-group">
                  <div className="input-label">Your Participant ID</div>
                  <input className="input" placeholder="e.g. gaurav3231"
                    value={ptPid} autoCapitalize="none" autoFocus
                    onChange={e => { setPtPid(e.target.value.toLowerCase().replace(/\s/g, '')); setError(''); }} />
                </div>
                <Err />
                <button className="btn btn-primary" disabled={!ptPid.trim() || loading} onClick={handlePtCheck}>
                  {loading ? 'Checking…' : 'Continue →'}
                </button>
                <button className="btn btn-ghost btn-sm" style={{ margin:'0 auto', width:'auto' }} onClick={() => go('login')}>← Back</button>
              </>
            )}
            {ptStep === 'setup' && (
              <>
                <div className="card" style={{ background:'var(--green-bg)', borderColor:'var(--green)', fontSize:13, color:'var(--text2)' }}>
                  ✓ Participant ID <strong style={{ color:'var(--green)' }}>{ptPid}</strong> found! Complete your profile.
                </div>
                <div className="input-group">
                  <div className="input-label">Your Name</div>
                  <input className="input" placeholder="How you want to appear"
                    value={ptName} autoFocus
                    onChange={e => { setPtName(e.target.value); setError(''); }} />
                </div>
                <div className="input-group">
                  <div className="input-label">Security Question</div>
                  <select className="input" value={ptSecQ} onChange={e => setPtSecQ(e.target.value)}>
                    {SECURITY_QUESTIONS.map(q => <option key={q} value={q}>{q}</option>)}
                  </select>
                </div>
                <div className="input-group">
                  <div className="input-label">Answer (to reset PIN later)</div>
                  <input className="input" placeholder="Your answer"
                    value={ptSecA}
                    onChange={e => { setPtSecA(e.target.value); setError(''); }} />
                </div>
                <Err />
                <button className="btn btn-primary"
                  disabled={!ptName.trim() || !ptSecA.trim()}
                  onClick={() => {
                    if (!ptName.trim() || !ptSecA.trim()) { setError('Fill all fields'); return; }
                    setError(''); setPtStep('pin');
                  }}>
                  Continue → Set PIN
                </button>
              </>
            )}
            {ptStep === 'pin' && (
              <>
                <PinPad
                  value={ptStage === 'set' ? ptPin : ptConfirm}
                  onChange={ptStage === 'set' ? setPtPin : setPtConfirm}
                  loading={loading}
                  onComplete={val => {
                    if (ptStage === 'set') {
                      setPtStage('confirm'); setPtConfirm(''); sounds.nav();
                    } else {
                      if (ptPin !== val) {
                        sounds.error(); setError('PINs do not match');
                        setPtConfirm(''); setPtStage('set'); setPtPin('');
                      } else {
                        handlePtFinish(val);
                      }
                    }
                  }}
                />
                <Err />
                <button className="btn btn-ghost btn-sm" style={{ margin:'0 auto', width:'auto' }}
                  onClick={() => { setPtStep('setup'); setPtPin(''); setPtConfirm(''); setPtStage('set'); setError(''); }}>← Back</button>
              </>
            )}
          </div>
        </>
      )}

      <div style={{ marginTop:16, fontSize:12, color:'var(--text3)', textAlign:'center', lineHeight:1.7 }}>
        🔒 All data stored locally · Offline · No cloud
      </div>
    </div>
  );
}
