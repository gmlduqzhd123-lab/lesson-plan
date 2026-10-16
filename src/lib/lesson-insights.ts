import type { Plan } from '../types';

export type LessonStage = {
  id: 'intro' | 'development' | 'wrapup';
  badge: string;
  title: string;
  duration: string;
  lines: string[];
  copyText: string;
  isSynthesized: boolean;
};

export type AiPromptOptions = {
  studentCount: number;
  groupSize: number;
  durationMinutes: number;
  focusMode: '기본 맞춤형' | '에듀테크·디지털 활용' | '배움중심·협력학습' | '수준별·기초학력 지원';
};

export type YsEduTool = {
  id: string;
  name: string;
  badge: string;
  emoji: string;
  desc: string;
  tip: string;
  url: string;
};

const gradeText = (p: Plan) =>
  p.educationLevel === '유아'
    ? '유아'
    : p.grades.length
      ? p.grades.map(g => `${g}학년`).join('·')
      : p.gradeBand || '초등';

export function buildLessonSections(p: Plan): {
  stages: LessonStage[];
  fullFlowText: string;
  isSynthesized: boolean;
} {
  const raw = (p.previewText || '').trim();
  const topicText = p.topic || p.unit || p.title;
  const unitText = p.unit || '단원 학습';
  const modelText = p.teachingModel || '배움중심 수업';
  const standards = p.standards || [];
  const objectives = p.objectives || [];
  const stdText = standards.length ? standards.join(', ') : '교과 성취기준 연계';
  const goalList = objectives.length
    ? objectives
    : [`${topicText}의 핵심 개념과 활동 방법을 이해하고 설명할 수 있다.`, `${unitText} 활동에 즐겁고 적극적으로 참여하며 배움을 실천할 수 있다.`];


  // Try parsing structured stages from previewText if it contains stage headers
  if (raw.length >= 40) {
    const introMatch = raw.match(/(?:^|\n)\s*(?:\[?도입\]?|1\.\s*도입|Ⅰ\.\s*도입|동기\s*유발)[^\n]*\n([\s\S]*?)(?=(?:\n\s*(?:\[?전개\]?|2\.\s*전개|Ⅱ\.\s*전개|활동\s*1))|$)/i);
    const devMatch = raw.match(/(?:^|\n)\s*(?:\[?전개\]?|2\.\s*전개|Ⅱ\.\s*전개|활동\s*1)[^\n]*\n([\s\S]*?)(?=(?:\n\s*(?:\[?정리\]?|3\.\s*정리|Ⅲ\.\s*정리|평가\s*계획))|$)/i);
    const wrapMatch = raw.match(/(?:^|\n)\s*(?:\[?정리\]?|3\.\s*정리|Ⅲ\.\s*정리|평가\s*계획)[^\n]*\n([\s\S]*?)$/i);

    if (introMatch || devMatch || wrapMatch) {
      const toLines = (txt?: string, fallback?: string[]) => {
        const cleaned = (txt || '')
          .split(/\r?\n/)
          .map(l => l.trim())
          .filter(Boolean);
        return cleaned.length ? cleaned.slice(0, 12) : (fallback || []);
      };
      const introLines = toLines(introMatch?.[1], [`동기유발: ${topicText} 관련 경험 나누기`, `학습목표: ${goalList[0]}`]);
      const devLines = toLines(devMatch?.[1], [raw.slice(0, 300)]);
      const wrapLines = toLines(wrapMatch?.[1], ['배운 내용 한 줄 정리 및 소감 나누기', `성취기준(${stdText}) 도달 여부 확인`]);

      const stages: LessonStage[] = [
        {
          id: 'intro',
          badge: '도입',
          title: '동기유발 및 학습문제 확인',
          duration: '5분',
          lines: introLines,
          copyText: `[도입 - 동기유발 및 학습문제 확인 (5분)]\n${introLines.map(l => `• ${l}`).join('\n')}`,
          isSynthesized: false,
        },
        {
          id: 'development',
          badge: '전개',
          title: '핵심 탐구 및 주요 학습 활동',
          duration: '30분',
          lines: devLines,
          copyText: `[전개 - 핵심 탐구 및 주요 학습 활동 (30분)]\n${devLines.map(l => `• ${l}`).join('\n')}`,
          isSynthesized: false,
        },
        {
          id: 'wrapup',
          badge: '정리·평가',
          title: '배움 정리 및 과정중심 평가',
          duration: '5분',
          lines: wrapLines,
          copyText: `[정리·평가 - 배움 정리 및 과정중심 평가 (5분)]\n${wrapLines.map(l => `• ${l}`).join('\n')}`,
          isSynthesized: false,
        },
      ];
      return {
        stages,
        fullFlowText: `[${gradeText(p)} ${p.subject}] ${p.title}\n단원: ${unitText}${p.lessonNumber ? ` (${p.lessonNumber})` : ''}\n학습주제: ${topicText}\n\n${stages.map(s => s.copyText).join('\n\n')}`,
        isSynthesized: false,
      };
    }
  }

  // Synthesize classroom-ready structured stages from metadata (and include raw preview snippet if any)
  const introLines = [
    `[동기유발] 일상 경험·시각 자료를 활용해 ‘${topicText}’에 대한 호기심 질문 던지기`,
    `[학습문제] ${goalList[0]}`,
    `[학습안내] ${modelText} 절차에 따른 오늘의 주요 활동 순서 안내하기`,
  ];

  const devLines = [
    `[활동 1] 기본 탐색 — ‘${unitText}’ 관련 핵심 개념·원리 찾아보기`,
    `[활동 2] 협력·실천 — 모둠 또는 짝과 함께 ‘${topicText}’ 해결 과업 수행하기`,
    `[활동 3] 표현·공유 — 활동 산출물을 발표하고 서로의 아이디어에 피드백 나누기`,
    ...(raw ? [`[본문 발췌] ${raw.replace(/\s+/g, ' ').slice(0, 180)}${raw.length > 180 ? '…' : ''}`] : []),
  ];

  const wrapLines = [
    `[배움정리] 오늘 수업에서 알게 된 점과 느낀 점을 핵심 키워드로 한 줄 요약하기`,
    `[형성평가] 성취기준(${stdText}) 연계 관찰·산출물·자기평가 체크리스트 점검`,
    `[차시예고] 다음 차시 학습 안내 및 가정·생활 속 실천 과제 연결하기`,
  ];

  const stages: LessonStage[] = [
    {
      id: 'intro',
      badge: '도입',
      title: '동기유발 및 학습문제 확인',
      duration: '5~7분',
      lines: introLines,
      copyText: `[도입 - 동기유발 및 학습문제 확인 (5~7분)]\n${introLines.map(l => `• ${l}`).join('\n')}`,
      isSynthesized: !raw,
    },
    {
      id: 'development',
      badge: '전개',
      title: `${modelText} 중심 핵심 활동 (활동 1·2·3)`,
      duration: '25~28분',
      lines: devLines,
      copyText: `[전개 - ${modelText} 중심 핵심 활동 (25~28분)]\n${devLines.map(l => `• ${l}`).join('\n')}`,
      isSynthesized: !raw,
    },
    {
      id: 'wrapup',
      badge: '정리·평가',
      title: '배움 성찰 및 과정중심 평가 계획',
      duration: '5~7분',
      lines: wrapLines,
      copyText: `[정리·평가 - 배움 성찰 및 과정중심 평가 (5~7분)]\n${wrapLines.map(l => `• ${l}`).join('\n')}`,
      isSynthesized: !raw,
    },
  ];

  return {
    stages,
    fullFlowText: `[${gradeText(p)} ${p.subject} 교수학습과정안 흐름]\n• 자료명: ${p.title}\n• 단원/차시: ${unitText}${p.lessonNumber ? ` (${p.lessonNumber})` : ''}\n• 학습주제: ${topicText}\n• 성취기준: ${stdText}\n\n${stages.map(s => s.copyText).join('\n\n')}`,
    isSynthesized: !raw,
  };
}

export function buildAiPrompt(p: Plan, options: AiPromptOptions): string {
  const grade = gradeText(p);
  const unitText = p.unit || '단원 미분류';
  const topicText = p.topic || p.title;
  const standardsText = p.standards.length ? p.standards.join(', ') : '해당 학년·교과 성취기준 자동 매칭';
  const objectivesText = p.objectives.length ? p.objectives.join(' / ') : `${topicText} 관련 지식·이해, 과정·기능, 가치·태도 통합 목표`;
  const modelText = p.teachingModel || '교과 특성에 맞는 학생 주도형 수업 모형';
  const groupCount = Math.max(1, Math.round(options.studentCount / Math.max(1, options.groupSize)));

  const focusGuide: Record<AiPromptOptions['focusMode'], string> = {
    '기본 맞춤형': '교실 현장에서 별도 복잡한 준비물 없이도 바로 실행할 수 있는 명확한 발문과 활동지 중심 수업으로 구성해 주세요.',
    '에듀테크·디지털 활용': '전자칠판, 태블릿, 패들렛/캔바 또는 교육용 미니 웹앱·게임을 활동 2~3에 자연스럽게 결합해 학생 참여도를 높여 주세요.',
    '배움중심·협력학습': '모둠원 각자에게 역할(기록자, 발표자, 배려자, 나눔이 등)을 부여하고 토의·토론과 상호 피드백이 살아있는 협력 수업으로 구성해 주세요.',
    '수준별·기초학력 지원': '느린 학습자를 위한 비계(Scaffolding) 힌트 자료와 빠른 학습자를 위한 심화 확장 과제를 각 활동마다 함께 제시해 주세요.',
  };

  return `당신은 대한민국 ${p.educationLevel === '유아' ? '유치원·유아교육' : '초등학교'} 수업 설계 및 공개수업 컨설팅 전문가입니다.
아래 「지도안 대백과」의 기준 지도안 정보를 바탕으로, 우리 반 실정에 딱 맞게 재구성한 **교수학습과정안(본시 세안 표)**을 작성해 주세요.

[1. 기준 지도안 정보]
• 대상/교과: ${grade} ${p.subject}
• 단원명: ${unitText}${p.lessonNumber ? ` (${p.lessonNumber}차시)` : ''}
• 학습 주제: ${topicText}
• 성취기준: ${standardsText}
• 학습 목표: ${objectivesText}
• 적용 수업모형: ${modelText}
${p.previewText ? `• 원본 핵심 내용 요약:\n${p.previewText.slice(0, 500)}\n` : ''}
[2. 우리 학급 맞춤형 조건]
• 학급 인원: 총 ${options.studentCount}명 (${options.groupSize}명씩 ${groupCount}모둠 구성)
• 수업 시간: ${options.durationMinutes}분 기준
• 재구성 중점 방향: [${options.focusMode}] ${focusGuide[options.focusMode]}

[3. 작성 요청 항목]
1) **본시 교수학습과정안**: [단계(도입-전개-정리) | 학습과정 | 교수학습 활동(교사 핵심 발문 T / 학생 예상 반응 S) | 시간(분) | 자료(★) 및 유의점(※)] 5열 표 형식
2) **칠판 판서 및 화면 구성 계획**: 전자칠판·칠판 한눈에 보기 레이아웃
3) **과정중심 평가 계획**: 성취기준(${standardsText})에 따른 평가 요소 및 상·중·하 3단계 루브릭`;
}

export function getRecommendedYsTools(p: Plan): YsEduTool[] {
  const tools: YsEduTool[] = [];
  const subj = p.subject;
  const hay = `${p.title} ${p.unit} ${p.topic} ${p.keywords.join(' ')}`;

  if (subj === '수학' || /분수|도형|연산|덧셈|뺄셈|곱셈|나눗셈|방정식|규칙/.test(hay)) {
    tools.push({
      id: 'math-survival',
      name: '매쓰 서바이벌 (Math Survival)',
      badge: '수학 수업 웹앱',
      emoji: '🌍',
      desc: '초등 1~6학년 수학 문제를 풀며 몬스터·보스를 물리치는 서바이벌 게임 · 학습 결과 분석 지원',
      tip: '전개 [활동 3]이나 정리 단계 형성평가 대신 5분간 모둠·개인 챌린지로 활용하면 집중도가 최고조에 달합니다.',
      url: 'https://gmlduqzhd123-lab.github.io/Math-Survival/',
    });
  }

  if (subj === '사회' || /역사|문화유산|조선|고려|삼국|독립|인물|고장|지역|여수/.test(hay)) {
    tools.push({
      id: 'history-quest',
      name: '역사 탐험 퀘스트',
      badge: '사회·역사 웹앱',
      emoji: '🧭',
      desc: '초등 사회(역사) 자기주도 학습 · 유물 탐정부터 핵심 한 줄 정리까지 퀘스트로 완수',
      tip: '시대별 유물·인물 탐색 활동이나 단원 마무리 골든벨 대체 활동으로 바로 투입해 보세요.',
      url: 'https://gmlduqzhd123-lab.github.io/History/',
    });
  }

  if (subj === '체육' || /경쟁|도전|표현|달리기|피구|배드민턴|체력|운동/.test(hay)) {
    tools.push({
      id: 'asian-game',
      name: '엽쌤의 아시안게임 체육 수업',
      badge: '체육 리드업 도구',
      emoji: '🏆',
      desc: '아시안게임 종목을 교실·강당용 리드업 게임으로 재구성한 체육 수업 도구 (준비운동·미션·기록)',
      tip: '도입 준비운동 타이머부터 전개 모둠별 미션 기록판까지 강당·교실 화면에 띄워두고 진행하세요.',
      url: 'https://gmlduqzhd123-lab.github.io/Asian-Game/',
    });
    tools.push({
      id: 'physical-expedition',
      name: '땀방울 원정대',
      badge: '건강체력 웹앱',
      emoji: '💦',
      desc: '학생들과 함께 운동 미션을 달성하며 체력을 기르는 참여형 체육 수업 웹앱',
      tip: '준비운동 루틴이나 체력 단원 자기주도 운동 기록용으로 활용하기 좋습니다.',
      url: 'https://physical-pi.vercel.app/',
    });
  }

  if (subj === '음악' || /합창|노래|리듬|화음|아카펠라|악기/.test(hay)) {
    tools.push({
      id: 'acapella',
      name: '우리 함께 아카펠라',
      badge: '음악 창작 웹앱',
      emoji: '🎤',
      desc: '파트별로 녹음·반복 재생해 우리 반만의 화음과 아카펠라를 완성하는 음악 수업 도구',
      tip: '모둠별 화음 쌓기 실습이나 성부별 음정 익히기 활동에 마이크만 연결해 바로 사용하세요.',
      url: 'https://gmlduqzhd123-lab.github.io/Acapella/',
    });
  }

  if (subj === '실과' || /요리|음식|조리|식생활|영양|간식/.test(hay)) {
    tools.push({
      id: 'cooking-encyclopedia',
      name: '요리 대백과 215선',
      badge: '실과 실습 웹앱',
      emoji: '📖',
      desc: '실과 교과 요리부터 실습 레시피까지 재료 검색, 단계별 요리 모드, 영상 가이드를 한 번에 제공',
      tip: '모둠별 조리 실습 계획 세우기 차시에서 학생들이 직접 재료와 조리 순서를 탐색하게 해보세요.',
      url: 'https://gmlduqzhd123-lab.github.io/cooking-/',
    });
  }

  // Always include 100 Learning Games Hub & HWP Lesson Report Assistant & Teacher Whitepaper to fill up to 3 tools
  const commonTools: YsEduTool[] = [
    {
      id: 'learning-games-100',
      name: '엽쌤스쿨 100종 배움게임월드',
      badge: '2022 개정 단원 매핑',
      emoji: '🎮',
      desc: `국어·수학·사회·과학·영어·안전·디지털 리터러시 100종 HTML 학습게임 (${gradeText(p)} ${subj} 연계)`,
      tip: '도입 3분 동기유발이나 정리 단계 핵심 개념 복습 게임으로 QR코드로 학생 태블릿에 바로 공유할 수 있습니다.',
      url: 'https://ysschool.vercel.app/showcase',
    },
    {
      id: 'hwp-finisher',
      name: '한글 마감실 (HWPX 세안·보고서 도우미)',
      badge: '수업문서 자동화',
      emoji: '📄',
      desc: '줄글 초안이나 수업 흐름을 넣으면 연구대회 보고서·공개수업 세안 HWPX 서식을 잡아주는 도구',
      tip: '위 AI 재구성 프롬프트로 만든 수업안을 한글 마감실에 붙여넣어 깔끔한 문서로 완성해 보세요.',
      url: 'https://gmlduqzhd123-lab.github.io/Hwp/',
    },
    {
      id: 'for-teacher',
      name: '교직백서 1000 & 교실 타이머·룰렛',
      badge: '학급운영 종합도구',
      emoji: '📚',
      desc: '수업 타이머·종 알림, 랜덤 발표자·모둠 배치, 생기부 문장 도우미를 한곳에 모은 교사 필수 앱',
      tip: '공개수업 중 모둠 활동 제한시간 타이머와 무작위 발표 모둠 뽑기 도구를 전자칠판에 함께 띄워두세요.',
      url: 'https://gmlduqzhd123-lab.github.io/For-Teacher/',
    },
  ];

  for (const item of commonTools) {
    if (tools.length >= 3) break;
    if (!tools.some(t => t.id === item.id)) tools.push(item);
  }

  return tools.slice(0, 3);
}
