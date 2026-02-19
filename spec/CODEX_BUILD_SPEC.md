# 뚝딱 그림책 (Doodle Storybook) - Codex 구현 명세

## 1) 프로젝트 목표
- 아이가 직접 그림을 그리고 짧은 설명을 입력하면 AI가 그림책(표지 포함, 전 페이지 이미지 포함)을 생성하는 반응형 웹앱을 만든다.
- 회원가입 기반 서비스로 운영하며, 무료 사용/구독 결제 전환 플로우를 포함한다.

## 2) 기술 스택 (고정)
- 프론트엔드: React (TypeScript)
- 백엔드: Cloudflare Pages Functions + Workers (serverless)
- DB: Supabase (PostgreSQL)
- 인증/인가/회원가입: Supabase Auth
- 스토리지: Cloudflare R2
- 결제: Polar
- AI: OpenAI API (텍스트 생성 + 이미지 생성 + TTS)
- 프론트 테스트/품질:
  - 모든 테스트 도구는 최신 안정(stable) 버전 사용
  - 단위/통합/컴포넌트 테스트: Vitest + Testing Library
  - 사용자 이벤트 테스트: `@testing-library/user-event`
  - DOM matcher: `@testing-library/jest-dom`
  - 브라우저 환경 시뮬레이션: `jsdom`
  - API mocking: `MSW`
  - 커버리지: `@vitest/coverage-v8`

## 3) MVP 범위 (필수 구현)

### 3.1 그림판
- 펜 굵기 조절
- 펜 색상 변경
- 펜 투명도(Opacity) 조절
- 지우개 모드
- 실행취소(Undo)

### 3.2 입력
- 그림별 설명(Description) 입력
- 최대 500자 제한 (클라이언트/서버 모두 검증)

### 3.3 동화 생성
- "동화 생성하기" 버튼으로 OpenAI API 호출
- 생성 결과는 반드시:
  - 표지 1장 포함
  - 모든 페이지에 이미지 포함
  - 페이지별 텍스트 포함
- 최소 데이터 단위: `표지 + 내지 N페이지` (N은 설정값으로 관리, 기본값 6 권장)

### 3.4 뷰어
- 책장 넘김 효과(페이지 플립)로 읽기
- TTS 재생:
  - 페이지 단위 재생
  - 전체 연속 재생(선택)

### 3.5 회원/과금
- 회원가입 후 사용 가능 (비회원 생성 불가)
- 무료 생성 2편 제공
- 월 구독: 6,900원 (무제한 생성)
- 1일 무료 체험 + 구독 결제 예약(자동 전환) 플로우 지원

## 4) 무료/결제 정책 (구현 규칙)
요구사항 9, 10, 11을 함께 만족시키기 위해 아래 규칙으로 확정한다.

1. 기본 무료 정책:
- 가입 사용자에게 평생 무료 생성 2편 제공 (`free_story_quota_total = 2`)

2. 체험 정책:
- 사용자가 "1일 무료 체험 시작"을 선택하면 24시간 동안 생성 제한 해제
- 체험 시작 시 결제수단 등록 + 구독 예약 생성
- 24시간 종료 시 자동 유료 전환 시도

3. 체험 미전환/실패 시:
- 구독이 ACTIVE가 아니면 다시 무료 2편 한도 규칙 적용
- 이미 무료 2편을 소진했다면 생성 차단하고 구독 유도

## 5) 정보 구조 및 데이터 모델
요구사항의 관계를 다음처럼 구현한다.

- `users` (Supabase Auth)
- `profiles` (앱 사용자 메타)
- `storybooks` : Users (1) : (N) Storybooks
- `storybook_origin_details` : Storybooks (1) : (N) OriginDetails
- `storybook_output_details` : Storybooks (1) : (N) OutputDetails

### 5.1 권장 테이블 스키마 (요약)

1. `profiles`
- `id` (uuid, pk, auth.users.id fk)
- `display_name`
- `preferred_language` (`ko`, `en`, `ja`, `zh`)
- `created_at`

2. `subscriptions`
- `id` (uuid, pk)
- `user_id` (uuid, fk)
- `provider` (`polar`)
- `status` (`trialing`, `active`, `past_due`, `canceled`, `incomplete`)
- `plan_code` (`monthly_unlimited_6900_krw`)
- `trial_start_at`, `trial_end_at`
- `current_period_start`, `current_period_end`
- `scheduled_activation_at`
- `provider_customer_id`, `provider_subscription_id`

3. `usage_quotas`
- `user_id` (uuid, pk)
- `free_story_quota_total` (int, default 2)
- `free_story_quota_used` (int, default 0)
- `updated_at`

4. `storybooks`
- `id` (uuid, pk)
- `user_id` (uuid, fk)
- `title`
- `language`
- `status` (`draft`, `generating`, `completed`, `failed`)
- `cover_image_r2_key`
- `page_count`
- `created_at`, `updated_at`

5. `storybook_origin_details`
- `id` (uuid, pk)
- `storybook_id` (uuid, fk)
- `page_index` (int, 0부터)
- `drawing_image_r2_key`
- `description` (varchar(500))

6. `storybook_output_details`
- `id` (uuid, pk)
- `storybook_id` (uuid, fk)
- `page_index` (int, 0부터, 0은 표지 가능)
- `page_type` (`cover`, `story`)
- `image_r2_key`
- `text_content`
- `tts_audio_r2_key`
- `highlight_animation_json` (nullable, 고도화용)

## 6) 저장소(R2) 규칙
- 산출물 저장 대상:
  - 사용자가 그린 원본 이미지
  - 생성 텍스트
  - 생성 이미지
  - TTS 음성 파일
- 키 네이밍 예시:
  - `users/{userId}/storybooks/{storybookId}/origin/{pageIndex}.png`
  - `users/{userId}/storybooks/{storybookId}/output/{pageIndex}.png`
  - `users/{userId}/storybooks/{storybookId}/tts/{pageIndex}.mp3`

## 7) API 계약 (Cloudflare Functions)

1. `POST /api/storybooks`
- 입력: 원본 그림 배열(최대 1장 MVP), 설명, 언어
- 처리: 사용권한/쿼터 검사 -> 생성 Job 시작
- 출력: `storybookId`, `status`

2. `POST /api/storybooks/:id/generate`
- OpenAI 호출로 표지+페이지 텍스트/이미지 생성
- 페이지별 TTS 생성
- R2 저장 + DB 반영

3. `GET /api/storybooks`
- 내 동화 목록 조회 (페이징)

4. `GET /api/storybooks/:id`
- 동화 상세(표지/페이지/tts 포함)

5. `POST /api/subscriptions/trial/start`
- 1일 체험 시작 + 결제 예약 생성

6. `POST /api/webhooks/polar`
- 구독 상태 변경 webhook 처리

## 8) 다국어/문체 요구사항
- 지원 언어: 한국어, 영어, 일본어, 중국어(간체 권장)
- 원어민 기준 자연스러운 표현 사용
- 아동용 앱 톤앤매너:
  - 한국어: 부드러운 해요체
  - 영어: 친근하고 짧은 문장
  - 일본어: 부드러운 아동용 문체
  - 중국어: 쉬운 어휘, 따뜻한 어조
- UI 텍스트/스토리 텍스트 모두 i18n 적용

## 9) 반응형 요구사항
- 모바일(세로/가로), 태블릿(세로/가로), PC 지원
- 그림판/뷰어는 터치 + 마우스 입력 모두 지원
- 기본 브레이크포인트 권장:
  - Mobile: `< 768`
  - Tablet: `768 - 1199`
  - Desktop: `>= 1200`

## 10) 보안/운영 요구사항
- OpenAI API 키는 서버(Cloudflare 환경변수)에만 저장
- 클라이언트에서 OpenAI 직접 호출 금지
- Supabase Row Level Security 적용
- 결제 webhook 서명 검증 필수
- 생성 실패 시 재시도/오류 상태 저장

## 11) 고도화 백로그 (차후)
1. 원본 그림+설명 최대 5장 입력
2. 표지/하이라이트 동적 애니메이션
3. 코치마크 튜토리얼 오버레이 + "다시 보지 않기"(브라우저 스토리지)
4. 산출물 스토리지 보관 정책 고도화
5. 사용자별 생성물 관계 모델 정교화
6. 내가 만든 동화 목록/재열람 UX 강화

## 12) Codex 작업 순서 (권장)
1. 프론트 TDD/FSD/Clean Architecture 부트스트랩 (테스트 러너, alias, 경계 규칙)
2. DB 스키마 + RLS + 최소 시드 작성
3. Supabase Auth 연동 (회원가입/로그인/세션)
4. 그림판 컴포넌트 구현
5. 동화 생성 API(서버) + OpenAI 연동
6. R2 업로드/조회 연결
7. 페이지 플립 뷰어 + TTS 재생
8. 무료쿼터/체험/구독 상태 제어
9. 목록/상세 조회 화면
10. i18n + 반응형 마감
11. E2E 테스트(가입 -> 생성 -> 읽기 -> 결제전환)
12. 최종 품질 게이트(`lint`, `test:coverage`, `build`) 통과

## 13) 완료 기준 (Definition of Done)
- 회원가입 사용자만 동화 생성 가능
- 무료 2편 제한이 정확히 동작
- 1일 체험 시작/종료/결제 전환이 상태값으로 검증 가능
- 생성된 동화는 표지 포함 + 모든 페이지 이미지 보유
- 책장 넘김 UI와 TTS 재생 동작
- 4개 언어 UI/스토리 생성 흐름 검증
- 모바일/태블릿/PC에서 주요 기능 깨짐 없이 동작
- 프론트 변경 시 `lint`, `test:coverage`, `build` 모두 통과
- TDD 사이클(RED -> GREEN -> REFACTOR) 증빙 가능한 테스트가 함께 존재

## 14) 프론트엔드 아키텍처 원칙 (필수)

### 14.1 FSD 레이어 구조
- `app`: 앱 초기화, 전역 Provider, 의존성 주입(Composition Root)
- `pages`: 라우트 단위 화면 조합
- `widgets`: 화면 섹션 단위 조합
- `features`: 유즈케이스 중심 기능(도메인/애플리케이션/UI/인프라)
- `entities`: 핵심 엔티티 타입/모델
- `shared`: 공통 유틸/설정/UI primitive

### 14.2 Clean Architecture 적용 규칙
- 의존 방향은 항상 안쪽 정책으로 수렴하며, 코드 흐름은 `UI -> application(port) -> domain`을 따른다.
- 인프라 구현체(API, Storage, SDK)는 `port interface`를 구현하고 `app`에서 주입한다.
- `domain`은 React/브라우저/네트워크 의존성을 가지지 않는다.
- `application(use-case)`은 프레임워크 세부 구현을 모른다.

### 14.3 의존성 경계 규칙
- 하위 레이어가 상위 레이어를 import 하면 안 된다.
- 상대경로 난립을 금지하고 path alias 기반 import를 사용한다.
- 레이어 경계 위반은 lint 단계에서 실패 처리한다.

## 15) 프론트 테스트 전략 (산업 표준)

### 15.1 테스트 피라미드
- Domain 테스트: 순수 함수/비즈니스 규칙 검증
- Use-case 테스트: port mock 기반 오케스트레이션 검증
- UI 테스트: 사용자 관점 상호작용/접근성 기반 검증
- 화면 통합 테스트: widget + feature 연결 동작 검증
- E2E 테스트: 핵심 사용자 시나리오(가입 -> 생성 -> 열람 -> 결제)

### 15.2 테스트 작성 원칙
- 구현 디테일보다는 사용자 행동/결과 중심으로 검증한다.
- `screen.getByRole`, `getByLabelText` 우선 사용(접근성 친화).
- 네트워크는 실제 호출 대신 MSW로 모킹한다.
- 스냅샷 테스트 남용 금지(필요 최소 범위에서만 사용).
- flaky 테스트 금지: 시간/랜덤/외부상태 의존성 제거.

### 15.3 커버리지 기준
- 라인/구문/함수: 최소 90%
- 브랜치: 최소 85%
- 기준 미달 시 CI 실패

## 16) TDD 실행 프로토콜 (필수)
1. RED: 먼저 실패하는 테스트를 작성
2. GREEN: 최소 코드로 테스트 통과
3. REFACTOR: 중복 제거/구조 개선 후 테스트 재통과 확인

- 모든 코드 수정은 최소 1개 이상의 테스트 변경(신규/보강)을 동반한다.
- 로컬 개발 중 기본 루틴:
  - `npm run test:watch`
  - 기능 완료 시 `npm run verify`
- PR 머지 조건:
  - `npm run lint` 통과
  - `npm run test:coverage` 통과
  - `npm run build` 통과
  - 핵심 시나리오 E2E 통과
