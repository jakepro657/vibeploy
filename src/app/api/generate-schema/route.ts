import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { AnyFrontendAction, SchemaWithActions, ActionBlock, WorkflowSchema, ActionBlockTemplate } from '@/lib/types';

// 요청 스키마 정의
const GenerateSchemaRequest = z.object({
  description: z.string().min(1, '설명이 필요합니다.'),
  actions: z.array(z.any()).optional(),
  saveSchema: z.boolean().optional().default(false),
  schemaId: z.string().optional(),
  includeWorkflow: z.boolean().optional().default(true) // 워크플로우 생성 여부
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { description, actions, saveSchema, schemaId, includeWorkflow } = GenerateSchemaRequest.parse(body);

    // CSS 셀렉터 감지 및 추출
    const selectorInfo = extractSelectorsFromDescription(description);

    // OpenAI API를 사용한 스키마 + 프론트엔드 액션 생성
    const schemaWithActions = await generateSchemaWithOpenAI(description, actions, selectorInfo, includeWorkflow);

    // 스키마 저장 (선택사항)
    if (saveSchema && schemaId) {
      try {
        const { storeSchema } = await import('@/lib/redis');
        await storeSchema(schemaId, schemaWithActions);
      } catch (redisError) {
        console.warn('Redis 저장 실패, 계속 진행:', redisError);
      }
    }

    return NextResponse.json({
      success: true,
      data: schemaWithActions,
      metadata: {
        timestamp: new Date().toISOString(),
        description,
        schemaId: saveSchema ? schemaId : null,
        cached: false,
        detectectedSelectors: selectorInfo.detectedSelectors,
        selectorCount: selectorInfo.detectedSelectors.length,
        frontendActionsCount: schemaWithActions.frontendActions.length,
        actionBlocksCount: schemaWithActions.actionBlocks?.length || 0,
        hasWorkflow: !!schemaWithActions.workflow
      }
    });
  } catch (error) {
    console.error('스키마 생성 오류:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          success: false,
          error: '입력 데이터가 유효하지 않습니다.',
          details: error.errors
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { 
        success: false,
        error: '스키마 생성에 실패했습니다.',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// CSS 셀렉터 감지 및 추출 함수
function extractSelectorsFromDescription(description: string) {
  const selectorPatterns = [
    // CSS 클래스 셀렉터
    /\.[\w-]+/g,
    // CSS ID 셀렉터
    /#[\w-]+/g,
    // 속성 셀렉터
    /\[[\w-]+[=~|^$*]?['"]*[\w-]*['"]*\]/g,
    // 태그 셀렉터 (일반적인 HTML 태그)
    /\b(div|span|p|h[1-6]|a|img|button|input|select|textarea|ul|li|ol|table|tr|td|th|form|nav|header|footer|section|article|aside)\b/g,
    // 복합 셀렉터
    /[\w-]+\s*[>+~]\s*[\w-]+/g,
    // 의사 클래스
    /:[\w-]+(\([^)]*\))?/g
  ];

  const detectedSelectors: Array<{
    selector: string;
    type: string;
    context: string;
  }> = [];

  selectorPatterns.forEach((pattern, index) => {
    const matches = description.match(pattern);
    if (matches) {
      matches.forEach(match => {
        const type = ['class', 'id', 'attribute', 'tag', 'combinator', 'pseudo'][index];
        const context = extractContext(description, match);
        
        detectedSelectors.push({
          selector: match,
          type,
          context
        });
      });
    }
  });

  // 중복 제거
  const uniqueSelectors = detectedSelectors.filter((selector, index, self) =>
    index === self.findIndex(s => s.selector === selector.selector)
  );

  return {
    detectedSelectors: uniqueSelectors,
    hasSelectors: uniqueSelectors.length > 0
  };
}

// 셀렉터 주변 컨텍스트 추출
function extractContext(text: string, selector: string): string {
  const index = text.indexOf(selector);
  if (index === -1) return '';
  
  const start = Math.max(0, index - 50);
  const end = Math.min(text.length, index + selector.length + 50);
  
  return text.substring(start, end).trim();
}

async function generateSchemaWithOpenAI(description: string, actions?: any[], selectorInfo?: any, includeWorkflow: boolean = true): Promise<SchemaWithActions> {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  
  if (!OPENAI_API_KEY) {
    console.warn('OpenAI API 키가 없습니다. Mock 데이터를 사용합니다.');
    return generateMockSchemaWithActions(description, actions, selectorInfo, includeWorkflow);
  }

  try {
    const systemPrompt = `당신은 웹 스크래핑 워크플로우 전문가입니다. 사용자의 자연어 설명을 분석하여 다음을 생성해주세요:

1. 데이터 추출을 위한 JSON 스키마
2. 프론트엔드에서 순차적으로 실행할 액션 목록
3. 드래그 앤 드롭 가능한 액션 블록들
4. 워크플로우 구조

프론트엔드 액션 타입:
- navigate: 페이지 이동
- extract: 데이터 추출
- click: 클릭 액션
- wait: 대기 (요소, 시간, 네트워크)
- scroll: 스크롤
- input: 텍스트 입력
- select: 선택 박스
- screenshot: 스크린샷
- auth: 인증 (로그인, CAPTCHA, OTP, 쿠키 동의)
- conditional: 조건부 액션
- if: IF 분기 (조건부 실행)
- keypress: 키 입력 (Enter, Tab, Escape, 방향키, 키 조합)

액션 블록 카테고리:
- navigation: 페이지 이동 관련
- authentication: 인증 관련 (옵셔널)
- extraction: 데이터 추출 관련
- interaction: 사용자 상호작용
- utility: 유틸리티 (스크린샷, 대기 등)

다음 형식으로 응답해주세요:
{
  "schema": {
    "type": "object",
    "properties": {
      "필드명": {
        "type": "string|number|boolean|array",
        "description": "필드 설명",
        "selector": "CSS 셀렉터",
        "attribute": "textContent|innerHTML|href|src|value"
      }
    },
    "required": ["필수필드"]
  },
  "frontendActions": [
    {
      "id": "unique-id",
      "type": "navigate|extract|click|wait|scroll|input|select|screenshot|auth|conditional|if|keypress",
      "description": "액션 설명",
      "order": 1,
      "isOptional": false,
      "isEnabled": true,
      "category": "required|optional|auth|conditional",
      "selector": "CSS 셀렉터",
      "field": "추출할 필드명 (extract용)",
      "attribute": "textContent|innerHTML|href|src|value|title|alt (extract용)",
      "multiple": false,
      "authType": "login|captcha|otp|cookie_consent (auth용)",
      "selectors": {
        "username": "사용자명 셀렉터",
        "password": "비밀번호 셀렉터",
        "submit": "제출 버튼 셀렉터"
      },
      "fallbackSelectors": ["대체 셀렉터1", "대체 셀렉터2"],
      "condition": {
        "type": "element_exists|element_visible|text_contains|url_contains|value_equals|custom",
        "selector": "CSS 셀렉터",
        "text": "검색할 텍스트",
        "url": "URL 포함 텍스트",
        "value": "비교할 값",
        "customCondition": "커스텀 JavaScript 조건"
      },
      "thenActions": ["조건이 참일 때 실행할 액션들"],
      "elseActions": ["조건이 거짓일 때 실행할 액션들"],
      "key": "Enter|Tab|Escape|Space|ArrowUp|ArrowDown|a|1 (keypress용)",
      "modifiers": ["Control", "Shift", "Alt", "Meta"],
      "waitAfter": 1000
    }
  ],
  "actionBlocks": [
    {
      "id": "block-id",
      "title": "블록 제목",
      "description": "블록 설명",
      "actions": ["액션 ID들"],
      "isOptional": false,
      "isEnabled": true,
      "category": "navigation|authentication|extraction|interaction|utility",
      "position": {"x": 100, "y": 100},
      "size": {"width": 200, "height": 150}
    }
  ],
  "workflow": {
    "id": "workflow-id",
    "name": "워크플로우 이름",
    "description": "워크플로우 설명",
    "actionBlocks": ["블록 ID들"],
    "connections": [
      {
        "id": "connection-id",
        "from": "시작 블록 ID",
        "to": "끝 블록 ID",
        "condition": "success|failure|always"
      }
    ]
  },
  "metadata": {
    "totalSteps": 5,
    "estimatedTime": 30,
    "complexity": "simple|medium|complex",
    "hasOptionalBlocks": true,
    "hasAuthBlocks": true
  }
}

**중요**: 
- 인증 관련 액션은 항상 옵셔널로 설정
- 대체 셀렉터를 제공하여 로버스트한 실행 보장
- 드래그 앤 드롭을 위한 적절한 블록 위치 설정`;

    let userPrompt = `사용자 설명: "${description}"`;

    // CSS 셀렉터 정보 추가
    if (selectorInfo?.hasSelectors) {
      userPrompt += `\n\n감지된 CSS 셀렉터들:`;
      selectorInfo.detectedSelectors.forEach((sel: any) => {
        userPrompt += `\n- ${sel.selector} (${sel.type}): ${sel.context}`;
      });
      userPrompt += `\n\n위 CSS 셀렉터들을 액션과 블록에 적절히 활용해주세요.`;
    }

    if (!includeWorkflow) {
      userPrompt += `\n\n워크플로우 구조는 생성하지 말고 액션과 블록만 생성해주세요.`;
    }

    userPrompt += `\n\n위 정보를 바탕으로 드래그 앤 드롭 가능한 워크플로우를 생성해주세요.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API 오류: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      throw new Error('OpenAI 응답이 비어있습니다.');
    }

    // JSON 추출 (더 유연한 매칭)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('JSON을 찾을 수 없음, Mock 스키마 사용');
      return generateMockSchemaWithActions(description, actions, selectorInfo, includeWorkflow);
    }

    try {
      const result = JSON.parse(jsonMatch[0]);
      
      // 스키마 검증
      validateSchemaWithActions(result);
      
      return result;
    } catch (parseError) {
      console.warn('JSON 파싱 실패, Mock 스키마 사용:', parseError);
      return generateMockSchemaWithActions(description, actions, selectorInfo, includeWorkflow);
    }
  } catch (error) {
    console.error('OpenAI API 호출 실패:', error);
    return generateMockSchemaWithActions(description, actions, selectorInfo, includeWorkflow);
  }
}

function validateSchemaWithActions(result: any) {
  if (!result.schema) {
    throw new Error('schema가 누락되었습니다.');
  }
  
  if (!result.frontendActions || !Array.isArray(result.frontendActions)) {
    throw new Error('frontendActions 배열이 누락되었습니다.');
  }
  
  if (!result.metadata) {
    throw new Error('metadata가 누락되었습니다.');
  }

  // 액션 블록 검증 (선택사항)
  if (result.actionBlocks && !Array.isArray(result.actionBlocks)) {
    throw new Error('actionBlocks는 배열이어야 합니다.');
  }

  // 프론트엔드 액션 검증
  const validActionTypes = ['navigate', 'extract', 'click', 'wait', 'scroll', 'input', 'select', 'screenshot', 'auth', 'conditional'];
  for (const action of result.frontendActions) {
    if (!validActionTypes.includes(action.type)) {
      console.warn(`알 수 없는 액션 타입: ${action.type}`);
    }
    if (!action.id || !action.order) {
      console.warn('액션에 필수 필드가 누락됨:', action);
    }
  }
}

function generateMockSchemaWithActions(description: string, actions?: any[], selectorInfo?: any, includeWorkflow: boolean = true): SchemaWithActions {
  // 기본 스키마 생성
  const schema = generateBasicSchema(description, selectorInfo);
  
  // 프론트엔드 액션 생성
  const frontendActions = generateFrontendActions(description, selectorInfo, schema);
  
  // 액션 블록 생성
  const actionBlocks = generateActionBlocks(frontendActions, description);
  
  // 워크플로우 생성
  const workflow = includeWorkflow ? generateWorkflow(actionBlocks, description) : undefined;

  return {
    schema,
    frontendActions,
    actionBlocks,
    workflow,
    metadata: {
      totalSteps: frontendActions.length,
      estimatedTime: frontendActions.length * 3, // 액션당 평균 3초
      complexity: frontendActions.length > 15 ? 'complex' : frontendActions.length > 8 ? 'medium' : 'simple',
      hasOptionalBlocks: actionBlocks.some(block => block.isOptional),
      hasAuthBlocks: actionBlocks.some(block => block.category === 'authentication')
    }
  };
}

function generateBasicSchema(description: string, selectorInfo?: any) {
  const commonFields = {
    title: { 
      type: 'string', 
      description: '제목',
      selector: '.title, h1, h2, .product-title, .item-title',
      attribute: 'textContent'
    },
    price: { 
      type: 'string', 
      description: '가격',
      selector: '.price, .cost, .amount, [data-price]',
      attribute: 'textContent'
    },
    image: { 
      type: 'string', 
      description: '이미지 URL',
      selector: 'img, .image, .photo, .picture',
      attribute: 'src'
    },
    link: { 
      type: 'string', 
      description: '링크',
      selector: 'a, .link, .url',
      attribute: 'href'
    },
    description: { 
      type: 'string', 
      description: '설명',
      selector: '.description, .content, .text, p',
      attribute: 'textContent'
    }
  };

  const schema = {
    type: 'object',
    properties: {} as Record<string, any>,
    required: [] as string[]
  };

  // 설명 기반 필드 선택
  const descLower = description.toLowerCase();
  
  if (descLower.includes('제목') || descLower.includes('title')) {
    schema.properties.title = commonFields.title;
    schema.required.push('title');
  }
  
  if (descLower.includes('가격') || descLower.includes('price')) {
    schema.properties.price = commonFields.price;
  }
  
  if (descLower.includes('이미지') || descLower.includes('image')) {
    schema.properties.image = commonFields.image;
  }
  
  if (descLower.includes('링크') || descLower.includes('link')) {
    schema.properties.link = commonFields.link;
  }
  
  if (descLower.includes('설명') || descLower.includes('description')) {
    schema.properties.description = commonFields.description;
  }

  // 기본 필드 설정
  if (Object.keys(schema.properties).length === 0) {
    schema.properties.title = commonFields.title;
    schema.properties.description = commonFields.description;
    schema.required = ['title'];
  }

  // CSS 셀렉터 정보 반영
  if (selectorInfo?.hasSelectors) {
    selectorInfo.detectedSelectors.forEach((sel: any) => {
      const context = sel.context.toLowerCase();
      Object.keys(schema.properties).forEach(field => {
        if (context.includes(field) || context.includes(schema.properties[field].description.toLowerCase())) {
          schema.properties[field].selector = sel.selector;
        }
      });
    });
  }

  return schema;
}

function generateFrontendActions(description: string, selectorInfo?: any, schema?: any): AnyFrontendAction[] {
  const actions: AnyFrontendAction[] = [];
  let order = 1;

  // 1. 기본 네비게이션
  actions.push({
    id: `navigate-${order}`,
    type: 'navigate',
    description: '대상 웹사이트로 이동',
    order: order++,
    url: '{{url}}',
    waitForLoad: true
  });

  // 2. 페이지 로딩 대기
  actions.push({
    id: `wait-${order}`,
    type: 'wait',
    description: '페이지 로딩 완료 대기',
    order: order++,
    condition: 'time',
    duration: 3000
  });

  // 3. 설명 기반 액션 추가
  const descLower = description.toLowerCase();
  
  if (descLower.includes('로그인')) {
    actions.push({
      id: `input-email-${order}`,
      type: 'input',
      description: '이메일 입력',
      order: order++,
      selector: 'input[type="email"], input[name="email"], #email',
      value: '{{email}}',
      clear: true
    });
    
    actions.push({
      id: `input-password-${order}`,
      type: 'input',
      description: '비밀번호 입력',
      order: order++,
      selector: 'input[type="password"], input[name="password"], #password',
      value: '{{password}}',
      clear: true
    });
    
    actions.push({
      id: `click-login-${order}`,
      type: 'click',
      description: '로그인 버튼 클릭',
      order: order++,
      selector: 'button[type="submit"], .login-btn, #login',
      waitAfter: 2000
    });
  }

  if (descLower.includes('검색')) {
    actions.push({
      id: `input-search-${order}`,
      type: 'input',
      description: '검색어 입력',
      order: order++,
      selector: 'input[type="search"], input[name="search"], .search-input',
      value: '{{searchTerm}}',
      clear: true
    });
    
    actions.push({
      id: `click-search-${order}`,
      type: 'click',
      description: '검색 버튼 클릭',
      order: order++,
      selector: 'button[type="submit"], .search-btn, .search-button',
      waitAfter: 2000
    });
  }

  if (descLower.includes('스크롤')) {
    actions.push({
      id: `scroll-${order}`,
      type: 'scroll',
      description: '페이지 스크롤',
      order: order++,
      direction: 'down',
      distance: 1000
    });
  }

  // 4. 데이터 추출 액션들
  if (schema?.properties) {
    Object.keys(schema.properties).forEach(field => {
      const fieldInfo = schema.properties[field];
      actions.push({
        id: `extract-${field}-${order}`,
        type: 'extract',
        description: `${fieldInfo.description} 추출`,
        order: order++,
        selector: fieldInfo.selector,
        field: field,
        attribute: fieldInfo.attribute || 'textContent',
        multiple: fieldInfo.type === 'array'
      });
    });
  }

  // 5. 스크린샷 (선택사항)
  if (descLower.includes('스크린샷') || descLower.includes('screenshot')) {
    actions.push({
      id: `screenshot-${order}`,
      type: 'screenshot',
      description: '결과 스크린샷 촬영',
      order: order++,
      filename: 'result-{{timestamp}}.png'
    });
  }

  return actions;
} 

function generateActionBlocks(actions: AnyFrontendAction[], description: string): ActionBlock[] {
  const blocks: ActionBlock[] = [];
  let yPosition = 100;
  
  // 네비게이션 블록
  const navActions = actions.filter(action => action.type === 'navigate' || action.type === 'wait');
  if (navActions.length > 0) {
    blocks.push({
      id: 'nav-block',
      title: '페이지 이동',
      description: '대상 웹사이트로 이동하고 로딩을 대기합니다.',
      actions: navActions,
      isOptional: false,
      isEnabled: true,
      category: 'navigation',
      position: { x: 100, y: yPosition },
      size: { width: 200, height: 120 }
    });
    yPosition += 180;
  }

  // 인증 블록 (옵셔널)
  const authActions = actions.filter(action => 
    action.type === 'auth' || 
    (action.type === 'input' && (action.selector?.includes('password') || action.selector?.includes('email'))) ||
    (action.type === 'click' && action.selector?.includes('login'))
  );
  if (authActions.length > 0) {
    blocks.push({
      id: 'auth-block',
      title: '인증',
      description: '로그인, CAPTCHA 등 인증 단계를 처리합니다.',
      actions: authActions,
      isOptional: true,
      isEnabled: true,
      category: 'authentication',
      position: { x: 350, y: yPosition },
      size: { width: 200, height: 150 }
    });
    yPosition += 180;
  }

  // 상호작용 블록
  const interactionActions = actions.filter(action => 
    action.type === 'click' || 
    action.type === 'input' || 
    action.type === 'select' ||
    action.type === 'scroll'
  ).filter(action => !authActions.includes(action));
  
  if (interactionActions.length > 0) {
    blocks.push({
      id: 'interaction-block',
      title: '페이지 상호작용',
      description: '버튼 클릭, 텍스트 입력, 스크롤 등을 수행합니다.',
      actions: interactionActions,
      isOptional: false,
      isEnabled: true,
      category: 'interaction',
      position: { x: 100, y: yPosition },
      size: { width: 200, height: 130 }
    });
    yPosition += 180;
  }

  // 데이터 추출 블록
  const extractActions = actions.filter(action => action.type === 'extract');
  if (extractActions.length > 0) {
    blocks.push({
      id: 'extract-block',
      title: '데이터 추출',
      description: '웹페이지에서 필요한 데이터를 추출합니다.',
      actions: extractActions,
      isOptional: false,
      isEnabled: true,
      category: 'extraction',
      position: { x: 350, y: yPosition },
      size: { width: 200, height: 140 }
    });
    yPosition += 180;
  }

  // 유틸리티 블록
  const utilityActions = actions.filter(action => 
    action.type === 'screenshot' || 
    action.type === 'conditional'
  );
  if (utilityActions.length > 0) {
    blocks.push({
      id: 'utility-block',
      title: '유틸리티',
      description: '스크린샷, 조건부 액션 등을 수행합니다.',
      actions: utilityActions,
      isOptional: true,
      isEnabled: true,
      category: 'utility',
      position: { x: 100, y: yPosition },
      size: { width: 200, height: 100 }
    });
  }

  return blocks;
}

function generateWorkflow(actionBlocks: ActionBlock[], description: string): WorkflowSchema {
  const connections = [];
  
  // 순차적 연결 생성
  for (let i = 0; i < actionBlocks.length - 1; i++) {
    connections.push({
      id: `conn-${i}`,
      from: actionBlocks[i].id,
      to: actionBlocks[i + 1].id,
      condition: 'success' as const,
      label: '성공시'
    });
  }

  return {
    id: `workflow-${Date.now()}`,
    name: `${description} 워크플로우`,
    description: `${description}를 위한 자동화 워크플로우`,
    schema: {}, // 별도로 설정
    actionBlocks,
    connections,
    metadata: {
      totalSteps: actionBlocks.length,
      estimatedTime: actionBlocks.length * 10, // 블록당 평균 10초
      complexity: actionBlocks.length > 5 ? 'complex' : actionBlocks.length > 3 ? 'medium' : 'simple',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  };
} 