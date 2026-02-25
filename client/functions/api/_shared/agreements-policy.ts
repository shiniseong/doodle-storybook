export const DEFAULT_REQUIRED_AGREEMENTS_VERSION = '2026-02-24'

const AGREEMENTS_VERSION_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export interface RequiredAgreementsEnv {
  REQUIRED_AGREEMENTS_VERSION?: string
}

export function resolveRequiredAgreementsVersion(env: RequiredAgreementsEnv): string {
  const configuredVersion = env.REQUIRED_AGREEMENTS_VERSION

  if (typeof configuredVersion !== 'string') {
    return DEFAULT_REQUIRED_AGREEMENTS_VERSION
  }

  const normalizedVersion = configuredVersion.trim()
  if (!AGREEMENTS_VERSION_PATTERN.test(normalizedVersion)) {
    return DEFAULT_REQUIRED_AGREEMENTS_VERSION
  }

  return normalizedVersion
}
