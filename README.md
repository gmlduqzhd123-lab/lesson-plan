# 지도안 대백과

Lesson Plan Encyclopedia — 초등·유아 교수학습과정안 검색, 브라우저 내 지도안 파일 분석, 관리자 검토 후 공개하는 정적 웹앱입니다.

- 저장소: https://github.com/gmlduqzhd123-lab/lesson-plan
- 공개 사이트: https://gmlduqzhd123-lab.github.io/lesson-plan/
- React + TypeScript + Vite / HashRouter / GitHub Pages
- 별도 서버, DB, 외부 AI API, 관리용 토큰이 필요하지 않습니다.
- 2026-10-11 교육청 자료 1,690개(교수학습과정안)를 분류하여 등록했습니다. 유아 자료는 195개입니다. 같은 수업의 서로 다른 HWP와 PDF도 각각 다운로드할 수 있습니다.
- 여수교육지원청은 게시 등록일 기준 2024~2026년 게시물 16개, 첨부 17개를 추가했습니다(2026년 2개·2025년 14개·2024년 0개). 학년·교과·단원·놀이 주제를 원문과 대조했습니다.
- 여수교육지원청 2022·2023년 게시물 1,424개에서 공개 가능한 첨부 1,721개를 추가한 뒤, 요청에 따라 교내 수업 공개·연구 운영 계획 87개와 학습지·서식·참관 서류·행사 운영계획 7개를 공개 목록과 파일에서 삭제했습니다. 수집·중복·분류·공개 제외 내역은 [2022·2023년 등록 기록](docs/YEOSU_2022_2023_IMPORT.md)을 참고하세요.
- 자료 제공자가 두 출처와 모든 요청 연도의 재배포 허락을 확인했습니다. 민감 학생 설명·식별 정보·학생 사진이 있는 자료 총 122개는 사용자 지시에 따라 공개용 PDF 텍스트 정리본으로 대체했고 원본은 비공개 보관합니다. 나머지 1,662개 파일의 원본 바이트를 보존했습니다.
- 테스트 fixture와 비공개 staging 원본은 공개 교육 자료로 등록하지 않습니다.

## 개발 및 검증

Node.js 24 LTS와 npm을 사용합니다.

```sh
npm ci
npm run dev
npm run typecheck
npm test
npm run test:admin
npm run validate
npm run build:catalog
npm run build
npm run preview
```

Vite base는 `/lesson-plan/`입니다. 자료실 주소는 `/lesson-plan/#/library`처럼 해시를 사용하므로 새로고침 시 서버 라우팅이 필요하지 않습니다. 정적 자산과 JSON은 `import.meta.env.BASE_URL`을 사용합니다. 배포 폴더는 `dist/`입니다.

선택적 로컬 브라우저 QA:

```sh
# 별도 터미널에서 먼저 npm run preview를 실행합니다.
# Windows에서는 기본 Edge 경로를 사용합니다.
# 다른 환경에서는 BROWSER_PATH를 설치된 Chromium 계열 실행 파일로 설정하세요.
node scripts/browser-qa.mjs
```

미리보기 포트가 다르면 `QA_URL`에 실제 `/lesson-plan/` 주소를 지정합니다. 브라우저 QA의 샘플 목록·파일 응답은 해당 브라우저 안에서만 대체하며 공개 데이터에 저장하지 않습니다. 결과와 화면은 무시되는 `.tmp/browser-qa/`에 저장됩니다. `QA_OUTPUT`으로 출력 폴더를 지정할 수 있습니다.

실제 ZIP → 비공개 가져오기 → 승인 → 정적 HTTP 검색·다운로드의 격리 통합 검증은 `QA_OUTPUT=.tmp/audit-local`로 브라우저 QA를 실행한 뒤 `node scripts/integration-qa.mjs`로 실행합니다. `.tmp/integration-*`에만 자료를 만들고 임시 로컬 서버를 검사 후 종료합니다. 앱 배포에는 이 서버가 필요하지 않습니다. 최신 전체 점검은 [docs/AUDIT.md](docs/AUDIT.md)를 참고하세요.

## 일반 교사: 파일 분석과 제출

1. `지도안 분석·제출` 화면에서 HWP/HWPX/PDF를 선택하거나 끌어놓습니다.
2. 학년·교과·단원·차시·주제·성취기준과 신뢰도를 확인합니다.
3. 행의 연필 버튼에서 제목, 학년, 교육과정, 학습 목표, 본문 미리보기 등을 수정합니다. **각 자료의 출처 및 이용 조건은 필수**입니다. 실제 수업 학년은 학년군과 구분해 선택합니다.
4. 원본과 미리보기의 학생 이름·연락처·사진 등 개인정보를 확인하고, 저작권과 배포 권한을 확인합니다. 원본에 개인정보가 있으면 원본을 수정한 후 다시 분석해야 합니다. 미리보기만 지워도 원본의 개인정보는 남습니다.
5. 확인 체크 후 `관리자 제출용 ZIP 다운로드`를 누릅니다. 이 단계는 공개 등록이 아닙니다.
6. 다운로드한 ZIP을 학교·관리자와 합의한 별도 방법으로 전달합니다. 사이트에는 관리자 자동 전송 기능이 없습니다.

새로고침하면 분석 목록은 사라집니다. 파일은 서버 전송이나 브라우저 영구 저장 없이 메모리에서 처리됩니다. 파일당 32MiB, 전체 원본 100MiB, 최대 30개입니다. 큰 파일은 나누어 처리하세요.

```text
submission/
  manifest.json
  records/plan-<sha256>.json
  plans/<sha256>.hwpx (또는 .hwp, .pdf)
  README.txt
```

manifest에는 원본·메타데이터 경로, 실제 파일 크기, SHA-256, 제출자 확인 선언을 기록합니다. 원본 파일명은 메타데이터에 보존하고, ZIP 내부와 공개 저장 경로는 해시 이름을 사용합니다.

## 관리자: 비공개 가져오기 → 검토 → 승인 → 게시

```sh
npm run import -- ./submission.zip
```

가져오기 명령이 출력한 `submission-...` ID를 사용합니다. 검증이 끝나면 `staging/<submission-id>/`에 원본 ZIP, 분류 JSON, 원본 파일, `REVIEW.md`가 저장됩니다. **staging과 ZIP은 .gitignore로 제외되며 가져오기만으로 public에 파일이 생기지 않습니다.**

원본과 본문 미리보기의 개인정보, 배포 허락과 이용 조건, 중복, 분류를 검토합니다. `staging/<id>/records/*.json`의 편집 가능한 분류·작성자·출처·이용 조건·미리보기는 수정할 수 있습니다. ID·해시·파일 경로·크기·원본 파일명은 바꾸지 마세요. 원본 수정이 필요하면 정리된 원본으로 새 패키지를 만들어 다시 가져옵니다.

실제로 검토한 뒤 다음 명령을 실행합니다.

```sh
npm run approve -- <submission-id> --privacy-reviewed --copyright-reviewed --reviewer "검토자 이름"
npm run validate
npm run check:duplicates
npm run build:catalog
npm run build
```

승인 명령은 검토 플래그와 검토자를 요구하고, 모든 후보의 무결성을 먼저 검사한 후에만 `records/*.json`과 `public/plans/*`를 추가합니다. 같은 SHA-256의 원본은 중복으로 거부합니다. 로컬 승인 내역은 staging의 `approval.json`에 남습니다. 플래그는 실제 검토자의 확인 기록이며, 자동 개인정보 탐지 또는 저작권 판정을 대신하지 않습니다.

마지막으로 **공개할 자료만** 검토 후 커밋·push합니다.

```sh
git status --short
git add records public/plans public/catalog/index.json
git diff --cached --check
git diff --cached --stat
git commit -m "Add reviewed lesson plans"
git push origin main
```

push 후 Actions의 `Validate and deploy GitHub Pages`가 검증·테스트·빌드·재배포를 수행합니다. Actions 배포 성공 후에만 실제 사이트 공개가 완료됩니다. 테스트에서 승인한 자료는 격리된 `.tmp` 폴더 안에만 생성합니다.

## 문서 분석 지원 범위

| 형식 | 지원 | 제한 |
|---|---|---|
| HWPX | ZIP/XML 문단 및 표 텍스트 추출, 규칙 기반 분류, 원본 보존 | 그림 OCR, 원본 표·페이지 렌더링, 암호화 문서 제외. 실제 사용자의 HWPX 원본 호환성은 별도 검증 필요 |
| HWP 5.x | OLE 컨테이너 서명 확인, 파일명 분류, 직접 입력, 원본 보존 | 본문 파서 미탑재. OLE 서명은 다른 문서에서도 사용되므로 실제 HWP 구조·암호화 여부를 보증하지 않음. 한글에서 원본 수동 확인 필요 |
| PDF | PDF 서명 확인, 파일명 분류, 직접 입력, 원본 보존·다운로드 | 브라우저 PDF 본문 자동 분석은 미지원 |
| HWP 3.x / DOCX | 미지원 | 앱이 중단되지 않고 개별 실패 사유 표시 |

분류 우선순위는 명시된 문서·표 필드 → 제목 → 파일명 → 성취기준 → 본문 키워드입니다. 신뢰도는 높음·보통·확인 필요입니다. 성취기준의 숫자로 실제 학년을 확정하지 않으며 교육과정은 명시된 경우에만 추출합니다.

[hwp.js](https://github.com/hahnlee/hwp.js)는 브라우저 파서 후보로 조사했고 Apache-2.0 라이선스임을 확인했습니다. 실제 HWP 샘플과 이 앱에서의 호환성 검증이 없으므로 첫 버전에 넣지 않았습니다. 지원한다고 표시하지 않습니다.

ZIP 처리는 입력·항목 수·선언된 크기·스트림 실제 해제 크기를 제한하고, CRC·경로·중복 경로·로컬/중앙 헤더를 확인합니다. ZIP Slip, 링크, 암호화 ZIP, 분할/ZIP64, 비허용 항목, 외부 XML 엔티티와 손상 파일을 거부합니다. 원본 연결은 SHA-256과 실제 크기로 재검증합니다.

## GitHub Pages 설정

지정된 기존 저장소의 **Settings → Pages → Build and deployment → Source → GitHub Actions**를 선택합니다. `.github/workflows/deploy.yml`은 main push와 수동 실행을 지원하고 공식 checkout/setup-node/configure-pages/upload-pages-artifact/deploy-pages를 사용합니다. Node.js 24, npm ci, 정적 검증, 목록 생성, 타입 검사, 프런트·관리자 테스트, Vite 빌드를 수행합니다.

필요 권한: `contents: read`, `pages: write`, `id-token: write`. `pages` concurrency로 배포를 직렬화합니다. 외부 백엔드나 토큰을 클라이언트에 넣지 마세요. Pages Source 설정이 안 되어 있으면 configure-pages 단계가 실패할 수 있습니다.

## 주요 파일

- `src/pages/`: 홈, 자료실, 상세정보, 분석·제출, 소개
- `src/lib/parsers/`: HWPX 추출 및 파일 분석
- `src/lib/classifier/`: 규칙 기반 분류
- `src/lib/search/`: 브라우저 검색·필터·정렬
- `src/lib/submission.ts`: 제출 ZIP 생성
- `shared/`: 프런트와 관리자 공통 메타데이터·ZIP 검증
- `scripts/`: 가져오기, 승인, 검증, 목록 생성, 중복 검사
- `records/`, `public/plans/`, `public/catalog/`: 승인된 공개 자료
- `tests/`: 생성된 fixture를 이용한 분석·보안·관리자·렌더링 검증

## 남은 개선 과제

실제 교사 HWP/HWPX 표본과 모바일 실기기 검증, HWP 본문 파서 검증, 다양한 한글 문서 레이아웃의 분류 정확도 개선, 큰 문서 Web Worker 처리, 대규모 목록의 페이지 분할, 관리자 검토 이력의 별도 보관 정책이 후속 과제입니다. 개인정보 자동 탐지는 첫 버전에 없으며 수동 검토가 필수입니다.
