// Frontend Action Types for Sequential Execution
export interface FrontendAction {
  id: string;
  type: 'navigate' | 'extract' | 'click' | 'wait' | 'scroll' | 'input' | 'select' | 'screenshot' | 'auth' | 'conditional' | 'if' | 'keypress' | 'option_select' | 'auth_verify' | 'api_call' | 'popup_switch';
  description: string;
  order: number;
  isOptional?: boolean;
  isEnabled?: boolean;
  category?: 'required' | 'optional' | 'auth' | 'conditional';
  position?: { x: number; y: number }; // 드래그 앤 드롭 위치
}

export interface NavigateAction extends FrontendAction {
  type: 'navigate';
  url: string;
  waitForLoad?: boolean;
}

export interface ExtractAction extends FrontendAction {
  type: 'extract';
  selector: string;
  field: string;
  attribute?: string; // innerHTML, textContent, href, src, etc.
  multiple?: boolean; // for arrays
  transform?: string; // optional transformation function
  fallbackSelectors?: string[]; // 대체 셀렉터들
}

export interface ClickAction extends FrontendAction {
  type: 'click';
  selector: string;
  waitAfter?: number; // milliseconds to wait after click
  fallbackSelectors?: string[]; // 대체 셀렉터들
}

export interface WaitAction extends FrontendAction {
  type: 'wait';
  condition: 'element' | 'time' | 'network';
  selector?: string; // for element wait
  duration?: number; // for time wait
}

export interface ScrollAction extends FrontendAction {
  type: 'scroll';
  direction: 'up' | 'down' | 'top' | 'bottom';
  distance?: number; // pixels, optional
}

export interface InputAction extends FrontendAction {
  type: 'input';
  selector: string;
  value: string;
  clear?: boolean; // clear before input
  fallbackSelectors?: string[]; // 대체 셀렉터들
  parameterName?: string; // POST 파라미터명 (동적 값 사용시)
  useParameter?: boolean; // 파라미터 값 사용 여부
}

export interface SelectAction extends FrontendAction {
  type: 'select';
  selector: string;
  value: string;
  by: 'value' | 'text' | 'index';
  fallbackSelectors?: string[]; // 대체 셀렉터들
  parameterName?: string; // POST 파라미터명 (동적 값 사용시)
  useParameter?: boolean; // 파라미터 값 사용 여부
}

export interface ScreenshotAction extends FrontendAction {
  type: 'screenshot';
  filename?: string;
}

// 새로운 인증 액션 타입
export interface AuthAction extends FrontendAction {
  type: 'auth';
  authType: 'login' | 'captcha' | 'otp' | 'cookie_consent';
  selectors: {
    username?: string;
    password?: string;
    submit?: string;
    captcha?: string;
    otp?: string;
    cookieAccept?: string;
  };
  fallbackSelectors?: {
    username?: string[];
    password?: string[];
    submit?: string[];
    captcha?: string[];
    otp?: string[];
    cookieAccept?: string[];
  };
  credentials?: {
    username?: string;
    password?: string;
  };
  skipIfNotFound?: boolean;
}

// 조건부 액션 타입
export interface ConditionalAction extends FrontendAction {
  type: 'conditional';
  condition: {
    type: 'element_exists' | 'element_visible' | 'text_contains' | 'url_contains';
    selector?: string;
    text?: string;
    url?: string;
  };
  ifTrue?: AnyFrontendAction[];
  ifFalse?: AnyFrontendAction[];
  timeout?: number;
}

// IF 분기 액션 타입
export interface IfAction extends FrontendAction {
  type: 'if';
  condition: {
    type: 'element_exists' | 'element_visible' | 'text_contains' | 'url_contains' | 'value_equals' | 'parameter_equals' | 'parameter_contains' | 'custom';
    selector?: string;
    text?: string;
    url?: string;
    value?: string;
    parameterName?: string; // 파라미터명
    parameterValue?: string; // 비교할 파라미터 값
    customCondition?: string;
  };
  thenActions: AnyFrontendAction[];
  elseActions?: AnyFrontendAction[];
  timeout?: number;
}

// 키 입력 액션 타입
export interface KeypressAction extends FrontendAction {
  type: 'keypress';
  key: string; // 'Enter', 'Tab', 'Escape', 'ArrowDown', 'Control+a', etc.
  selector?: string; // 특정 요소에 포커스 후 키 입력 (옵션)
  modifiers?: string[]; // ['Control', 'Shift', 'Alt', 'Meta']
  waitAfter?: number; // 키 입력 후 대기 시간 (ms)
}

// 옵션 선택 액션 타입 (드롭다운, 라디오 버튼, 체크박스 등)
export interface OptionSelectAction extends FrontendAction {
  type: 'option_select';
  selector: string;
  optionType: 'dropdown' | 'radio' | 'checkbox' | 'multi_select';
  value: string | string[]; // 선택할 값 (다중 선택의 경우 배열)
  by: 'value' | 'text' | 'index';
  parameterName?: string; // POST 파라미터명 (동적 값 사용시)
  useParameter?: boolean; // 파라미터 값 사용 여부
  fallbackSelectors?: string[]; // 대체 셀렉터들
  waitAfter?: number; // 선택 후 대기 시간 (ms)
}

// 인증 검증 액션 타입
export interface AuthVerifyAction extends FrontendAction {
  type: 'auth_verify';
  verificationType: 'otp' | 'sms' | 'email' | 'captcha' | 'biometric';
  inputSelector: string; // 인증번호 입력 필드
  submitSelector?: string; // 확인 버튼 (옵션)
  successSelector?: string; // 성공 시 나타나는 요소
  failureSelector?: string; // 실패 시 나타나는 요소
  value?: string; // 인증번호 (파라미터로 받을 수도 있음)
  parameterName?: string; // POST 파라미터명
  useParameter?: boolean; // 파라미터 값 사용 여부
  timeout?: number; // 인증 대기 시간 (ms)
  retryCount?: number; // 재시도 횟수
  fallbackSelectors?: {
    input?: string[];
    submit?: string[];
    success?: string[];
    failure?: string[];
  };
}

// API 호출 액션 타입
export interface ApiCallAction extends FrontendAction {
  type: 'api_call';
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: any;
  useFormData?: boolean; // FormData로 전송할지 여부
  parameterMapping?: Record<string, string>; // 파라미터 매핑 (parameterName -> apiFieldName)
  responseField?: string; // 응답에서 추출할 필드
  storeAs?: string; // 결과를 저장할 변수명
  onSuccess?: AnyFrontendAction[]; // 성공 시 실행할 액션들
  onFailure?: AnyFrontendAction[]; // 실패 시 실행할 액션들
  timeout?: number; // 요청 타임아웃 (ms)
}

// 팝업 전환 액션
export interface PopupSwitchAction extends FrontendAction {
  type: 'popup_switch';
  triggerSelector?: string; // 팝업을 트리거하는 요소
  popupType: 'new_tab' | 'new_window' | 'modal' | 'dialog' | 'iframe' | 'alert' | 'confirm' | 'prompt';
  waitForPopup?: boolean; // 팝업이 나타날 때까지 대기
  timeout?: number; // 대기 시간 (ms)
  closeOriginal?: boolean; // 원본 페이지 닫기
  popupUrl?: string; // 직접 열 URL (new_tab/new_window용)
  dialogAction?: 'accept' | 'dismiss'; // alert/confirm/prompt용
  dialogInput?: string; // prompt 입력값
  waitAfter?: number; // 액션 후 대기 시간
}

export type AnyFrontendAction = 
  | NavigateAction 
  | ExtractAction 
  | ClickAction 
  | WaitAction 
  | ScrollAction 
  | InputAction 
  | SelectAction 
  | ScreenshotAction
  | AuthAction
  | ConditionalAction
  | IfAction
  | KeypressAction
  | OptionSelectAction
  | AuthVerifyAction
  | ApiCallAction
  | PopupSwitchAction;

// 액션 블록 그룹 (드래그 앤 드롭용)
export interface ActionBlock {
  id: string;
  title: string;
  description: string;
  actions: AnyFrontendAction[];
  isOptional: boolean;
  isEnabled: boolean;
  category: 'navigation' | 'authentication' | 'extraction' | 'interaction' | 'utility';
  position: { x: number; y: number };
  size: { width: number; height: number };
  connections?: string[]; // 연결된 다른 블록들의 ID
}

// 워크플로우 전체 구조
export interface WorkflowSchema {
  id: string;
  name: string;
  description: string;
  schema: any; // 데이터 스키마
  actionBlocks: ActionBlock[];
  connections: WorkflowConnection[];
  metadata: {
    totalSteps: number;
    estimatedTime: number;
    complexity: 'simple' | 'medium' | 'complex';
    createdAt: string;
    updatedAt: string;
  };
}

// 워크플로우 연결 정보
export interface WorkflowConnection {
  id: string;
  from: string; // 시작 블록 ID
  to: string; // 끝 블록 ID
  condition?: 'success' | 'failure' | 'always';
  label?: string;
}

// 액션 블록 템플릿
export interface ActionBlockTemplate {
  id: string;
  name: string;
  description: string;
  category: 'navigation' | 'authentication' | 'extraction' | 'interaction' | 'utility';
  icon: string;
  defaultActions: AnyFrontendAction[];
  isOptional: boolean;
  configurableFields: string[]; // 사용자가 설정할 수 있는 필드들
}

// 사용자 정의 셀렉터 설정
export interface SelectorConfig {
  actionId: string;
  fieldName: string; // 'selector', 'username', 'password' 등
  originalSelector: string;
  customSelector: string;
  isVerified: boolean; // 사용자가 검증했는지
  lastVerified?: string;
}

// Schema with Frontend Actions (기존 유지 + 새로운 필드 추가)
export interface SchemaWithActions {
  schema: any;
  frontendActions: AnyFrontendAction[];
  actionBlocks?: ActionBlock[];
  workflow?: WorkflowSchema;
  metadata: {
    totalSteps: number;
    estimatedTime: number; // seconds
    complexity: 'simple' | 'medium' | 'complex';
    hasOptionalBlocks?: boolean;
    hasAuthBlocks?: boolean;
  };
} 