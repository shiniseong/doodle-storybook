import { describe, expect, it } from 'vitest'

import { resolveAppLanguage } from '@shared/config/i18n/constants'

describe('resolveAppLanguage', () => {
  it('null/undefined 는 기본값 ko를 반환한다', () => {
    expect(resolveAppLanguage(null)).toBe('ko')
    expect(resolveAppLanguage(undefined)).toBe('ko')
  })

  it('국가 코드가 포함된 언어 태그를 기본 언어 코드로 정규화한다', () => {
    expect(resolveAppLanguage('en-US')).toBe('en')
    expect(resolveAppLanguage('ja-JP')).toBe('ja')
    expect(resolveAppLanguage('zh-CN')).toBe('zh')
  })

  it('지원하지 않는 언어는 ko로 대체한다', () => {
    expect(resolveAppLanguage('fr')).toBe('ko')
    expect(resolveAppLanguage('de-DE')).toBe('ko')
  })
})
