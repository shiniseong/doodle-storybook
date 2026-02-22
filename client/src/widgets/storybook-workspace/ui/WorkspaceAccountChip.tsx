import { ChevronDown, LogIn, UserRound } from 'lucide-react'

import './WorkspaceAccountChip.css'

interface WorkspaceAccountChipProps {
  label: string
  isAuthenticated: boolean
  isExpanded?: boolean
  disabled?: boolean
  onClick: () => void
}

export function WorkspaceAccountChip({
  label,
  isAuthenticated,
  isExpanded = false,
  disabled = false,
  onClick,
}: WorkspaceAccountChipProps) {
  return (
    <button
      type="button"
      className={`workspace-account-chip${isAuthenticated ? ' workspace-account-chip--authenticated' : ''}`}
      aria-haspopup={isAuthenticated ? 'menu' : undefined}
      aria-expanded={isAuthenticated ? isExpanded : undefined}
      onClick={onClick}
      disabled={disabled}
    >
      {isAuthenticated ? (
        <UserRound className="workspace-account-chip__icon" size={14} strokeWidth={2.2} aria-hidden="true" />
      ) : (
        <LogIn className="workspace-account-chip__icon" size={14} strokeWidth={2.2} aria-hidden="true" />
      )}
      <span className="workspace-account-chip__label">{label}</span>
      {isAuthenticated ? (
        <ChevronDown
          className={`workspace-account-chip__chevron${isExpanded ? ' workspace-account-chip__chevron--expanded' : ''}`}
          size={14}
          strokeWidth={2.2}
          aria-hidden="true"
        />
      ) : null}
    </button>
  )
}
