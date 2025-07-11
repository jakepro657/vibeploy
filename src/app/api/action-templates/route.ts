import { NextRequest, NextResponse } from 'next/server';
import { ActionBlockTemplate } from '@/lib/types';

export async function GET(request: NextRequest) {
  try {
    const templates = getActionBlockTemplates();
    
    return NextResponse.json({
      success: true,
      data: templates,
      metadata: {
        timestamp: new Date().toISOString(),
        totalTemplates: templates.length,
        categories: [...new Set(templates.map(t => t.category))]
      }
    });
  } catch (error) {
    console.error('액션 템플릿 조회 오류:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: '액션 템플릿 조회에 실패했습니다.',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

function getActionBlockTemplates(): ActionBlockTemplate[] {
  return [
    // 네비게이션 템플릿
    {
      id: 'template-navigate',
      name: '페이지 이동',
      description: '웹페이지로 이동하고 로딩을 대기합니다.',
      category: 'navigation',
      icon: '🌐',
      isOptional: false,
      configurableFields: ['url', 'waitForLoad'],
      defaultActions: [
        {
          id: 'nav-1',
          type: 'navigate',
          description: '페이지 이동',
          order: 1,
          url: '{{url}}',
          waitForLoad: true,
          isOptional: false,
          isEnabled: true,
          category: 'required'
        },
        {
          id: 'wait-1',
          type: 'wait',
          description: '페이지 로딩 대기',
          order: 2,
          condition: 'time',
          duration: 3000,
          isOptional: false,
          isEnabled: true,
          category: 'required'
        }
      ]
    },

    // 인증 템플릿들
    {
      id: 'template-login',
      name: '로그인',
      description: '사용자명과 비밀번호로 로그인합니다.',
      category: 'authentication',
      icon: '🔐',
      isOptional: true,
      configurableFields: ['selectors', 'credentials'],
      defaultActions: [
        {
          id: 'auth-login',
          type: 'auth',
          description: '로그인 처리',
          order: 1,
          authType: 'login',
          selectors: {
            username: 'input[type="email"], input[name="username"], input[name="email"]',
            password: 'input[type="password"], input[name="password"]',
            submit: 'button[type="submit"], button:has-text("로그인"), button:has-text("Login")'
          },
          fallbackSelectors: {
            username: ['#email', '#username', '.email-input', '.username-input'],
            password: ['#password', '.password-input'],
            submit: ['#login-btn', '.login-button', '.signin-btn']
          },
          credentials: {
            username: '{{username}}',
            password: '{{password}}'
          },
          skipIfNotFound: true,
          isOptional: true,
          isEnabled: true,
          category: 'auth'
        }
      ]
    },

    {
      id: 'template-captcha',
      name: 'CAPTCHA 해결',
      description: 'CAPTCHA 인증을 처리합니다.',
      category: 'authentication',
      icon: '🤖',
      isOptional: true,
      configurableFields: ['selectors'],
      defaultActions: [
        {
          id: 'auth-captcha',
          type: 'auth',
          description: 'CAPTCHA 처리',
          order: 1,
          authType: 'captcha',
          selectors: {
            captcha: 'iframe[src*="recaptcha"], iframe[src*="hcaptcha"], .g-recaptcha, .h-captcha'
          },
          fallbackSelectors: {
            captcha: ['[data-sitekey]', '.captcha', '#captcha']
          },
          skipIfNotFound: true,
          isOptional: true,
          isEnabled: true,
          category: 'auth'
        }
      ]
    },

    {
      id: 'template-cookie-consent',
      name: '쿠키 동의',
      description: '쿠키 동의 팝업을 처리합니다.',
      category: 'authentication',
      icon: '🍪',
      isOptional: true,
      configurableFields: ['selectors'],
      defaultActions: [
        {
          id: 'auth-cookie',
          type: 'auth',
          description: '쿠키 동의 처리',
          order: 1,
          authType: 'cookie_consent',
          selectors: {
            cookieAccept: 'button:has-text("동의"), button:has-text("Accept"), button:has-text("수락")'
          },
          fallbackSelectors: {
            cookieAccept: ['.cookie-consent button', '.cookie-banner button', '#cookie-accept']
          },
          skipIfNotFound: true,
          isOptional: true,
          isEnabled: true,
          category: 'auth'
        }
      ]
    },

    // 상호작용 템플릿들
    {
      id: 'template-search',
      name: '검색',
      description: '검색어를 입력하고 검색을 실행합니다.',
      category: 'interaction',
      icon: '🔍',
      isOptional: false,
      configurableFields: ['selector', 'value'],
      defaultActions: [
        {
          id: 'search-input',
          type: 'input',
          description: '검색어 입력',
          order: 1,
          selector: 'input[type="search"], input[name="search"], .search-input',
          value: '{{searchTerm}}',
          clear: true,
          fallbackSelectors: ['#search', '.search-field', '[placeholder*="검색"]'],
          isOptional: false,
          isEnabled: true,
          category: 'required'
        },
        {
          id: 'search-submit',
          type: 'click',
          description: '검색 실행',
          order: 2,
          selector: 'button[type="submit"], .search-btn, .search-button',
          waitAfter: 2000,
          fallbackSelectors: ['#search-btn', '.search-submit', 'button:has-text("검색")'],
          isOptional: false,
          isEnabled: true,
          category: 'required'
        }
      ]
    },

    {
      id: 'template-form-fill',
      name: '폼 입력',
      description: '폼에 데이터를 입력합니다.',
      category: 'interaction',
      icon: '📝',
      isOptional: false,
      configurableFields: ['selector', 'value'],
      defaultActions: [
        {
          id: 'form-input',
          type: 'input',
          description: '폼 데이터 입력',
          order: 1,
          selector: 'input[type="text"], textarea, select',
          value: '{{inputValue}}',
          clear: true,
          fallbackSelectors: ['.form-control', '.input-field'],
          isOptional: false,
          isEnabled: true,
          category: 'required'
        }
      ]
    },

    {
      id: 'template-click-button',
      name: '버튼 클릭',
      description: '특정 버튼이나 링크를 클릭합니다.',
      category: 'interaction',
      icon: '👆',
      isOptional: false,
      configurableFields: ['selector', 'waitAfter'],
      defaultActions: [
        {
          id: 'click-action',
          type: 'click',
          description: '버튼 클릭',
          order: 1,
          selector: 'button, a, .btn, .button',
          waitAfter: 1000,
          fallbackSelectors: ['.click-target', '[role="button"]'],
          isOptional: false,
          isEnabled: true,
          category: 'required'
        }
      ]
    },

    {
      id: 'template-scroll',
      name: '스크롤',
      description: '페이지를 스크롤합니다.',
      category: 'interaction',
      icon: '📜',
      isOptional: true,
      configurableFields: ['direction', 'distance'],
      defaultActions: [
        {
          id: 'scroll-action',
          type: 'scroll',
          description: '페이지 스크롤',
          order: 1,
          direction: 'down',
          distance: 1000,
          isOptional: true,
          isEnabled: true,
          category: 'optional'
        }
      ]
    },

    // 데이터 추출 템플릿들
    {
      id: 'template-extract-text',
      name: '텍스트 추출',
      description: '웹페이지에서 텍스트를 추출합니다.',
      category: 'extraction',
      icon: '📄',
      isOptional: false,
      configurableFields: ['selector', 'field', 'attribute', 'multiple', 'fallbackSelectors'],
      defaultActions: [
        {
          id: 'extract-text',
          type: 'extract',
          description: '텍스트 추출',
          order: 1,
          selector: '.content, .text, p, h1, h2, h3',
          field: 'text',
          attribute: 'textContent',
          multiple: false,
          fallbackSelectors: ['.description', '.title', '.content-text'],
          isOptional: false,
          isEnabled: true,
          category: 'required'
        }
      ]
    },

    {
      id: 'template-extract-links',
      name: '링크 추출',
      description: '웹페이지에서 링크를 추출합니다.',
      category: 'extraction',
      icon: '🔗',
      isOptional: false,
      configurableFields: ['selector', 'field', 'multiple', 'fallbackSelectors'],
      defaultActions: [
        {
          id: 'extract-links',
          type: 'extract',
          description: '링크 추출',
          order: 1,
          selector: 'a[href]',
          field: 'links',
          attribute: 'href',
          multiple: true,
          fallbackSelectors: ['[href]', '.link'],
          isOptional: false,
          isEnabled: true,
          category: 'required'
        }
      ]
    },

    {
      id: 'template-extract-images',
      name: '이미지 추출',
      description: '웹페이지에서 이미지를 추출합니다.',
      category: 'extraction',
      icon: '🖼️',
      isOptional: false,
      configurableFields: ['selector', 'field', 'multiple', 'fallbackSelectors'],
      defaultActions: [
        {
          id: 'extract-images',
          type: 'extract',
          description: '이미지 추출',
          order: 1,
          selector: 'img[src]',
          field: 'images',
          attribute: 'src',
          multiple: true,
          fallbackSelectors: ['[src]', '.image img'],
          isOptional: false,
          isEnabled: true,
          category: 'required'
        }
      ]
    },

    // 키 입력 템플릿들
    {
      id: 'template-keypress-enter',
      name: 'Enter 키 입력',
      description: 'Enter 키를 입력하여 폼을 제출하거나 검색을 실행합니다.',
      category: 'interaction',
      icon: '⌨️',
      isOptional: false,
      configurableFields: ['selector', 'waitAfter'],
      defaultActions: [
        {
          id: 'keypress-enter',
          type: 'keypress',
          description: 'Enter 키 입력',
          order: 1,
          key: 'Enter',
          selector: '',
          waitAfter: 1000,
          isOptional: false,
          isEnabled: true,
          category: 'required'
        }
      ]
    },

    {
      id: 'template-keypress-tab',
      name: 'Tab 키 입력',
      description: 'Tab 키를 입력하여 다음 필드로 이동합니다.',
      category: 'interaction',
      icon: '↹',
      isOptional: false,
      configurableFields: ['selector', 'waitAfter'],
      defaultActions: [
        {
          id: 'keypress-tab',
          type: 'keypress',
          description: 'Tab 키 입력',
          order: 1,
          key: 'Tab',
          selector: '',
          waitAfter: 500,
          isOptional: false,
          isEnabled: true,
          category: 'required'
        }
      ]
    },

    {
      id: 'template-keypress-escape',
      name: 'Escape 키 입력',
      description: 'Escape 키를 입력하여 모달이나 팝업을 닫습니다.',
      category: 'interaction',
      icon: '🔚',
      isOptional: true,
      configurableFields: ['selector', 'waitAfter'],
      defaultActions: [
        {
          id: 'keypress-escape',
          type: 'keypress',
          description: 'Escape 키 입력',
          order: 1,
          key: 'Escape',
          selector: '',
          waitAfter: 500,
          isOptional: true,
          isEnabled: true,
          category: 'optional'
        }
      ]
    },

    {
      id: 'template-keypress-ctrl-a',
      name: 'Ctrl+A 전체 선택',
      description: 'Ctrl+A 키 조합으로 텍스트를 전체 선택합니다.',
      category: 'interaction',
      icon: '🔤',
      isOptional: false,
      configurableFields: ['selector', 'waitAfter'],
      defaultActions: [
        {
          id: 'keypress-ctrl-a',
          type: 'keypress',
          description: 'Ctrl+A 전체 선택',
          order: 1,
          key: 'a',
          modifiers: ['Control'],
          selector: '',
          waitAfter: 500,
          isOptional: false,
          isEnabled: true,
          category: 'required'
        }
      ]
    },

    {
      id: 'template-keypress-arrows',
      name: '방향키 입력',
      description: '방향키를 입력하여 메뉴나 목록을 탐색합니다.',
      category: 'interaction',
      icon: '🏹',
      isOptional: false,
      configurableFields: ['key', 'selector', 'waitAfter'],
      defaultActions: [
        {
          id: 'keypress-arrow',
          type: 'keypress',
          description: '방향키 입력',
          order: 1,
          key: 'ArrowDown',
          selector: '',
          waitAfter: 500,
          isOptional: false,
          isEnabled: true,
          category: 'required'
        }
      ]
    },

    // 조건부 액션 템플릿들
    {
      id: 'template-if-element-exists',
      name: 'IF 요소 존재',
      description: '특정 요소가 존재하는지 확인하고 조건부 실행합니다.',
      category: 'utility',
      icon: '🔍',
      isOptional: true,
      configurableFields: ['condition', 'thenActions', 'elseActions'],
      defaultActions: [
        {
          id: 'if-element-exists',
          type: 'if',
          description: '요소 존재 여부 확인',
          order: 1,
          condition: {
            type: 'element_exists',
            selector: '.target-element'
          },
          thenActions: [],
          elseActions: [],
          isOptional: true,
          isEnabled: true,
          category: 'conditional'
        }
      ]
    },

    {
      id: 'template-if-text-contains',
      name: 'IF 텍스트 포함',
      description: '페이지에 특정 텍스트가 포함되어 있는지 확인하고 조건부 실행합니다.',
      category: 'utility',
      icon: '📝',
      isOptional: true,
      configurableFields: ['condition', 'thenActions', 'elseActions'],
      defaultActions: [
        {
          id: 'if-text-contains',
          type: 'if',
          description: '텍스트 포함 여부 확인',
          order: 1,
          condition: {
            type: 'text_contains',
            text: '로그인'
          },
          thenActions: [],
          elseActions: [],
          isOptional: true,
          isEnabled: true,
          category: 'conditional'
        }
      ]
    },

    {
      id: 'template-extract-links',
      name: '링크 추출',
      description: '웹페이지에서 링크를 추출합니다.',
      category: 'extraction',
      icon: '🔗',
      isOptional: false,
      configurableFields: ['selector', 'field'],
      defaultActions: [
        {
          id: 'extract-links',
          type: 'extract',
          description: '링크 추출',
          order: 1,
          selector: 'a[href], .link',
          field: 'links',
          attribute: 'href',
          multiple: true,
          fallbackSelectors: ['[href]', '.url'],
          isOptional: false,
          isEnabled: true,
          category: 'required'
        }
      ]
    },

    {
      id: 'template-extract-images',
      name: '이미지 추출',
      description: '웹페이지에서 이미지를 추출합니다.',
      category: 'extraction',
      icon: '🖼️',
      isOptional: false,
      configurableFields: ['selector', 'field'],
      defaultActions: [
        {
          id: 'extract-images',
          type: 'extract',
          description: '이미지 추출',
          order: 1,
          selector: 'img[src], .image',
          field: 'images',
          attribute: 'src',
          multiple: true,
          fallbackSelectors: ['[src]', '.photo', '.picture'],
          isOptional: false,
          isEnabled: true,
          category: 'required'
        }
      ]
    },

    {
      id: 'template-extract-table',
      name: '테이블 추출',
      description: '웹페이지에서 테이블 데이터를 추출합니다.',
      category: 'extraction',
      icon: '📊',
      isOptional: false,
      configurableFields: ['selector', 'field'],
      defaultActions: [
        {
          id: 'extract-table',
          type: 'extract',
          description: '테이블 데이터 추출',
          order: 1,
          selector: 'table, .table, .data-table',
          field: 'tableData',
          attribute: 'innerHTML',
          multiple: false,
          fallbackSelectors: ['.grid', '.list-table'],
          isOptional: false,
          isEnabled: true,
          category: 'required'
        }
      ]
    },

    // 유틸리티 템플릿들
    {
      id: 'template-wait',
      name: '대기',
      description: '특정 시간 또는 요소를 대기합니다.',
      category: 'utility',
      icon: '⏱️',
      isOptional: true,
      configurableFields: ['condition', 'duration', 'selector'],
      defaultActions: [
        {
          id: 'wait-action',
          type: 'wait',
          description: '대기',
          order: 1,
          condition: 'time',
          duration: 3000,
          isOptional: true,
          isEnabled: true,
          category: 'optional'
        }
      ]
    },

    {
      id: 'template-screenshot',
      name: '스크린샷',
      description: '현재 페이지의 스크린샷을 촬영합니다.',
      category: 'utility',
      icon: '📸',
      isOptional: true,
      configurableFields: ['filename'],
      defaultActions: [
        {
          id: 'screenshot-action',
          type: 'screenshot',
          description: '스크린샷 촬영',
          order: 1,
          filename: 'screenshot-{{timestamp}}.png',
          isOptional: true,
          isEnabled: true,
          category: 'optional'
        }
      ]
    },

    {
      id: 'template-conditional',
      name: '조건부 실행',
      description: '조건에 따라 다른 액션을 실행합니다.',
      category: 'utility',
      icon: '🔀',
      isOptional: true,
      configurableFields: ['condition', 'ifTrue', 'ifFalse'],
      defaultActions: [
        {
          id: 'conditional-action',
          type: 'conditional',
          description: '조건부 실행',
          order: 1,
          condition: {
            type: 'element_exists',
            selector: '.target-element'
          },
          ifTrue: [],
          ifFalse: [],
          timeout: 5000,
          isOptional: true,
          isEnabled: true,
          category: 'conditional'
        }
      ]
    },

    // 옵션 선택 템플릿들
    {
      id: 'template-option-dropdown',
      name: '드롭다운 선택',
      description: '드롭다운 메뉴에서 옵션을 선택합니다.',
      category: 'interaction',
      icon: '📋',
      isOptional: false,
      configurableFields: ['selector', 'value', 'by', 'parameterName', 'useParameter'],
      defaultActions: [
        {
          id: 'option-dropdown',
          type: 'option_select',
          description: '드롭다운 옵션 선택',
          order: 1,
          selector: 'select',
          optionType: 'dropdown',
          value: '',
          by: 'text',
          parameterName: '',
          useParameter: false,
          fallbackSelectors: ['.select', '.dropdown'],
          waitAfter: 1000,
          isOptional: false,
          isEnabled: true,
          category: 'required'
        }
      ]
    },

    {
      id: 'template-option-radio',
      name: '라디오 버튼 선택',
      description: '라디오 버튼 그룹에서 옵션을 선택합니다.',
      category: 'interaction',
      icon: '🔘',
      isOptional: false,
      configurableFields: ['selector', 'value', 'by', 'parameterName', 'useParameter'],
      defaultActions: [
        {
          id: 'option-radio',
          type: 'option_select',
          description: '라디오 버튼 선택',
          order: 1,
          selector: 'input[type="radio"]',
          optionType: 'radio',
          value: '',
          by: 'value',
          parameterName: '',
          useParameter: false,
          fallbackSelectors: ['.radio', '.option'],
          waitAfter: 500,
          isOptional: false,
          isEnabled: true,
          category: 'required'
        }
      ]
    },

    {
      id: 'template-option-checkbox',
      name: '체크박스 선택',
      description: '체크박스 옵션을 선택합니다.',
      category: 'interaction',
      icon: '☑️',
      isOptional: false,
      configurableFields: ['selector', 'value', 'by', 'parameterName', 'useParameter'],
      defaultActions: [
        {
          id: 'option-checkbox',
          type: 'option_select',
          description: '체크박스 선택',
          order: 1,
          selector: 'input[type="checkbox"]',
          optionType: 'checkbox',
          value: '',
          by: 'value',
          parameterName: '',
          useParameter: false,
          fallbackSelectors: ['.checkbox', '.check'],
          waitAfter: 500,
          isOptional: false,
          isEnabled: true,
          category: 'required'
        }
      ]
    },

    // 인증 검증 템플릿들
    {
      id: 'template-auth-otp',
      name: 'OTP 인증',
      description: '일회용 비밀번호(OTP)를 입력하여 인증합니다.',
      category: 'authentication',
      icon: '🔐',
      isOptional: false,
      configurableFields: ['inputSelector', 'submitSelector', 'successSelector', 'failureSelector', 'parameterName'],
      defaultActions: [
        {
          id: 'auth-otp',
          type: 'auth_verify',
          description: 'OTP 인증번호 입력',
          order: 1,
          verificationType: 'otp',
          inputSelector: 'input[type="text"]',
          submitSelector: 'button[type="submit"]',
          successSelector: '.success-message',
          failureSelector: '.error-message',
          value: '',
          parameterName: 'otp_code',
          useParameter: true,
          timeout: 30000,
          retryCount: 3,
          fallbackSelectors: {},
          isOptional: false,
          isEnabled: true,
          category: 'required'
        }
      ]
    },

    {
      id: 'template-auth-sms',
      name: 'SMS 인증',
      description: 'SMS로 받은 인증번호를 입력하여 인증합니다.',
      category: 'authentication',
      icon: '📱',
      isOptional: false,
      configurableFields: ['inputSelector', 'submitSelector', 'successSelector', 'failureSelector', 'parameterName'],
      defaultActions: [
        {
          id: 'auth-sms',
          type: 'auth_verify',
          description: 'SMS 인증번호 입력',
          order: 1,
          verificationType: 'sms',
          inputSelector: 'input[name="sms_code"]',
          submitSelector: 'button.verify-btn',
          successSelector: '.verification-success',
          failureSelector: '.verification-error',
          value: '',
          parameterName: 'sms_code',
          useParameter: true,
          timeout: 30000,
          retryCount: 3,
          fallbackSelectors: {},
          isOptional: false,
          isEnabled: true,
          category: 'required'
        }
      ]
    },

    {
      id: 'template-auth-email',
      name: '이메일 인증',
      description: '이메일로 받은 인증번호를 입력하여 인증합니다.',
      category: 'authentication',
      icon: '📧',
      isOptional: false,
      configurableFields: ['inputSelector', 'submitSelector', 'successSelector', 'failureSelector', 'parameterName'],
      defaultActions: [
        {
          id: 'auth-email',
          type: 'auth_verify',
          description: '이메일 인증번호 입력',
          order: 1,
          verificationType: 'email',
          inputSelector: 'input[name="email_code"]',
          submitSelector: 'button.confirm-btn',
          successSelector: '.auth-success',
          failureSelector: '.auth-error',
          value: '',
          parameterName: 'email_code',
          useParameter: true,
          timeout: 30000,
          retryCount: 3,
          fallbackSelectors: {},
          isOptional: false,
          isEnabled: true,
          category: 'required'
        }
      ]
    },

    // API 호출 템플릿
    {
      id: 'template-api-call',
      name: 'API 호출',
      description: '외부 API를 호출하여 데이터를 전송하거나 수신합니다.',
      category: 'utility',
      icon: '🌐',
      isOptional: false,
      configurableFields: ['url', 'method', 'headers', 'body', 'parameterMapping'],
      defaultActions: [
        {
          id: 'api-call',
          type: 'api_call',
          description: 'API 호출',
          order: 1,
          url: '',
          method: 'POST',
          headers: {},
          body: {},
          useFormData: false,
          parameterMapping: {},
          responseField: '',
          storeAs: '',
          timeout: 30000,
          onSuccess: [],
          onFailure: [],
          isOptional: false,
          isEnabled: true,
          category: 'required'
        }
      ]
    },

    // 팝업 전환 템플릿들
    {
      id: 'template-popup-new-tab',
      name: '새 탭 열기',
      description: '링크나 버튼을 클릭하여 새 탭에서 페이지를 엽니다.',
      category: 'interaction',
      icon: '🗗',
      isOptional: false,
      configurableFields: ['triggerSelector', 'popupUrl', 'closeOriginal'],
      defaultActions: [
        {
          id: 'popup-new-tab',
          type: 'popup_switch',
          description: '새 탭에서 페이지 열기',
          order: 1,
          popupType: 'new_tab',
          triggerSelector: 'a[target="_blank"]',
          waitForPopup: true,
          timeout: 30000,
          closeOriginal: false,
          waitAfter: 2000,
          isOptional: false,
          isEnabled: true,
          category: 'required'
        }
      ]
    },

    {
      id: 'template-popup-modal',
      name: '모달 다이얼로그',
      description: '버튼 클릭으로 모달 다이얼로그를 엽니다.',
      category: 'interaction',
      icon: '🔲',
      isOptional: false,
      configurableFields: ['triggerSelector', 'waitForPopup'],
      defaultActions: [
        {
          id: 'popup-modal',
          type: 'popup_switch',
          description: '모달 다이얼로그 열기',
          order: 1,
          popupType: 'modal',
          triggerSelector: '.modal-trigger',
          waitForPopup: true,
          timeout: 10000,
          waitAfter: 1000,
          isOptional: false,
          isEnabled: true,
          category: 'required'
        }
      ]
    },

    {
      id: 'template-popup-alert',
      name: 'JavaScript 알림창',
      description: 'JavaScript alert 대화상자를 처리합니다.',
      category: 'interaction',
      icon: '⚠️',
      isOptional: false,
      configurableFields: ['triggerSelector', 'dialogAction'],
      defaultActions: [
        {
          id: 'popup-alert',
          type: 'popup_switch',
          description: 'JavaScript 알림창 처리',
          order: 1,
          popupType: 'alert',
          triggerSelector: '.alert-trigger',
          dialogAction: 'accept',
          waitAfter: 500,
          isOptional: false,
          isEnabled: true,
          category: 'required'
        }
      ]
    },

    {
      id: 'template-popup-iframe',
      name: 'iframe 전환',
      description: 'iframe 내부로 전환하여 작업을 수행합니다.',
      category: 'interaction',
      icon: '🖼️',
      isOptional: false,
      configurableFields: ['triggerSelector'],
      defaultActions: [
        {
          id: 'popup-iframe',
          type: 'popup_switch',
          description: 'iframe으로 전환',
          order: 1,
          popupType: 'iframe',
          triggerSelector: 'iframe',
          waitAfter: 1000,
          isOptional: false,
          isEnabled: true,
          category: 'required'
        }
      ]
    },

    // 파라미터 조건부 템플릿들
    {
      id: 'template-if-parameter-equals',
      name: 'IF 파라미터 같음',
      description: '파라미터 값이 특정 값과 같은지 확인하고 조건부 실행합니다.',
      category: 'utility',
      icon: '🔍',
      isOptional: true,
      configurableFields: ['condition', 'thenActions', 'elseActions'],
      defaultActions: [
        {
          id: 'if-parameter-equals',
          type: 'if',
          description: '파라미터 값 비교',
          order: 1,
          condition: {
            type: 'parameter_equals',
            parameterName: 'user_type',
            parameterValue: 'admin'
          },
          thenActions: [],
          elseActions: [],
          isOptional: true,
          isEnabled: true,
          category: 'conditional'
        }
      ]
    },

    {
      id: 'template-if-parameter-contains',
      name: 'IF 파라미터 포함',
      description: '파라미터 값이 특정 텍스트를 포함하는지 확인하고 조건부 실행합니다.',
      category: 'utility',
      icon: '📝',
      isOptional: true,
      configurableFields: ['condition', 'thenActions', 'elseActions'],
      defaultActions: [
        {
          id: 'if-parameter-contains',
          type: 'if',
          description: '파라미터 텍스트 포함 확인',
          order: 1,
          condition: {
            type: 'parameter_contains',
            parameterName: 'search_query',
            parameterValue: 'premium'
          },
          thenActions: [],
          elseActions: [],
          isOptional: true,
          isEnabled: true,
          category: 'conditional'
        }
      ]
    }
  ];
} 