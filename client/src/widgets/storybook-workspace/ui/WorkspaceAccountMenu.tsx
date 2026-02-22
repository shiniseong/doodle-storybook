import { useTranslation } from 'react-i18next'

import './WorkspaceAccountMenu.css'

interface WorkspaceAccountMenuProps {
  isUnsubscribed: boolean
  onNavigateToLibrary: () => void
  onOpenPricingModal: () => void
  onManageSubscription: () => void
  onSignOut: () => void
}

export function WorkspaceAccountMenu({
  isUnsubscribed,
  onNavigateToLibrary,
  onOpenPricingModal,
  onManageSubscription,
  onSignOut,
}: WorkspaceAccountMenuProps) {
  const { t } = useTranslation()

  return (
    <div className="workspace-account-menu" role="menu" aria-label={t('workspace.accountMenu.aria')}>
      <button type="button" role="menuitem" className="workspace-account-menu__item" onClick={onNavigateToLibrary}>
        {t('workspace.accountMenu.library')}
      </button>
      {isUnsubscribed ? (
        <button
          type="button"
          role="menuitem"
          className="workspace-account-menu__item workspace-account-menu__item--trial"
          onClick={onOpenPricingModal}
        >
          {t('workspace.accountMenu.subscribe')}
        </button>
      ) : null}
      {!isUnsubscribed ? (
        <button type="button" role="menuitem" className="workspace-account-menu__item" onClick={onManageSubscription}>
          {t('workspace.accountMenu.manage')}
        </button>
      ) : null}
      <button
        type="button"
        role="menuitem"
        className="workspace-account-menu__item workspace-account-menu__item--danger"
        onClick={onSignOut}
      >
        {t('workspace.accountMenu.signOut')}
      </button>
    </div>
  )
}
