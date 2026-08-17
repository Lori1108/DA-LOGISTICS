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
          <svg width="64" height="64" viewBox="-2 0 26 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginBottom: '16px' }}>
            <path d="M14 4H4C2.89543 4 2 4.89543 2 6V15H14V4Z" fill="#60BB46"/>
            <path d="M-1 7H2" stroke="#60BB46" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M-2 10H2" stroke="#60BB46" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M-1 13H2" stroke="#60BB46" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M14 7H19L23 11V15H14V7Z" fill="#124388"/>
            <path d="M15 8H18.5L21.5 11H15V8Z" fill="#FFFFFF"/>
            <circle cx="6" cy="16" r="2.5" fill="#1E293B"/>
            <circle cx="6" cy="16" r="1" fill="#FFFFFF"/>
            <circle cx="18" cy="16" r="2.5" fill="#1E293B"/>
            <circle cx="18" cy="16" r="1" fill="#FFFFFF"/>
          </svg>
          <h1>DA LOGISTICS</h1>
          <p>Portal de Punto de Venta</p>
        </div>
        
        <form onSubmit={handleLogin} className="login-form">
          {error && <div className="login-error">{error}</div>}
          
          <div className="form-group">
            <label htmlFor="username">Usuario</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Ingresa tu usuario"
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
              placeholder="Ingresa tu contraseña"
              required
              autoComplete="current-password"
            />
          </div>

          <button type="submit" className="login-button" disabled={loading}>
            {loading ? 'Iniciando sesión...' : 'Ingresar al POS'}
          </button>
        </form>
      </div>

      <style jsx>{`
        .login-container {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          display: flex;
          background: linear-gradient(135deg, #0B2C5F 0%, #124388 100%);
          padding: 20px;
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
          overflow-y: auto;
          box-sizing: border-box;
        }

        .login-card {
          margin: auto;
          background: rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 24px;
          padding: 40px;
          width: 100%;
          max-width: 420px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        }

        .login-header {
          text-align: center;
          margin-bottom: 30px;
        }

        .login-header h1 {
          color: #fff;
          font-size: 28px;
          font-weight: 800;
          margin: 0 0 8px 0;
          letter-spacing: -0.5px;
          background: linear-gradient(to right, #38bdf8, #818cf8);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .login-header p {
          color: #94a3b8;
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
          color: #cbd5e1;
          font-size: 14px;
          font-weight: 500;
        }

        .form-group input {
          background: rgba(15, 23, 42, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          padding: 14px 16px;
          color: #fff;
          font-size: 16px;
          transition: all 0.2s ease;
          outline: none;
        }

        .form-group input:focus {
          border-color: #60BB46;
          box-shadow: 0 0 0 3px rgba(96, 187, 70, 0.2);
          background: rgba(15, 23, 42, 0.8);
        }

        .form-group input::placeholder {
          color: #475569;
        }

        .login-button {
          background-color: #124388;
          color: white;
          border: none;
          border-radius: 12px;
          padding: 14px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          margin-top: 10px;
          box-shadow: 0 4px 15px rgba(18, 67, 136, 0.3);
        }

        .login-button:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(18, 67, 136, 0.4);
          background-color: #0C2B59;
        }

        .login-button:active:not(:disabled) {
          transform: translateY(0);
        }

        .login-button:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .login-error {
          background: rgba(239, 68, 68, 0.1);
          color: #fca5a5;
          border: 1px solid rgba(239, 68, 68, 0.2);
          padding: 12px;
          border-radius: 10px;
          font-size: 14px;
          text-align: center;
          font-weight: 500;
        }

        @media (max-width: 480px) {
          .login-card {
            padding: 30px 20px;
          }
          
          .login-header h1 {
            font-size: 24px;
          }
        }
      `}</style>
    </div>
  );
}
