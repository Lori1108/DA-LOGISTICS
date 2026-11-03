"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (data.success) {
        // Redirect based on role
        if (data.role === 'preventa') {
          router.push('/preventa');
        } else if (data.role === 'admin') {
          router.push('/');
        } else {
          router.push('/pos.html');
        }
      } else {
        setError(data.message || 'Credenciales incorrectas');
        setLoading(false);
      }
    } catch (err) {
      setError('Error de conexión');
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="logo-container">
            <img src="/logo.png" alt="DA LOGISTICS" className="login-logo" />
          </div>
          <h1>Bienvenido de nuevo</h1>
          <p>Ingresa tus credenciales para acceder al POS</p>
        </div>
        <form onSubmit={handleLogin} className="login-form">
          {error && (
            <div className="login-error">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <span>{error}</span>
            </div>
          )}
          <div className="form-group">
            <label htmlFor="email">Correo</label>
            <input type="email" id="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ej. preventa1@bilo.com" required autoComplete="email" />
          </div>
          <div className="form-group">
            <label htmlFor="password">Contraseña</label>
            <input type="password" id="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required autoComplete="current-password" />
          </div>
          <button type="submit" className="login-button" disabled={loading}>
            {loading ? <span className="loader"></span> : 'Iniciar Sesión'}
          </button>
        </form>
      </div>
      <style jsx>{`
        .login-container {position: fixed; top:0; left:0; right:0; bottom:0; display:flex; background:#F8FAFC; background-image:radial-gradient(at 40% 20%, rgba(121,193,67,0.08) 0px, transparent 50%), radial-gradient(at 80% 0%, rgba(27,74,150,0.08) 0px, transparent 50%), radial-gradient(at 0% 50%, rgba(27,74,150,0.08) 0px, transparent 50%); padding:20px; justify-content:center; align-items:center; font-family:'Inter',system-ui,-apple-system,sans-serif;}
        .login-card {background:#FFF; border:1px solid rgba(0,0,0,0.04); padding:48px 40px; border-radius:24px; width:100%; max-width:440px; box-shadow:0 20px 40px -12px rgba(0,0,0,0.08),0 0 0 1px rgba(0,0,0,0.02);}
        .login-header {text-align:center; margin-bottom:32px;}
        .logo-container {margin-bottom:24px;}
        .login-logo {width:180px; height:auto; display:block; margin:0 auto;}
        .login-header h1 {color:#0F172A; font-size:26px; font-weight:800; margin:0 0 8px; letter-spacing:-0.5px;}
        .login-header p {color:#64748B; margin:0; font-size:15px;}
        .login-form {display:flex; flex-direction:column; gap:20px;}
        .form-group {display:flex; flex-direction:column; gap:8px;}
        .form-group label {color:#334155; font-size:14px; font-weight:600;}
        .form-group input {background:#F1F5F9; border:1px solid transparent; border-radius:12px; padding:14px 16px; color:#0F172A; font-size:15px; transition:all 0.2s ease; outline:none;}
        .form-group input::placeholder {color:#94A3B8;}
        .form-group input:hover {background:#E2E8F0;}
        .form-group input:focus {background:#FFF; border-color:#1B4A96; box-shadow:0 0 0 4px rgba(27,74,150,0.1);}
        .login-button {background-color:#1B4A96; color:white; border:none; border-radius:12px; padding:16px; font-size:16px; cursor:pointer;}
        .login-button:disabled {opacity:0.6; cursor:not-allowed;}
        .login-error {color:#DC2626; display:flex; align-items:center; gap:8px;}
        .loader {border:3px solid #f3f3f3; border-top:3px solid #1B4A96; border-radius:50%; width:16px; height:16px; animation:spin 1s linear infinite; display:inline-block;}
        @keyframes spin {0% {transform:rotate(0deg);} 100% {transform:rotate(360deg);}}
      `}</style>
    </div>
  );
}
