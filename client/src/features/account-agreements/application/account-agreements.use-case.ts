export interface AccountAgreementsStatus {
  requiredVersion: string
  hasAcceptedRequiredAgreements: boolean
  agreements: {
    termsOfService: boolean
    adultPayer: boolean
    noDirectChildDataCollection: boolean
  }
  acceptedAt: string | null
}

export interface AccountAgreementsPort {
  getStatus(): Promise<AccountAgreementsStatus>
  acceptAllRequiredAgreements(): Promise<AccountAgreementsStatus>
}

export interface AccountAgreementsUseCasePort {
  getStatus(): Promise<AccountAgreementsStatus>
  acceptAllRequiredAgreements(): Promise<AccountAgreementsStatus>
}

export class AccountAgreementsUseCase implements AccountAgreementsUseCasePort {
  private readonly port: AccountAgreementsPort

  constructor(port: AccountAgreementsPort) {
    this.port = port
  }

  getStatus(): Promise<AccountAgreementsStatus> {
    return this.port.getStatus()
  }

  acceptAllRequiredAgreements(): Promise<AccountAgreementsStatus> {
    return this.port.acceptAllRequiredAgreements()
  }
}
