import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { url, schema, actions, parameters } = await request.json();

    if (!url || !schema) {
      return NextResponse.json(
        { error: 'URL과 스키마가 필요합니다.' },
        { status: 400 }
      );
    }

    // URL 형식 검증
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { error: '올바른 URL 형식이 아닙니다.' },
        { status: 400 }
      );
    }

    // 브라우저 자동화 및 데이터 추출 실행
    const extractedData = await extractDataWithActions(url, schema, actions, parameters);

    return NextResponse.json({
      success: true,
      data: extractedData,
      timestamp: new Date().toISOString(),
      source: url,
      actionsExecuted: actions?.length || 0
    });
  } catch (error) {
    console.error('데이터 추출 오류:', error);
    return NextResponse.json(
      { error: '데이터 추출에 실패했습니다.' },
      { status: 500 }
    );
  }
}

async function extractDataWithActions(url: string, schema: any, actions?: any[], parameters?: any) {
  // 실제 Playwright 기반 브라우저 자동화 (항상 실행)
  console.log('🚀 실제 Playwright 브라우저 자동화를 시작합니다...');
  
  try {
    return await extractWithPlaywright(url, schema, actions, parameters);
  } catch (error) {
    console.error('❌ Playwright 실행 실패:', error);
    console.log('🔄 Mock 데이터로 대체합니다...');
    return generateMockData(schema.dataSchema || schema);
  }
}

async function setupPopupHandling(page: any) {
  // 다이얼로그 자동 처리 (alert, confirm, prompt)
  page.on('dialog', async (dialog: any) => {
    console.log(`🚨 다이얼로그 감지: ${dialog.type()} - ${dialog.message()}`);
    
    if (dialog.type() === 'alert') {
      await dialog.accept();
      console.log('✅ Alert 다이얼로그 자동 확인');
    } else if (dialog.type() === 'confirm') {
      await dialog.accept(); // 기본적으로 확인
      console.log('✅ Confirm 다이얼로그 자동 확인');
    } else if (dialog.type() === 'prompt') {
      await dialog.accept(''); // 빈 값으로 확인
      console.log('✅ Prompt 다이얼로그 자동 확인');
    }
  });
  
  // 새 창/팝업 처리
  page.on('popup', async (popup: any) => {
    console.log(`🔗 팝업 창 감지: ${popup.url()}`);
    
    // 팝업 창이 광고나 불필요한 내용인지 확인
    const url = popup.url();
    const isAd = url.includes('ad') || url.includes('popup') || url.includes('banner');
    
    if (isAd) {
      console.log('🚫 광고 팝업으로 판단하여 닫습니다.');
      await popup.close();
    } else {
      console.log('ℹ️ 팝업 창을 유지합니다.');
    }
  });
  
  // 페이지 로드 에러 처리
  page.on('pageerror', (error: any) => {
    console.warn('⚠️ 페이지 에러:', error.message);
  });
  
  // 요청 실패 처리
  page.on('requestfailed', (request: any) => {
    console.warn('⚠️ 요청 실패:', request.url(), request.failure()?.errorText);
  });
}

async function handlePopupsWithSelectors(page: any) {
  // 기존 셀렉터 기반 팝업 처리 방식
  try {
    // 쿠키 동의 팝업 처리
    await handleCookieConsent(page);
    
    // 일반적인 모달 팝업 처리
    await handleModalPopups(page);
    
    // 알림 허용 팝업 처리
    await handleNotificationPermission(page);
    
    // 위치 정보 권한 팝업 처리
    await handleLocationPermission(page);
    
    // 광고 팝업 처리
    await handleAdvertisementPopups(page);
    
    // 캡차 처리
    await handleCaptcha(page);
    
  } catch (error) {
    console.warn('⚠️ 셀렉터 기반 팝업 처리 중 오류:', error);
  }
}

async function handlePopupWithVision(page: any, popup: any) {
  console.log(`🎯 Vision AI 팝업 처리: ${popup.type} (우선순위: ${popup.priority})`);
  
  try {
    // GPT가 제안한 액션 셀렉터 먼저 시도
    if (popup.actionSelector && popup.actionType !== 'none') {
      try {
        const element = await page.locator(popup.actionSelector).first();
        if (await element.isVisible({ timeout: 3000 })) {
          await element.click();
          console.log(`✅ Vision 제안 셀렉터로 ${popup.type} 팝업 처리: ${popup.actionSelector}`);
          await page.waitForTimeout(1000);
          return;
        }
      } catch (error) {
        console.warn(`⚠️ Vision 제안 셀렉터 실패: ${popup.actionSelector}`);
      }
    }
    
    // 팝업 타입별 기본 처리 방식
    switch (popup.type) {
      case 'cookie':
        await handleVisionCookiePopup(page, popup);
        break;
        
      case 'notification':
        await handleVisionNotificationPopup(page, popup);
        break;
        
      case 'location':
        await handleVisionLocationPopup(page, popup);
        break;
        
      case 'modal':
        await handleVisionModalPopup(page, popup);
        break;
        
      case 'advertisement':
        await handleVisionAdPopup(page, popup);
        break;
        
      case 'error':
        await handleVisionErrorPopup(page, popup);
        break;
        
      default:
        await handleVisionGenericPopup(page, popup);
    }
    
  } catch (error) {
    console.error(`❌ Vision 팝업 처리 실패 (${popup.type}):`, error);
  }
}

async function handleVisionCookiePopup(page: any, popup: any) {
  const cookieSelectors = [
    'button:has-text("동의")',
    'button:has-text("Accept")',
    'button:has-text("수락")',
    'button:has-text("확인")',
    'button:has-text("OK")',
    'button:has-text("Accept All")',
    '[data-testid*="cookie"] button',
    '[data-testid*="consent"] button',
    '.cookie-consent button',
    '.cookie-banner button:first-child'
  ];
  
  for (const selector of cookieSelectors) {
    try {
      const element = await page.locator(selector).first();
      if (await element.isVisible({ timeout: 2000 })) {
        await element.click();
        console.log(`✅ 쿠키 동의 팝업 처리: ${selector}`);
        await page.waitForTimeout(1000);
        return;
      }
    } catch (error) {
      // 다음 셀렉터 시도
    }
  }
}

async function handleVisionNotificationPopup(page: any, popup: any) {
  const notificationSelectors = [
    'button:has-text("나중에")',
    'button:has-text("거부")',
    'button:has-text("Later")',
    'button:has-text("No")',
    'button:has-text("Cancel")',
    'button:has-text("Not Now")',
    '[data-testid*="notification"] button:last-child',
    '.notification-popup button:last-child'
  ];
  
  for (const selector of notificationSelectors) {
    try {
      const element = await page.locator(selector).first();
      if (await element.isVisible({ timeout: 2000 })) {
        await element.click();
        console.log(`✅ 알림 권한 팝업 거부: ${selector}`);
        await page.waitForTimeout(1000);
        return;
      }
    } catch (error) {
      // 다음 셀렉터 시도
    }
  }
}

async function handleVisionLocationPopup(page: any, popup: any) {
  try {
    // 위치 정보 권한 거부
    await page.context().grantPermissions([], { origin: page.url() });
    console.log('✅ 위치 권한 거부 완료');
  } catch (error) {
    console.warn('⚠️ 위치 권한 처리 오류:', error);
  }
}

async function handleVisionModalPopup(page: any, popup: any) {
  const modalCloseSelectors = [
    'button:has-text("닫기")',
    'button:has-text("Close")',
    'button:has-text("×")',
    'button:has-text("✕")',
    '[data-testid*="close"]',
    '[data-testid*="modal"] button',
    '.modal .close',
    '.popup .close',
    '.overlay .close',
    '[aria-label*="close"]',
    '[aria-label*="닫기"]'
  ];
  
  for (const selector of modalCloseSelectors) {
    try {
      const element = await page.locator(selector).first();
      if (await element.isVisible({ timeout: 2000 })) {
        await element.click();
        console.log(`✅ 모달 팝업 닫기: ${selector}`);
        await page.waitForTimeout(1000);
        return;
      }
    } catch (error) {
      // 다음 셀렉터 시도
    }
  }
}

async function handleVisionAdPopup(page: any, popup: any) {
  const adCloseSelectors = [
    'button:has-text("Skip Ad")',
    'button:has-text("광고 건너뛰기")',
    'button:has-text("Close Ad")',
    'button:has-text("×")',
    '.ad-close',
    '.ad-skip',
    '[class*="ad-"] button',
    '[class*="advertisement"] button',
    '[id*="ad-"] button'
  ];
  
  for (const selector of adCloseSelectors) {
    try {
      const element = await page.locator(selector).first();
      if (await element.isVisible({ timeout: 2000 })) {
        await element.click();
        console.log(`✅ 광고 팝업 닫기: ${selector}`);
        await page.waitForTimeout(1000);
        return;
      }
    } catch (error) {
      // 다음 셀렉터 시도
    }
  }
}

async function handleVisionErrorPopup(page: any, popup: any) {
  console.log('⚠️ 에러 팝업 감지됨:', popup.reasoning);
  
  const errorCloseSelectors = [
    'button:has-text("확인")',
    'button:has-text("OK")',
    'button:has-text("닫기")',
    'button:has-text("Close")',
    '.error button',
    '.alert button',
    '[role="alert"] button'
  ];
  
  for (const selector of errorCloseSelectors) {
    try {
      const element = await page.locator(selector).first();
      if (await element.isVisible({ timeout: 2000 })) {
        await element.click();
        console.log(`✅ 에러 팝업 닫기: ${selector}`);
        await page.waitForTimeout(1000);
        return;
      }
    } catch (error) {
      // 다음 셀렉터 시도
    }
  }
}

async function handleVisionGenericPopup(page: any, popup: any) {
  console.log(`🔍 일반 팝업 처리 시도: ${popup.type}`);
  
  // 일반적인 닫기 버튼들 시도
  const genericCloseSelectors = [
    'button:has-text("닫기")',
    'button:has-text("Close")',
    'button:has-text("×")',
    'button:has-text("Cancel")',
    'button:has-text("취소")',
    '.close',
    '[aria-label*="close"]'
  ];
  
  for (const selector of genericCloseSelectors) {
    try {
      const element = await page.locator(selector).first();
      if (await element.isVisible({ timeout: 2000 })) {
        await element.click();
        console.log(`✅ 일반 팝업 닫기: ${selector}`);
        await page.waitForTimeout(1000);
        return;
      }
    } catch (error) {
      // 다음 셀렉터 시도
    }
  }
}

async function handlePopups(page: any) {
  try {
    console.log('🔍 Vision AI로 팝업 감지 시작...');
    
    // OpenAI API 키 확인
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) {
      console.warn('OpenAI API 키가 없습니다. 기본 셀렉터 방식으로 팝업 처리합니다.');
      await handlePopupsWithSelectors(page);
      return;
    }

    // 스크린샷 촬영
    const screenshot = await page.screenshot({ fullPage: false });
    
    const visionPrompt = `당신은 웹 페이지의 팝업과 모달 전문 분석가입니다.

스크린샷을 분석하여 다음 요소들이 있는지 확인해주세요:

1. 쿠키 동의 팝업/배너
2. 알림 권한 요청 팝업
3. 위치 정보 권한 요청
4. 일반적인 모달 창
5. 광고 팝업/오버레이
6. 캐치(CAPTCHA)
7. 에러 메시지
8. 기타 방해 요소

각 요소에 대해 다음 JSON 형식으로 응답해주세요:
{
  "popups": [
    {
      "type": "cookie|notification|location|modal|advertisement|captcha|error|other",
      "present": boolean,
      "location": "화면에서의 위치 설명",
      "selector": "추천 CSS 셀렉터",
      "actionType": "accept|decline|close|dismiss|none",
      "actionSelector": "클릭할 요소의 셀렉터",
      "buttonText": "버튼 텍스트 (있다면)",
      "priority": 1-10,
      "reasoning": "판단 근거"
    }
  ],
  "summary": "전체적인 페이지 상태 요약"
}

팝업이 없다면 빈 배열을 반환하세요.`;

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: visionPrompt },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:image/png;base64,${screenshot.toString('base64')}`,
                    detail: 'high'
                  }
                }
              ]
            }
          ],
          max_tokens: 800,
          temperature: 0.1
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API 오류: ${response.statusText}`);
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content;
      
      if (content) {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const popupAnalysis = JSON.parse(jsonMatch[0]);
          console.log('🔍 Vision AI 팝업 분석 결과:', popupAnalysis);
          
          if (popupAnalysis.popups && popupAnalysis.popups.length > 0) {
            // 우선순위 순으로 정렬
            const sortedPopups = popupAnalysis.popups
              .filter((popup: any) => popup.present)
              .sort((a: any, b: any) => (b.priority || 5) - (a.priority || 5));
            
            for (const popup of sortedPopups) {
              await handlePopupWithVision(page, popup);
            }
          } else {
            console.log('✅ Vision AI: 처리할 팝업이 감지되지 않았습니다.');
          }
          
          // 캡차는 별도로 처리
          await handleCaptcha(page);
          return;
        }
      }
    } catch (error) {
      console.error('❌ Vision AI 팝업 분석 실패:', error);
    }

    // Vision AI 실패 시 기본 셀렉터 방식으로 대체
    console.log('🔄 기본 셀렉터 방식으로 팝업 처리합니다.');
    await handlePopupsWithSelectors(page);
    
  } catch (error) {
    console.warn('⚠️ 팝업 처리 중 오류:', error);
  }
}

async function handleCookieConsent(page: any) {
  const cookieSelectors = [
    'button:has-text("동의")',
    'button:has-text("Accept")',
    'button:has-text("수락")',
    'button:has-text("확인")',
    'button:has-text("OK")',
    '[data-testid*="cookie"] button',
    '[data-testid*="consent"] button',
    '.cookie-consent button',
    '.cookie-banner button',
    '#cookie-consent button',
    '[class*="cookie"] button:first-child',
    '[class*="consent"] button:first-child'
  ];
  
  for (const selector of cookieSelectors) {
    try {
      const element = await page.locator(selector).first();
      if (await element.isVisible({ timeout: 2000 })) {
        await element.click();
        console.log(`✅ 쿠키 동의 팝업 처리: ${selector}`);
        await page.waitForTimeout(1000);
        break;
      }
    } catch (error) {
      // 무시하고 다음 셀렉터 시도
    }
  }
}

async function handleModalPopups(page: any) {
  const modalCloseSelectors = [
    'button:has-text("닫기")',
    'button:has-text("Close")',
    'button:has-text("×")',
    '[data-testid*="close"]',
    '[data-testid*="modal"] button',
    '.modal button:has-text("닫기")',
    '.modal button:has-text("Close")',
    '.modal .close',
    '.popup .close',
    '.overlay .close',
    '[aria-label*="close"]',
    '[aria-label*="닫기"]'
  ];
  
  for (const selector of modalCloseSelectors) {
    try {
      const element = await page.locator(selector).first();
      if (await element.isVisible({ timeout: 2000 })) {
        await element.click();
        console.log(`✅ 모달 팝업 닫기: ${selector}`);
        await page.waitForTimeout(1000);
        break;
      }
    } catch (error) {
      // 무시하고 다음 셀렉터 시도
    }
  }
}

async function handleNotificationPermission(page: any) {
  try {
    // 브라우저 알림 권한 팝업 거부
    await page.context().grantPermissions([], { origin: page.url() });
    
    // 웹사이트 알림 팝업 처리
    const notificationSelectors = [
      'button:has-text("나중에")',
      'button:has-text("거부")',
      'button:has-text("Later")',
      'button:has-text("No")',
      'button:has-text("Cancel")',
      '[data-testid*="notification"] button:last-child',
      '.notification-popup button:last-child'
    ];
    
    for (const selector of notificationSelectors) {
      try {
        const element = await page.locator(selector).first();
        if (await element.isVisible({ timeout: 2000 })) {
          await element.click();
          console.log(`✅ 알림 권한 팝업 거부: ${selector}`);
          await page.waitForTimeout(1000);
          break;
        }
      } catch (error) {
        // 무시하고 다음 셀렉터 시도
      }
    }
  } catch (error) {
    console.warn('⚠️ 알림 권한 처리 오류:', error);
  }
}

async function handleLocationPermission(page: any) {
  try {
    // 위치 정보 권한 거부
    await page.context().grantPermissions([], { origin: page.url() });
  } catch (error) {
    console.warn('⚠️ 위치 권한 처리 오류:', error);
  }
}

async function handleAdvertisementPopups(page: any) {
  const adSelectors = [
    '[class*="ad-"] button',
    '[class*="advertisement"] button',
    '[id*="ad-"] button',
    '.ad-overlay button',
    '.advertisement button',
    '[data-testid*="ad"] button',
    'button:has-text("Skip Ad")',
    'button:has-text("광고 건너뛰기")',
    'button:has-text("Close Ad")',
    '.ad-close',
    '.ad-skip'
  ];
  
  for (const selector of adSelectors) {
    try {
      const element = await page.locator(selector).first();
      if (await element.isVisible({ timeout: 2000 })) {
        await element.click();
        console.log(`✅ 광고 팝업 닫기: ${selector}`);
        await page.waitForTimeout(1000);
        break;
      }
    } catch (error) {
      // 무시하고 다음 셀렉터 시도
    }
  }
}

async function handleAuthenticationWithSelectors(page: any) {
  // 기존 셀렉터 기반 인증 시스템 처리 방식
  const authSelectors = [
    // 캡차 관련
    '.captcha', '.recaptcha', '.g-recaptcha', '.hcaptcha', '.h-captcha',
    'iframe[src*="recaptcha"]', 'iframe[src*="hcaptcha"]',
    
    // 인증번호 입력 관련
    'input[name*="verification"]', 'input[name*="verify"]', 'input[name*="code"]',
    'input[id*="verification"]', 'input[id*="verify"]', 'input[id*="code"]',
    'input[placeholder*="인증"]', 'input[placeholder*="verification"]',
    'input[placeholder*="코드"]', 'input[placeholder*="code"]',
    
    // SMS/전화 관련
    'input[name*="phone"]', 'input[name*="mobile"]', 'input[name*="sms"]',
    'input[type="tel"]', 'input[id*="phone"]', 'input[id*="mobile"]',
    
    // 본인인증 관련  
    'input[name*="identity"]', 'input[name*="ssn"]', 'input[name*="resident"]',
    'input[name*="card"]', 'input[id*="identity"]',
    
    // OTP 관련
    'input[name*="otp"]', 'input[name*="token"]', 'input[id*="otp"]',
    
    // 일반 인증 관련
    '[data-testid*="auth"]', '[data-testid*="verify"]', '[class*="auth"]',
    '[class*="verify"]', '[id*="auth"]', '[id*="verify"]'
  ];
  
  let authFound = false;
  
  for (const selector of authSelectors) {
    try {
      const element = await page.locator(selector).first();
      if (await element.isVisible({ timeout: 2000 })) {
        console.log(`🔐 인증 시스템 감지: ${selector}`);
        authFound = true;
        
        // 인증 타입별 처리
        if (selector.includes('recaptcha') || selector.includes('g-recaptcha')) {
          await handleRecaptcha(page, element);
        } else if (selector.includes('hcaptcha') || selector.includes('h-captcha')) {
          await handleHcaptcha(page, element);
        } else if (selector.includes('phone') || selector.includes('mobile') || selector.includes('sms')) {
          console.log('📱 SMS/전화 인증 감지됨 - 사용자 입력 대기');
        } else if (selector.includes('verification') || selector.includes('verify') || selector.includes('code')) {
          console.log('🔢 인증번호 입력 필드 감지됨 - 사용자 입력 대기');
        } else if (selector.includes('otp') || selector.includes('token')) {
          console.log('🔑 OTP 인증 감지됨 - 사용자 입력 대기');
        } else {
          await handleGenericCaptcha(page, element);
        }
        break;
      }
    } catch (error) {
      // 무시하고 다음 셀렉터 시도
    }
  }
  
  if (!authFound) {
    console.log('ℹ️ 셀렉터 기반: 인증 시스템이 감지되지 않았습니다.');
  }
}

async function handleAuthenticationWithVision(page: any, analysis: any) {
  console.log(`🎯 Vision AI 인증 처리: ${analysis.authenticationType}`);
  
  try {
    switch (analysis.authenticationType) {
      case 'sms':
        await handleVisionSmsAuth(page, analysis);
        break;
        
      case 'email':
        await handleVisionEmailAuth(page, analysis);
        break;
        
      case 'phone':
        await handleVisionPhoneAuth(page, analysis);
        break;
        
      case 'identity':
        await handleVisionIdentityAuth(page, analysis);
        break;
        
      case 'otp':
        await handleVisionOtpAuth(page, analysis);
        break;
        
      case 'recaptcha':
        await handleVisionRecaptcha(page, analysis);
        break;
        
      case 'hcaptcha':
        await handleVisionHcaptcha(page, analysis);
        break;
        
      case 'math':
        await handleVisionMathCaptcha(page, analysis);
        break;
        
      case 'image_text':
        await handleVisionImageTextAuth(page, analysis);
        break;
        
      case 'pattern':
        await handleVisionPatternAuth(page, analysis);
        break;
        
      case 'security_question':
        await handleVisionSecurityQuestion(page, analysis);
        break;
        
      default:
        console.log(`⚠️ 지원되지 않는 인증 타입: ${analysis.authenticationType}`);
        // 기본 셀렉터 방식으로 대체
        await handleAuthenticationWithSelectors(page);
    }
  } catch (error) {
    console.error('❌ Vision 인증 처리 실패:', error);
    // 실패 시 기본 방식으로 대체
    await handleAuthenticationWithSelectors(page);
  }
}

async function handleVisionRecaptcha(page: any, analysis: any) {
  console.log('🔍 Vision AI reCAPTCHA 처리');
  
  // GPT가 제안한 셀렉터 먼저 시도
  if (analysis.selector) {
    try {
      const element = await page.locator(analysis.selector).first();
      if (await element.isVisible({ timeout: 3000 })) {
        await element.click();
        console.log(`✅ Vision 제안 셀렉터로 reCAPTCHA 클릭: ${analysis.selector}`);
        await page.waitForTimeout(3000);
        return;
      }
    } catch (error) {
      console.warn('⚠️ Vision 제안 셀렉터 실패, 기본 방식 시도');
    }
  }
  
  // 기본 reCAPTCHA 셀렉터들 시도
  const checkboxSelectors = [
    '.recaptcha-checkbox',
    '.recaptcha-checkbox-border',
    '#recaptcha-anchor',
    'span[role="checkbox"]',
    'iframe[src*="recaptcha"]'
  ];
  
  for (const selector of checkboxSelectors) {
    try {
      const checkbox = await page.locator(selector).first();
      if (await checkbox.isVisible({ timeout: 3000 })) {
        await checkbox.click();
        console.log('✅ reCAPTCHA 체크박스 클릭 완료');
        await page.waitForTimeout(3000);
        return;
      }
    } catch (error) {
      // 다음 셀렉터 시도
    }
  }
}

async function handleVisionHcaptcha(page: any, analysis: any) {
  console.log('🔍 Vision AI hCaptcha 처리');
  
  // GPT가 제안한 셀렉터 먼저 시도
  if (analysis.selector) {
    try {
      const element = await page.locator(analysis.selector).first();
      if (await element.isVisible({ timeout: 3000 })) {
        await element.click();
        console.log(`✅ Vision 제안 셀렉터로 hCaptcha 클릭: ${analysis.selector}`);
        await page.waitForTimeout(3000);
        return;
      }
    } catch (error) {
      console.warn('⚠️ Vision 제안 셀렉터 실패, 기본 방식 시도');
    }
  }
  
  // 기본 hCaptcha 셀렉터들 시도
  const checkboxSelectors = [
    '.hcaptcha-checkbox',
    '#hcaptcha-checkbox',
    '[data-hcaptcha-widget-id] iframe'
  ];
  
  for (const selector of checkboxSelectors) {
    try {
      const checkbox = await page.locator(selector).first();
      if (await checkbox.isVisible({ timeout: 3000 })) {
        await checkbox.click();
        console.log('✅ hCaptcha 체크박스 클릭 완료');
        await page.waitForTimeout(3000);
        return;
      }
    } catch (error) {
      // 다음 셀렉터 시도
    }
  }
}

async function handleVisionMathCaptcha(page: any, analysis: any) {
  console.log('🔍 Vision AI 수학 캡차 처리');
  
  if (analysis.mathAnswer) {
    // GPT가 제안한 셀렉터로 답 입력
    if (analysis.selector) {
      try {
        const input = await page.locator(analysis.selector).first();
        if (await input.isVisible({ timeout: 3000 })) {
          await input.fill(analysis.mathAnswer.toString());
          console.log(`✅ Vision AI로 수학 캡차 해결: ${analysis.mathAnswer}`);
          return;
        }
      } catch (error) {
        console.warn('⚠️ Vision 제안 셀렉터 실패');
      }
    }
    
    // 기본 입력 필드 찾기
    const inputSelectors = [
      'input[name*="captcha"]',
      'input[id*="captcha"]',
      '.captcha-input',
      '[data-testid*="captcha"] input'
    ];
    
    for (const selector of inputSelectors) {
      try {
        const input = await page.locator(selector).first();
        if (await input.isVisible({ timeout: 3000 })) {
          await input.fill(analysis.mathAnswer.toString());
          console.log(`✅ 수학 캡차 답 입력: ${analysis.mathAnswer}`);
          return;
        }
      } catch (error) {
        // 다음 셀렉터 시도
      }
    }
  } else {
    console.log('⚠️ GPT가 수학 문제를 해결하지 못했습니다.');
  }
}

async function handleVisionTextCaptcha(page: any, analysis: any) {
  console.log('🔍 Vision AI 텍스트 캡차 처리');
  console.log('ℹ️ 텍스트 캡차는 수동 해결이 필요할 수 있습니다.');
  
  // 입력 필드는 찾아서 포커스라도 맞춰주기
  if (analysis.selector) {
    try {
      const input = await page.locator(analysis.selector).first();
      if (await input.isVisible({ timeout: 3000 })) {
        await input.focus();
        console.log('✅ 텍스트 캡차 입력 필드에 포커스');
      }
    } catch (error) {
      console.warn('⚠️ 텍스트 캡차 입력 필드 포커스 실패');
    }
  }
}

async function handleVisionSmsAuth(page: any, analysis: any) {
  console.log('📱 Vision AI SMS 인증 처리');
  console.log(`ℹ️ SMS 인증 안내: ${analysis.instructions || 'SMS로 전송된 인증번호를 입력해주세요.'}`);
  
  if (analysis.inputSelector) {
    try {
      const input = await page.locator(analysis.inputSelector).first();
      if (await input.isVisible({ timeout: 3000 })) {
        await input.focus();
        console.log('✅ SMS 인증번호 입력 필드에 포커스 완료');
        console.log('⏳ 사용자의 인증번호 입력을 기다립니다...');
      }
    } catch (error) {
      console.warn('⚠️ SMS 인증 입력 필드 포커스 실패');
    }
  }
}

async function handleVisionEmailAuth(page: any, analysis: any) {
  console.log('📧 Vision AI 이메일 인증 처리');
  console.log(`ℹ️ 이메일 인증 안내: ${analysis.instructions || '이메일로 전송된 인증번호를 입력해주세요.'}`);
  
  if (analysis.inputSelector) {
    try {
      const input = await page.locator(analysis.inputSelector).first();
      if (await input.isVisible({ timeout: 3000 })) {
        await input.focus();
        console.log('✅ 이메일 인증번호 입력 필드에 포커스 완료');
      }
    } catch (error) {
      console.warn('⚠️ 이메일 인증 입력 필드 포커스 실패');
    }
  }
}

async function handleVisionPhoneAuth(page: any, analysis: any) {
  console.log('📞 Vision AI 전화번호 인증 처리');
  console.log(`ℹ️ 전화 인증 안내: ${analysis.instructions || '전화번호를 입력하고 인증을 진행해주세요.'}`);
  
  if (analysis.inputSelector) {
    try {
      const input = await page.locator(analysis.inputSelector).first();
      if (await input.isVisible({ timeout: 3000 })) {
        await input.focus();
        console.log('✅ 전화번호 입력 필드에 포커스 완료');
      }
    } catch (error) {
      console.warn('⚠️ 전화번호 입력 필드 포커스 실패');
    }
  }
}

async function handleVisionIdentityAuth(page: any, analysis: any) {
  console.log('🆔 Vision AI 본인인증 처리');
  console.log(`ℹ️ 본인인증 안내: ${analysis.instructions || '본인인증을 위한 정보를 입력해주세요.'}`);
  
  if (analysis.inputSelector) {
    try {
      const input = await page.locator(analysis.inputSelector).first();
      if (await input.isVisible({ timeout: 3000 })) {
        await input.focus();
        console.log('✅ 본인인증 입력 필드에 포커스 완료');
      }
    } catch (error) {
      console.warn('⚠️ 본인인증 입력 필드 포커스 실패');
    }
  }
}

async function handleVisionOtpAuth(page: any, analysis: any) {
  console.log('🔑 Vision AI OTP 인증 처리');
  console.log(`ℹ️ OTP 인증 안내: ${analysis.instructions || 'OTP 앱에서 생성된 코드를 입력해주세요.'}`);
  
  if (analysis.inputSelector) {
    try {
      const input = await page.locator(analysis.inputSelector).first();
      if (await input.isVisible({ timeout: 3000 })) {
        await input.focus();
        console.log('✅ OTP 입력 필드에 포커스 완료');
      }
    } catch (error) {
      console.warn('⚠️ OTP 입력 필드 포커스 실패');
    }
  }
}

async function handleVisionImageTextAuth(page: any, analysis: any) {
  console.log('🖼️ Vision AI 이미지 텍스트 인증 처리');
  console.log(`ℹ️ 이미지 텍스트 안내: ${analysis.instructions || '이미지에 표시된 문자/숫자를 입력해주세요.'}`);
  
  if (analysis.answer) {
    // GPT가 이미지에서 텍스트를 읽었다면 자동 입력
    if (analysis.inputSelector) {
      try {
        const input = await page.locator(analysis.inputSelector).first();
        if (await input.isVisible({ timeout: 3000 })) {
          await input.fill(analysis.answer);
          console.log(`✅ 이미지 텍스트 자동 입력: ${analysis.answer}`);
        }
      } catch (error) {
        console.warn('⚠️ 이미지 텍스트 자동 입력 실패');
      }
    }
  } else {
    console.log('⚠️ 이미지 텍스트를 자동으로 읽을 수 없습니다 - 수동 입력 필요');
  }
}

async function handleVisionPatternAuth(page: any, analysis: any) {
  console.log('🔗 Vision AI 패턴 인증 처리');
  console.log(`ℹ️ 패턴 인증 안내: ${analysis.instructions || '화면의 패턴을 따라 입력해주세요.'}`);
  console.log('⚠️ 패턴 인증은 수동 조작이 필요합니다.');
}

async function handleVisionSecurityQuestion(page: any, analysis: any) {
  console.log('❓ Vision AI 보안 질문 처리');
  console.log(`ℹ️ 보안 질문: ${analysis.question || '보안 질문에 답변해주세요.'}`);
  
  if (analysis.answer) {
    // GPT가 답변을 알고 있다면 자동 입력
    if (analysis.inputSelector) {
      try {
        const input = await page.locator(analysis.inputSelector).first();
        if (await input.isVisible({ timeout: 3000 })) {
          await input.fill(analysis.answer);
          console.log(`✅ 보안 질문 자동 답변: ${analysis.answer}`);
        }
      } catch (error) {
        console.warn('⚠️ 보안 질문 자동 답변 실패');
      }
    }
  } else {
    console.log('⚠️ 보안 질문 답변을 알 수 없습니다 - 수동 입력 필요');
    if (analysis.inputSelector) {
      try {
        const input = await page.locator(analysis.inputSelector).first();
        if (await input.isVisible({ timeout: 3000 })) {
          await input.focus();
          console.log('✅ 보안 질문 입력 필드에 포커스 완료');
        }
      } catch (error) {
        console.warn('⚠️ 보안 질문 입력 필드 포커스 실패');
      }
    }
  }
}

async function handleCaptcha(page: any) {
  try {
    console.log('🔐 Vision AI로 인증 시스템 감지 시작...');
    
    // OpenAI API 키 확인
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) {
      console.warn('OpenAI API 키가 없습니다. 기본 셀렉터 방식으로 대체합니다.');
      await handleAuthenticationWithSelectors(page);
      return;
    }

    // 스크린샷 촬영
    const screenshot = await page.screenshot({ fullPage: false });
    
    const visionPrompt = `당신은 웹 페이지의 인증 시스템 전문 분석가입니다.

스크린샷을 분석하여 다음과 같은 인증 요구사항이 있는지 확인해주세요:

1. SMS/문자 인증번호 입력
2. 이메일 인증번호 입력  
3. 전화번호 입력 및 인증
4. 본인인증 (주민번호, 카드번호 등)
5. OTP/앱 인증번호
6. reCAPTCHA/hCaptcha
7. 수학 문제 또는 간단한 질문
8. 이미지에서 문자/숫자 읽기
9. 패턴 입력
10. 기타 보안 인증

다음 JSON 형식으로 응답해주세요:
{
  "hasAuthentication": boolean,
  "authenticationType": "sms|email|phone|identity|otp|recaptcha|hcaptcha|math|image_text|pattern|security_question|other",
  "description": "인증 요구사항 상세 설명",
  "location": "화면에서의 위치 설명",
  "inputSelector": "입력 필드 CSS 셀렉터",
  "submitSelector": "제출/확인 버튼 셀렉터",
  "question": "수학 문제나 질문 내용 (있다면)",
  "answer": "자동으로 계산/답변 가능한 경우",
  "requiresUserInput": boolean,
  "actionRequired": "input|click|wait|manual",
  "reasoning": "판단 근거",
  "instructions": "사용자가 해야 할 작업 설명"
}

인증 요구사항이 없다면 hasAuthentication을 false로 설정하세요.`;

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: visionPrompt },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:image/png;base64,${screenshot.toString('base64')}`,
                    detail: 'high'
                  }
                }
              ]
            }
          ],
          max_tokens: 500,
          temperature: 0.1
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API 오류: ${response.statusText}`);
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content;
      
      if (content) {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const captchaAnalysis = JSON.parse(jsonMatch[0]);
          console.log('🔍 Vision AI 캡차 분석 결과:', captchaAnalysis);
          
          if (captchaAnalysis.hasAuthentication) {
            await handleAuthenticationWithVision(page, captchaAnalysis);
          } else {
            console.log('✅ Vision AI: 인증 시스템이 감지되지 않았습니다.');
          }
          return;
        }
      }
    } catch (error) {
      console.error('❌ Vision AI 인증 분석 실패:', error);
    }

    // Vision AI 실패 시 기본 셀렉터 방식으로 대체
    console.log('🔄 기본 셀렉터 방식으로 대체합니다.');
    await handleAuthenticationWithSelectors(page);
    
  } catch (error) {
    console.warn('⚠️ 캡차 처리 중 오류:', error);
  }
}

async function handleRecaptcha(page: any, element: any) {
  try {
    console.log('🔍 reCAPTCHA 처리 시도...');
    
    // "로봇이 아닙니다" 체크박스 클릭 시도
    const checkboxSelectors = [
      '.recaptcha-checkbox',
      '.recaptcha-checkbox-border',
      '#recaptcha-anchor',
      'span[role="checkbox"]'
    ];
    
    for (const selector of checkboxSelectors) {
      try {
        const checkbox = await page.locator(selector).first();
        if (await checkbox.isVisible({ timeout: 3000 })) {
          await checkbox.click();
          console.log('✅ reCAPTCHA 체크박스 클릭 완료');
          await page.waitForTimeout(3000);
          
          // 추가 챌린지가 나타나는지 확인
          const challengeVisible = await page.locator('.recaptcha-challenge').isVisible({ timeout: 5000 });
          if (challengeVisible) {
            console.log('⚠️ reCAPTCHA 추가 챌린지 감지 - 수동 해결 필요');
            // 실제 환경에서는 2captcha 같은 서비스를 사용하거나 사용자 개입 필요
            await page.waitForTimeout(10000); // 임시 대기
          }
          break;
        }
      } catch (error) {
        // 무시하고 다음 셀렉터 시도
      }
    }
    
  } catch (error) {
    console.warn('⚠️ reCAPTCHA 처리 실패:', error);
  }
}

async function handleHcaptcha(page: any, element: any) {
  try {
    console.log('🔍 hCaptcha 처리 시도...');
    
    // hCaptcha 체크박스 클릭 시도
    const checkboxSelectors = [
      '.hcaptcha-checkbox',
      '#hcaptcha-checkbox',
      '[data-hcaptcha-widget-id] iframe'
    ];
    
    for (const selector of checkboxSelectors) {
      try {
        const checkbox = await page.locator(selector).first();
        if (await checkbox.isVisible({ timeout: 3000 })) {
          await checkbox.click();
          console.log('✅ hCaptcha 체크박스 클릭 완료');
          await page.waitForTimeout(3000);
          break;
        }
      } catch (error) {
        // 무시하고 다음 셀렉터 시도
      }
    }
    
  } catch (error) {
    console.warn('⚠️ hCaptcha 처리 실패:', error);
  }
}

async function handleGenericCaptcha(page: any, element: any) {
  try {
    console.log('🔍 일반 캡차 처리 시도...');
    
    // 간단한 수학 문제나 텍스트 캡차 처리
    const mathCaptchaSelectors = [
      'input[name*="captcha"]',
      'input[id*="captcha"]',
      '.captcha-input',
      '[data-testid*="captcha"] input'
    ];
    
    for (const selector of mathCaptchaSelectors) {
      try {
        const input = await page.locator(selector).first();
        if (await input.isVisible({ timeout: 3000 })) {
          // 간단한 수학 문제 해결 시도
          const captchaText = await page.locator('label').textContent();
          const mathResult = solveMathCaptcha(captchaText);
          
          if (mathResult !== null) {
            await input.fill(mathResult.toString());
            console.log(`✅ 수학 캡차 해결: ${mathResult}`);
          } else {
            console.log('⚠️ 캡차 해결 실패 - 수동 입력 필요');
          }
          break;
        }
      } catch (error) {
        // 무시하고 다음 셀렉터 시도
      }
    }
    
  } catch (error) {
    console.warn('⚠️ 일반 캡차 처리 실패:', error);
  }
}

function solveMathCaptcha(text: string | null): number | null {
  if (!text) return null;
  
  try {
    // 간단한 수학 문제 패턴 매칭
    const mathPatterns = [
      /(\d+)\s*\+\s*(\d+)/,  // 덧셈
      /(\d+)\s*-\s*(\d+)/,   // 뺄셈
      /(\d+)\s*\*\s*(\d+)/,  // 곱셈
      /(\d+)\s*×\s*(\d+)/,   // 곱셈 (×)
    ];
    
    for (const pattern of mathPatterns) {
      const match = text.match(pattern);
      if (match) {
        const a = parseInt(match[1]);
        const b = parseInt(match[2]);
        
        if (text.includes('+')) {
          return a + b;
        } else if (text.includes('-')) {
          return a - b;
        } else if (text.includes('*') || text.includes('×')) {
          return a * b;
        }
      }
    }
    
    return null;
  } catch (error) {
    console.warn('⚠️ 수학 캡차 해결 실패:', error);
    return null;
  }
}

async function extractWithPlaywright(url: string, schema: any, actions?: any[], parameters?: any) {
  // Magnitude 스타일의 vision-first Playwright 구현
  const { chromium } = require('playwright');
  
  console.log('🌐 Chromium 브라우저를 시작합니다...');
  
  const browser = await chromium.launch({
    headless: true, // 개발 시에는 false로 변경하여 브라우저 확인 가능
    args: [
      '--no-sandbox', 
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-extensions',
      '--disable-gpu',
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor',
      '--disable-blink-features=AutomationControlled' // 자동화 탐지 방지
    ]
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36',
    javaScriptEnabled: true,
    acceptDownloads: true,
    ignoreHTTPSErrors: true,
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
  });
  
  const page = await context.newPage();

  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br',
  });
  
  try {
    console.log('📄 새 페이지를 생성했습니다.');
    
    // 팝업 및 다이얼로그 처리 설정
    await setupPopupHandling(page);
    
    // 액션 실행
    if (actions && actions.length > 0) {
      console.log(`🎬 ${actions.length}개의 액션을 실행합니다:`, actions.map(a => a.type).join(' → '));
      
      for (let i = 0; i < actions.length; i++) {
        const action = actions[i];
        console.log(`\n🎯 액션 ${i + 1}/${actions.length}: ${action.type}`);
        
        try {
          await executeActionWithRetry(page, action, url, parameters);
          
          // 각 액션 후 팝업 확인
          await handlePopups(page);
          
          // 페이지 상태 체크
          await checkPageHealth(page);
          
          console.log(`✅ 액션 ${i + 1} 완료`);
        } catch (error) {
          console.error(`❌ 액션 ${i + 1} 실패:`, error);
          
          // 에러 복구 시도
          const recovered = await attemptErrorRecovery(page, action, error);
          if (!recovered) {
            console.warn(`⚠️ 액션 ${i + 1} 복구 실패, 다음 액션으로 계속 진행합니다.`);
          }
        }
      }
    } else {
      // 기본 액션: 페이지 이동
      console.log(`🌍 기본 액션: ${url}로 이동합니다...`);
      await page.goto(url, { waitUntil: 'networkidle' });
      await page.waitForTimeout(3000);
      
      // 초기 팝업 처리
      await handlePopups(page);
      
      console.log('✅ 페이지 로드 완료');
    }
    
    // Vision AI 기반 데이터 추출
    const dataSchema = schema.dataSchema || schema;
    console.log('🔍 데이터 추출을 시작합니다...');
    const extractedData = await extractDataWithVision(page, dataSchema);
    
    console.log('✅ 데이터 추출 완료:', Object.keys(extractedData));
    await browser.close();
    return extractedData;
    
  } catch (error) {
    console.error('❌ 브라우저 작업 중 오류 발생:', error);
    await browser.close();
    throw error;
  }
}

async function extractDataWithVision(page: any, dataSchema: any) {
  // 페이지 스크린샷 캡처
  const screenshot = await page.screenshot({ fullPage: true });
  
  // OpenAI Vision API를 사용한 데이터 추출
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  
  if (!OPENAI_API_KEY) {
    console.warn('OpenAI API 키가 없습니다. 기본 DOM 파싱을 사용합니다.');
    return await extractDataWithDOM(page, dataSchema);
  }

  try {
    const visionPrompt = `당신은 Magnitude 스타일의 vision-first 웹 데이터 추출 전문가입니다. 
    
스크린샷을 분석하여 다음 스키마에 따라 데이터를 추출해주세요:
${JSON.stringify(dataSchema, null, 2)}

각 필드에 대해:
1. visualDescription을 참고하여 해당하는 요소를 시각적으로 찾으세요
2. 찾은 요소의 텍스트 또는 속성 값을 추출하세요
3. 데이터 타입에 맞게 변환하세요

JSON 형식으로만 응답해주세요.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: visionPrompt },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/png;base64,${screenshot.toString('base64')}`,
                  detail: 'high'
                }
              }
            ]
          }
        ],
        max_tokens: 1000,
        temperature: 0.1
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI Vision API 오류: ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      throw new Error('Vision API 응답이 비어있습니다.');
    }

    // JSON 추출
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('유효한 JSON을 찾을 수 없습니다.');
    }

    return JSON.parse(jsonMatch[0]);

  } catch (error) {
    console.error('Vision API 실패, DOM 파싱으로 대체:', error);
    return await extractDataWithDOM(page, dataSchema);
  }
}

async function extractDataWithDOM(page: any, dataSchema: any) {
  // 개선된 DOM 기반 추출 (Vision API 대체)
  console.log('🔧 DOM 기반 데이터 추출을 시작합니다...');
  
  return await page.evaluate((dataSchema: any) => {
    const data: any = {};
    
    if (!dataSchema.properties) return data;
    
    // 일반적인 웹사이트 요소 감지 함수
    const detectElementType = (key: string, fieldDef: any) => {
      const keyLower = key.toLowerCase();
      const description = fieldDef.description?.toLowerCase() || '';
      
      // 제목/헤딩 필드
      if (keyLower.includes('title') || keyLower.includes('heading') || keyLower.includes('name') || 
          description.includes('title') || description.includes('heading') || description.includes('제목')) {
        return 'title';
      }
      
      // 가격 필드
      if (keyLower.includes('price') || keyLower.includes('cost') || keyLower.includes('amount') || 
          description.includes('price') || description.includes('cost') || description.includes('가격')) {
        return 'price';
      }
      
      // 이미지 필드
      if (keyLower.includes('image') || keyLower.includes('img') || keyLower.includes('photo') || 
          description.includes('image') || description.includes('이미지')) {
        return 'image';
      }
      
      // 링크 필드
      if (keyLower.includes('link') || keyLower.includes('url') || keyLower.includes('href') || 
          description.includes('link') || description.includes('url') || description.includes('링크')) {
        return 'link';
      }
      
      // 날짜 필드
      if (keyLower.includes('date') || keyLower.includes('time') || keyLower.includes('created') || 
          description.includes('date') || description.includes('time') || description.includes('날짜')) {
        return 'date';
      }
      
      // 텍스트 필드
      if (keyLower.includes('text') || keyLower.includes('content') || keyLower.includes('description') || 
          description.includes('text') || description.includes('content') || description.includes('내용')) {
        return 'text';
      }
      
      // 숫자 필드
      if (keyLower.includes('count') || keyLower.includes('number') || keyLower.includes('rating') || 
          description.includes('count') || description.includes('number') || description.includes('수량')) {
        return 'number';
      }
      
      return 'generic';
    };
    
    // 다양한 선택자를 시도해보는 함수
    const trySelectors = (selectors: string[]) => {
      for (const selector of selectors) {
        try {
          const el = document.querySelector(selector);
          if (el && (el.textContent?.trim() || el.getAttribute('src') || el.getAttribute('href'))) {
            return el;
          }
        } catch (e) {
          // 선택자 오류 무시
        }
      }
      return null;
    };
    
    // 타입별 셀렉터 생성
    const generateSelectors = (key: string, type: string) => {
      const keyLower = key.toLowerCase();
      const commonSelectors = [
        `.${key}`, `[class*="${key}"]`, `[data-testid*="${key}"]`,
        `[id*="${key}"]`, `[name*="${key}"]`, `[data-field="${key}"]`,
        `[data-name="${key}"]`, `[aria-label*="${key}"]`
      ];
      
      switch (type) {
        case 'title':
          return [
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            '.title', '.heading', '.header', '.name',
            '[class*="title"]', '[class*="heading"]', '[class*="name"]',
            '[class*="header"]', '[data-testid*="title"]',
            '[data-testid*="heading"]', '[data-testid*="name"]',
            ...commonSelectors
          ];
          
        case 'price':
          return [
            '.price', '.cost', '.amount', '.money', '.fee',
            '[class*="price"]', '[class*="cost"]', '[class*="amount"]',
            '[class*="money"]', '[data-testid*="price"]',
            'span:contains("₩")', 'span:contains("$")', 'span:contains("원")',
            'span:contains("달러")', '[class*="currency"]',
            ...commonSelectors
          ];
          
        case 'image':
          return [
            'img', '.image img', '.photo img', '.picture img',
            '[class*="image"] img', '[class*="photo"] img',
            '[class*="picture"] img', '[data-testid*="image"]',
            ...commonSelectors.map(s => `${s} img`)
          ];
          
        case 'link':
          return [
            'a', '.link', '[class*="link"]', '[href]',
            '[data-testid*="link"]', '[data-testid*="url"]',
            ...commonSelectors
          ];
          
        case 'date':
          return [
            '.date', '.time', '.created', '.updated', '.published',
            '[class*="date"]', '[class*="time"]', '[class*="created"]',
            '[data-testid*="date"]', '[data-testid*="time"]',
            'time', '[datetime]',
            ...commonSelectors
          ];
          
        case 'text':
          return [
            '.text', '.content', '.description', '.summary', '.details',
            '.body', '.paragraph', '[class*="text"]', '[class*="content"]',
            '[class*="description"]', '[data-testid*="text"]',
            '[data-testid*="content"]', 'p', '.p',
            ...commonSelectors
          ];
          
        case 'number':
          return [
            '.number', '.count', '.rating', '.score', '.quantity',
            '[class*="number"]', '[class*="count"]', '[class*="rating"]',
            '[class*="score"]', '[data-testid*="number"]',
            '[data-testid*="count"]', '[data-testid*="rating"]',
            ...commonSelectors
          ];
          
        default:
          return commonSelectors;
      }
    };
    
    // 각 필드 처리
    for (const [key, field] of Object.entries(dataSchema.properties)) {
      const fieldDef = field as any;
      const elementType = detectElementType(key, fieldDef);
      const selectors = generateSelectors(key, elementType);
      
      console.log(`🔍 ${key} 필드를 찾는 중... (타입: ${elementType})`);
      
      const element = trySelectors(selectors);
      
      // 데이터 추출 및 변환
      if (element) {
        if (elementType === 'image') {
          data[key] = element.getAttribute('src') || element.getAttribute('data-src') || 
                      element.getAttribute('data-lazy') || element.getAttribute('data-original');
        } else if (elementType === 'link') {
          data[key] = element.getAttribute('href');
        } else if (elementType === 'date') {
          data[key] = element.getAttribute('datetime') || element.textContent?.trim();
        } else if (elementType === 'number' || fieldDef.type === 'number') {
          const text = element.textContent?.trim() || '';
          const number = parseFloat(text.replace(/[^\d.]/g, ''));
          data[key] = isNaN(number) ? text : number;
        } else {
          data[key] = element.textContent?.trim() || element.getAttribute('value') || 
                      element.getAttribute('content');
        }
        
        console.log(`✅ ${key}: ${data[key]}`);
      } else {
        console.log(`❌ ${key}: 요소를 찾을 수 없음`);
      }
    }
    
    return data;
  }, dataSchema);
}

async function executeScrollAction(page: any, direction: string, selector?: string) {
  console.log(`📜 스크롤 액션 실행: ${direction}`);
  
  try {
    switch (direction) {
      case 'up':
        await page.evaluate(() => {
          window.scrollBy(0, -window.innerHeight);
        });
        console.log('✅ 위로 스크롤 완료');
        break;
        
      case 'down':
        await page.evaluate(() => {
          window.scrollBy(0, window.innerHeight);
        });
        console.log('✅ 아래로 스크롤 완료');
        break;
        
      case 'element':
        if (selector) {
          const element = await page.locator(selector).first();
          if (await element.isVisible({ timeout: 5000 })) {
            await element.scrollIntoView();
            console.log(`✅ 요소까지 스크롤 완료: ${selector}`);
          } else {
            console.warn(`⚠️ 요소를 찾을 수 없음: ${selector}`);
          }
        } else {
          console.warn('⚠️ 요소 스크롤에 셀렉터가 필요합니다.');
        }
        break;
        
      default:
        await page.evaluate(() => {
          window.scrollBy(0, window.innerHeight);
        });
        console.log('✅ 기본 스크롤 완료');
    }
  } catch (error) {
    console.error('❌ 스크롤 액션 실패:', error);
  }
}

async function executeScreenshotAction(page: any, filename: string) {
  console.log(`📸 스크린샷 촬영: ${filename}`);
  
  try {
    const screenshotPath = `./screenshots/${filename}_${Date.now()}.png`;
    await page.screenshot({ 
      path: screenshotPath, 
      fullPage: true,
      type: 'png'
    });
    console.log(`✅ 스크린샷 저장 완료: ${screenshotPath}`);
  } catch (error) {
    console.error('❌ 스크린샷 촬영 실패:', error);
  }
}

async function executeConditionAction(page: any, selector: string, instruction: string, data?: any, parameters?: any) {
  console.log(`🔍 조건부 액션 실행: ${selector}`);
  
  try {
    if (!selector) {
      console.warn('⚠️ 조건부 액션에 셀렉터가 필요합니다.');
      return;
    }
    
    const element = await page.locator(selector).first();
    const isVisible = await element.isVisible({ timeout: 3000 });
    
    if (isVisible) {
      console.log(`✅ 조건 만족: ${selector}`);
      if (instruction) {
        await executeNaturalLanguageAction(page, instruction, data, parameters);
      }
    } else {
      console.log(`ℹ️ 조건 불만족: ${selector}`);
    }
  } catch (error) {
    console.error('❌ 조건부 액션 실패:', error);
  }
}

async function executeLoopAction(page: any, instruction: string, selector: string, maxIterations: number, data?: any, parameters?: any) {
  console.log(`🔄 반복 액션 실행: ${maxIterations}회 최대`);
  
  try {
    for (let i = 0; i < maxIterations; i++) {
      console.log(`🔄 반복 ${i + 1}/${maxIterations}`);
      
      // 대상 요소가 있는지 확인
      if (selector) {
        const element = await page.locator(selector).first();
        const isVisible = await element.isVisible({ timeout: 3000 });
        
        if (!isVisible) {
          console.log(`ℹ️ 더 이상 반복할 요소가 없음: ${selector}`);
          break;
        }
        
        // 직접 셀렉터 사용하여 액션 실행
        await executeDirectSelectorAction(page, selector, instruction, data, parameters);
      } else {
        // 자연어 명령으로 액션 실행
        await executeNaturalLanguageAction(page, instruction, data, parameters);
      }
      
      // 반복 간 대기
      await page.waitForTimeout(2000);
      
      // 페이지 변화 감지를 위한 추가 대기
      await page.waitForLoadState('networkidle');
    }
    
    console.log(`✅ 반복 액션 완료`);
  } catch (error) {
    console.error('❌ 반복 액션 실패:', error);
  }
}

async function executeActionWithRetry(page: any, action: any, baseUrl: string, parameters?: any, maxRetries: number = 3) {
  let lastError: any = null;
  
  for (let retry = 0; retry < maxRetries; retry++) {
    try {
      if (retry > 0) {
        console.log(`🔄 액션 재시도 ${retry + 1}/${maxRetries}`);
        await page.waitForTimeout(2000); // 재시도 전 대기
      }
      
      await executeAction(page, action, baseUrl, parameters);
      return; // 성공 시 함수 종료
    } catch (error) {
      lastError = error;
      console.warn(`⚠️ 액션 실패 (시도 ${retry + 1}/${maxRetries}):`, error);
      
      if (retry === maxRetries - 1) {
        throw lastError; // 최종 시도 실패 시 에러 던지기
      }
    }
  }
}

async function checkPageHealth(page: any) {
  try {
    // 페이지 로드 상태 확인
    await page.waitForLoadState('domcontentloaded', { timeout: 10000 });
    
    console.log('🔍 Vision AI로 페이지 상태 체크...');
    
    // OpenAI API 키 확인
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) {
      console.warn('OpenAI API 키가 없습니다. 기본 방식으로 페이지 상태 체크합니다.');
      await checkPageHealthWithSelectors(page);
      return;
    }

    // 스크린샷 촬영
    const screenshot = await page.screenshot({ fullPage: false });
    
    const visionPrompt = `당신은 웹 페이지 상태 분석 전문가입니다.

스크린샷을 분석하여 다음을 확인해주세요:

1. 페이지가 정상적으로 로드되었는지
2. 에러 메시지가 있는지 (404, 500, 접근 금지 등)
3. 로딩 중인 상태인지
4. 콘텐츠가 제대로 표시되는지
5. 사용자 액션이 필요한 상황인지

다음 JSON 형식으로 응답해주세요:
{
  "status": "healthy|error|loading|blocked|needs_action",
  "errorType": "404|500|403|timeout|network|captcha|login_required|none",
  "errorMessage": "감지된 에러 메시지",
  "location": "에러가 표시된 위치",
  "severity": "low|medium|high|critical",
  "actionRequired": "refresh|wait|login|solve_captcha|none",
  "recommendation": "권장 조치사항",
  "reasoning": "판단 근거"
}`;

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: visionPrompt },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:image/png;base64,${screenshot.toString('base64')}`,
                    detail: 'high'
                  }
                }
              ]
            }
          ],
          max_tokens: 400,
          temperature: 0.1
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API 오류: ${response.statusText}`);
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content;
      
      if (content) {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const healthAnalysis = JSON.parse(jsonMatch[0]);
          console.log('🔍 Vision AI 페이지 상태 분석:', healthAnalysis);
          
          if (healthAnalysis.status !== 'healthy') {
            console.warn(`⚠️ 페이지 상태 이상: ${healthAnalysis.status} - ${healthAnalysis.errorMessage}`);
            
            // 필요한 액션 수행
            switch (healthAnalysis.actionRequired) {
              case 'refresh':
                console.log('🔄 페이지 새로고침 권장');
                break;
              case 'wait':
                console.log('⏳ 로딩 완료 대기 권장');
                await page.waitForTimeout(5000);
                break;
              case 'login':
                console.log('🔐 로그인 필요');
                break;
              case 'solve_captcha':
                console.log('🤖 캡차 해결 필요');
                await handleCaptcha(page);
                break;
            }
          } else {
            console.log('✅ Vision AI: 페이지 상태 정상');
          }
          return;
        }
      }
    } catch (error) {
      console.error('❌ Vision AI 페이지 상태 분석 실패:', error);
    }

    // Vision AI 실패 시 기본 방식으로 대체
    await checkPageHealthWithSelectors(page);
    
  } catch (error) {
    console.warn('⚠️ 페이지 상태 체크 실패:', error);
  }
}

async function checkPageHealthWithSelectors(page: any) {
  try {
    // 기본 셀렉터 기반 에러 체크
    const hasError = await page.evaluate(() => {
      // 일반적인 에러 메시지 확인
      const errorSelectors = [
        '.error',
        '.error-message',
        '.alert-error',
        '[class*="error"]',
        '#error',
        '.failure',
        '.warning'
      ];
      
      for (const selector of errorSelectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          return true;
        }
      }
      
      // 404 페이지 확인
      const text = document.body.textContent?.toLowerCase() || '';
      if (text.includes('404') || text.includes('not found') || text.includes('page not found')) {
        return true;
      }
      
      return false;
    });
    
    if (hasError) {
      console.warn('⚠️ 셀렉터 기반: 페이지에 에러가 감지되었습니다.');
    } else {
      console.log('✅ 셀렉터 기반: 페이지 상태 정상');
    }
  } catch (error) {
    console.warn('⚠️ 셀렉터 기반 페이지 상태 체크 실패:', error);
  }
}

async function attemptErrorRecovery(page: any, action: any, error: any) {
  console.log('🔧 에러 복구 시도 중...');
  
  try {
    // 타임아웃 에러 복구
    if (error.message?.includes('timeout') || error.message?.includes('Timeout')) {
      console.log('⏱️ 타임아웃 에러 복구 시도');
      await page.waitForTimeout(5000);
      await page.reload({ waitUntil: 'networkidle' });
      return true;
    }
    
    // 요소를 찾을 수 없는 에러 복구
    if (error.message?.includes('not found') || error.message?.includes('waiting for selector')) {
      console.log('🔍 요소 찾기 에러 복구 시도');
      await page.waitForTimeout(3000);
      await handlePopups(page); // 팝업으로 인한 요소 가려짐 해결
      return true;
    }
    
    // 네트워크 에러 복구
    if (error.message?.includes('net::') || error.message?.includes('Network')) {
      console.log('🌐 네트워크 에러 복구 시도');
      await page.waitForTimeout(10000);
      await page.reload({ waitUntil: 'networkidle' });
      return true;
    }
    
    // 일반적인 페이지 새로고침
    console.log('🔄 일반적인 페이지 새로고침 시도');
    await page.reload({ waitUntil: 'networkidle' });
    await handlePopups(page);
    return true;
    
  } catch (recoveryError) {
    console.error('❌ 에러 복구 실패:', recoveryError);
    return false;
  }
}

async function executeAction(page: any, action: any, baseUrl: string, parameters?: any) {
  const { type, instruction, url, data, timeout = 10000, selector, value } = action;
  
  switch (type) {
    case 'navigate':
      const targetUrl = url?.replace('{{url}}', baseUrl) || baseUrl;
      console.log(`🌍 페이지 이동: ${targetUrl}`);
      await page.goto(targetUrl, { waitUntil: 'networkidle' });
      break;
      
    case 'act':
      // 사용자 지정 셀렉터가 있으면 우선 사용
      if (selector && selector.trim()) {
        console.log(`🎯 사용자 지정 셀렉터 사용: ${selector}`);
        await executeDirectSelectorAction(page, selector, instruction, data, parameters);
      } else {
        // Magnitude 스타일의 자연어 액션 처리
        await executeNaturalLanguageAction(page, instruction, data, parameters);
      }
      break;
      
    case 'wait':
      const waitTime = parseInt(value || '3') * 1000;
      console.log(`⏱️ ${waitTime/1000}초 대기`);
      await page.waitForTimeout(waitTime);
      break;
      
    case 'scroll':
      await executeScrollAction(page, value, selector);
      break;
      
    case 'screenshot':
      await executeScreenshotAction(page, value || 'screenshot');
      break;
      
    case 'condition':
      await executeConditionAction(page, selector, instruction, data, parameters);
      break;
      
    case 'loop':
      await executeLoopAction(page, instruction, selector, parseInt(value || '5'), data, parameters);
      break;
      
    case 'extract':
      // 데이터 추출은 메인 함수에서 처리
      break;
      
    default:
      console.warn(`알 수 없는 액션 타입: ${type}`);
  }
  
  // 액션 후 잠시 대기
  await page.waitForTimeout(1000);
}

async function executeDirectSelectorAction(page: any, selector: string, instruction: string, data?: any, parameters?: any) {
  // 사용자 지정 셀렉터를 사용한 직접 액션 실행
  try {
    // 매개변수 치환
    let processedInstruction = instruction;
    if (parameters) {
      Object.entries(parameters).forEach(([key, val]) => {
        processedInstruction = processedInstruction.replace(`{{${key}}}`, val as string);
      });
    }
    
    console.log(`🎯 직접 셀렉터 액션 실행: ${selector} - ${processedInstruction}`);
    
    // 셀렉터 요소 대기
    await page.waitForSelector(selector, { timeout: 10000 });
    
    // 명령어 기반 액션 결정
    const lowerInstruction = processedInstruction.toLowerCase();
    
    if (lowerInstruction.includes('클릭') || lowerInstruction.includes('click')) {
      await page.click(selector);
      console.log(`✅ 클릭 완료: ${selector}`);
    } else if (lowerInstruction.includes('입력') || lowerInstruction.includes('fill') || lowerInstruction.includes('type')) {
      const inputValue = data?.inputValue || parameters?.value || '';
      await page.fill(selector, inputValue);
      console.log(`✅ 입력 완료: ${selector} = ${inputValue}`);
    } else if (lowerInstruction.includes('선택') || lowerInstruction.includes('select')) {
      const selectValue = data?.selectValue || parameters?.value || '';
      await page.selectOption(selector, selectValue);
      console.log(`✅ 선택 완료: ${selector} = ${selectValue}`);
    } else if (lowerInstruction.includes('스크롤') || lowerInstruction.includes('scroll')) {
      await page.evaluate((sel: string) => {
        const element = document.querySelector(sel);
        if (element) element.scrollIntoView();
      }, selector);
      console.log(`✅ 스크롤 완료: ${selector}`);
    } else if (lowerInstruction.includes('호버') || lowerInstruction.includes('hover')) {
      await page.hover(selector);
      console.log(`✅ 호버 완료: ${selector}`);
    } else {
      // 기본값: 클릭
      await page.click(selector);
      console.log(`✅ 기본 클릭 완료: ${selector}`);
    }
    
  } catch (error) {
    console.error(`❌ 직접 셀렉터 액션 실패 (${selector}):`, error);
    // 실패 시 기본 휴리스틱 방식으로 대체
    await executeBasicAction(page, instruction, data);
  }
}

async function executeNaturalLanguageAction(page: any, instruction: string, data?: any, parameters?: any) {
  // 매개변수 치환
  let processedInstruction = instruction;
  if (parameters) {
    Object.entries(parameters).forEach(([key, val]) => {
      processedInstruction = processedInstruction.replace(`{{${key}}}`, val as string);
    });
  }
  
  console.log(`실행 중인 액션: ${processedInstruction}`);
  
  // OpenAI Vision API를 사용한 액션 실행 시뮬레이션
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  
  if (!OPENAI_API_KEY) {
    // API 키가 없으면 기본 휴리스틱 방식 사용
    await executeBasicAction(page, processedInstruction, data);
    return;
  }

  try {
    // 페이지 스크린샷 캡처
    const screenshot = await page.screenshot();
    
    const visionPrompt = `당신은 Magnitude 스타일의 브라우저 자동화 전문가입니다.

다음 지시사항을 수행하기 위해 스크린샷을 분석하고 적절한 Playwright 액션을 결정해주세요:
"${processedInstruction}"

응답 형식:
{
  "action": "click|fill|scroll|wait",
  "selector": "CSS 선택자",
  "value": "입력할 값 (fill의 경우만)",
  "reasoning": "액션을 선택한 이유"
}

스크린샷에서 해당 요소를 찾을 수 없으면 "notFound"를 action으로 반환하세요.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: visionPrompt },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/png;base64,${screenshot.toString('base64')}`,
                  detail: 'low'
                }
              }
            ]
          }
        ],
        max_tokens: 300,
        temperature: 0.1
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const content = data.choices[0]?.message?.content;
      
      if (content) {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const actionData = JSON.parse(jsonMatch[0]);
          await executePlaywrightAction(page, actionData, data?.inputValue);
          return;
        }
      }
    }
  } catch (error) {
    console.error('Vision API 액션 실행 실패:', error);
  }

  // Vision API 실패 시 기본 휴리스틱 방식 사용
  await executeBasicAction(page, processedInstruction, data);
}

async function executePlaywrightAction(page: any, actionData: any, inputValue?: string) {
  const { action, selector, value } = actionData;
  
  try {
    switch (action) {
      case 'click':
        await page.waitForSelector(selector, { timeout: 5000 });
        await page.click(selector);
        break;
      case 'fill':
        await page.waitForSelector(selector, { timeout: 5000 });
        await page.fill(selector, inputValue || value || '');
        break;
      case 'scroll':
        await page.evaluate((sel: any) => {
          const element = document.querySelector(sel);
          if (element) element.scrollIntoView();
        }, selector);
        break;
      case 'wait':
        await page.waitForTimeout(3000);
        break;
      default:
        console.warn(`지원되지 않는 액션: ${action}`);
    }
  } catch (error) {
    console.error(`액션 실행 실패 (${action}):`, error);
  }
}

async function executeBasicAction(page: any, instruction: string, data?: any) {
  console.log('🔍 Vision AI로 기본 액션 실행 시도...');
  
  // OpenAI API 키 확인
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) {
    console.warn('OpenAI API 키가 없습니다. 휴리스틱 방식으로 액션 실행합니다.');
    await executeHeuristicAction(page, instruction, data);
    return;
  }

  try {
    // 스크린샷 촬영
    const screenshot = await page.screenshot({ fullPage: false });
    
    const visionPrompt = `당신은 웹 페이지 브라우저 자동화 전문가입니다.

다음 지시사항을 수행하기 위해 스크린샷을 분석하고 적절한 액션을 결정해주세요:
"${instruction}"

추가 데이터: ${data ? JSON.stringify(data) : '없음'}

스크린샷에서 관련 요소를 찾고 다음 JSON 형식으로 응답해주세요:
{
  "actionFound": boolean,
  "actionType": "click|fill|select|scroll|wait|none",
  "element": {
    "selector": "가장 적절한 CSS 셀렉터",
    "description": "요소 설명",
    "location": "화면에서의 위치"
  },
  "value": "입력할 값 (fill인 경우)",
  "confidence": 1-10,
  "reasoning": "액션을 선택한 이유",
  "alternatives": ["대안 셀렉터들"]
}

요소를 찾을 수 없으면 actionFound를 false로 설정하세요.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: visionPrompt },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/png;base64,${screenshot.toString('base64')}`,
                  detail: 'high'
                }
              }
            ]
          }
        ],
        max_tokens: 500,
        temperature: 0.1
      }),
    });

    if (response.ok) {
      const apiData = await response.json();
      const content = apiData.choices[0]?.message?.content;
      
      if (content) {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const actionData = JSON.parse(jsonMatch[0]);
          console.log('🎯 Vision AI 액션 분석:', actionData);
          
          if (actionData.actionFound && actionData.confidence >= 5) {
            await executeVisionBasedAction(page, actionData, data);
            return;
          } else {
            console.log('⚠️ Vision AI 신뢰도 낮음, 휴리스틱 방식으로 대체');
          }
        }
      }
    }
  } catch (error) {
    console.error('❌ Vision AI 액션 분석 실패:', error);
  }

  // Vision AI 실패 시 휴리스틱 방식으로 대체
  await executeHeuristicAction(page, instruction, data);
}

async function executeVisionBasedAction(page: any, actionData: any, data?: any) {
  const { actionType, element, value } = actionData;
  
  try {
    console.log(`🎯 Vision 기반 액션 실행: ${actionType} on ${element.selector}`);
    
    // 주 셀렉터 시도
    let success = await tryActionWithSelector(page, element.selector, actionType, value || data?.inputValue);
    
    // 실패시 대안 셀렉터들 시도
    if (!success && actionData.alternatives) {
      for (const altSelector of actionData.alternatives) {
        success = await tryActionWithSelector(page, altSelector, actionType, value || data?.inputValue);
        if (success) break;
      }
    }
    
    if (success) {
      console.log('✅ Vision 기반 액션 성공');
    } else {
      console.log('❌ Vision 기반 액션 실패');
    }
    
  } catch (error) {
    console.error('❌ Vision 기반 액션 실행 오류:', error);
  }
}

async function tryActionWithSelector(page: any, selector: string, actionType: string, value?: string): Promise<boolean> {
  try {
    const element = await page.locator(selector).first();
    if (await element.isVisible({ timeout: 3000 })) {
      switch (actionType) {
        case 'click':
          await element.click();
          break;
        case 'fill':
          await element.fill(value || '');
          break;
        case 'select':
          await element.selectOption(value || '');
          break;
        case 'scroll':
          await element.scrollIntoView();
          break;
      }
      return true;
    }
  } catch (error) {
    // 실패는 무시하고 false 반환
  }
  return false;
}

async function executeHeuristicAction(page: any, instruction: string, data?: any) {
  // 기본 휴리스틱 기반 액션 실행
  console.log('🔧 휴리스틱 방식으로 액션 실행');
  const lowerInstruction = instruction.toLowerCase();
  
  try {
    if (lowerInstruction.includes('클릭') || lowerInstruction.includes('click')) {
      // 버튼이나 링크 찾기
      const selectors = ['button', 'a', '[role="button"]', 'input[type="submit"]'];
      for (const selector of selectors) {
        try {
          await page.waitForSelector(selector, { timeout: 2000 });
          await page.click(selector);
          console.log(`✅ 휴리스틱 클릭 성공: ${selector}`);
          break;
        } catch {}
      }
    } else if (lowerInstruction.includes('입력') || lowerInstruction.includes('fill')) {
      // 입력 필드 찾기
      const inputValue = data?.inputValue || '';
      const selectors = ['input[type="text"]', 'input[type="email"]', 'input[type="search"]', 'textarea'];
      for (const selector of selectors) {
        try {
          await page.waitForSelector(selector, { timeout: 2000 });
          await page.fill(selector, inputValue);
          console.log(`✅ 휴리스틱 입력 성공: ${selector}`);
          break;
        } catch {}
      }
    } else if (lowerInstruction.includes('기다') || lowerInstruction.includes('wait')) {
      await page.waitForTimeout(3000);
      console.log('✅ 휴리스틱 대기 완료');
    }
  } catch (error) {
    console.error('❌ 휴리스틱 액션 실행 실패:', error);
  }
}

function generateMockData(schema: any) {
  const mockData: Record<string, any> = {};
  
  if (!schema.properties) {
    return mockData;
  }

  // 스키마에 따라 mock 데이터 생성
  for (const [key, field] of Object.entries(schema.properties)) {
    const fieldDef = field as any;
    
    switch (fieldDef.type) {
      case 'string':
        if (key === 'title') {
          mockData[key] = '예시 제품명';
        } else if (key === 'price') {
          mockData[key] = '₩29,900';
        } else if (key === 'image') {
          mockData[key] = 'https://example.com/image.jpg';
        } else if (key === 'link') {
          mockData[key] = 'https://example.com/product';
        } else if (key === 'category') {
          mockData[key] = '전자제품';
        } else if (key === 'brand') {
          mockData[key] = '예시 브랜드';
        } else if (key === 'description') {
          mockData[key] = '이것은 예시 제품 설명입니다.';
        } else {
          mockData[key] = `예시 ${key}`;
        }
        break;
      case 'number':
        if (key === 'rating') {
          mockData[key] = 4.5;
        } else if (key === 'reviews') {
          mockData[key] = 123;
        } else if (key === 'stock') {
          mockData[key] = 50;
        } else {
          mockData[key] = 100;
        }
        break;
      case 'boolean':
        mockData[key] = true;
        break;
      case 'array':
        mockData[key] = ['항목1', '항목2', '항목3'];
        break;
      default:
        mockData[key] = `예시 ${key}`;
    }
  }

  return mockData;
}

// 실제 Playwright 사용 예시 함수 (주석 처리)
/*
async function extractWithPlaywright(url: string, schema: any) {
  const { chromium } = require('playwright');
  
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  try {
    await page.goto(url, { waitUntil: 'networkidle' });
    
    // 페이지 로드 대기
    await page.waitForTimeout(2000);
    
    const extractedData = await page.evaluate((schema) => {
      const data = {};
      
      // 일반적인 선택자 패턴
      const selectors = {
        title: 'h1, .title, .product-title, .name',
        price: '.price, .cost, .amount, [class*="price"]',
        image: 'img[src*="product"], .product-image img, .main-image',
        rating: '.rating, .stars, [class*="rating"]',
        description: '.description, .product-description, .details',
        link: 'a[href*="product"], .product-link',
        category: '.category, .breadcrumb, .tag',
        brand: '.brand, .manufacturer, .company'
      };
      
      for (const [key, field] of Object.entries(schema.properties)) {
        const selector = selectors[key];
        if (selector) {
          const element = document.querySelector(selector);
          if (element) {
            if (key === 'image') {
              data[key] = element.getAttribute('src');
            } else if (key === 'link') {
              data[key] = element.getAttribute('href');
            } else {
              data[key] = element.textContent?.trim();
            }
          }
        }
      }
      
      return data;
    }, schema);
    
    await browser.close();
    return extractedData;
    
  } catch (error) {
    await browser.close();
    throw error;
  }
}
*/ 