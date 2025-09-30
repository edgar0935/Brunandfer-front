import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import "@/styles/auth.css";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const location = useLocation() as any;
  const from = location.state?.from?.pathname || "/dashboard";

  const [email, setEmail] = useState("admin@local"); // demo
  const [password, setPassword] = useState("1234");  // demo
  const [remember, setRemember] = useState(true);
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    document.body.classList.add("no-scroll");
    return () => document.body.classList.remove("no-scroll");
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");

    if (!email.trim() || !password.trim()) {
      setErr("Ingresa tu usuario y contraseña.");
      return;
    }
    setLoading(true);
    try {
      await login(email, password, { remember });
      nav(from, { replace: true });
    } catch (e: any) {
      setErr(e?.message ?? "Error de autenticación");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-backdrop" />
      <div className="login-card">
        <div className="login-brand">
          <div className="brand-badge"><span className="brand-initials">B&F</span></div>
          <div className="brand-caption">BRUN &amp; FER</div>
        </div>

        <h1 className="login-title">Iniciar sesión</h1>

        <form className="login-form" onSubmit={onSubmit}>
          <div className="input-panel">
            <label className="field">
              <span>Usuario</span>
              <input
                type="text"
                placeholder="usuario o correo"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                autoFocus
              />
            </label>

            <label className="field">
              <span>Contraseña</span>
              <div className="password-input">
                <input
                  type={show ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="has-toggle"
                />
                <button
                  type="button"
                  className="toggle-pass"
                  onClick={() => setShow((s) => !s)}
                  aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
                  disabled={loading}
                >
                  {show ? "Ocultar" : "Mostrar"}
                </button>
              </div>
            </label>
          </div>

          <label className="field checkbox">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
            <span>Recordarme en este dispositivo</span>
          </label>

          {err && <div className="login-error">{err}</div>}

          <button className="btn-primary login-submit" disabled={loading}>
            {loading ? "Ingresando…" : "Entrar"}
          </button>
        </form>

        <div className="login-hint">
          Demo rápida: <b>admin@local / 1234</b> (admin) · <b>operador@local / 1234</b> (user)
        </div>
      </div>
    </div>
  );
}
