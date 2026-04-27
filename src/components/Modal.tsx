import React, { useEffect, useRef } from "react";
import "./Modal.css";

type ModalSize = "md" | "lg" | "xl" | "xxl";
type ModalVariant = "light" | "dark";

type ModalProps = {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  actions?: React.ReactNode;
  initialFocusRef?: React.RefObject<HTMLElement>;
  closeOnOverlay?: boolean;
  /** tamaño del panel (ancho máximo) */
  size?: ModalSize;
  /** tema para inputs/cuerpo: light (default) u oscuro */
  variant?: ModalVariant;
};

export default function Modal({
  isOpen,
  title,
  onClose,
  children,
  actions,
  initialFocusRef,
  closeOnOverlay = true,
  size = "lg",
  variant = "light",
}: ModalProps) {
  const backdropRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [isOpen]);

  // ESC + trap de foco sencillo
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && panelRef.current) {
        const focusables = panelRef.current.querySelectorAll<HTMLElement>(
          'button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement;
        if (e.shiftKey && active === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  // foco inicial
  useEffect(() => {
    if (!isOpen) return;
    const el =
      initialFocusRef?.current ??
      panelRef.current?.querySelector<HTMLElement>("input, button, [tabindex]");
    el?.focus();
  }, [isOpen, initialFocusRef]);

  if (!isOpen) return null;

  return (
    <div
      ref={backdropRef}
      className="modal-backdrop"
      aria-hidden={!isOpen}
      onMouseDown={(e) => {
        if (!closeOnOverlay) return;
        if (e.target === backdropRef.current) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={`modal-panel modal--${variant}`}
        data-size={size}
      >
        <div className="modal-header">
          <h3 id="modal-title" className="modal-title">
            {title}
          </h3>
          <button
            className="btn-close"
            onClick={onClose}
            aria-label="Cerrar"
            type="button"
          >
            ×
          </button>
        </div>

        <div className="modal-body">{children}</div>

        {actions && <div className="modal-actions">{actions}</div>}
      </div>
    </div>
  );
}
