import React, { useEffect, useRef } from 'react'
import './Modal.css'

type ModalProps = {
  isOpen: boolean
  title: string
  onClose: () => void
  /** Contenido del modal */
  children: React.ReactNode
  /** Botones (Guardar/Cancelar) etc. */
  actions?: React.ReactNode
  /** Elemento que debe tomar el foco al abrir (opcional) */
  initialFocusRef?: React.RefObject<HTMLElement>
  /** ¿Cerrar al hacer clic afuera? */
  closeOnOverlay?: boolean
}

export default function Modal({
  isOpen,
  title,
  onClose,
  children,
  actions,
  initialFocusRef,
  closeOnOverlay = true,
}: ModalProps) {
  const backdropRef = useRef<HTMLDivElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)

  // lock de scroll en <body> mientras esté abierto
  useEffect(() => {
    if (!isOpen) return
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = original }
  }, [isOpen])

  // cerrar con Escape
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      // focus-trap simple: mantén el tab dentro del panel
      if (e.key === 'Tab' && panelRef.current) {
        const focusables = panelRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
        if (focusables.length === 0) return
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        const active = document.activeElement
        if (e.shiftKey && active === first) {
          e.preventDefault(); last.focus()
        } else if (!e.shiftKey && active === last) {
          e.preventDefault(); first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  // foco inicial
  useEffect(() => {
    if (!isOpen) return
    const el = initialFocusRef?.current ?? panelRef.current?.querySelector<HTMLElement>('input, button, [tabindex]')
    el?.focus()
  }, [isOpen, initialFocusRef])

  if (!isOpen) return null

  return (
    <div
      ref={backdropRef}
      className="modal-backdrop"
      aria-hidden={!isOpen}
      onMouseDown={(e) => {
        if (!closeOnOverlay) return
        // cierra sólo si el click es sobre el backdrop (no dentro del panel)
        if (e.target === backdropRef.current) onClose()
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className="modal-panel"
      >
        <div className="modal-header">
          <h3 id="modal-title" className="modal-title">{title}</h3>
          <button className="modal-close" onClick={onClose} aria-label="Cerrar">×</button>
        </div>
        <div className="modal-body">{children}</div>
        {actions && <div className="modal-actions">{actions}</div>}
      </div>
    </div>
  )
}
