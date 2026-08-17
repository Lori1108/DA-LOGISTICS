'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [username, setUsername] = useState('');
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
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (data.success) {
        window.location.href = '/pos.html';
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
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
              <span>{error}</span>
            </div>
          )}
          
          <div className="form-group">
            <label htmlFor="username">Usuario</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="ej. admin"
              required
              autoComplete="username"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Contraseña</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>

          <button type="submit" className="login-button" disabled={loading}>
            {loading ? (
              <span className="loader"></span>
            ) : 'Iniciar Sesión'}
          </button>
        </form>
      </div>

      <style jsx>{`
        .login-container {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          display: flex;
          background: #F8FAFC;
          background-image: 
            radial-gradient(at 40% 20%, rgba(121, 193, 67, 0.08) 0px, transparent 50%),
            radial-gradient(at 80% 0%, rgba(27, 74, 150, 0.08) 0px, transparent 50%),
            radial-gradient(at 0% 50%, rgba(27, 74, 150, 0.08) 0px, transparent 50%);
          padding: 20px;
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
          justify-content: center;
          align-items: center;
        }

        .login-card {
          background: #FFFFFF;
          border: 1px solid rgba(0, 0, 0, 0.04);
          padding: 48px 40px;
          border-radius: 24px;
          width: 100%;
          max-width: 440px;
          box-shadow: 0 20px 40px -12px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(0,0,0,0.02);
          position: relative;
          z-index: 10;
        }

        .login-header {
          text-align: center;
          margin-bottom: 32px;
        }

        .logo-container {
          margin-bottom: 24px;
        }

        .login-logo {
          width: 180px;
          height: auto;
          object-fit: contain;
          display: block;
          margin: 0 auto;
        }

        .login-header h1 {
          color: #0F172A;
          font-size: 26px;
          font-weight: 800;
          margin: 0 0 8px 0;
          letter-spacing: -0.5px;
        }

        .login-header p {
          color: #64748B;
          margin: 0;
          font-size: 15px;
        }

        .login-form {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .form-group label {
          color: #334155;
          font-size: 14px;
          font-weight: 600;
        }

        .form-group input {
          background: #F1F5F9;
          border: 1px solid transparent;
          border-radius: 12px;
          padding: 14px 16px;
          color: #0F172A;
          font-size: 15px;
          transition: all 0.2s ease;
          outline: none;
        }

        .form-group input::placeholder {
          color: #94A3B8;
        }

        .form-group input:hover {
          background: #E2E8F0;
        }

        .form-group input:focus {
          background: #FFFFFF;
          border-color: #1B4A96;
          box-shadow: 0 0 0 4px rgba(27, 74, 150, 0.1);
        }

        .login-button {
          background-color: #1B4A96;
          color: white;
          border: none;
          border-radius: 12px;
          padding: 16px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          margin-top: 8px;
          box-shadow: 0 4px 12px rgba(27, 74, 150, 0.2);
          display: flex;
          justify-content: center;
          align-items: center;
          height: 54px;
        }

        .login-button:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(27, 74, 150, 0.3);
          background-color: #143A7A;
        }

        .login-button:active:not(:disabled) {
          transform: translateY(0);
          box-shadow: 0 2px 8px rgba(27, 74, 150, 0.2);
        }

        .login-button:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .login-error {
          background: #FEF2F2;
          color: #DC2626;
          border: 1px solid #FCA5A5;
          padding: 12px 16px;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 500;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .login-error svg {
          width: 18px;
          height: 18px;
          flex-shrink: 0;
        }

        .loader {
          width: 20px;
          height: 20px;
          border: 3px solid rgba(255,255,255,0.3);
          border-radius: 50%;
          border-top-color: #fff;
          animation: spin 1s ease-in-out infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        @media (max-width: 480px) {
          .login-card {
            padding: 32px 24px;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05);
          }
          
          .login-header h1 {
            font-size: 24px;
          }
        }
      `}</style>
    </div>
  );
}
