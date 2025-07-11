'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Plus, Edit2, Trash2, Save, X, ChevronUp, ChevronDown, Move, Settings, Play, Pause, Eye, EyeOff } from 'lucide-react';

interface WebScrapingInterfaceProps {
  onApiGenerated: (data: any) => void;
  onNext: () => void;
}

interface ActionItem {
  id: string;
  type: string;
  description?: string;
  instruction?: string;
  url?: string;
  selector?: string;
  value?: string;
  data?: any;
  isEditing?: boolean;
  isOptional?: boolean;
  isEnabled?: boolean;
  category?: string;
  order?: number;
  field?: string;
  attribute?: string;
  multiple?: boolean;
  authType?: string;
  selectors?: any;
  fallbackSelectors?: string[];
  condition?: {
    type: string;
    selector?: string;
    text?: string;
    url?: string;
    value?: string;
    parameterName?: string;
    parameterValue?: string;
    customCondition?: string;
  };
  thenActions?: ActionItem[];
  elseActions?: ActionItem[];
  key?: string;
  modifiers?: string[];
  waitAfter?: number;
  // 새로운 액션 타입 필드들
  optionType?: 'dropdown' | 'radio' | 'checkbox' | 'multi_select';
  by?: 'value' | 'text' | 'index';
  parameterName?: string;
  useParameter?: boolean;
  verificationType?: 'otp' | 'sms' | 'email' | 'captcha' | 'biometric';
  inputSelector?: string;
  submitSelector?: string;
  successSelector?: string;
  failureSelector?: string;
  timeout?: number;
  retryCount?: number;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: any;
  useFormData?: boolean;
  parameterMapping?: Record<string, string>;
  responseField?: string;
  storeAs?: string;
  onSuccess?: ActionItem[];
  onFailure?: ActionItem[];
  // 팝업 전환 액션 필드들
  popupType?: 'new_tab' | 'new_window' | 'modal' | 'dialog' | 'iframe' | 'alert' | 'confirm' | 'prompt';
  triggerSelector?: string;
  waitForPopup?: boolean;
  closeOriginal?: boolean;
  popupUrl?: string;
  dialogAction?: 'accept' | 'dismiss';
  dialogInput?: string;
}

interface ActionBlock {
  id: string;
  title: string;
  description: string;
  actions: ActionItem[];
  isOptional: boolean;
  isEnabled: boolean;
  category: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  isExpanded?: boolean;
}

// 기존 validation 함수들
function getRequiredParameters(actions: any[]): string[] {
  const params = new Set<string>();
  
  actions.forEach(action => {
    // 기존 템플릿 변수 확인
    const instruction = action.instruction || '';
    const matches = instruction.match(/\{\{(\w+)\}\}/g);
    if (matches) {
      matches.forEach((match: string) => {
        const param = match.replace(/\{\{|\}\}/g, '');
        params.add(param);
      });
    }
    
    // URL 매개변수 확인
    if (action.url && action.url.includes('{{')) {
      const urlMatches = action.url.match(/\{\{(\w+)\}\}/g);
      if (urlMatches) {
        urlMatches.forEach((match: string) => {
          const param = match.replace(/\{\{|\}\}/g, '');
          params.add(param);
        });
      }
    }
    
    // 새로운 파라미터 필드들 확인
    if (action.useParameter && action.parameterName) {
      params.add(action.parameterName);
    }
    
    // 조건부 액션의 파라미터 확인
    if (action.condition?.parameterName) {
      params.add(action.condition.parameterName);
    }
    
    // API 호출 액션의 파라미터 매핑 확인
    if (action.parameterMapping) {
      Object.keys(action.parameterMapping).forEach(paramName => {
        params.add(paramName);
      });
    }
  });
  
  return Array.from(params);
}

function validateCSSSelector(selector: string): string[] {
  const errors: string[] = [];
  
  if (!selector.trim()) {
    return errors; // 빈 셀렉터는 유효함 (Vision AI 사용)
  }
  
  // 기본적인 CSS 셀렉터 유효성 검사
  try {
    // 브라우저 환경에서만 실행
    if (typeof document !== 'undefined') {
      document.querySelector(selector);
    }
  } catch (e) {
    errors.push('유효하지 않은 CSS 셀렉터입니다.');
  }
  
  // 일반적인 문제 패턴 검사
  if (selector.includes('::')) {
    errors.push('의사 요소(::)는 지원하지 않습니다.');
  }
  
  if (selector.length > 200) {
    errors.push('셀렉터가 너무 깁니다.');
  }
  
  if (selector.includes('..')) {
    errors.push('연속된 점(.)은 유효하지 않습니다.');
  }
  
  if (selector.includes('##')) {
    errors.push('연속된 해시(#)는 유효하지 않습니다.');
  }
  
  return errors;
}

function validateAction(action: ActionItem): string[] {
  const errors: string[] = [];
  
  if (!action.type) {
    errors.push('액션 타입을 선택해주세요.');
    return errors;
  }
  
  if (!action.description?.trim()) {
    errors.push('액션 설명을 입력해주세요.');
  }
  
  // 타입별 유효성 검사
  switch (action.type) {
    case 'navigate':
      if (!action.url?.trim()) {
        errors.push('이동할 URL을 입력해주세요.');
      } else if (!action.url.startsWith('http') && !action.url.includes('{{')) {
        errors.push('올바른 URL 형식이 아닙니다.');
      }
      break;
      
    case 'extract':
      if (!action.field?.trim()) {
        errors.push('추출할 필드명을 입력해주세요.');
      }
      if (!action.selector?.trim()) {
        errors.push('CSS 셀렉터를 입력해주세요.');
      }
      break;
      
    case 'input':
      if (!action.selector?.trim()) {
        errors.push('입력 필드 셀렉터를 입력해주세요.');
      }
      if (!action.value?.trim()) {
        errors.push('입력할 값을 입력해주세요.');
      }
      break;
      
    case 'click':
      if (!action.selector?.trim()) {
        errors.push('클릭할 요소의 셀렉터를 입력해주세요.');
      }
      break;
      
    case 'wait':
      const waitTime = parseInt(action.value || '0');
      if (isNaN(waitTime) || waitTime < 1 || waitTime > 30) {
        errors.push('대기 시간은 1-30초 사이여야 합니다.');
      }
      break;
  }
  
  return errors;
}

export function WebScrapingInterface({ onApiGenerated, onNext }: WebScrapingInterfaceProps) {
  const [description, setDescription] = useState('');
  const [url, setUrl] = useState('');
  const [generatedSchema, setGeneratedSchema] = useState<any>(null);
  const [extractedData, setExtractedData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [parameters, setParameters] = useState<Record<string, string>>({});
  const [editableActions, setEditableActions] = useState<ActionItem[]>([]);
  const [actionBlocks, setActionBlocks] = useState<ActionBlock[]>([]);
  const [draggedBlock, setDraggedBlock] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'blocks' | 'list'>('blocks');
  const [editingDataFields, setEditingDataFields] = useState(false);
  const [hoveredInsertPosition, setHoveredInsertPosition] = useState<{blockId: string, position: 'above' | 'below'} | null>(null);
  
  // 새로운 상태: 워크플로우 세션 관리
  const [workflowSession, setWorkflowSession] = useState<{
    sessionId: string;
    status: 'running' | 'paused' | 'completed' | 'failed';
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
    executionLog: string[];
  } | null>(null);
  const [sessionInputs, setSessionInputs] = useState<Record<string, string>>({});

  // 워크플로우에서 사용되는 파라미터들을 자동으로 감지하고 업데이트
  const updateParametersFromWorkflow = () => {
    let allActions: ActionItem[] = [];
    
    if (actionBlocks.length > 0) {
      allActions = actionBlocks.flatMap(block => block.actions);
    } else {
      allActions = editableActions;
    }
    
    const detectedParams = getRequiredParameters(allActions);
    
    // 새로 감지된 파라미터들을 기존 파라미터 목록에 추가
    const updatedParams = { ...parameters };
    let hasNewParams = false;
    
    detectedParams.forEach(paramName => {
      if (!(paramName in updatedParams)) {
        updatedParams[paramName] = '';
        hasNewParams = true;
      }
    });
    
    if (hasNewParams) {
      setParameters(updatedParams);
    }
  };

  const handleGenerateSchema = async () => {
    if (!description.trim()) {
      alert('데이터 설명을 입력해주세요.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/generate-schema', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          description,
          saveSchema: false,
          includeWorkflow: true
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '스키마 생성에 실패했습니다.');
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || '스키마 생성에 실패했습니다.');
      }
      
      const data = result.data;
      setGeneratedSchema(data);
      
      // 액션 시퀸스를 편집 가능한 형태로 변환
      if (data.frontendActions) {
        const actionsWithEditState = data.frontendActions.map((action: any) => ({
          ...action,
          isEditing: false,
          selector: action.selector || ''
        }));
        setEditableActions(actionsWithEditState);
      }

      // 액션 블록 설정
      if (data.actionBlocks) {
        const blocksWithEditState = data.actionBlocks.map((block: any) => ({
          ...block,
          isExpanded: true,
          actions: block.actions.map((actionId: string) => {
            const foundAction = data.frontendActions.find((action: any) => action.id === actionId);
            return foundAction ? { ...foundAction, isEditing: false } : { id: actionId };
          })
        }));
        setActionBlocks(blocksWithEditState);
        
        // 블록 액션들을 editableActions에도 반영
        const allBlockActions = blocksWithEditState.flatMap((block: ActionBlock) => block.actions);
        setEditableActions(allBlockActions);
      }

      // 감지된 셀렉터 정보 표시
      if (result.metadata?.detectectedSelectors?.length > 0) {
        console.log('🎯 감지된 CSS 셀렉터:', result.metadata.detectectedSelectors);
        
        const selectorCount = result.metadata.selectorCount;
        alert(`✅ 스키마 생성 완료!\n🎯 ${selectorCount}개의 CSS 셀렉터가 감지되어 자동으로 적용되었습니다.`);
      }
    } catch (error) {
      console.error('스키마 생성 오류:', error);
      alert(`스키마 생성에 실패했습니다.\n${error instanceof Error ? error.message : '다시 시도해주세요.'}`);
    } finally {
      setIsLoading(false);
    }
  };

  // 블록 관리 함수들
  const handleBlockToggle = (blockId: string) => {
    setActionBlocks(blocks => 
      blocks.map(block => 
        block.id === blockId 
          ? { ...block, isExpanded: !block.isExpanded }
          : block
      )
    );
  };

  const handleBlockEnable = (blockId: string, enabled: boolean) => {
    // 블록 상태 업데이트
    setActionBlocks(blocks => 
      blocks.map(block => 
        block.id === blockId 
          ? { ...block, isEnabled: enabled }
          : block
      )
    );
    
    // 해당 블록의 액션들도 editableActions에서 동기화
    const targetBlock = actionBlocks.find(block => block.id === blockId);
    if (targetBlock) {
      setEditableActions(actions => 
        actions.map(action => {
          const isInTargetBlock = targetBlock.actions.some(blockAction => blockAction.id === action.id);
          return isInTargetBlock 
            ? { ...action, isEnabled: enabled }
            : action;
        })
      );
    }
  };

  const handleActionEdit = (blockId: string, actionId: string, field: string, value: any) => {
    // 블록 상태 업데이트
    setActionBlocks(blocks => 
      blocks.map(block => 
        block.id === blockId 
          ? {
              ...block,
              actions: block.actions.map(action => 
                action.id === actionId 
                  ? { ...action, [field]: value }
                  : action
              )
            }
          : block
      )
    );
    
    // editableActions도 동기화
    setEditableActions(actions => 
      actions.map(action => 
        action.id === actionId 
          ? { ...action, [field]: value }
          : action
      )
    );
    
    // 파라미터 관련 필드가 변경된 경우 파라미터 목록 업데이트
    if (field === 'parameterName' || field === 'useParameter' || field === 'condition' || field === 'parameterMapping') {
      setTimeout(() => updateParametersFromWorkflow(), 100);
    }
  };

  const handleActionToggleEdit = (blockId: string, actionId: string) => {
    setActionBlocks(blocks => 
      blocks.map(block => 
        block.id === blockId 
          ? {
              ...block,
              actions: block.actions.map(action => 
                action.id === actionId 
                  ? { ...action, isEditing: !action.isEditing }
                  : action
              )
            }
          : block
      )
    );
  };

  const handleDeleteBlock = (blockId: string) => {
    if (confirm('이 블록을 삭제하시겠습니까?')) {
      setActionBlocks(blocks => blocks.filter(block => block.id !== blockId));
    }
  };

  const handleAddBlock = (insertAfterBlockId?: string) => {
    const newBlock: ActionBlock = {
      id: `block-${Date.now()}`,
      title: '새 액션 블록',
      description: '새로운 액션 블록입니다.',
      actions: [{
        id: `action-${Date.now()}`,
        type: 'navigate',
        description: '새 액션',
        isEditing: true,
        isOptional: false,
        isEnabled: true,
        category: 'required',
        order: 1
      }],
      isOptional: true,
      isEnabled: true,
      category: 'interaction',
      position: { x: 100, y: 100 },
      size: { width: 300, height: 200 },
      isExpanded: true
    };
    
    if (insertAfterBlockId) {
      const insertIndex = actionBlocks.findIndex(block => block.id === insertAfterBlockId);
      if (insertIndex !== -1) {
        const newBlocks = [...actionBlocks];
        newBlocks.splice(insertIndex + 1, 0, newBlock);
        setActionBlocks(newBlocks);
      } else {
        setActionBlocks([...actionBlocks, newBlock]);
      }
    } else {
      setActionBlocks([...actionBlocks, newBlock]);
    }
  };

  const handleInsertBlock = (targetBlockId: string, position: 'above' | 'below') => {
    const newBlock: ActionBlock = {
      id: `block-${Date.now()}`,
      title: '새 액션 블록',
      description: '새로운 액션 블록입니다.',
      actions: [{
        id: `action-${Date.now()}`,
        type: 'navigate',
        description: '새 액션',
        isEditing: true,
        isOptional: false,
        isEnabled: true,
        category: 'required',
        order: 1
      }],
      isOptional: true,
      isEnabled: true,
      category: 'interaction',
      position: { x: 100, y: 100 },
      size: { width: 300, height: 200 },
      isExpanded: true
    };
    
    const targetIndex = actionBlocks.findIndex(block => block.id === targetBlockId);
    if (targetIndex !== -1) {
      const newBlocks = [...actionBlocks];
      const insertIndex = position === 'above' ? targetIndex : targetIndex + 1;
      newBlocks.splice(insertIndex, 0, newBlock);
      setActionBlocks(newBlocks);
    }
  };

  // 드래그 앤 드롭 함수들
  const handleDragStart = (e: React.DragEvent, blockId: string) => {
    setDraggedBlock(blockId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetBlockId: string) => {
    e.preventDefault();
    
    if (!draggedBlock || draggedBlock === targetBlockId) return;
    
    const draggedIndex = actionBlocks.findIndex(block => block.id === draggedBlock);
    const targetIndex = actionBlocks.findIndex(block => block.id === targetBlockId);
    
    if (draggedIndex === -1 || targetIndex === -1) return;
    
    const newBlocks = [...actionBlocks];
    const [draggedBlockData] = newBlocks.splice(draggedIndex, 1);
    newBlocks.splice(targetIndex, 0, draggedBlockData);
    
    setActionBlocks(newBlocks);
    setDraggedBlock(null);
  };

  // 데이터 필드 관리 함수들
  const handleDataFieldEdit = (fieldName: string, property: string, value: any) => {
    if (!generatedSchema?.schema?.properties) return;
    
    const updatedSchema = {
      ...generatedSchema,
      schema: {
        ...generatedSchema.schema,
        properties: {
          ...generatedSchema.schema.properties,
          [fieldName]: {
            ...generatedSchema.schema.properties[fieldName],
            [property]: value
          }
        }
      }
    };
    
    setGeneratedSchema(updatedSchema);
  };

  const handleAddDataField = () => {
    if (!generatedSchema?.schema?.properties) return;
    
    const newFieldName = `newField_${Date.now()}`;
    const updatedSchema = {
      ...generatedSchema,
      schema: {
        ...generatedSchema.schema,
        properties: {
          ...generatedSchema.schema.properties,
          [newFieldName]: {
            type: 'string',
            description: '새 데이터 필드',
            selector: '',
            attribute: 'textContent'
          }
        }
      }
    };
    
    setGeneratedSchema(updatedSchema);
  };

  const handleDeleteDataField = (fieldName: string) => {
    if (!generatedSchema?.schema?.properties) return;
    
    const updatedProperties = { ...generatedSchema.schema.properties };
    delete updatedProperties[fieldName];
    
    const updatedSchema = {
      ...generatedSchema,
      schema: {
        ...generatedSchema.schema,
        properties: updatedProperties
      }
    };
    
    setGeneratedSchema(updatedSchema);
  };

  const handleExecuteWorkflow = async (executeWorkflow: boolean = true) => {
    if (!url.trim()) {
      alert('크롤링할 웹사이트 URL을 입력해주세요.');
      return;
    }

    if (!generatedSchema) {
      alert('먼저 데이터 스키마를 생성해주세요.');
      return;
    }

    setIsLoading(true);
    try {
      // 블록 방식에서 편집된 액션들을 수집
      let actionsToExecute = [];
      
      if (actionBlocks.length > 0) {
        // 블록 방식: 활성화된 블록의 액션들만 수집
        actionsToExecute = actionBlocks
          .filter(block => block.isEnabled)
          .flatMap(block => block.actions)
          .filter(action => action.isEnabled !== false)
          .sort((a, b) => (a.order || 0) - (b.order || 0));
      } else {
        // 기존 방식: editableActions 사용
        actionsToExecute = editableActions.filter(action => action.isEnabled !== false);
      }
      
      console.log('실행할 액션들:', actionsToExecute);
      console.log('actionBlocks 상태:', actionBlocks);
      console.log('editableActions 상태:', editableActions);
      
      const response = await fetch('/api/execute-workflow', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          url, 
          schema: generatedSchema.schema,
          actions: actionsToExecute,
          parameters,
          executeWorkflow: executeWorkflow // 실제 워크플로우 실행 여부
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.details || data.error || '워크플로우 실행에 실패했습니다.');
      }

      // 워크플로우가 일시정지된 경우
      if (data.status === 'paused') {
        setWorkflowSession({
          sessionId: data.sessionId,
          status: 'paused',
          waitingFor: data.waitingFor,
          executionLog: data.executionLog || []
        });
        
        // 입력 필드 초기화
        const initialInputs: Record<string, string> = {};
        data.waitingFor?.inputFields?.forEach((field: any) => {
          initialInputs[field.name] = '';
        });
        setSessionInputs(initialInputs);
        
        alert(`워크플로우가 일시정지되었습니다.\n${data.waitingFor?.message || '사용자 입력이 필요합니다.'}`);
        return;
      }

      // 정상 완료된 경우
      setExtractedData(data.data);
      
      onApiGenerated({
        schema: generatedSchema,
        extractedData: data.data,
        url,
        description,
      });
      
    } catch (error) {
      console.error('워크플로우 실행 오류:', error);
      
      // 더 자세한 에러 정보 표시
      let errorMessage = '워크플로우 실행에 실패했습니다.';
      if (error instanceof Error) {
        errorMessage += `\n\n오류 내용: ${error.message}`;
      }
      
      alert(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // 세션 입력 제출
  const handleSessionInputSubmit = async () => {
    if (!workflowSession?.sessionId) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/workflow-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: workflowSession.sessionId,
          action: 'provide_input',
          inputs: sessionInputs
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '입력 제출에 실패했습니다.');
      }

      // 다시 일시정지된 경우
      if (data.status === 'paused') {
        setWorkflowSession(prev => prev ? {
          ...prev,
          waitingFor: data.waitingFor,
          executionLog: data.executionLog || prev.executionLog
        } : null);
        
        // 새로운 입력 필드 초기화
        const initialInputs: Record<string, string> = {};
        data.waitingFor?.inputFields?.forEach((field: any) => {
          initialInputs[field.name] = '';
        });
        setSessionInputs(initialInputs);
        
        alert(`추가 입력이 필요합니다.\n${data.waitingFor?.message || '사용자 입력이 필요합니다.'}`);
        return;
      }

      // 완료된 경우
      if (data.status === 'completed') {
        setExtractedData(data.data);
        setWorkflowSession(null);
        
        onApiGenerated({
          schema: generatedSchema,
          extractedData: data.data,
          url,
          description,
        });
        
        alert('워크플로우가 성공적으로 완료되었습니다!');
      }

    } catch (error) {
      console.error('세션 입력 제출 오류:', error);
      alert(error instanceof Error ? error.message : '입력 제출에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 세션 취소
  const handleSessionCancel = async () => {
    if (!workflowSession?.sessionId) return;

    try {
      await fetch('/api/workflow-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: workflowSession.sessionId,
          action: 'cancel'
        }),
      });

      setWorkflowSession(null);
      setSessionInputs({});
      alert('워크플로우가 취소되었습니다.');

    } catch (error) {
      console.error('세션 취소 오류:', error);
    }
  };

  const renderActionBlock = (block: ActionBlock) => {
    const categoryColors = {
      navigation: 'bg-blue-50 border-blue-200',
      authentication: 'bg-yellow-50 border-yellow-200',
      extraction: 'bg-green-50 border-green-200',
      interaction: 'bg-purple-50 border-purple-200',
      utility: 'bg-gray-50 border-gray-200'
    };

    const categoryIcons = {
      navigation: '🌐',
      authentication: '🔐',
      extraction: '📊',
      interaction: '👆',
      utility: '🔧'
    };

    return (
      <div key={block.id} className="relative">
        {/* 위쪽 호버 영역 */}
        <div
          className="absolute -top-2 left-0 right-0 h-4 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity z-10"
          onMouseEnter={() => setHoveredInsertPosition({blockId: block.id, position: 'above'})}
          onMouseLeave={() => setHoveredInsertPosition(null)}
        >
          {hoveredInsertPosition?.blockId === block.id && hoveredInsertPosition?.position === 'above' && (
            <button
              onClick={() => handleInsertBlock(block.id, 'above')}
              className="flex items-center space-x-1 px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 shadow-md"
            >
              <Plus size={12} />
              <span>위에 추가</span>
            </button>
          )}
        </div>

        <div
          className={`border-2 rounded-lg p-4 ${categoryColors[block.category as keyof typeof categoryColors]} ${
            !block.isEnabled ? 'opacity-50' : ''
          } ${draggedBlock === block.id ? 'opacity-50' : ''}`}
          draggable
          onDragStart={(e) => handleDragStart(e, block.id)}
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, block.id)}
        >
        {/* 블록 헤더 */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <span className="text-lg">{categoryIcons[block.category as keyof typeof categoryIcons]}</span>
            <div>
              <h4 className="font-medium text-gray-800">{block.title}</h4>
              <p className="text-xs text-gray-600">{block.description}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-1">
            {/* 옵셔널 표시 */}
            {block.isOptional && (
              <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded">
                선택사항
              </span>
            )}
            
            {/* 활성화/비활성화 토글 */}
            <button
              onClick={() => handleBlockEnable(block.id, !block.isEnabled)}
              className={`p-1 rounded ${
                block.isEnabled 
                  ? 'text-green-600 hover:bg-green-100' 
                  : 'text-gray-400 hover:bg-gray-100'
              }`}
              title={block.isEnabled ? '비활성화' : '활성화'}
            >
              {block.isEnabled ? <Eye size={16} /> : <EyeOff size={16} />}
            </button>
            
            {/* 확장/축소 토글 */}
            <button
              onClick={() => handleBlockToggle(block.id)}
              className="p-1 text-gray-600 hover:bg-gray-100 rounded"
              title={block.isExpanded ? '축소' : '확장'}
            >
              {block.isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            
            {/* 드래그 핸들 */}
            <div className="p-1 text-gray-400 cursor-move">
              <Move size={16} />
            </div>
            
            {/* 삭제 버튼 */}
            <button
              onClick={() => handleDeleteBlock(block.id)}
              className="p-1 text-red-600 hover:bg-red-100 rounded"
              title="삭제"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        {/* 블록 내용 */}
        {block.isExpanded && (
          <div className="space-y-3">
            {block.actions.map((action) => (
              <div
                key={action.id}
                className="bg-white p-3 rounded border border-gray-200"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded font-medium">
                      {action.type}
                    </span>
                    <span className="text-sm font-medium text-gray-700">
                      {action.description}
                    </span>
                  </div>
                  
                  <button
                    onClick={() => handleActionToggleEdit(block.id, action.id)}
                    className="p-1 text-blue-600 hover:bg-blue-100 rounded"
                    title="편집"
                  >
                    <Edit2 size={14} />
                  </button>
                </div>

                {action.isEditing ? (
                  <div className="space-y-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        액션 타입
                      </label>
                      <select
                        value={action.type}
                        onChange={(e) => handleActionEdit(block.id, action.id, 'type', e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded text-sm"
                      >
                        <optgroup label="네비게이션">
                          <option value="navigate">navigate - 페이지 이동</option>
                        </optgroup>
                        <optgroup label="데이터 추출">
                          <option value="extract">extract - 데이터 추출</option>
                        </optgroup>
                        <optgroup label="상호작용">
                          <option value="click">click - 클릭</option>
                          <option value="input">input - 텍스트 입력</option>
                          <option value="option_select">option_select - 옵션 선택</option>
                          <option value="keypress">keypress - 키 입력</option>
                          <option value="popup_switch">popup_switch - 팝업 전환</option>
                        </optgroup>
                        <optgroup label="인증">
                          <option value="auth">auth - 기본 인증</option>
                          <option value="auth_verify">auth_verify - 인증 검증</option>
                        </optgroup>
                        <optgroup label="조건부">
                          <option value="if">if - 조건부 분기</option>
                        </optgroup>
                        <optgroup label="유틸리티">
                          <option value="wait">wait - 대기</option>
                          <option value="scroll">scroll - 스크롤</option>
                          <option value="screenshot">screenshot - 스크린샷</option>
                          <option value="api_call">api_call - API 호출</option>
                        </optgroup>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        설명
                      </label>
                      <input
                        type="text"
                        value={action.description || ''}
                        onChange={(e) => handleActionEdit(block.id, action.id, 'description', e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded text-sm"
                        placeholder="액션 설명"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        CSS 셀렉터
                      </label>
                      <input
                        type="text"
                        value={action.selector || ''}
                        onChange={(e) => handleActionEdit(block.id, action.id, 'selector', e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded text-sm"
                        placeholder="CSS 셀렉터 (예: .class-name, #id, button)"
                      />
                    </div>
                    
                    {/* 액션 타입별 추가 필드 */}
                    {action.type === 'navigate' && (
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          URL
                        </label>
                        <input
                          type="text"
                          value={action.url || ''}
                          onChange={(e) => handleActionEdit(block.id, action.id, 'url', e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded text-sm"
                          placeholder="https://example.com"
                        />
                      </div>
                    )}
                    
                    {action.type === 'input' && (
                      <div className="space-y-2">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            입력값
                          </label>
                          <input
                            type="text"
                            value={action.value || ''}
                            onChange={(e) => handleActionEdit(block.id, action.id, 'value', e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded text-sm"
                            placeholder="입력할 텍스트"
                          />
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={action.useParameter || false}
                            onChange={(e) => handleActionEdit(block.id, action.id, 'useParameter', e.target.checked)}
                            className="rounded border-gray-300"
                          />
                          <label className="text-xs text-gray-600">파라미터 값 사용</label>
                        </div>
                        
                        {action.useParameter && (
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              파라미터명
                            </label>
                            <input
                              type="text"
                              value={action.parameterName || ''}
                              onChange={(e) => handleActionEdit(block.id, action.id, 'parameterName', e.target.value)}
                              className="w-full p-2 border border-gray-300 rounded text-sm"
                              placeholder="POST 파라미터 이름"
                            />
                          </div>
                        )}
                      </div>
                    )}
                    
                    {action.type === 'extract' && (
                      <>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            필드명
                          </label>
                          <input
                            type="text"
                            value={action.field || ''}
                            onChange={(e) => handleActionEdit(block.id, action.id, 'field', e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded text-sm"
                            placeholder="추출할 데이터의 필드명"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            속성
                          </label>
                          <select
                            value={action.attribute || 'textContent'}
                            onChange={(e) => handleActionEdit(block.id, action.id, 'attribute', e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded text-sm"
                          >
                            <option value="textContent">텍스트 내용</option>
                            <option value="innerHTML">HTML 내용</option>
                            <option value="href">링크 주소</option>
                            <option value="src">이미지 소스</option>
                            <option value="value">입력값</option>
                            <option value="title">제목</option>
                            <option value="alt">대체 텍스트</option>
                          </select>
                        </div>
                        <div>
                          <label className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={action.multiple || false}
                              onChange={(e) => handleActionEdit(block.id, action.id, 'multiple', e.target.checked)}
                              className="rounded border-gray-300"
                            />
                            <span className="text-xs text-gray-600">여러 요소 추출 (배열)</span>
                          </label>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            대체 셀렉터 (쉼표로 구분)
                          </label>
                          <input
                            type="text"
                            value={action.fallbackSelectors?.join(', ') || ''}
                            onChange={(e) => handleActionEdit(block.id, action.id, 'fallbackSelectors', 
                              e.target.value.split(',').map(s => s.trim()).filter(s => s)
                            )}
                            className="w-full p-2 border border-gray-300 rounded text-sm"
                            placeholder=".backup-selector1, .backup-selector2"
                          />
                          <div className="text-xs text-gray-500 mt-1">
                            💡 메인 셀렉터가 실패할 경우 시도할 대체 셀렉터들
                          </div>
                        </div>
                      </>
                    )}
                    
                    {action.type === 'wait' && (
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          대기 시간 (초)
                        </label>
                        <input
                          type="number"
                          value={action.value || '3'}
                          onChange={(e) => handleActionEdit(block.id, action.id, 'value', e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded text-sm"
                          placeholder="3"
                          min="1"
                          max="30"
                        />
                      </div>
                    )}
                    
                    {action.type === 'if' && (
                      <div className="space-y-3 border-t pt-3">
                        <div className="text-sm font-medium text-gray-700">조건 설정</div>
                        
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            조건 타입
                          </label>
                          <select
                            value={action.condition?.type || 'element_exists'}
                            onChange={(e) => handleActionEdit(block.id, action.id, 'condition', {
                              ...action.condition,
                              type: e.target.value
                            })}
                            className="w-full p-2 border border-gray-300 rounded text-sm"
                          >
                            <option value="element_exists">요소 존재 여부</option>
                            <option value="element_visible">요소 표시 여부</option>
                            <option value="text_contains">텍스트 포함 여부</option>
                            <option value="url_contains">URL 포함 여부</option>
                            <option value="value_equals">값 일치 여부</option>
                            <option value="parameter_equals">파라미터 값 일치</option>
                            <option value="parameter_contains">파라미터 텍스트 포함</option>
                            <option value="custom">커스텀 조건</option>
                          </select>
                        </div>
                        
                        {(action.condition?.type === 'element_exists' || action.condition?.type === 'element_visible' || action.condition?.type === 'value_equals') && (
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              CSS 셀렉터
                            </label>
                            <input
                              type="text"
                              value={action.condition?.selector || ''}
                              onChange={(e) => handleActionEdit(block.id, action.id, 'condition', {
                                ...action.condition,
                                selector: e.target.value
                              })}
                              className="w-full p-2 border border-gray-300 rounded text-sm"
                              placeholder="예: .class-name, #id"
                            />
                          </div>
                        )}
                        
                        {action.condition?.type === 'text_contains' && (
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              검색할 텍스트
                            </label>
                            <input
                              type="text"
                              value={action.condition?.text || ''}
                              onChange={(e) => handleActionEdit(block.id, action.id, 'condition', {
                                ...action.condition,
                                text: e.target.value
                              })}
                              className="w-full p-2 border border-gray-300 rounded text-sm"
                              placeholder="페이지에서 찾을 텍스트"
                            />
                          </div>
                        )}
                        
                        {action.condition?.type === 'url_contains' && (
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              URL에 포함될 텍스트
                            </label>
                            <input
                              type="text"
                              value={action.condition?.url || ''}
                              onChange={(e) => handleActionEdit(block.id, action.id, 'condition', {
                                ...action.condition,
                                url: e.target.value
                              })}
                              className="w-full p-2 border border-gray-300 rounded text-sm"
                              placeholder="URL에 포함될 텍스트"
                            />
                          </div>
                        )}
                        
                        {action.condition?.type === 'value_equals' && (
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              비교할 값
                            </label>
                            <input
                              type="text"
                              value={action.condition?.value || ''}
                              onChange={(e) => handleActionEdit(block.id, action.id, 'condition', {
                                ...action.condition,
                                value: e.target.value
                              })}
                              className="w-full p-2 border border-gray-300 rounded text-sm"
                              placeholder="요소의 값과 비교할 값"
                            />
                          </div>
                        )}
                        
                        {(action.condition?.type === 'parameter_equals' || action.condition?.type === 'parameter_contains') && (
                          <>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">
                                파라미터명
                              </label>
                              <input
                                type="text"
                                value={action.condition?.parameterName || ''}
                                onChange={(e) => handleActionEdit(block.id, action.id, 'condition', {
                                  ...action.condition,
                                  parameterName: e.target.value
                                })}
                                className="w-full p-2 border border-gray-300 rounded text-sm"
                                placeholder="user_type, search_query"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">
                                비교할 값
                              </label>
                              <input
                                type="text"
                                value={action.condition?.parameterValue || ''}
                                onChange={(e) => handleActionEdit(block.id, action.id, 'condition', {
                                  ...action.condition,
                                  parameterValue: e.target.value
                                })}
                                className="w-full p-2 border border-gray-300 rounded text-sm"
                                placeholder="admin, premium"
                              />
                            </div>
                          </>
                        )}
                        
                        {action.condition?.type === 'custom' && (
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              커스텀 JavaScript 조건
                            </label>
                            <textarea
                              value={action.condition?.customCondition || ''}
                              onChange={(e) => handleActionEdit(block.id, action.id, 'condition', {
                                ...action.condition,
                                customCondition: e.target.value
                              })}
                              className="w-full p-2 border border-gray-300 rounded text-sm"
                              rows={3}
                              placeholder="return document.querySelector('.element').innerText === 'expected';"
                            />
                          </div>
                        )}
                        
                        <div className="text-xs text-gray-500 bg-blue-50 p-2 rounded">
                          💡 THEN/ELSE 액션은 별도의 블록으로 구성하여 연결하세요.
                        </div>
                      </div>
                    )}
                    
                    {action.type === 'keypress' && (
                      <div className="space-y-3 border-t pt-3">
                        <div className="text-sm font-medium text-gray-700">키 입력 설정</div>
                        
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            키 선택
                          </label>
                          <select
                            value={action.key || ''}
                            onChange={(e) => handleActionEdit(block.id, action.id, 'key', e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded text-sm"
                          >
                            <option value="">키 선택</option>
                            <optgroup label="특수 키">
                              <option value="Enter">Enter</option>
                              <option value="Tab">Tab</option>
                              <option value="Escape">Escape</option>
                              <option value="Space">Space</option>
                              <option value="Backspace">Backspace</option>
                              <option value="Delete">Delete</option>
                            </optgroup>
                            <optgroup label="방향 키">
                              <option value="ArrowUp">위쪽 화살표</option>
                              <option value="ArrowDown">아래쪽 화살표</option>
                              <option value="ArrowLeft">왼쪽 화살표</option>
                              <option value="ArrowRight">오른쪽 화살표</option>
                            </optgroup>
                            <optgroup label="기능 키">
                              <option value="F1">F1</option>
                              <option value="F2">F2</option>
                              <option value="F3">F3</option>
                              <option value="F4">F4</option>
                              <option value="F5">F5</option>
                              <option value="F12">F12</option>
                            </optgroup>
                            <optgroup label="문자/숫자">
                              <option value="a">a</option>
                              <option value="b">b</option>
                              <option value="c">c</option>
                              <option value="1">1</option>
                              <option value="2">2</option>
                              <option value="3">3</option>
                            </optgroup>
                          </select>
                        </div>
                        
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            수정자 키 (복수 선택 가능)
                          </label>
                          <div className="flex flex-wrap gap-2">
                            {['Control', 'Shift', 'Alt', 'Meta'].map(modifier => (
                              <label key={modifier} className="flex items-center space-x-1">
                                <input
                                  type="checkbox"
                                  checked={action.modifiers?.includes(modifier) || false}
                                  onChange={(e) => {
                                    const currentModifiers = action.modifiers || [];
                                    const newModifiers = e.target.checked
                                      ? [...currentModifiers, modifier]
                                      : currentModifiers.filter(m => m !== modifier);
                                    handleActionEdit(block.id, action.id, 'modifiers', newModifiers);
                                  }}
                                  className="rounded border-gray-300"
                                />
                                <span className="text-xs text-gray-600">{modifier}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                        
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            포커스할 요소 (선택사항)
                          </label>
                          <input
                            type="text"
                            value={action.selector || ''}
                            onChange={(e) => handleActionEdit(block.id, action.id, 'selector', e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded text-sm"
                            placeholder="CSS 셀렉터 (예: input[type='text'])"
                          />
                          <div className="text-xs text-gray-500 mt-1">
                            💡 비워두면 전체 페이지에 키 입력
                          </div>
                        </div>
                        
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            키 입력 후 대기 시간 (ms)
                          </label>
                          <input
                            type="number"
                            value={action.waitAfter || ''}
                            onChange={(e) => handleActionEdit(block.id, action.id, 'waitAfter', parseInt(e.target.value) || 0)}
                            className="w-full p-2 border border-gray-300 rounded text-sm"
                            placeholder="1000"
                            min="0"
                            max="10000"
                          />
                        </div>
                        
                        <div className="text-xs text-gray-500 bg-green-50 p-2 rounded">
                          💡 예시: Enter 키로 폼 제출, Tab 키로 다음 필드 이동, Ctrl+A로 전체 선택
                        </div>
                      </div>
                    )}
                    
                    {action.type === 'option_select' && (
                      <div className="space-y-2">
                        <div className="text-sm font-medium text-gray-700">옵션 선택 설정</div>
                        
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            옵션 타입
                          </label>
                          <select
                            value={action.optionType || 'dropdown'}
                            onChange={(e) => handleActionEdit(block.id, action.id, 'optionType', e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded text-sm"
                          >
                            <option value="dropdown">드롭다운 (select)</option>
                            <option value="radio">라디오 버튼</option>
                            <option value="checkbox">체크박스</option>
                            <option value="multi_select">다중 선택</option>
                          </select>
                        </div>
                        
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            CSS 셀렉터
                          </label>
                          <div className="space-y-1">
                            <input
                              type="text"
                              value={action.selector || ''}
                              onChange={(e) => handleActionEdit(block.id, action.id, 'selector', e.target.value)}
                              className="w-full p-2 border border-gray-300 rounded text-sm"
                              placeholder="CSS 셀렉터 (예: .class-name, #id, select)"
                            />
                            <div className="flex flex-wrap gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  const commonSelectors = {
                                    dropdown: 'select',
                                    radio: 'input[type="radio"]',
                                    checkbox: 'input[type="checkbox"]',
                                    multi_select: 'select[multiple]'
                                  };
                                  const selector = commonSelectors[action.optionType as keyof typeof commonSelectors] || 'select';
                                  handleActionEdit(block.id, action.id, 'selector', selector);
                                }}
                                className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                              >
                                기본
                              </button>
                              <button
                                type="button"
                                onClick={() => handleActionEdit(block.id, action.id, 'selector', '.dropdown')}
                                className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                              >
                                .dropdown
                              </button>
                              <button
                                type="button"
                                onClick={() => handleActionEdit(block.id, action.id, 'selector', '.select-wrapper')}
                                className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                              >
                                .select-wrapper
                              </button>
                              <button
                                type="button"
                                onClick={() => handleActionEdit(block.id, action.id, 'selector', '[role="combobox"]')}
                                className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                              >
                                [role="combobox"]
                              </button>
                            </div>
                          </div>
                        </div>
                        
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            선택 방법
                          </label>
                          <select
                            value={action.by || 'text'}
                            onChange={(e) => handleActionEdit(block.id, action.id, 'by', e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded text-sm"
                          >
                            <option value="text">텍스트로 선택 (권장)</option>
                            <option value="value">값으로 선택</option>
                            <option value="index">인덱스로 선택</option>
                          </select>
                        </div>
                        
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            선택할 값
                          </label>
                          <input
                            type="text"
                            value={action.value || ''}
                            onChange={(e) => handleActionEdit(block.id, action.id, 'value', e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded text-sm"
                            placeholder={
                              action.by === 'text' ? '화면에 표시되는 텍스트 (예: "서울", "남성")' :
                              action.by === 'value' ? 'HTML value 속성값 (예: "seoul", "male")' :
                              '순서 번호 (0부터 시작, 예: 0, 1, 2)'
                            }
                          />
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={action.useParameter || false}
                            onChange={(e) => handleActionEdit(block.id, action.id, 'useParameter', e.target.checked)}
                            className="rounded border-gray-300"
                          />
                          <label className="text-xs text-gray-600">파라미터 값 사용</label>
                        </div>
                        
                        {action.useParameter && (
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              파라미터명
                            </label>
                            <input
                              type="text"
                              value={action.parameterName || ''}
                              onChange={(e) => handleActionEdit(block.id, action.id, 'parameterName', e.target.value)}
                              className="w-full p-2 border border-gray-300 rounded text-sm"
                              placeholder="사용할 파라미터 이름 (예: region, gender)"
                            />
                          </div>
                        )}
                        
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            대체 셀렉터 (쉼표로 구분)
                          </label>
                          <input
                            type="text"
                            value={action.fallbackSelectors?.join(', ') || ''}
                            onChange={(e) => handleActionEdit(block.id, action.id, 'fallbackSelectors', 
                              e.target.value.split(',').map(s => s.trim()).filter(s => s)
                            )}
                            className="w-full p-2 border border-gray-300 rounded text-sm"
                            placeholder=".backup-select, .alternative-option, #fallback-dropdown"
                          />
                          <div className="text-xs text-gray-500 mt-1">
                            메인 셀렉터가 실패할 경우 시도할 백업 셀렉터들
                          </div>
                        </div>
                        
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            대기 시간 (ms)
                          </label>
                          <input
                            type="number"
                            value={action.waitAfter || '1000'}
                            onChange={(e) => handleActionEdit(block.id, action.id, 'waitAfter', parseInt(e.target.value) || 1000)}
                            className="w-full p-2 border border-gray-300 rounded text-sm"
                            placeholder="1000"
                            min="0"
                            max="10000"
                          />
                        </div>
                        
                        <div className="text-xs text-gray-500 bg-blue-50 p-3 rounded">
                          <div className="font-medium mb-2">💡 옵션 선택 팁:</div>
                          <div className="space-y-1">
                            <div>• <strong>텍스트 선택:</strong> 사용자가 보는 텍스트 그대로 입력 (대소문자 무관)</div>
                            <div>• <strong>부분 일치:</strong> 전체 텍스트의 일부만 입력해도 찾을 수 있음</div>
                            <div>• <strong>커스텀 드롭다운:</strong> 일반 select가 아닌 div/ul 기반 드롭다운도 자동 처리</div>
                            <div>• <strong>대체 셀렉터:</strong> 여러 후보를 설정하여 성공률 향상</div>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {action.type === 'popup_switch' && (
                      <div className="space-y-2">
                        <div className="text-sm font-medium text-gray-700">팝업 전환 설정</div>
                        
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            팝업 타입
                          </label>
                          <select
                            value={action.popupType || 'new_tab'}
                            onChange={(e) => handleActionEdit(block.id, action.id, 'popupType', e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded text-sm"
                          >
                            <option value="new_tab">새 탭</option>
                            <option value="new_window">새 창</option>
                            <option value="modal">모달 다이얼로그</option>
                            <option value="dialog">팝업 다이얼로그</option>
                            <option value="iframe">iframe 전환</option>
                            <option value="alert">알림창 (alert)</option>
                            <option value="confirm">확인창 (confirm)</option>
                            <option value="prompt">입력창 (prompt)</option>
                          </select>
                        </div>
                        
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            트리거 셀렉터 (선택사항)
                          </label>
                          <input
                            type="text"
                            value={action.triggerSelector || ''}
                            onChange={(e) => handleActionEdit(block.id, action.id, 'triggerSelector', e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded text-sm"
                            placeholder="팝업을 여는 버튼이나 링크의 셀렉터"
                          />
                        </div>
                        
                        {(action.popupType === 'new_tab' || action.popupType === 'new_window') && (
                          <>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">
                                직접 열 URL (선택사항)
                              </label>
                              <input
                                type="text"
                                value={action.popupUrl || ''}
                                onChange={(e) => handleActionEdit(block.id, action.id, 'popupUrl', e.target.value)}
                                className="w-full p-2 border border-gray-300 rounded text-sm"
                                placeholder="https://example.com"
                              />
                            </div>
                            
                            <div className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                checked={action.closeOriginal || false}
                                onChange={(e) => handleActionEdit(block.id, action.id, 'closeOriginal', e.target.checked)}
                                className="rounded border-gray-300"
                              />
                              <label className="text-xs text-gray-600">원본 페이지 닫기</label>
                            </div>
                          </>
                        )}
                        
                        {(action.popupType === 'alert' || action.popupType === 'confirm' || action.popupType === 'prompt') && (
                          <>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">
                                대화상자 액션
                              </label>
                              <select
                                value={action.dialogAction || 'accept'}
                                onChange={(e) => handleActionEdit(block.id, action.id, 'dialogAction', e.target.value)}
                                className="w-full p-2 border border-gray-300 rounded text-sm"
                              >
                                <option value="accept">확인/수락</option>
                                <option value="dismiss">취소/거부</option>
                              </select>
                            </div>
                            
                            {action.popupType === 'prompt' && (
                              <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">
                                  입력값 (prompt용)
                                </label>
                                <input
                                  type="text"
                                  value={action.dialogInput || ''}
                                  onChange={(e) => handleActionEdit(block.id, action.id, 'dialogInput', e.target.value)}
                                  className="w-full p-2 border border-gray-300 rounded text-sm"
                                  placeholder="prompt에 입력할 값"
                                />
                              </div>
                            )}
                          </>
                        )}
                        
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={action.waitForPopup !== false}
                            onChange={(e) => handleActionEdit(block.id, action.id, 'waitForPopup', e.target.checked)}
                            className="rounded border-gray-300"
                          />
                          <label className="text-xs text-gray-600">팝업 나타날 때까지 대기</label>
                        </div>
                        
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            타임아웃 (ms)
                          </label>
                          <input
                            type="number"
                            value={action.timeout || '30000'}
                            onChange={(e) => handleActionEdit(block.id, action.id, 'timeout', parseInt(e.target.value) || 30000)}
                            className="w-full p-2 border border-gray-300 rounded text-sm"
                            placeholder="30000"
                            min="1000"
                            max="120000"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            대기 시간 (ms)
                          </label>
                          <input
                            type="number"
                            value={action.waitAfter || '2000'}
                            onChange={(e) => handleActionEdit(block.id, action.id, 'waitAfter', parseInt(e.target.value) || 2000)}
                            className="w-full p-2 border border-gray-300 rounded text-sm"
                            placeholder="2000"
                            min="0"
                            max="10000"
                          />
                        </div>
                        
                        <div className="text-xs text-gray-500 bg-purple-50 p-2 rounded">
                          💡 팝업 전환 유형:
                          <br />• 새 탭/창: 링크나 버튼 클릭으로 새 페이지 열기
                          <br />• 모달: 페이지 위에 나타나는 팝업창
                          <br />• iframe: 페이지 내 프레임으로 전환
                          <br />• alert/confirm/prompt: JavaScript 대화상자
                        </div>
                      </div>
                    )}
                    
                    {action.type === 'auth_verify' && (
                      <div className="space-y-2">
                        <div className="text-sm font-medium text-gray-700">인증 검증 설정</div>
                        
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            인증 타입
                          </label>
                          <select
                            value={action.verificationType || 'otp'}
                            onChange={(e) => handleActionEdit(block.id, action.id, 'verificationType', e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded text-sm"
                          >
                            <option value="otp">OTP (일회용 비밀번호)</option>
                            <option value="sms">SMS 인증</option>
                            <option value="email">이메일 인증</option>
                            <option value="captcha">캡차 인증</option>
                            <option value="biometric">생체 인증</option>
                          </select>
                        </div>
                        
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            인증번호 입력 필드 셀렉터
                          </label>
                          <input
                            type="text"
                            value={action.inputSelector || ''}
                            onChange={(e) => handleActionEdit(block.id, action.id, 'inputSelector', e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded text-sm"
                            placeholder="input[type='text'], .auth-input"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            확인 버튼 셀렉터 (선택사항)
                          </label>
                          <input
                            type="text"
                            value={action.submitSelector || ''}
                            onChange={(e) => handleActionEdit(block.id, action.id, 'submitSelector', e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded text-sm"
                            placeholder="button[type='submit'], .verify-btn"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            성공 확인 셀렉터 (선택사항)
                          </label>
                          <input
                            type="text"
                            value={action.successSelector || ''}
                            onChange={(e) => handleActionEdit(block.id, action.id, 'successSelector', e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded text-sm"
                            placeholder=".success-message, .auth-success"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            실패 확인 셀렉터 (선택사항)
                          </label>
                          <input
                            type="text"
                            value={action.failureSelector || ''}
                            onChange={(e) => handleActionEdit(block.id, action.id, 'failureSelector', e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded text-sm"
                            placeholder=".error-message, .auth-error"
                          />
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={action.useParameter || false}
                            onChange={(e) => handleActionEdit(block.id, action.id, 'useParameter', e.target.checked)}
                            className="rounded border-gray-300"
                          />
                          <label className="text-xs text-gray-600">파라미터에서 인증번호 가져오기</label>
                        </div>
                        
                        {action.useParameter && (
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              파라미터명
                            </label>
                            <input
                              type="text"
                              value={action.parameterName || ''}
                              onChange={(e) => handleActionEdit(block.id, action.id, 'parameterName', e.target.value)}
                              className="w-full p-2 border border-gray-300 rounded text-sm"
                              placeholder="auth_code, otp_code, sms_code"
                            />
                          </div>
                        )}
                        
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            타임아웃 (ms)
                          </label>
                          <input
                            type="number"
                            value={action.timeout || '30000'}
                            onChange={(e) => handleActionEdit(block.id, action.id, 'timeout', parseInt(e.target.value) || 30000)}
                            className="w-full p-2 border border-gray-300 rounded text-sm"
                            placeholder="30000"
                            min="1000"
                            max="120000"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            재시도 횟수
                          </label>
                          <input
                            type="number"
                            value={action.retryCount || '3'}
                            onChange={(e) => handleActionEdit(block.id, action.id, 'retryCount', parseInt(e.target.value) || 3)}
                            className="w-full p-2 border border-gray-300 rounded text-sm"
                            placeholder="3"
                            min="1"
                            max="10"
                          />
                        </div>
                        
                        <div className="text-xs text-gray-500 bg-yellow-50 p-2 rounded">
                          💡 OTP, SMS, 이메일 인증 등 다양한 인증 방식을 지원합니다. 파라미터로 인증번호를 전달할 수 있습니다.
                        </div>
                      </div>
                    )}
                    
                    {action.type === 'api_call' && (
                      <div className="space-y-2">
                        <div className="text-sm font-medium text-gray-700">API 호출 설정</div>
                        
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            API URL
                          </label>
                          <input
                            type="text"
                            value={action.url || ''}
                            onChange={(e) => handleActionEdit(block.id, action.id, 'url', e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded text-sm"
                            placeholder="https://api.example.com/endpoint"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            HTTP 메서드
                          </label>
                          <select
                            value={action.method || 'POST'}
                            onChange={(e) => handleActionEdit(block.id, action.id, 'method', e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded text-sm"
                          >
                            <option value="GET">GET</option>
                            <option value="POST">POST</option>
                            <option value="PUT">PUT</option>
                            <option value="DELETE">DELETE</option>
                            <option value="PATCH">PATCH</option>
                          </select>
                        </div>
                        
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            요청 헤더 (JSON 형식)
                          </label>
                          <textarea
                            value={JSON.stringify(action.headers || {}, null, 2)}
                            onChange={(e) => {
                              try {
                                const headers = JSON.parse(e.target.value);
                                handleActionEdit(block.id, action.id, 'headers', headers);
                              } catch (error) {
                                // 잘못된 JSON은 무시
                              }
                            }}
                            className="w-full p-2 border border-gray-300 rounded text-sm"
                            rows={3}
                            placeholder='{"Content-Type": "application/json", "Authorization": "Bearer token"}'
                          />
                        </div>
                        
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            요청 본문 (JSON 형식)
                          </label>
                          <textarea
                            value={JSON.stringify(action.body || {}, null, 2)}
                            onChange={(e) => {
                              try {
                                const body = JSON.parse(e.target.value);
                                handleActionEdit(block.id, action.id, 'body', body);
                              } catch (error) {
                                // 잘못된 JSON은 무시
                              }
                            }}
                            className="w-full p-2 border border-gray-300 rounded text-sm"
                            rows={3}
                            placeholder='{"key": "value"}'
                          />
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={action.useFormData || false}
                            onChange={(e) => handleActionEdit(block.id, action.id, 'useFormData', e.target.checked)}
                            className="rounded border-gray-300"
                          />
                          <label className="text-xs text-gray-600">FormData로 전송</label>
                        </div>
                        
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            파라미터 매핑 (JSON 형식)
                          </label>
                          <textarea
                            value={JSON.stringify(action.parameterMapping || {}, null, 2)}
                            onChange={(e) => {
                              try {
                                const mapping = JSON.parse(e.target.value);
                                handleActionEdit(block.id, action.id, 'parameterMapping', mapping);
                              } catch (error) {
                                // 잘못된 JSON은 무시
                              }
                            }}
                            className="w-full p-2 border border-gray-300 rounded text-sm"
                            rows={2}
                            placeholder='{"parameterName": "apiFieldName"}'
                          />
                          <div className="text-xs text-gray-500 mt-1">
                            💡 POST 파라미터를 API 필드로 매핑
                          </div>
                        </div>
                        
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            응답 필드 (선택사항)
                          </label>
                          <input
                            type="text"
                            value={action.responseField || ''}
                            onChange={(e) => handleActionEdit(block.id, action.id, 'responseField', e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded text-sm"
                            placeholder="data.result"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            결과 저장 변수명 (선택사항)
                          </label>
                          <input
                            type="text"
                            value={action.storeAs || ''}
                            onChange={(e) => handleActionEdit(block.id, action.id, 'storeAs', e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded text-sm"
                            placeholder="apiResponse"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            타임아웃 (ms)
                          </label>
                          <input
                            type="number"
                            value={action.timeout || '30000'}
                            onChange={(e) => handleActionEdit(block.id, action.id, 'timeout', parseInt(e.target.value) || 30000)}
                            className="w-full p-2 border border-gray-300 rounded text-sm"
                            placeholder="30000"
                            min="1000"
                            max="120000"
                          />
                        </div>
                        
                        <div className="text-xs text-gray-500 bg-blue-50 p-2 rounded">
                          💡 외부 API 호출하여 데이터 전송/수신. 파라미터 매핑으로 동적 데이터 전달 가능.
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1">
                    {action.selector && (
                      <div className="text-xs text-gray-600">
                        <span className="font-medium">셀렉터:</span> {action.selector}
                      </div>
                    )}
                    {action.url && (
                      <div className="text-xs text-gray-600">
                        <span className="font-medium">URL:</span> {action.url}
                      </div>
                    )}
                    {action.value && (
                      <div className="text-xs text-gray-600">
                        <span className="font-medium">값:</span> {action.value}
                      </div>
                    )}
                    {action.field && (
                      <div className="text-xs text-gray-600">
                        <span className="font-medium">필드:</span> {action.field}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        </div>

        {/* 아래쪽 호버 영역 */}
        <div
          className="absolute -bottom-2 left-0 right-0 h-4 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity z-10"
          onMouseEnter={() => setHoveredInsertPosition({blockId: block.id, position: 'below'})}
          onMouseLeave={() => setHoveredInsertPosition(null)}
        >
          {hoveredInsertPosition?.blockId === block.id && hoveredInsertPosition?.position === 'below' && (
            <button
              onClick={() => handleInsertBlock(block.id, 'below')}
              className="flex items-center space-x-1 px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 shadow-md"
            >
              <Plus size={12} />
              <span>아래에 추가</span>
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-4">웹 스크래핑 API 생성기</h2>
        
        {/* 워크플로우 세션 입력 모달 */}
        {workflowSession && workflowSession.status === 'paused' && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold mb-4">워크플로우 일시정지</h3>
              
              <div className="mb-4">
                <p className="text-gray-600 mb-2">
                  {workflowSession.waitingFor?.message || '사용자 입력이 필요합니다.'}
                </p>
              </div>
              
              {workflowSession.waitingFor?.inputFields?.map((field) => (
                <div key={field.name} className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {field.label}
                    {field.required && <span className="text-red-500 ml-1">*</span>}
                  </label>
                  <input
                    type={field.type}
                    value={sessionInputs[field.name] || ''}
                    onChange={(e) => setSessionInputs(prev => ({
                      ...prev,
                      [field.name]: e.target.value
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={`${field.label}를 입력하세요`}
                    required={field.required}
                  />
                </div>
              ))}
              
              <div className="flex justify-end space-x-2">
                <button
                  onClick={handleSessionCancel}
                  disabled={isLoading}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
                >
                  취소
                </button>
                <button
                  onClick={handleSessionInputSubmit}
                  disabled={isLoading || !workflowSession.waitingFor?.inputFields?.every(field => 
                    !field.required || sessionInputs[field.name]?.trim()
                  )}
                  className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
                >
                  {isLoading ? '처리 중...' : '계속 진행'}
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* 워크플로우 세션 상태 표시 */}
        {workflowSession && (
          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-semibold text-blue-800">워크플로우 세션</h4>
                <p className="text-sm text-blue-600">
                  세션 ID: {workflowSession.sessionId}
                </p>
                <p className="text-sm text-blue-600">
                  상태: {workflowSession.status === 'paused' ? '일시정지' : '실행 중'}
                </p>
              </div>
              <button
                onClick={handleSessionCancel}
                className="text-red-600 hover:text-red-800 text-sm"
              >
                세션 취소
              </button>
            </div>
            
            {workflowSession.executionLog.length > 0 && (
              <details className="mt-3">
                <summary className="cursor-pointer text-sm text-blue-600 hover:text-blue-800">
                  실행 로그 보기 ({workflowSession.executionLog.length}개)
                </summary>
                <div className="mt-2 max-h-32 overflow-y-auto">
                  {workflowSession.executionLog.slice(-10).map((log, index) => (
                    <div key={index} className="text-xs text-gray-600 font-mono py-1">
                      {log}
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              웹사이트 URL
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="https://example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              API 설명
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="예: 제품 정보 추출 API"
            />
          </div>
        </div>
      </div>

      {/* Step 1: 자연어 설명 입력 */}
      <div className="bg-gray-50 p-6 rounded-lg">
        <h3 className="text-lg font-semibold mb-3">1단계: 추출하려는 데이터 설명</h3>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="예: 웹사이트에서 상품명, 가격, 이미지 URL, 평점을 추출하고 싶습니다.

💡 CSS 셀렉터도 함께 지정할 수 있습니다:
- 제목은 .product-title 클래스로 가져오기
- 가격은 .price-value 셀렉터로 추출
- 이미지는 .product-image img 태그에서 가져오기"
          className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          rows={6}
        />
        <button
          onClick={handleGenerateSchema}
          disabled={isLoading || !description.trim()}
          className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? '스키마 생성 중...' : '데이터 스키마 생성'}
        </button>
      </div>

      {/* 생성된 스키마 및 워크플로우 */}
      {generatedSchema && (
        <div className="bg-green-50 p-6 rounded-lg space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">생성된 워크플로우</h3>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setViewMode(viewMode === 'blocks' ? 'list' : 'blocks')}
                className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
              >
                {viewMode === 'blocks' ? '리스트 보기' : '블록 보기'}
              </button>
              <button
                onClick={() => handleAddBlock()}
                className="flex items-center space-x-1 px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
              >
                <Plus size={14} />
                <span>블록 추가</span>
              </button>
            </div>
          </div>

          {/* 데이터 스키마 미리보기 및 편집 */}
          {generatedSchema.schema?.properties && (
            <div className="bg-white p-4 rounded border">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-gray-700">📊 추출할 데이터 필드</h4>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setEditingDataFields(!editingDataFields)}
                    className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                  >
                    {editingDataFields ? '편집 완료' : '필드 편집'}
                  </button>
                  {editingDataFields && (
                    <button
                      onClick={handleAddDataField}
                      className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                    >
                      + 필드 추가
                    </button>
                  )}
                </div>
              </div>
              
              {editingDataFields ? (
                <div className="space-y-4">
                  {Object.entries(generatedSchema.schema.properties).map(([fieldName, fieldConfig]: [string, any]) => (
                    <div key={fieldName} className="bg-gray-50 p-4 rounded border">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            필드명
                          </label>
                          <input
                            type="text"
                            value={fieldName}
                            onChange={(e) => {
                              // 필드명 변경 시 전체 스키마 재구성
                              const newFieldName = e.target.value;
                              if (newFieldName !== fieldName) {
                                const updatedProperties = { ...generatedSchema.schema.properties };
                                updatedProperties[newFieldName] = updatedProperties[fieldName];
                                delete updatedProperties[fieldName];
                                
                                const updatedSchema = {
                                  ...generatedSchema,
                                  schema: {
                                    ...generatedSchema.schema,
                                    properties: updatedProperties
                                  }
                                };
                                setGeneratedSchema(updatedSchema);
                              }
                            }}
                            className="w-full p-2 border border-gray-300 rounded text-sm"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            설명
                          </label>
                          <input
                            type="text"
                            value={fieldConfig.description || ''}
                            onChange={(e) => handleDataFieldEdit(fieldName, 'description', e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded text-sm"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            CSS 셀렉터
                          </label>
                          <input
                            type="text"
                            value={fieldConfig.selector || ''}
                            onChange={(e) => handleDataFieldEdit(fieldName, 'selector', e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded text-sm"
                            placeholder="예: .class-name, #id"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            속성
                          </label>
                          <select
                            value={fieldConfig.attribute || 'textContent'}
                            onChange={(e) => handleDataFieldEdit(fieldName, 'attribute', e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded text-sm"
                          >
                            <option value="textContent">텍스트 내용</option>
                            <option value="innerHTML">HTML 내용</option>
                            <option value="href">링크 URL</option>
                            <option value="src">이미지 소스</option>
                            <option value="value">입력값</option>
                            <option value="title">제목</option>
                            <option value="alt">대체 텍스트</option>
                          </select>
                        </div>
                        
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            데이터 타입
                          </label>
                          <select
                            value={fieldConfig.type || 'string'}
                            onChange={(e) => handleDataFieldEdit(fieldName, 'type', e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded text-sm"
                          >
                            <option value="string">문자열</option>
                            <option value="number">숫자</option>
                            <option value="boolean">불린</option>
                            <option value="array">배열</option>
                          </select>
                        </div>
                        
                        <div className="flex items-end">
                          <button
                            onClick={() => handleDeleteDataField(fieldName)}
                            className="w-full px-3 py-2 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                          >
                            삭제
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {Object.entries(generatedSchema.schema.properties).map(([fieldName, fieldConfig]: [string, any]) => (
                    <div key={fieldName} className="bg-gray-50 p-3 rounded">
                      <div className="font-medium text-gray-800">{fieldName}</div>
                      <div className="text-sm text-gray-600">{fieldConfig.description}</div>
                      {fieldConfig.selector && (
                        <div className="text-xs text-blue-600 mt-1">
                          셀렉터: {fieldConfig.selector}
                        </div>
                      )}
                      <div className="text-xs text-gray-500 mt-1">
                        타입: {fieldConfig.type} | 속성: {fieldConfig.attribute || 'textContent'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 워크플로우 블록 에디터 */}
          {viewMode === 'blocks' && actionBlocks.length > 0 && (
            <div className="bg-white p-4 rounded border">
              <h4 className="font-medium text-gray-700 mb-4">🔧 워크플로우 블록 (드래그하여 순서 변경)</h4>
              <div className="space-y-4">
                {actionBlocks.map(renderActionBlock)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 2: URL 입력 및 실행 */}
      {generatedSchema && (
        <div className="bg-blue-50 p-6 rounded-lg space-y-4">
          <h3 className="text-lg font-semibold">2단계: 웹사이트 URL 입력 및 워크플로우 실행</h3>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              크롤링할 웹사이트 URL
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* POST 파라미터 설정 */}
          <div className="bg-white p-4 rounded border">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-gray-700">📝 API 파라미터 설정</h4>
              <div className="flex items-center space-x-2">
                <button
                  onClick={updateParametersFromWorkflow}
                  className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                  title="워크플로우에서 사용되는 파라미터를 자동으로 감지하여 추가합니다"
                >
                  🔍 자동 감지
                </button>
                <button
                  onClick={() => {
                    const newParamName = prompt('새 파라미터 이름을 입력하세요:');
                    if (newParamName && newParamName.trim()) {
                      setParameters(prev => ({
                        ...prev,
                        [newParamName.trim()]: ''
                      }));
                    }
                  }}
                  className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                >
                  + 수동 추가
                </button>
              </div>
            </div>
            
            <div className="space-y-3">
              {Object.keys(parameters).length === 0 ? (
                <div className="text-sm text-gray-500 text-center py-4">
                  사용자가 이 API를 호출할 때 전달할 파라미터를 추가하세요.
                  <br />
                  예: user_type, auth_code, search_query 등
                </div>
              ) : (
                Object.entries(parameters).map(([paramName, paramValue]) => (
                  <div key={paramName} className="flex items-center space-x-2">
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        {paramName}
                        <span className="text-blue-600 ml-1">(string)</span>
                      </label>
                      <input
                        type="text"
                        value={paramValue}
                        onChange={(e) => setParameters(prev => ({
                          ...prev,
                          [paramName]: e.target.value
                        }))}
                        placeholder={`${paramName} 값 (테스트용)`}
                        className="w-full p-2 border border-gray-300 rounded text-sm"
                      />
                      <div className="text-xs text-gray-500 mt-1">
                        사용자가 API 호출 시 전달하는 값
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        const newParams = { ...parameters };
                        delete newParams[paramName];
                        setParameters(newParams);
                      }}
                      className="mt-5 px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700"
                    >
                      삭제
                    </button>
                  </div>
                ))
              )}
            </div>
            
            <div className="mt-4 p-3 bg-gray-50 rounded text-sm">
              <div className="font-medium text-gray-700 mb-2">💡 파라미터 사용법:</div>
              <div className="text-gray-600 space-y-1">
                <div>• <strong>입력 액션:</strong> "파라미터 값 사용" 체크 → 파라미터명 입력</div>
                <div>• <strong>옵션 선택:</strong> 드롭다운/라디오 선택 값을 파라미터로 설정</div>
                <div>• <strong>인증 검증:</strong> OTP/SMS 인증번호를 파라미터로 전달</div>
                <div>• <strong>조건부 분기:</strong> 파라미터 값에 따른 워크플로우 분기</div>
                <div>• <strong>API 호출:</strong> 파라미터 매핑으로 외부 API에 데이터 전송</div>
              </div>
            </div>
            
            {Object.keys(parameters).length > 0 && (
              <div className="mt-4 p-3 bg-blue-50 rounded text-sm">
                <div className="font-medium text-gray-700 mb-2">📋 API 호출 예시:</div>
                <pre className="text-xs bg-white p-2 rounded border overflow-x-auto">
{`POST /api/execute-workflow
Content-Type: application/json

{
  "url": "${url || 'https://example.com'}",
  "executeWorkflow": true,
  "parameters": {${Object.entries(parameters).map(([key, value]) => `
    "${key}": "${value || 'actual_value'}"`).join(',')}
  }
}`}
                </pre>
              </div>
            )}
          </div>

          <div className="flex space-x-2">
            <button
              onClick={() => handleExecuteWorkflow(true)}
              disabled={isLoading || !url.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? '워크플로우 실행 중...' : '워크플로우 실행'}
            </button>
            <button
              onClick={() => handleExecuteWorkflow(false)}
              disabled={isLoading || !url.trim()}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              검증만
            </button>
          </div>
        </div>
      )}

      {/* 워크플로우 실행 결과 */}
      {extractedData && (
        <div className="bg-green-50 p-6 rounded-lg">
          <h3 className="text-lg font-semibold mb-3">워크플로우 실행 결과</h3>
          <pre className="bg-white p-4 rounded border text-sm overflow-x-auto">
            {JSON.stringify(extractedData, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
} 