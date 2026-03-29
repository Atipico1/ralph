# DiceBear Docs

오픈소스 아바타 라이브러리. SVG 출력, TypeScript 지원, 30+ 스타일.
Ralph UI에서 에이전트 캐릭터 표현에 사용 가능.

## Docs

- [JS Library](https://www.dicebear.com/how-to-use/js-library): 설치, createAvatar API, 코어 옵션
- [HTTP API](https://www.dicebear.com/how-to-use/http-api): URL 기반 아바타 생성
- [CLI](https://www.dicebear.com/how-to-use/cli): CLI 사용법
- [React Guide](https://www.dicebear.com/guides/use-the-library-with-react): React 통합 가이드
- [Styles](https://www.dicebear.com/styles/): 전체 스타일 목록
- [Avataaars Style](https://www.dicebear.com/styles/avataaars): 표정 파라미터 지원 스타일 (추천)
- [Licenses](https://www.dicebear.com/licenses/): 스타일별 라이선스

## 설치

```bash
npm install @dicebear/core @dicebear/collection
```

## 기본 사용법

```typescript
import { createAvatar } from '@dicebear/core';
import { avataaars } from '@dicebear/collection';

const avatar = createAvatar(avataaars, {
  seed: 'ralph',
  // ... style-specific options
});

const svg = avatar.toString();        // SVG XML string
const dataUri = avatar.toDataUri();   // data:image/svg+xml;... (img src용)
```

## 코어 옵션 (모든 스타일 공통)

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| seed | string | random | 결정적 생성 시드 |
| flip | boolean | false | 좌우 반전 |
| rotate | number | 0 | 회전 (0-360) |
| scale | number | 100 | 스케일 (0-200%) |
| radius | number | 0 | 둥근 모서리 (0-50%) |
| size | number | undefined | 고정 크기 (px) |
| backgroundColor | string[] | undefined | 배경색 (hex without #) |
| randomizeIds | boolean | false | SVG ID 랜덤화 (같은 페이지 여러 아바타 시 필수) |

## avataaars 스타일 — 표정 파라미터

Ralph 에이전트 캐릭터에 추천. phase별 상태 표현 가능.

### eyes

`closed` `cry` `default` `eyeRoll` `happy` `hearts` `side` `squint` `surprised` `wink` `winkWacky` `xDizzy`

### eyebrows

`angry` `angryNatural` `default` `defaultNatural` `flatNatural` `frownNatural` `raisedExcited` `raisedExcitedNatural` `sadConcerned` `sadConcernedNatural` `unibrowNatural` `upDown` `upDownNatural`

### mouth

`concerned` `default` `disbelief` `eating` `grimace` `sad` `screamOpen` `serious` `smile` `tongue` `twinkle` `vomit`

### Ralph phase별 표정 매핑 예시

| Phase | eyes | eyebrows | mouth | 의도 |
|-------|------|----------|-------|------|
| Landing | happy | default | smile | 반갑게 인사 |
| Collect (질문) | default | raisedExcited | default | 관심있게 듣기 |
| Collect (응답 수신) | happy | defaultNatural | twinkle | 고개 끄덕 |
| Simulate (검토 중) | squint | flatNatural | serious | 집중해서 검토 |
| Simulate (코멘트) | side | upDown | twinkle | 혼잣말 |
| Deliver (결과) | happy | raisedExcitedNatural | smile | 자신있게 제시 |

### HTTP API (프리렌더링 / 빠른 테스트)

```
https://api.dicebear.com/9.x/avataaars/svg?seed=ralph&eyes=happy&mouth=smile&eyebrows=default
```

## 전체 스타일 목록

캐릭���성 있는 스타일 (얼굴 표현 가능):
- `adventurer` / `adventurer-neutral`
- `avataaars` / `avataaars-neutral`
- `big-ears` / `big-ears-neutral`
- `big-smile`
- `croodles` / `croodles-neutral`
- `fun-emoji`
- `lorelei` / `lorelei-neutral`
- `micah`
- `miniavs`
- `notionists` / `notionists-neutral`
- `open-peeps`
- `personas`
- `pixel-art` / `pixel-art-neutral`
- `thumbs`

추상/기하학 스타일 (패턴, 얼굴 없음):
- `bottts` / `bottts-neutral`
- `dylan`
- `glass`
- `icons`
- `identicon`
- `initials`
- `rings`
- `shapes`
- `toon-head`
