'use client';

import React, { useState } from 'react';
import { ChevronRight, Edit2, Save, X, ChevronUp, ChevronDown, Plus, Trash2 } from 'lucide-react';

interface WebScrapingInterfaceProps {
  onApiGenerated: (data: any) => void;
  onNext: () => void;
}

interface ActionItem {
  type: string;
  description?: string;
  instruction?: string;
  url?: string;
  selector?: string;
  value?: string;
  data?: any;
  isEditing?: boolean;
}

// 액션에서 필요한 매개변수 추출
function getRequiredParameters(actions: any[]): string[] {
  const parameters = new Set<string>();
  
  actions.forEach((action) => {
    const actionStr = JSON.stringify(action);
    const matches = actionStr.match(/\{\{([^}]+)\}\}/g);
    
    if (matches) {
      matches.forEach((match) => {
        const param = match.replace(/[{}]/g, '');
        if (param !== 'url') { // url은 별도로 입력받음
          parameters.add(param);
        }
      });
    }
  });
  
  return Array.from(parameters);
}

// 액션 유효성 검사 함수
function validateAction(action: ActionItem): string[] {
  const errors: string[] = [];
  
  if (!action.description?.trim()) {
    errors.push('설명을 입력해주세요.');
  }
  
  switch (action.type) {
    case 'navigate':
      if (!action.url?.trim()) {
        errors.push('이동할 URL을 입력해주세요.');
      } else if (action.url !== '{{url}}' && !action.url.startsWith('http')) {
        errors.push('올바른 URL 형식이 아닙니다.');
      }
      break;
      
    case 'act':
      if (!action.instruction?.trim()) {
        errors.push('자연어 명령을 입력해주세요.');
      }
      
      if (action.selector?.trim()) {
        // CSS 셀렉터 기본 유효성 검사
        if (action.selector.includes('..') || action.selector.includes('//')) {
          errors.push('유효하지 않은 CSS 셀렉터입니다.');
        }
      }
      break;
      
    case 'extract':
      if (!action.instruction?.trim()) {
        errors.push('추출 명령을 입력해주세요.');
      }
      break;
      
    case 'wait':
      const waitTime = parseInt(action.value || '0');
      if (isNaN(waitTime) || waitTime < 1 || waitTime > 60) {
        errors.push('대기 시간은 1-60초 사이여야 합니다.');
      }
      break;
      
    case 'scroll':
      if (!action.value || !['up', 'down', 'element'].includes(action.value)) {
        errors.push('스크롤 방향을 선택해주세요.');
      }
      if (action.value === 'element' && !action.selector?.trim()) {
        errors.push('요소 스크롤에는 셀렉터가 필요합니다.');
      }
      break;
      
    case 'screenshot':
      if (!action.value?.trim()) {
        errors.push('스크린샷 파일명을 입력해주세요.');
      }
      break;
      
    case 'condition':
      if (!action.selector?.trim()) {
        errors.push('조건 셀렉터를 입력해주세요.');
      }
      if (!action.instruction?.trim()) {
        errors.push('조건 만족 시 실행할 액션을 입력해주세요.');
      }
      break;
      
    case 'loop':
      const loopCount = parseInt(action.value || '0');
      if (isNaN(loopCount) || loopCount < 1 || loopCount > 20) {
        errors.push('반복 횟수는 1-20회 사이여야 합니다.');
      }
      if (!action.instruction?.trim()) {
        errors.push('반복할 액션을 입력해주세요.');
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
        body: JSON.stringify({ description }),
      });

      if (!response.ok) {
        throw new Error('스키마 생성에 실패했습니다.');
      }

      const data = await response.json();
      setGeneratedSchema(data);
      
      // 액션 시퀸스를 편집 가능한 형태로 변환
      if (data.actions) {
        const actionsWithEditState = data.actions.map((action: any) => ({
          ...action,
          isEditing: false,
          selector: action.selector || '' // 기본 셀렉터 필드 추가
        }));
        setEditableActions(actionsWithEditState);
      }
    } catch (error) {
      console.error('스키마 생성 오류:', error);
      alert('스키마 생성에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditAction = (index: number) => {
    const updatedActions = [...editableActions];
    updatedActions[index].isEditing = true;
    setEditableActions(updatedActions);
  };

  const handleSaveAction = (index: number) => {
    const action = editableActions[index];
    const errors = validateAction(action);
    
    if (errors.length > 0) {
      alert(`액션 저장 실패:\n${errors.join('\n')}`);
      return;
    }
    
    const updatedActions = [...editableActions];
    updatedActions[index].isEditing = false;
    setEditableActions(updatedActions);
    
    // 원본 스키마의 actions도 업데이트
    if (generatedSchema) {
      const updatedSchema = {
        ...generatedSchema,
        actions: updatedActions
      };
      setGeneratedSchema(updatedSchema);
    }
  };

  const handleCancelEdit = (index: number) => {
    const updatedActions = [...editableActions];
    updatedActions[index].isEditing = false;
    setEditableActions(updatedActions);
  };

  const handleActionChange = (index: number, field: string, value: string) => {
    const updatedActions = [...editableActions];
    updatedActions[index] = {
      ...updatedActions[index],
      [field]: value
    };
    setEditableActions(updatedActions);
  };

  const handleMoveAction = (index: number, direction: 'up' | 'down') => {
    const updatedActions = [...editableActions];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (targetIndex >= 0 && targetIndex < updatedActions.length) {
      [updatedActions[index], updatedActions[targetIndex]] = [updatedActions[targetIndex], updatedActions[index]];
      setEditableActions(updatedActions);
      
      // 원본 스키마도 업데이트
      if (generatedSchema) {
        const updatedSchema = {
          ...generatedSchema,
          actions: updatedActions
        };
        setGeneratedSchema(updatedSchema);
      }
    }
  };

  const handleDeleteAction = (index: number) => {
    if (confirm('이 액션을 삭제하시겠습니까?')) {
      const updatedActions = editableActions.filter((_, i) => i !== index);
      setEditableActions(updatedActions);
      
      // 원본 스키마도 업데이트
      if (generatedSchema) {
        const updatedSchema = {
          ...generatedSchema,
          actions: updatedActions
        };
        setGeneratedSchema(updatedSchema);
      }
    }
  };

  const handleAddAction = () => {
    const newAction: ActionItem = {
      type: 'act',
      description: '새로운 액션',
      instruction: '',
      selector: '',
      isEditing: true
    };
    
    const updatedActions = [...editableActions, newAction];
    setEditableActions(updatedActions);
    
    // 원본 스키마도 업데이트
    if (generatedSchema) {
      const updatedSchema = {
        ...generatedSchema,
        actions: updatedActions
      };
      setGeneratedSchema(updatedSchema);
    }
  };

  const handleExtractData = async () => {
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
      // 웹 크롤링 API 호출 (편집된 액션 시퀸스 사용)
      const response = await fetch('/api/extract-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          url, 
          schema: generatedSchema,
          actions: editableActions, // 편집된 액션 시퀸스 사용
          parameters
        }),
      });

      if (!response.ok) {
        throw new Error('데이터 추출에 실패했습니다.');
      }

      const data = await response.json();
      setExtractedData(data);
      
      // API 생성 완료 - 부모 컴포넌트에 전달
      onApiGenerated({
        schema: generatedSchema,
        extractedData: data,
        url,
        description,
      });
    } catch (error) {
      console.error('데이터 추출 오류:', error);
      alert('데이터 추출에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">웹 크롤링 API 생성</h2>
        <p className="text-gray-600 mb-6">
          자연어로 원하는 데이터를 설명하면 자동으로 웹 크롤링 API를 생성해드립니다.
        </p>
      </div>

      {/* Step 1: 자연어 설명 입력 */}
      <div className="bg-gray-50 p-6 rounded-lg">
        <h3 className="text-lg font-semibold mb-3">1단계: 추출하려는 데이터 설명</h3>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="예: 웹사이트에서 상품명, 가격, 이미지 URL, 평점을 추출하고 싶습니다."
          className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          rows={4}
        />
        <button
          onClick={handleGenerateSchema}
          disabled={isLoading || !description.trim()}
          className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? '스키마 생성 중...' : '데이터 스키마 생성'}
        </button>
      </div>

      {/* 생성된 스키마 미리보기 */}
      {generatedSchema && (
        <div className="bg-green-50 p-6 rounded-lg space-y-4">
          <div>
            <h3 className="text-lg font-semibold mb-3">생성된 데이터 스키마</h3>
            <pre className="bg-white p-4 rounded border text-sm overflow-x-auto">
              {JSON.stringify(generatedSchema.dataSchema || generatedSchema, null, 2)}
            </pre>
          </div>
          
          {/* 편집 가능한 액션 시퀸스 */}
          {editableActions.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold">브라우저 액션 시퀸스 (편집 가능)</h3>
                <button
                  onClick={handleAddAction}
                  className="flex items-center space-x-2 px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                >
                  <Plus size={16} />
                  <span>액션 추가</span>
                </button>
              </div>
              <div className="bg-white p-4 rounded border space-y-3">
                {editableActions.map((action, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium">
                          {action.type}
                        </span>
                        <span className="text-sm font-medium text-gray-700">
                          액션 {index + 1}
                        </span>
                      </div>
                      <div className="flex items-center space-x-1">
                        {/* 순서 변경 버튼 */}
                        <button
                          onClick={() => handleMoveAction(index, 'up')}
                          disabled={index === 0}
                          className="p-1 text-gray-600 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                          title="위로 이동"
                        >
                          <ChevronUp size={16} />
                        </button>
                        <button
                          onClick={() => handleMoveAction(index, 'down')}
                          disabled={index === editableActions.length - 1}
                          className="p-1 text-gray-600 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                          title="아래로 이동"
                        >
                          <ChevronDown size={16} />
                        </button>
                        
                        {/* 삭제 버튼 */}
                        <button
                          onClick={() => handleDeleteAction(index)}
                          className="p-1 text-red-600 hover:text-red-800"
                          title="삭제"
                        >
                          <Trash2 size={16} />
                        </button>
                        
                        {/* 편집 버튼 */}
                        {action.isEditing ? (
                          <>
                            <button
                              onClick={() => handleSaveAction(index)}
                              className="p-1 text-green-600 hover:text-green-800"
                              title="저장"
                            >
                              <Save size={16} />
                            </button>
                            <button
                              onClick={() => handleCancelEdit(index)}
                              className="p-1 text-gray-600 hover:text-gray-800"
                              title="취소"
                            >
                              <X size={16} />
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => handleEditAction(index)}
                            className="p-1 text-blue-600 hover:text-blue-800"
                            title="편집"
                          >
                            <Edit2 size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                    
                    {action.isEditing ? (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            액션 타입
                          </label>
                          <select
                            value={action.type}
                            onChange={(e) => handleActionChange(index, 'type', e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded text-sm"
                          >
                            <option value="navigate">navigate - 페이지 이동</option>
                            <option value="act">act - 액션 실행</option>
                            <option value="extract">extract - 데이터 추출</option>
                            <option value="wait">wait - 대기</option>
                            <option value="scroll">scroll - 스크롤</option>
                            <option value="screenshot">screenshot - 스크린샷</option>
                            <option value="condition">condition - 조건부 실행</option>
                            <option value="loop">loop - 반복 실행</option>
                          </select>
                        </div>
                        
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            설명
                          </label>
                          <input
                            type="text"
                            value={action.description || ''}
                            onChange={(e) => handleActionChange(index, 'description', e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded text-sm"
                            placeholder="액션 설명"
                          />
                        </div>
                        
                        {action.type === 'act' && (
                          <>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                자연어 명령
                              </label>
                              <input
                                type="text"
                                value={action.instruction || ''}
                                onChange={(e) => handleActionChange(index, 'instruction', e.target.value)}
                                className="w-full p-2 border border-gray-300 rounded text-sm"
                                placeholder="예: 로그인 버튼을 클릭하세요"
                              />
                            </div>
                            
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                CSS 셀렉터 (수동 지정)
                              </label>
                              <input
                                type="text"
                                value={action.selector || ''}
                                onChange={(e) => handleActionChange(index, 'selector', e.target.value)}
                                className="w-full p-2 border border-gray-300 rounded text-sm"
                                placeholder="예: .login-button, #submit-btn, [data-testid='login']"
                              />
                              <p className="text-xs text-gray-500 mt-1">
                                CSS 셀렉터를 지정하면 자연어 명령보다 우선적으로 사용됩니다.
                              </p>
                            </div>
                          </>
                        )}
                        
                        {action.type === 'navigate' && (
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              이동할 URL
                            </label>
                            <input
                              type="text"
                              value={action.url || ''}
                              onChange={(e) => handleActionChange(index, 'url', e.target.value)}
                              className="w-full p-2 border border-gray-300 rounded text-sm"
                              placeholder="{{url}} 또는 구체적인 URL"
                            />
                          </div>
                        )}
                        
                        {action.type === 'extract' && (
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              추출 명령
                            </label>
                            <input
                              type="text"
                              value={action.instruction || ''}
                              onChange={(e) => handleActionChange(index, 'instruction', e.target.value)}
                              className="w-full p-2 border border-gray-300 rounded text-sm"
                              placeholder="예: 이 페이지에서 모든 상품 정보를 추출하세요"
                            />
                          </div>
                        )}
                        
                        {action.type === 'wait' && (
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              대기 시간 (초)
                            </label>
                            <input
                              type="number"
                              value={action.value || '3'}
                              onChange={(e) => handleActionChange(index, 'value', e.target.value)}
                              className="w-full p-2 border border-gray-300 rounded text-sm"
                              placeholder="3"
                              min="1"
                              max="60"
                            />
                          </div>
                        )}
                        
                        {action.type === 'scroll' && (
                          <div className="space-y-2">
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                스크롤 방향
                              </label>
                              <select
                                value={action.value || 'down'}
                                onChange={(e) => handleActionChange(index, 'value', e.target.value)}
                                className="w-full p-2 border border-gray-300 rounded text-sm"
                              >
                                <option value="down">아래로</option>
                                <option value="up">위로</option>
                                <option value="element">특정 요소까지</option>
                              </select>
                            </div>
                            
                            {action.value === 'element' && (
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                  대상 요소 셀렉터
                                </label>
                                <input
                                  type="text"
                                  value={action.selector || ''}
                                  onChange={(e) => handleActionChange(index, 'selector', e.target.value)}
                                  className="w-full p-2 border border-gray-300 rounded text-sm"
                                  placeholder="예: .load-more-button"
                                />
                              </div>
                            )}
                          </div>
                        )}
                        
                        {action.type === 'screenshot' && (
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              스크린샷 파일명
                            </label>
                            <input
                              type="text"
                              value={action.value || 'screenshot'}
                              onChange={(e) => handleActionChange(index, 'value', e.target.value)}
                              className="w-full p-2 border border-gray-300 rounded text-sm"
                              placeholder="screenshot"
                            />
                          </div>
                        )}
                        
                        {action.type === 'condition' && (
                          <div className="space-y-2">
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                조건 (CSS 셀렉터)
                              </label>
                              <input
                                type="text"
                                value={action.selector || ''}
                                onChange={(e) => handleActionChange(index, 'selector', e.target.value)}
                                className="w-full p-2 border border-gray-300 rounded text-sm"
                                placeholder="예: .error-message"
                              />
                            </div>
                            
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                조건 만족 시 실행할 액션
                              </label>
                              <input
                                type="text"
                                value={action.instruction || ''}
                                onChange={(e) => handleActionChange(index, 'instruction', e.target.value)}
                                className="w-full p-2 border border-gray-300 rounded text-sm"
                                placeholder="예: 에러 메시지 닫기 버튼을 클릭하세요"
                              />
                            </div>
                          </div>
                        )}
                        
                        {action.type === 'loop' && (
                          <div className="space-y-2">
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                반복 횟수
                              </label>
                              <input
                                type="number"
                                value={action.value || '5'}
                                onChange={(e) => handleActionChange(index, 'value', e.target.value)}
                                className="w-full p-2 border border-gray-300 rounded text-sm"
                                placeholder="5"
                                min="1"
                                max="20"
                              />
                            </div>
                            
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                반복할 액션
                              </label>
                              <input
                                type="text"
                                value={action.instruction || ''}
                                onChange={(e) => handleActionChange(index, 'instruction', e.target.value)}
                                className="w-full p-2 border border-gray-300 rounded text-sm"
                                placeholder="예: 더보기 버튼을 클릭하세요"
                              />
                            </div>
                            
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                반복 대상 셀렉터
                              </label>
                              <input
                                type="text"
                                value={action.selector || ''}
                                onChange={(e) => handleActionChange(index, 'selector', e.target.value)}
                                className="w-full p-2 border border-gray-300 rounded text-sm"
                                placeholder="예: .load-more-button"
                              />
                            </div>
                          </div>
                        )}
                        
                        {/* 유효성 검사 결과 표시 */}
                        {(() => {
                          const errors = validateAction(action);
                          if (errors.length > 0) {
                            return (
                              <div className="bg-red-50 border border-red-200 rounded p-2">
                                <div className="text-xs text-red-800 font-medium mb-1">⚠️ 수정 필요:</div>
                                <ul className="text-xs text-red-700 space-y-1">
                                  {errors.map((error, errorIndex) => (
                                    <li key={errorIndex}>• {error}</li>
                                  ))}
                                </ul>
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="text-sm text-gray-600">
                          <strong>설명:</strong> {action.description || '없음'}
                        </div>
                        
                        {action.instruction && (
                          <div className="text-sm text-gray-600">
                            <strong>명령:</strong> {action.instruction}
                          </div>
                        )}
                        
                        {action.selector && (
                          <div className="text-sm text-gray-600">
                            <strong>셀렉터:</strong> <code className="bg-gray-100 px-1 rounded">{action.selector}</code>
                          </div>
                        )}
                        
                        {action.url && (
                          <div className="text-sm text-gray-600">
                            <strong>URL:</strong> {action.url}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 2: URL 입력 및 매개변수 설정 */}
      <div className="bg-gray-50 p-6 rounded-lg space-y-4">
        <h3 className="text-lg font-semibold mb-3">2단계: 실행 설정</h3>
        
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

        {/* 동적 매개변수 입력 */}
        {generatedSchema?.actions && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              액션 매개변수
            </label>
            <div className="space-y-3">
              {getRequiredParameters(generatedSchema.actions).map((param) => (
                <div key={param}>
                  <label className="block text-xs text-gray-600 mb-1">
                    {param}
                  </label>
                  <input
                    type={param.includes('password') ? 'password' : 'text'}
                    value={parameters[param] || ''}
                    onChange={(e) => setParameters(prev => ({ ...prev, [param]: e.target.value }))}
                    placeholder={`${param} 값을 입력하세요`}
                    className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              ))}
            </div>
          </div>
        )}
        
        <button
          onClick={handleExtractData}
          disabled={isLoading || !url.trim() || !generatedSchema}
          className="w-full px-4 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          {isLoading ? '🤖 브라우저 자동화 실행 중...' : '🚀 데이터 추출 시작'}
        </button>
      </div>

      {/* 추출된 데이터 미리보기 */}
      {extractedData && (
        <div className="bg-blue-50 p-6 rounded-lg">
          <h3 className="text-lg font-semibold mb-3">추출된 데이터</h3>
          <pre className="bg-white p-4 rounded border text-sm overflow-x-auto max-h-60">
            {JSON.stringify(extractedData, null, 2)}
          </pre>
          <button
            onClick={onNext}
            className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            다음 단계: API 문서 생성 →
          </button>
        </div>
      )}
    </div>
  );
} 