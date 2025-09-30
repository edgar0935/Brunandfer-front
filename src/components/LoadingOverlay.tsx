import React from 'react';
import '@/styles/auth.css';

export default function LoadingOverlay({ text = 'Cargando…' }: { text?: string }) {
  return (
    <div className="overlay">
      <div className="overlay-box">
        <div className="spinner" aria-hidden />
        <div>{text}</div>
      </div>
    </div>
  );
}
