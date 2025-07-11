import { NextRequest, NextResponse } from 'next/server';

// 워크플로우 세션 저장소 (실제로는 Redis나 DB 사용 권장)
const workflowSessions = new Map<string, {
  sessionId: string;
  status: 'running' | 'paused' | 'completed' | 'failed';
  currentActionIndex: number;
  actions: any[];
  schema: any;
  parameters: Record<string, any>;
  extractedData: Record<string, any>;
  executionLog: string[];
  pausedAt: Date;
  waitingFor?: {
    type: 'auth_verify' | 'user_input';
    actionId: string;
    message: string;
    inputFields: Array<{
      name: string;
      type: string;
      label: string;
      required: boolean;
    }>;
  };
}>();

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body = await request.json();
    const { 
      url, 
      apiKey, 
      schemaId, 
      actions = [], 
      schema = null,
      parameters = {},
      executeWorkflow = false,
      sessionId = null, // 재개할 세션 ID
      sessionAction = null, // 'resume', 'provide_input'
      sessionData = {} // 세션 재개 시 추가 데이터
    } = body;

    // 세션 재개 처리
    if (sessionId && sessionAction) {
      return await handleSessionAction(sessionId, sessionAction, sessionData);
    }

    // 기본 입력 검증
    if (!url) {
      return NextResponse.json(
        { 
          success: false,
          error: 'URL이 필요합니다.'
        },
        { status: 400 }
      );
    }

    // URL 형식 검증
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { 
          success: false,
          error: '올바른 URL 형식이 아닙니다.'
        },
        { status: 400 }
      );
    }

    // API 키 인증 (선택사항)
    if (apiKey) {
      try {
        const isValidKey = await validateApiKey(apiKey);
        if (!isValidKey) {
          return NextResponse.json(
            { 
              success: false,
              error: '유효하지 않은 API 키입니다.'
            },
            { status: 401 }
          );
        }
      } catch (error) {
        console.warn('API 키 검증 실패:', error);
        // Redis가 없어도 계속 진행
      }
    }

    // 스키마 정보 조회 (선택사항)
    let schemaInfo = null;
    if (schemaId) {
      try {
        const { getSchema } = await import('@/lib/redis');
        schemaInfo = await getSchema(schemaId);
      } catch (error) {
        console.warn('스키마 조회 실패:', error);
      }
    }

    let extractedData = null;
    let executionResult = null;

    // 실제 워크플로우 실행
    if (executeWorkflow && actions.length > 0) {
      try {
        console.log('워크플로우 실행 시작:', { url, actionsCount: actions.length });
        
        // 새 세션 생성
        const newSessionId = generateSessionId();
        
        executionResult = await executeWorkflowWithPlaywright(
          url, 
          actions, 
          schema, 
          parameters, 
          newSessionId
        );
        
        extractedData = executionResult.data;
        console.log('워크플로우 실행 완료:', { success: true, dataKeys: Object.keys(extractedData || {}) });
      } catch (error) {
        console.error('워크플로우 실행 오류 상세:', {
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
          url,
          actionsCount: actions.length
        });
        
        // 일시정지된 워크플로우인지 확인
        if (error instanceof WorkflowPausedException) {
          return NextResponse.json({
            success: false,
            status: 'paused',
            message: '워크플로우가 사용자 입력을 기다리고 있습니다.',
            sessionId: error.sessionId,
            waitingFor: error.waitingFor,
            executionLog: error.executionLog
          });
        }
        
        return NextResponse.json(
          { 
            success: false,
            error: '워크플로우 실행에 실패했습니다.',
            details: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined
          },
          { status: 500 }
        );
      }
    }

    const executionTime = Date.now() - startTime;

    // 성공 응답
    return NextResponse.json({
      success: true,
      status: executeWorkflow ? 'completed' : 'ready',
      message: executeWorkflow ? '워크플로우가 성공적으로 실행되었습니다.' : '검증 완료. 워크플로우 실행 준비됨.',
      data: extractedData || {
        url,
        parameters,
        timestamp: new Date().toISOString(),
        executionTime: `${executionTime}ms`,
        schemaInfo: schemaInfo || null,
        readyForExecution: true
      },
      executionResult,
      metadata: {
        authenticated: !!apiKey,
        schemaLoaded: !!schemaInfo,
        parametersReceived: Object.keys(parameters).length,
        actionsCount: actions.length,
        processingTime: executionTime,
        workflowExecuted: executeWorkflow
      }
    });

  } catch (error) {
    console.error('API 오류:', error);
    return NextResponse.json(
      { 
        success: false,
        error: '서버 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// 세션 액션 처리
async function handleSessionAction(sessionId: string, action: string, data: any) {
  const session = workflowSessions.get(sessionId);
  
  if (!session) {
    return NextResponse.json(
      { 
        success: false,
        error: '유효하지 않은 세션 ID입니다.'
      },
      { status: 404 }
    );
  }

  switch (action) {
    case 'get_status':
      return NextResponse.json({
        success: true,
        status: session.status,
        waitingFor: session.waitingFor,
        executionLog: session.executionLog.slice(-10) // 최근 10개 로그만
      });

    case 'provide_input':
      if (session.status !== 'paused') {
        return NextResponse.json(
          { 
            success: false,
            error: '워크플로우가 일시정지 상태가 아닙니다.'
          },
          { status: 400 }
        );
      }

      // 입력 데이터를 세션에 추가
      session.parameters = { ...session.parameters, ...data.inputs };
      session.status = 'running';
      session.waitingFor = undefined;

      try {
        // 워크플로우 재개
        const result = await resumeWorkflow(session);
        
        if (result.paused) {
          return NextResponse.json({
            success: false,
            status: 'paused',
            message: '워크플로우가 추가 입력을 기다리고 있습니다.',
            sessionId: sessionId,
            waitingFor: result.waitingFor,
            executionLog: result.executionLog
          });
        }

        return NextResponse.json({
          success: true,
          status: 'completed',
          message: '워크플로우가 성공적으로 완료되었습니다.',
          data: result.data,
          executionLog: result.executionLog
        });

      } catch (error) {
        session.status = 'failed';
        return NextResponse.json(
          { 
            success: false,
            error: '워크플로우 재개에 실패했습니다.',
            details: error instanceof Error ? error.message : 'Unknown error'
          },
          { status: 500 }
        );
      }

    case 'cancel':
      session.status = 'failed';
      workflowSessions.delete(sessionId);
      return NextResponse.json({
        success: true,
        message: '워크플로우가 취소되었습니다.'
      });

    default:
      return NextResponse.json(
        { 
          success: false,
          error: '지원하지 않는 세션 액션입니다.'
        },
        { status: 400 }
      );
  }
}

// 워크플로우 일시정지 예외 클래스
class WorkflowPausedException extends Error {
  constructor(
    public sessionId: string,
    public waitingFor: any,
    public executionLog: string[]
  ) {
    super('워크플로우가 일시정지되었습니다.');
    this.name = 'WorkflowPausedException';
  }
}

// 세션 ID 생성
function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// 워크플로우 재개
async function resumeWorkflow(session: any) {
  console.log('워크플로우 재개:', session.sessionId);
  
  try {
    // Playwright 브라우저 재시작 (실제로는 세션을 유지하는 것이 좋음)
    const { chromium } = await import('playwright');
    const browser = await chromium.launch({ 
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    });
    
    const page = await context.newPage();
    
    // 현재 액션부터 재개
    const remainingActions = session.actions.slice(session.currentActionIndex);
    
    for (let i = 0; i < remainingActions.length; i++) {
      const action = remainingActions[i];
      session.currentActionIndex = session.currentActionIndex + i;
      
      if (!action.isEnabled) {
        session.executionLog.push(`⏭️ 액션 건너뜀: ${action.description} (비활성화됨)`);
        continue;
      }
      
      try {
        await executeAction(page, action, session.parameters, session.extractedData, session.executionLog, session.sessionId);
      } catch (actionError) {
        if (actionError instanceof WorkflowPausedException) {
          // 다시 일시정지됨
          await browser.close();
          return {
            paused: true,
            waitingFor: actionError.waitingFor,
            executionLog: actionError.executionLog
          };
        }
        
        session.executionLog.push(`❌ 액션 실패: ${action.description} - ${actionError}`);
        
        if (!action.isOptional) {
          throw new Error(`필수 액션 실패: ${action.description}`);
        }
      }
    }
    
    await browser.close();
    
    // 완료 처리
    session.status = 'completed';
    workflowSessions.delete(session.sessionId);
    
    return {
      paused: false,
      data: session.extractedData,
      executionLog: session.executionLog
    };
    
  } catch (error) {
    session.status = 'failed';
    throw error;
  }
}

async function executeWorkflowWithPlaywright(
  url: string, 
  actions: any[], 
  schema: any = null, 
  parameters: Record<string, any> = {},
  sessionId: string
) {
  console.log('Playwright 브라우저 시작 시도...');
  
  // 세션 생성
  const session = {
    sessionId,
    status: 'running' as 'running' | 'paused' | 'completed' | 'failed',
    currentActionIndex: 0,
    actions,
    schema,
    parameters,
    extractedData: {} as Record<string, any>,
    executionLog: [] as string[],
    pausedAt: new Date()
  };
  
  workflowSessions.set(sessionId, session);
  
  let browser: any = null;
  
  try {
    const { chromium } = await import('playwright');
    browser = await chromium.launch({ 
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    console.log('✅ Playwright 브라우저 시작 성공');
  } catch (error) {
    console.error('❌ Playwright 브라우저 시작 실패:', error);
    
    // 동적 import로 재시도
    try {
      console.log('동적 import로 Playwright 재시도...');
      const playwright = await import('playwright');
      browser = await playwright.chromium.launch({ 
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      console.log('✅ 동적 import로 Playwright 브라우저 시작 성공');
    } catch (retryError) {
      console.error('❌ 동적 import도 실패:', retryError);
      throw new Error(`Playwright 초기화 실패: ${retryError}`);
    }
  }
  
  try {
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    });
    
    const page = await context.newPage();
    
    // 초기 페이지 로드
    console.log('초기 페이지 로드:', url);
    await page.goto(url);
    session.executionLog.push(`✅ 초기 페이지 로드: ${url}`);
    
    // 액션들을 순서대로 실행
    const sortedActions = actions.sort((a, b) => (a.order || 0) - (b.order || 0));
    
    for (let i = 0; i < sortedActions.length; i++) {
      const action = sortedActions[i];
      session.currentActionIndex = i;
      
      if (!action.isEnabled) {
        session.executionLog.push(`⏭️ 액션 건너뜀: ${action.description} (비활성화됨)`);
        continue;
      }
      
      try {
        await executeAction(page, action, session.parameters, session.extractedData, session.executionLog, sessionId);
      } catch (actionError) {
        if (actionError instanceof WorkflowPausedException) {
          // 워크플로우 일시정지
          await browser.close();
          throw actionError;
        }
        
        session.executionLog.push(`❌ 액션 실패: ${action.description} - ${actionError}`);
        
        // 옵셔널 액션이 아닌 경우 실행 중단
        if (!action.isOptional) {
          throw new Error(`필수 액션 실패: ${action.description}`);
        }
      }
    }
    
    await browser.close();
    
    // 완료 처리
    session.status = 'completed';
    workflowSessions.delete(sessionId);
    
    console.log('워크플로우 실행 완료');
    
    return {
      success: true,
      data: session.extractedData,
      executionLog: session.executionLog,
      metadata: {
        totalActions: actions.length,
        completedActions: session.currentActionIndex + 1,
        executionTime: Date.now() - session.pausedAt.getTime()
      }
    };
    
  } catch (error) {
    if (browser) {
      await browser.close();
    }
    
    if (error instanceof WorkflowPausedException) {
      throw error; // 일시정지 예외는 그대로 전파
    }
    
    session.status = 'failed';
    throw error;
  }
}

async function executeAction(
  page: any, 
  action: any, 
  parameters: Record<string, any>, 
  extractedData: Record<string, any>,
  executionLog: string[],
  sessionId: string
) {
  const { type, selector, description } = action;
  
  switch (type) {
    case 'navigate':
      const targetUrl = action.url || parameters.url || page.url();
      await page.goto(targetUrl);
      executionLog.push(`✅ 페이지 이동: ${targetUrl}`);
      break;
      
    case 'wait':
      if (action.selector) {
        await page.waitForSelector(action.selector, { timeout: action.timeout || 30000 });
        executionLog.push(`✅ 요소 대기: ${action.selector}`);
      } else if (action.duration) {
        await page.waitForTimeout(action.duration);
        executionLog.push(`✅ 시간 대기: ${action.duration}ms`);
      }
      break;
      
    case 'click':
      const clickElement = await page.locator(selector).first();
      await clickElement.click();
      executionLog.push(`✅ 클릭: ${selector}`);
      if (action.waitAfter) {
        await page.waitForTimeout(action.waitAfter);
      }
      break;
      
    case 'input':
      const inputElement = await page.locator(selector).first();
      let inputValue = action.value;
      
      // 파라미터 사용 여부 확인
      if (action.useParameter && action.parameterName && parameters[action.parameterName]) {
        inputValue = parameters[action.parameterName];
      } else if (action.parameterName && parameters[action.parameterName]) {
        inputValue = parameters[action.parameterName];
      }
      
      if (action.clear) {
        await inputElement.clear();
      }
      await inputElement.fill(inputValue || '');
      executionLog.push(`✅ 텍스트 입력: ${selector} = ${inputValue}`);
      break;
      
    case 'extract':
      await executeExtractAction(page, action, extractedData, executionLog);
      break;
      
    case 'scroll':
      await page.evaluate((distance: number) => {
        window.scrollBy(0, distance);
      }, action.distance || 500);
      executionLog.push(`✅ 스크롤: ${action.distance || 500}px`);
      break;
      
    case 'screenshot':
      const screenshotPath = action.filename || `screenshot-${Date.now()}.png`;
      await page.screenshot({ path: screenshotPath });
      executionLog.push(`✅ 스크린샷: ${screenshotPath}`);
      break;
      
    case 'auth':
      // 인증 관련 액션은 수동 개입이 필요할 수 있음
      executionLog.push(`⚠️ 인증 액션: ${description} (수동 개입 필요할 수 있음)`);
      break;
      
    case 'if':
      await executeIfAction(page, action, parameters, extractedData, executionLog, sessionId);
      break;
      
    case 'keypress':
      await executeKeypressAction(page, action, executionLog);
      break;
      
    case 'option_select':
      await executeOptionSelectAction(page, action, parameters, executionLog);
      break;
      
    case 'auth_verify':
      await executeAuthVerifyAction(page, action, parameters, executionLog, sessionId);
      break;
      
    case 'api_call':
      await executeApiCallAction(page, action, parameters, extractedData, executionLog, sessionId);
      break;
      
    case 'popup_switch':
      await executePopupSwitchAction(page, action, parameters, executionLog, sessionId);
      break;
      
    default:
      executionLog.push(`⚠️ 알 수 없는 액션 타입: ${type}`);
  }
}

async function executeExtractAction(
  page: any,
  action: any,
  extractedData: Record<string, any>,
  executionLog: string[]
) {
  const { selector, field, attribute = 'textContent', multiple = false, fallbackSelectors = [] } = action;
  
  if (!selector || !field) {
    executionLog.push(`❌ 추출 액션 오류: 셀렉터 또는 필드명이 없습니다.`);
    return;
  }
  
  const selectorsToTry = [selector, ...fallbackSelectors];
  let extractedValue = null;
  let usedSelector = '';
  
  for (const currentSelector of selectorsToTry) {
    try {
      const elements = await page.locator(currentSelector);
      const elementCount = await elements.count();
      
      if (elementCount === 0) {
        executionLog.push(`⚠️ 요소를 찾을 수 없음: ${currentSelector}`);
        continue;
      }
      
      usedSelector = currentSelector;
      
      if (multiple) {
        // 여러 요소 추출
        const values = [];
        for (let i = 0; i < elementCount; i++) {
          const element = elements.nth(i);
          let value = '';
          
          switch (attribute) {
            case 'textContent':
              value = await element.textContent() || '';
              break;
            case 'innerHTML':
              value = await element.innerHTML() || '';
              break;
            case 'href':
              value = await element.getAttribute('href') || '';
              break;
            case 'src':
              value = await element.getAttribute('src') || '';
              break;
            case 'value':
              value = await element.inputValue() || '';
              break;
            case 'title':
              value = await element.getAttribute('title') || '';
              break;
            case 'alt':
              value = await element.getAttribute('alt') || '';
              break;
            default:
              value = await element.getAttribute(attribute) || '';
          }
          
          if (value.trim()) {
            values.push(value.trim());
          }
        }
        extractedValue = values;
      } else {
        // 단일 요소 추출
        const element = elements.first();
        
        switch (attribute) {
          case 'textContent':
            extractedValue = await element.textContent() || '';
            break;
          case 'innerHTML':
            extractedValue = await element.innerHTML() || '';
            break;
          case 'href':
            extractedValue = await element.getAttribute('href') || '';
            break;
          case 'src':
            extractedValue = await element.getAttribute('src') || '';
            break;
          case 'value':
            extractedValue = await element.inputValue() || '';
            break;
          case 'title':
            extractedValue = await element.getAttribute('title') || '';
            break;
          case 'alt':
            extractedValue = await element.getAttribute('alt') || '';
            break;
          default:
            extractedValue = await element.getAttribute(attribute) || '';
        }
        
        if (extractedValue) {
          extractedValue = extractedValue.trim();
        }
      }
      
      break; // 성공하면 루프 종료
    } catch (error) {
      executionLog.push(`⚠️ 셀렉터 시도 실패: ${currentSelector} - ${error}`);
      continue;
    }
  }
  
  if (extractedValue !== null) {
    extractedData[field] = extractedValue;
    const valuePreview = multiple 
      ? `[${extractedValue.length}개 항목]` 
      : extractedValue.toString().substring(0, 50) + (extractedValue.toString().length > 50 ? '...' : '');
    executionLog.push(`✅ 데이터 추출 성공: ${field} = ${valuePreview} (셀렉터: ${usedSelector})`);
  } else {
    executionLog.push(`❌ 데이터 추출 실패: ${field} - 모든 셀렉터에서 데이터를 찾을 수 없습니다.`);
  }
}

async function executeKeypressAction(
  page: any,
  action: any,
  executionLog: string[]
) {
  const { key, selector, modifiers = [], waitAfter, description } = action;
  
  if (!key) {
    executionLog.push(`❌ 키 입력 액션 오류: 키가 지정되지 않았습니다.`);
    return;
  }
  
  try {
    // 특정 요소에 포커스 (선택사항)
    if (selector) {
      const element = await page.locator(selector).first();
      if (await element.isVisible()) {
        await element.focus();
        executionLog.push(`✅ 요소 포커스: ${selector}`);
      } else {
        executionLog.push(`⚠️ 요소를 찾을 수 없어 전체 페이지에 키 입력: ${selector}`);
      }
    }
    
    // 키 입력 실행
    if (modifiers.length > 0) {
      // 수정자 키와 함께 입력 (예: Ctrl+A, Shift+Tab)
      const modifierString = modifiers.join('+');
      const fullKey = `${modifierString}+${key}`;
      await page.keyboard.press(fullKey);
      executionLog.push(`✅ 키 조합 입력: ${fullKey}`);
    } else {
      // 단일 키 입력
      await page.keyboard.press(key);
      executionLog.push(`✅ 키 입력: ${key}`);
    }
    
    // 대기 시간 (옵션)
    if (waitAfter) {
      await page.waitForTimeout(waitAfter);
      executionLog.push(`✅ 키 입력 후 대기: ${waitAfter}ms`);
    }
    
  } catch (error) {
    executionLog.push(`❌ 키 입력 실패: ${description || key} - ${error}`);
    throw error;
  }
}

async function executeIfAction(
  page: any,
  action: any,
  parameters: Record<string, any>,
  extractedData: Record<string, any>,
  executionLog: string[],
  sessionId: string
) {
  const { condition, thenActions = [], elseActions = [], description } = action;
  
  try {
    let conditionResult = false;
    
    switch (condition.type) {
      case 'element_exists':
        if (condition.selector) {
          const element = await page.locator(condition.selector).first();
          conditionResult = await element.count() > 0;
        }
        break;
        
      case 'element_visible':
        if (condition.selector) {
          const element = await page.locator(condition.selector).first();
          conditionResult = await element.isVisible().catch(() => false);
        }
        break;
        
      case 'text_contains':
        if (condition.text) {
          const pageContent = await page.content();
          conditionResult = pageContent.includes(condition.text);
        }
        break;
        
      case 'url_contains':
        if (condition.url) {
          const currentUrl = page.url();
          conditionResult = currentUrl.includes(condition.url);
        }
        break;
        
      case 'value_equals':
        if (condition.selector && condition.value) {
          const element = await page.locator(condition.selector).first();
          const elementValue = await element.inputValue().catch(() => '');
          conditionResult = elementValue === condition.value;
        }
        break;
        
      case 'parameter_equals':
        if (condition.parameterName && condition.parameterValue) {
          const paramValue = parameters[condition.parameterName];
          conditionResult = paramValue === condition.parameterValue;
        }
        break;
        
      case 'parameter_contains':
        if (condition.parameterName && condition.parameterValue) {
          const paramValue = parameters[condition.parameterName];
          conditionResult = paramValue && paramValue.toString().includes(condition.parameterValue);
        }
        break;
        
      case 'custom':
        // 커스텀 조건은 JavaScript로 평가
        if (condition.customCondition) {
          conditionResult = await page.evaluate(condition.customCondition);
        }
        break;
        
      default:
        executionLog.push(`⚠️ 알 수 없는 조건 타입: ${condition.type}`);
        return;
    }
    
    executionLog.push(`🔍 IF 조건 검사: ${description} - 결과: ${conditionResult ? 'TRUE' : 'FALSE'}`);
    
    // 조건에 따라 액션 실행
    const actionsToExecute = conditionResult ? thenActions : elseActions;
    
    if (actionsToExecute && actionsToExecute.length > 0) {
      executionLog.push(`🔄 ${conditionResult ? 'THEN' : 'ELSE'} 액션 실행 시작 (${actionsToExecute.length}개)`);
      
      // 액션들을 순서대로 실행
      const sortedActions = actionsToExecute.sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
      
      for (const subAction of sortedActions) {
        if (!subAction.isEnabled) {
          executionLog.push(`⏭️ 하위 액션 건너뜀: ${subAction.description} (비활성화됨)`);
          continue;
        }
        
        try {
          await executeAction(page, subAction, parameters, extractedData, executionLog, sessionId);
        } catch (subActionError) {
          executionLog.push(`❌ 하위 액션 실패: ${subAction.description} - ${subActionError}`);
          
          // 옵셔널 액션이 아닌 경우 상위로 오류 전파
          if (!subAction.isOptional) {
            throw new Error(`IF 분기 내 필수 액션 실패: ${subAction.description}`);
          }
        }
      }
      
      executionLog.push(`✅ ${conditionResult ? 'THEN' : 'ELSE'} 액션 실행 완료`);
    } else {
      executionLog.push(`ℹ️ ${conditionResult ? 'THEN' : 'ELSE'} 액션이 없어 건너뜀`);
    }
    
  } catch (error) {
    executionLog.push(`❌ IF 액션 실행 실패: ${description} - ${error}`);
    throw error;
  }
}

async function validateApiKey(apiKey: string): Promise<boolean> {
  try {
    // Redis에서 API 키 검증
    const { getApiKey } = await import('@/lib/redis');
    const keyInfo = await getApiKey(apiKey);
    
    if (!keyInfo) {
      return false;
    }

    // 키 상태 확인
    if (keyInfo.status !== 'active') {
      return false;
    }

    // 사용량 제한 확인 (선택사항)
    if (keyInfo.usageLimit && keyInfo.usageCount >= keyInfo.usageLimit) {
      return false;
    }

    // 사용량 카운트 증가
    await updateApiKeyUsage(apiKey);
    
    return true;
  } catch (error) {
    console.error('API 키 검증 오류:', error);
    // Redis가 없거나 오류가 발생하면 기본 키 검증 수행
    return apiKey === 'test-key' || apiKey === 'demo-key';
  }
}

async function updateApiKeyUsage(apiKey: string): Promise<void> {
  try {
    const { updateApiKeyUsage: updateUsage } = await import('@/lib/redis');
    await updateUsage(apiKey);
  } catch (error) {
    console.warn('API 키 사용량 업데이트 실패:', error);
    // Redis가 없어도 계속 진행
  }
}

async function executeOptionSelectAction(
  page: any,
  action: any,
  parameters: Record<string, any>,
  executionLog: string[]
) {
  const { selector, optionType, value, by = 'value', parameterName, useParameter, fallbackSelectors = [], waitAfter } = action;
  
  if (!selector) {
    executionLog.push(`❌ 옵션 선택 액션 오류: 셀렉터가 없습니다.`);
    return;
  }
  
  try {
    // 파라미터 값 확인
    let selectValue = value;
    if (useParameter && parameterName && parameters[parameterName]) {
      selectValue = parameters[parameterName];
    }
    
    if (!selectValue) {
      executionLog.push(`❌ 선택할 값이 없습니다.`);
      return;
    }
    
    const selectorsToTry = [selector, ...fallbackSelectors];
    let success = false;
    
    for (const currentSelector of selectorsToTry) {
      try {
        executionLog.push(`🔍 셀렉터 시도: ${currentSelector}`);
        
        // 요소가 로드될 때까지 대기
        await page.waitForSelector(currentSelector, { timeout: 10000 });
        
        switch (optionType) {
          case 'dropdown':
          case 'select':
            success = await handleDropdownSelection(page, currentSelector, selectValue, by, executionLog);
            break;
            
          case 'radio':
            success = await handleRadioSelection(page, currentSelector, selectValue, by, executionLog);
            break;
            
          case 'checkbox':
            success = await handleCheckboxSelection(page, currentSelector, selectValue, by, executionLog);
            break;
            
          case 'multi_select':
            success = await handleMultiSelection(page, currentSelector, selectValue, by, executionLog);
            break;
            
          default:
            // 기본적으로 클릭 처리
            const element = await page.locator(currentSelector).first();
            await element.waitFor({ state: 'visible', timeout: 5000 });
            await element.click();
            success = true;
            executionLog.push(`✅ 기본 클릭: ${currentSelector}`);
        }
        
        if (success) {
          executionLog.push(`✅ 옵션 선택 성공: ${currentSelector} = ${selectValue} (${optionType}, ${by})`);
          break;
        }
        
      } catch (error) {
        executionLog.push(`⚠️ 셀렉터 시도 실패: ${currentSelector} - ${error}`);
        continue;
      }
    }
    
    if (!success) {
      throw new Error(`모든 셀렉터에서 옵션 선택 실패: ${selectValue}`);
    }
    
    // 대기 시간
    if (waitAfter) {
      await page.waitForTimeout(waitAfter);
      executionLog.push(`✅ 옵션 선택 후 대기: ${waitAfter}ms`);
    }
    
  } catch (error) {
    executionLog.push(`❌ 옵션 선택 실패: ${action.description} - ${error}`);
    throw error;
  }
}

// 드롭다운 선택 처리
async function handleDropdownSelection(page: any, selector: string, value: string, by: string, executionLog: string[]): Promise<boolean> {
  try {
    const selectElement = await page.locator(selector).first();
    await selectElement.waitFor({ state: 'visible', timeout: 5000 });
    
    // 실제 select 요소인지 확인
    const tagName = await selectElement.evaluate((el: any) => el.tagName.toLowerCase());
    
    if (tagName === 'select') {
      return await handleNativeSelect(selectElement, value, by, executionLog);
    } else {
      // 커스텀 드롭다운 처리
      return await handleCustomDropdown(page, selector, value, by, executionLog);
    }
    
  } catch (error) {
    executionLog.push(`❌ 드롭다운 선택 처리 오류: ${error}`);
    return false;
  }
}

// 네이티브 select 요소 처리
async function handleNativeSelect(selectElement: any, value: string, by: string, executionLog: string[]): Promise<boolean> {
  try {
    // 드롭다운이 비활성화되어 있는지 확인
    const isDisabled = await selectElement.isDisabled();
    if (isDisabled) {
      executionLog.push(`⚠️ 드롭다운이 비활성화되어 있음`);
      return false;
    }
    
    // 드롭다운 클릭하여 열기
    await selectElement.click();
    await selectElement.waitForTimeout(500);
    
    let selected = false;
    
    switch (by) {
      case 'value':
        try {
          await selectElement.selectOption({ value: value });
          selected = true;
          executionLog.push(`✅ 값으로 선택: ${value}`);
        } catch (error) {
          executionLog.push(`⚠️ 값으로 선택 실패: ${value}`);
        }
        break;
        
      case 'text':
      case 'label':
        try {
          await selectElement.selectOption({ label: value });
          selected = true;
          executionLog.push(`✅ 텍스트로 선택: ${value}`);
        } catch (error) {
          executionLog.push(`⚠️ 텍스트로 선택 실패, 대안 시도: ${value}`);
          
          // 대안: 옵션 요소들을 직접 검색
          const options = await selectElement.locator('option').all();
          for (const option of options) {
            const optionText = await option.textContent();
            if (optionText && (
              optionText.trim().toLowerCase() === value.toLowerCase() ||
              optionText.trim().toLowerCase().includes(value.toLowerCase())
            )) {
              await option.click();
              selected = true;
              executionLog.push(`✅ 텍스트 포함으로 선택: ${optionText.trim()}`);
              break;
            }
          }
        }
        break;
        
      case 'index':
        try {
          const index = parseInt(value);
          await selectElement.selectOption({ index: index });
          selected = true;
          executionLog.push(`✅ 인덱스로 선택: ${index}`);
        } catch (error) {
          executionLog.push(`⚠️ 인덱스로 선택 실패: ${value}`);
        }
        break;
    }
    
    return selected;
  } catch (error) {
    executionLog.push(`❌ 네이티브 select 처리 오류: ${error}`);
    return false;
  }
}

// 커스텀 드롭다운 처리
async function handleCustomDropdown(page: any, selector: string, value: string, by: string, executionLog: string[]): Promise<boolean> {
  try {
    const dropdownElement = await page.locator(selector).first();
    
    // 드롭다운 클릭하여 열기
    await dropdownElement.click();
    await page.waitForTimeout(1000); // 커스텀 드롭다운은 더 긴 대기시간 필요
    
    // 다양한 옵션 셀렉터 패턴 시도
    const optionSelectors = [
      `${selector} option`,
      `${selector} li`,
      `${selector} .option`,
      `${selector} .item`,
      `${selector} [role="option"]`,
      `${selector} [data-value]`,
      // 드롭다운이 body에 append되는 경우
      '.dropdown-menu option',
      '.dropdown-menu li',
      '.dropdown-menu .option',
      '.dropdown-menu .item',
      '.select-dropdown option',
      '.select-dropdown li',
      '.select-dropdown .option',
      '.select-dropdown .item',
      // 일반적인 드롭다운 클래스들
      '.dropdown-option',
      '.select-option',
      '.menu-item',
      '[role="listbox"] [role="option"]'
    ];
    
    let selected = false;
    
    for (const optionSelector of optionSelectors) {
      try {
        const options = await page.locator(optionSelector).all();
        if (options.length === 0) continue;
        
        executionLog.push(`🔍 옵션 셀렉터 시도: ${optionSelector} (${options.length}개 옵션 발견)`);
        
        for (const option of options) {
          let shouldSelect = false;
          
          switch (by) {
            case 'value':
              const optionValue = await option.getAttribute('value') || 
                                 await option.getAttribute('data-value') ||
                                 await option.textContent();
              if (optionValue && optionValue.trim() === value) {
                shouldSelect = true;
              }
              break;
              
            case 'text':
            case 'label':
              const optionText = await option.textContent();
              if (optionText && (
                optionText.trim().toLowerCase() === value.toLowerCase() ||
                optionText.trim().toLowerCase().includes(value.toLowerCase())
              )) {
                shouldSelect = true;
              }
              break;
              
            case 'index':
              const index = parseInt(value);
              const currentIndex = options.indexOf(option);
              if (currentIndex === index) {
                shouldSelect = true;
              }
              break;
          }
          
          if (shouldSelect) {
            await option.click();
            selected = true;
            const selectedText = await option.textContent();
            executionLog.push(`✅ 커스텀 드롭다운 선택: "${selectedText?.trim()}" (${by}: ${value})`);
            break;
          }
        }
        
        if (selected) break;
        
      } catch (error) {
        executionLog.push(`⚠️ 옵션 셀렉터 실패: ${optionSelector}`);
        continue;
      }
    }
    
    return selected;
  } catch (error) {
    executionLog.push(`❌ 커스텀 드롭다운 처리 오류: ${error}`);
    return false;
  }
}

// 라디오 버튼 선택 처리
async function handleRadioSelection(page: any, selector: string, value: string, by: string, executionLog: string[]): Promise<boolean> {
  try {
    let selected = false;
    
    switch (by) {
      case 'value':
        try {
          const radioSelector = `${selector}[value="${value}"]`;
          const radio = await page.locator(radioSelector).first();
          await radio.waitFor({ state: 'visible', timeout: 5000 });
          await radio.click();
          selected = true;
          executionLog.push(`✅ 라디오 값으로 선택: ${value}`);
        } catch (error) {
          executionLog.push(`⚠️ 라디오 값으로 선택 실패: ${value}`);
        }
        break;
        
      case 'text':
        try {
          // 모든 라디오 버튼을 찾아서 텍스트 확인
          const radioElements = await page.locator(selector).all();
          
          for (const radio of radioElements) {
            // 라디오 버튼의 부모나 형제 요소에서 텍스트 찾기
            const parent = await radio.locator('..').first();
            const parentText = await parent.textContent();
            
            // 라벨 요소 찾기
            const radioId = await radio.getAttribute('id');
            let labelText = '';
            if (radioId) {
              try {
                const label = await page.locator(`label[for="${radioId}"]`).first();
                labelText = await label.textContent() || '';
              } catch (error) {
                // 라벨이 없을 수 있음
              }
            }
            
            const combinedText = `${parentText || ''} ${labelText || ''}`.toLowerCase();
            
            if (combinedText.includes(value.toLowerCase())) {
              await radio.click();
              selected = true;
              executionLog.push(`✅ 라디오 텍스트로 선택: "${value}" (찾은 텍스트: "${combinedText.trim()}")`);
              break;
            }
          }
        } catch (error) {
          executionLog.push(`⚠️ 라디오 텍스트로 선택 실패: ${value}`);
        }
        break;
        
      case 'index':
        try {
          const index = parseInt(value);
          const radio = await page.locator(selector).nth(index);
          await radio.waitFor({ state: 'visible', timeout: 5000 });
          await radio.click();
          selected = true;
          executionLog.push(`✅ 라디오 인덱스로 선택: ${index}`);
        } catch (error) {
          executionLog.push(`⚠️ 라디오 인덱스로 선택 실패: ${value}`);
        }
        break;
    }
    
    return selected;
  } catch (error) {
    executionLog.push(`❌ 라디오 선택 처리 오류: ${error}`);
    return false;
  }
}

// 체크박스 선택 처리
async function handleCheckboxSelection(page: any, selector: string, value: string, by: string, executionLog: string[]): Promise<boolean> {
  try {
    let selected = false;
    
    switch (by) {
      case 'value':
        try {
          const checkboxSelector = `${selector}[value="${value}"]`;
          const checkbox = await page.locator(checkboxSelector).first();
          await checkbox.waitFor({ state: 'visible', timeout: 5000 });
          
          if (!(await checkbox.isChecked())) {
            await checkbox.click();
          }
          selected = true;
          executionLog.push(`✅ 체크박스 값으로 선택: ${value}`);
        } catch (error) {
          executionLog.push(`⚠️ 체크박스 값으로 선택 실패: ${value}`);
        }
        break;
        
      case 'text':
        try {
          const checkboxElements = await page.locator(selector).all();
          
          for (const checkbox of checkboxElements) {
            const parent = await checkbox.locator('..').first();
            const parentText = await parent.textContent();
            
            // 라벨 요소 찾기
            const checkboxId = await checkbox.getAttribute('id');
            let labelText = '';
            if (checkboxId) {
              try {
                const label = await page.locator(`label[for="${checkboxId}"]`).first();
                labelText = await label.textContent() || '';
              } catch (error) {
                // 라벨이 없을 수 있음
              }
            }
            
            const combinedText = `${parentText || ''} ${labelText || ''}`.toLowerCase();
            
            if (combinedText.includes(value.toLowerCase())) {
              if (!(await checkbox.isChecked())) {
                await checkbox.click();
              }
              selected = true;
              executionLog.push(`✅ 체크박스 텍스트로 선택: "${value}" (찾은 텍스트: "${combinedText.trim()}")`);
              break;
            }
          }
        } catch (error) {
          executionLog.push(`⚠️ 체크박스 텍스트로 선택 실패: ${value}`);
        }
        break;
        
      case 'index':
        try {
          const index = parseInt(value);
          const checkbox = await page.locator(selector).nth(index);
          await checkbox.waitFor({ state: 'visible', timeout: 5000 });
          
          if (!(await checkbox.isChecked())) {
            await checkbox.click();
          }
          selected = true;
          executionLog.push(`✅ 체크박스 인덱스로 선택: ${index}`);
        } catch (error) {
          executionLog.push(`⚠️ 체크박스 인덱스로 선택 실패: ${value}`);
        }
        break;
    }
    
    return selected;
  } catch (error) {
    executionLog.push(`❌ 체크박스 선택 처리 오류: ${error}`);
    return false;
  }
}

// 다중 선택 처리
async function handleMultiSelection(page: any, selector: string, value: string, by: string, executionLog: string[]): Promise<boolean> {
  try {
    const selectElement = await page.locator(selector).first();
    await selectElement.waitFor({ state: 'visible', timeout: 5000 });
    
    // 다중 선택: 배열로 처리
    const values = Array.isArray(value) ? value : value.split(',').map(v => v.trim());
    let selected = false;
    
    // Ctrl 키를 누른 상태로 다중 선택
    await page.keyboard.down('Control');
    
    for (const val of values) {
      try {
        switch (by) {
          case 'value':
            await selectElement.selectOption({ value: val });
            break;
          case 'text':
          case 'label':
            await selectElement.selectOption({ label: val });
            break;
          case 'index':
            await selectElement.selectOption({ index: parseInt(val) });
            break;
        }
        await page.waitForTimeout(200);
        selected = true;
        executionLog.push(`✅ 다중 선택 항목: ${val}`);
      } catch (error) {
        executionLog.push(`⚠️ 다중 선택 항목 실패: ${val}`);
      }
    }
    
    await page.keyboard.up('Control');
    
    return selected;
  } catch (error) {
    executionLog.push(`❌ 다중 선택 처리 오류: ${error}`);
    return false;
  }
}

// 팝업창 전환 액션 추가
async function executePopupSwitchAction(
  page: any,
  action: any,
  parameters: Record<string, any>,
  executionLog: string[],
  sessionId: string
) {
  const { 
    triggerSelector, 
    popupType = 'new_tab', 
    waitForPopup = true,
    timeout = 30000,
    closeOriginal = false,
    popupUrl,
    waitAfter
  } = action;
  
  try {
    const context = page.context();
    
    switch (popupType) {
      case 'new_tab':
      case 'new_window':
        // 새 탭/창이 열리는 경우
        if (triggerSelector) {
          // 새 페이지가 열릴 것을 대기
          const [newPage] = await Promise.all([
            context.waitForEvent('page', { timeout }),
            page.locator(triggerSelector).first().click()
          ]);
          
          // 새 페이지로 전환
          await newPage.waitForLoadState('domcontentloaded');
          
          // 기존 페이지 닫기 (옵션)
          if (closeOriginal) {
            await page.close();
          }
          
          // 새 페이지를 현재 페이지로 설정
          // 이는 실제로는 context에서 관리되어야 하지만, 
          // 여기서는 로그만 남김
          executionLog.push(`✅ 새 탭/창으로 전환: ${newPage.url()}`);
          
        } else if (popupUrl) {
          // 직접 새 탭에서 URL 열기
          const newPage = await context.newPage();
          await newPage.goto(popupUrl);
          await newPage.waitForLoadState('domcontentloaded');
          
          if (closeOriginal) {
            await page.close();
          }
          
          executionLog.push(`✅ 새 탭에서 URL 열기: ${popupUrl}`);
        }
        break;
        
      case 'modal':
      case 'dialog':
        // 모달/다이얼로그가 나타나는 경우
        if (triggerSelector) {
          await page.locator(triggerSelector).first().click();
          
          // 모달이 나타날 때까지 대기
          if (waitForPopup) {
            // 일반적인 모달 셀렉터들로 대기
            const modalSelectors = [
              '.modal', '.dialog', '.popup', '.overlay',
              '[role="dialog"]', '[role="modal"]',
              '.modal-content', '.dialog-content'
            ];
            
            let modalFound = false;
            for (const modalSelector of modalSelectors) {
              try {
                await page.waitForSelector(modalSelector, { timeout: 5000 });
                modalFound = true;
                executionLog.push(`✅ 모달 감지: ${modalSelector}`);
                break;
              } catch (error) {
                continue;
              }
            }
            
            if (!modalFound) {
              executionLog.push(`⚠️ 모달을 찾을 수 없지만 계속 진행`);
            }
          }
          
          executionLog.push(`✅ 모달/다이얼로그 트리거: ${triggerSelector}`);
        }
        break;
        
      case 'iframe':
        // iframe으로 전환
        if (triggerSelector) {
          // iframe 셀렉터 클릭 또는 iframe으로 전환
          const iframe = await page.frameLocator(triggerSelector);
          executionLog.push(`✅ iframe으로 전환: ${triggerSelector}`);
        }
        break;
        
      case 'alert':
      case 'confirm':
      case 'prompt':
        // JavaScript 대화상자 처리
        page.on('dialog', async (dialog: any) => {
          executionLog.push(`🔔 ${dialog.type()} 대화상자: ${dialog.message()}`);
          
          if (action.dialogAction === 'accept') {
            await dialog.accept(action.dialogInput || '');
          } else {
            await dialog.dismiss();
          }
        });
        
        if (triggerSelector) {
          await page.locator(triggerSelector).first().click();
        }
        break;
        
      default:
        throw new Error(`지원하지 않는 팝업 타입: ${popupType}`);
    }
    
    // 대기 시간
    if (waitAfter) {
      await page.waitForTimeout(waitAfter);
      executionLog.push(`✅ 팝업 전환 후 대기: ${waitAfter}ms`);
    }
    
  } catch (error) {
    executionLog.push(`❌ 팝업 전환 실패: ${action.description} - ${error}`);
    throw error;
  }
}

async function executeAuthVerifyAction(
  page: any,
  action: any,
  parameters: Record<string, any>,
  executionLog: string[],
  sessionId: string
) {
  const { 
    verificationType, 
    inputSelector, 
    submitSelector, 
    successSelector, 
    failureSelector,
    value,
    parameterName,
    useParameter,
    timeout = 30000,
    retryCount = 3,
    fallbackSelectors = {},
    pauseForInput = true // 새로운 옵션: 사용자 입력을 위해 일시정지할지 여부
  } = action;
  
  if (!inputSelector) {
    executionLog.push(`❌ 인증 검증 액션 오류: 입력 셀렉터가 없습니다.`);
    return;
  }
  
  try {
    // 인증번호 값 확인
    let authValue = value;
    if (useParameter && parameterName && parameters[parameterName]) {
      authValue = parameters[parameterName];
    }
    
    // 인증번호가 없고 일시정지 옵션이 활성화된 경우 워크플로우 일시정지
    if (!authValue && pauseForInput) {
      executionLog.push(`⏸️ 인증번호 입력을 위해 워크플로우 일시정지`);
      
      // 세션 저장
      const session = workflowSessions.get(sessionId);
      if (session) {
        session.status = 'paused';
        session.pausedAt = new Date();
        session.waitingFor = {
          type: 'auth_verify',
          actionId: action.id,
          message: getAuthMessage(verificationType),
          inputFields: [
            {
              name: parameterName || 'auth_code',
              type: 'text',
              label: getAuthInputLabel(verificationType),
              required: true
            }
          ]
        };
      }
      
      throw new WorkflowPausedException(
        sessionId,
        {
          type: 'auth_verify',
          actionId: action.id,
          message: getAuthMessage(verificationType),
          inputFields: [
            {
              name: parameterName || 'auth_code',
              type: 'text',
              label: getAuthInputLabel(verificationType),
              required: true
            }
          ]
        },
        executionLog
      );
    }
    
    if (!authValue) {
      executionLog.push(`❌ 인증번호가 제공되지 않았습니다.`);
      return;
    }
    
    let attempts = 0;
    let success = false;
    
    while (attempts < retryCount && !success) {
      attempts++;
      executionLog.push(`🔄 인증 시도 ${attempts}/${retryCount}`);
      
      try {
        // 인증번호 입력
        const inputSelectors = [inputSelector, ...(fallbackSelectors.input || [])];
        let inputSuccess = false;
        
        for (const selector of inputSelectors) {
          try {
            const inputElement = await page.locator(selector).first();
            await inputElement.waitFor({ state: 'visible', timeout: 5000 });
            await inputElement.clear();
            await inputElement.fill(authValue);
            inputSuccess = true;
            executionLog.push(`✅ 인증번호 입력: ${selector}`);
            break;
          } catch (error) {
            continue;
          }
        }
        
        if (!inputSuccess) {
          throw new Error('인증번호 입력 필드를 찾을 수 없습니다.');
        }
        
        // 확인 버튼 클릭 (옵션)
        if (submitSelector) {
          const submitSelectors = [submitSelector, ...(fallbackSelectors.submit || [])];
          for (const selector of submitSelectors) {
            try {
              const submitElement = await page.locator(selector).first();
              await submitElement.waitFor({ state: 'visible', timeout: 5000 });
              await submitElement.click();
              executionLog.push(`✅ 확인 버튼 클릭: ${selector}`);
              break;
            } catch (error) {
              continue;
            }
          }
        }
        
        // 결과 확인
        if (successSelector || failureSelector) {
          await page.waitForTimeout(2000); // 결과 대기
          
          // 성공 확인
          if (successSelector) {
            const successSelectors = [successSelector, ...(fallbackSelectors.success || [])];
            for (const selector of successSelectors) {
              try {
                const successElement = await page.locator(selector).first();
                await successElement.waitFor({ state: 'visible', timeout: 5000 });
                success = true;
                executionLog.push(`✅ 인증 성공 확인: ${selector}`);
                break;
              } catch (error) {
                continue;
              }
            }
          }
          
          // 실패 확인
          if (!success && failureSelector) {
            const failureSelectors = [failureSelector, ...(fallbackSelectors.failure || [])];
            for (const selector of failureSelectors) {
              try {
                const failureElement = await page.locator(selector).first();
                await failureElement.waitFor({ state: 'visible', timeout: 3000 });
                executionLog.push(`❌ 인증 실패 확인: ${selector}`);
                break;
              } catch (error) {
                continue;
              }
            }
          }
        } else {
          // 성공/실패 셀렉터가 없으면 성공으로 간주
          success = true;
          executionLog.push(`✅ 인증 처리 완료 (결과 확인 셀렉터 없음)`);
        }
        
        if (success) {
          break;
        }
        
      } catch (error) {
        executionLog.push(`❌ 인증 시도 ${attempts} 실패: ${error}`);
        if (attempts < retryCount) {
          await page.waitForTimeout(1000); // 재시도 전 대기
        }
      }
    }
    
    if (!success) {
      throw new Error(`인증 실패: ${retryCount}번 시도 후 실패`);
    }
    
  } catch (error) {
    if (error instanceof WorkflowPausedException) {
      throw error; // 일시정지 예외는 그대로 전파
    }
    
    executionLog.push(`❌ 인증 검증 실패: ${action.description} - ${error}`);
    throw error;
  }
}

// 인증 타입별 메시지 생성
function getAuthMessage(verificationType: string): string {
  switch (verificationType) {
    case 'otp':
      return 'OTP 인증번호를 입력해주세요.';
    case 'sms':
      return 'SMS로 받은 인증번호를 입력해주세요.';
    case 'email':
      return '이메일로 받은 인증번호를 입력해주세요.';
    case 'captcha':
      return '화면에 표시된 보안문자를 입력해주세요.';
    case 'biometric':
      return '생체 인증을 완료해주세요.';
    default:
      return '인증번호를 입력해주세요.';
  }
}

// 인증 타입별 입력 라벨 생성
function getAuthInputLabel(verificationType: string): string {
  switch (verificationType) {
    case 'otp':
      return 'OTP 인증번호';
    case 'sms':
      return 'SMS 인증번호';
    case 'email':
      return '이메일 인증번호';
    case 'captcha':
      return '보안문자';
    case 'biometric':
      return '생체 인증';
    default:
      return '인증번호';
  }
}

async function executeApiCallAction(
  page: any,
  action: any,
  parameters: Record<string, any>,
  extractedData: Record<string, any>,
  executionLog: string[],
  sessionId: string
) {
  const { 
    url, 
    method = 'POST', 
    headers = {}, 
    body,
    useFormData = false,
    parameterMapping = {},
    responseField,
    storeAs,
    onSuccess = [],
    onFailure = [],
    timeout = 30000
  } = action;
  
  if (!url) {
    executionLog.push(`❌ API 호출 액션 오류: URL이 없습니다.`);
    return;
  }
  
  try {
    // 요청 본문 구성
    let requestBody = body;
    
    // 파라미터 매핑 적용
    if (parameterMapping && Object.keys(parameterMapping).length > 0) {
      const mappedData: Record<string, any> = {};
             for (const [paramName, apiField] of Object.entries(parameterMapping)) {
         if (parameters[paramName] !== undefined) {
           mappedData[apiField as string] = parameters[paramName];
         }
       }
      
      if (useFormData) {
        requestBody = new FormData();
        for (const [key, value] of Object.entries(mappedData)) {
          requestBody.append(key, value);
        }
      } else {
        requestBody = { ...requestBody, ...mappedData };
      }
    }
    
    // 기본 헤더 설정
    const requestHeaders = {
      'Content-Type': useFormData ? 'multipart/form-data' : 'application/json',
      ...headers
    };
    
    executionLog.push(`🔄 API 호출 시작: ${method} ${url}`);
    
    // API 호출 실행
    const response = await page.evaluate(async (requestConfig: any) => {
      const { url, method, headers, body, timeout } = requestConfig;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      try {
        const response = await fetch(url, {
          method,
          headers,
          body: typeof body === 'string' ? body : JSON.stringify(body),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        const responseData = await response.json();
        
        return {
          success: response.ok,
          status: response.status,
          statusText: response.statusText,
          data: responseData
        };
      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
      }
    }, {
      url,
      method,
      headers: requestHeaders,
      body: requestBody,
      timeout
    });
    
    if (response.success) {
      executionLog.push(`✅ API 호출 성공: ${response.status} ${response.statusText}`);
      
      // 응답 데이터 저장
      if (responseField && response.data[responseField]) {
        const fieldValue = response.data[responseField];
        if (storeAs) {
          extractedData[storeAs] = fieldValue;
          executionLog.push(`✅ 응답 데이터 저장: ${storeAs} = ${fieldValue}`);
        }
      } else if (storeAs) {
        extractedData[storeAs] = response.data;
        executionLog.push(`✅ 전체 응답 데이터 저장: ${storeAs}`);
      }
      
      // 성공 시 액션 실행
      if (onSuccess.length > 0) {
        executionLog.push(`🔄 성공 시 액션 실행 시작 (${onSuccess.length}개)`);
        for (const successAction of onSuccess) {
          try {
            await executeAction(page, successAction, parameters, extractedData, executionLog, sessionId);
          } catch (error) {
            executionLog.push(`❌ 성공 시 액션 실패: ${successAction.description} - ${error}`);
          }
        }
      }
      
    } else {
      throw new Error(`API 호출 실패: ${response.status} ${response.statusText}`);
    }
    
  } catch (error) {
    executionLog.push(`❌ API 호출 실패: ${action.description} - ${error}`);
    
    // 실패 시 액션 실행
    if (onFailure.length > 0) {
      executionLog.push(`🔄 실패 시 액션 실행 시작 (${onFailure.length}개)`);
      for (const failureAction of onFailure) {
        try {
          await executeAction(page, failureAction, parameters, extractedData, executionLog, sessionId);
        } catch (error) {
          executionLog.push(`❌ 실패 시 액션 실패: ${failureAction.description} - ${error}`);
        }
      }
    }
    
    throw error;
  }
} 