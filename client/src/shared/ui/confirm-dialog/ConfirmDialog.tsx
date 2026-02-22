import { useEffect, useId, useRef } from 'react'

import { useBodyScrollLock } from '@shared/lib/dom/body-scroll-lock'

import './ConfirmDialog.css'

type ConfirmDialogTone = 'default' | 'danger'

interface ConfirmDialogLayerProps {
  title: string
  description: string
  confirmLabel: string
  cancelLabel: string
  closeLabel: string
  isConfirming: boolean
  tone: ConfirmDialogTone
  onConfirm: () => void
  onCancel: () => void
}

interface ConfirmDialogProps {
  isOpen: boolean
  title: string
  description: string
  confirmLabel: string
  cancelLabel: string
  closeLabel: string
  isConfirming?: boolean
  tone?: ConfirmDialogTone
  onConfirm: () => void
  onCancel: () => void
}

function ConfirmDialogLayer({
  title,
  description,
  confirmLabel,
  cancelLabel,
  closeLabel,
  isConfirming,
  tone,
  onConfirm,
  onCancel,
}: ConfirmDialogLayerProps) {
  const titleId = useId()
  const descriptionId = useId()
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null)

  useBodyScrollLock()

  useEffect(() => {
    cancelButtonRef.current?.focus()
  }, [])

  useEffect(() => {
    const handleWindowKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || isConfirming) {
        return
      }

      event.preventDefault()
      onCancel()
    }

    window.addEventListener('keydown', handleWindowKeyDown)

    return () => {
      window.removeEventListener('keydown', handleWindowKeyDown)
    }
  }, [isConfirming, onCancel])

  return (
    <div
      className="confirm-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
    >
      <button
        type="button"
        className="confirm-dialog__backdrop"
        aria-label={closeLabel}
        onClick={onCancel}
        disabled={isConfirming}
      />
      <article className="confirm-dialog__sheet">
        <button
          type="button"
          className="confirm-dialog__close"
          aria-label={closeLabel}
          onClick={onCancel}
          disabled={isConfirming}
        >
          ×
        </button>
        <h2 id={titleId}>{title}</h2>
        <p id={descriptionId}>{description}</p>
        <div className="confirm-dialog__actions">
          <button
            ref={cancelButtonRef}
            type="button"
            className="confirm-dialog__action confirm-dialog__action--secondary"
            onClick={onCancel}
            disabled={isConfirming}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`confirm-dialog__action ${
              tone === 'danger' ? 'confirm-dialog__action--danger' : 'confirm-dialog__action--primary'
            }`}
            onClick={onConfirm}
            disabled={isConfirming}
          >
            {confirmLabel}
          </button>
        </div>
      </article>
    </div>
  )
}

export function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmLabel,
  cancelLabel,
  closeLabel,
  isConfirming = false,
  tone = 'default',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!isOpen) {
    return null
  }

  return (
    <ConfirmDialogLayer
      title={title}
      description={description}
      confirmLabel={confirmLabel}
      cancelLabel={cancelLabel}
      closeLabel={closeLabel}
      isConfirming={isConfirming}
      tone={tone}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  )
}
