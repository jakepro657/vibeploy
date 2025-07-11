'use client';

import { useState, useEffect } from 'react';

interface ApiDocumentationProps {
  generatedApi: any;
  onNext: () => void;
}

export function ApiDocumentation({ generatedApi, onNext }: ApiDocumentationProps) {
  const [swaggerSpec, setSwaggerSpec] = useState<any>(null);
  const [apiEndpoint, setApiEndpoint] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (generatedApi) {
      generateSwaggerDocs();
    }
  }, [generatedApi]);

  const generateSwaggerDocs = async () => {
    if (!generatedApi) return;

    setIsGenerating(true);
    try {
      // 존재하지 않는 API 호출 대신 직접 Swagger 스펙 생성
      const swagger = {
        openapi: '3.0.0',
        info: {
          title: 'VibePloy 웹 크롤링 API',
          version: '1.0.0',
          description: generatedApi.description || '자동 생성된 웹 크롤링 API'
        },
        servers: [
          {
            url: 'http://localhost:3000',
            description: '개발 서버'
          }
        ],
        paths: {
          '/api/execute-workflow': {
            post: {
              summary: '워크플로우 실행',
              description: '지정된 워크플로우를 실행하여 웹 데이터를 추출합니다.',
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        url: { type: 'string', description: '크롤링할 웹사이트 URL' },
                        executeWorkflow: { type: 'boolean', description: '워크플로우 실행 여부' },
                        parameters: { type: 'object', description: '워크플로우 파라미터' }
                      },
                      required: ['url']
                    }
                  }
                }
              },
              responses: {
                '200': {
                  description: '성공',
                  content: {
                    'application/json': {
                      schema: generatedApi.schema || {
                        type: 'object',
                        properties: {
                          success: { type: 'boolean' },
                          data: { type: 'object' }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      };

      const endpoint = 'http://localhost:3000/api/execute-workflow';
      setSwaggerSpec(swagger);
      setApiEndpoint(endpoint);
    } catch (error) {
      console.error('Swagger 문서 생성 오류:', error);
      alert('API 문서 생성에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('클립보드에 복사되었습니다!');
  };

  const exampleUsage = {
    javascript: `// JavaScript 예제
const response = await fetch('${apiEndpoint}', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    url: '${generatedApi?.url || 'https://example.com'}',
    executeWorkflow: true,
    parameters: {}
  })
});

const data = await response.json();
console.log(data);`,
    
    python: `# Python 예제
import requests

data = {
    'url': '${generatedApi?.url || 'https://example.com'}',
    'executeWorkflow': True,
    'parameters': {}
}

response = requests.post('${apiEndpoint}', json=data)
result = response.json()
print(result)`,
    
    curl: `# cURL 예제
curl -X POST '${apiEndpoint}' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "url": "${generatedApi?.url || 'https://example.com'}",
    "executeWorkflow": true,
    "parameters": {}
  }'`
  };

  if (!generatedApi) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">먼저 웹 크롤링 API를 생성해주세요.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">API 문서 및 엔드포인트</h2>
        <p className="text-gray-600 mb-6">
          생성된 API의 문서와 사용 방법을 확인하세요.
        </p>
      </div>

      {/* API 정보 */}
      <div className="bg-blue-50 p-6 rounded-lg">
        <h3 className="text-lg font-semibold mb-3">API 정보</h3>
        <div className="space-y-2">
          <div>
            <span className="font-medium">설명:</span> {generatedApi.description || '웹 크롤링 API'}
          </div>
          <div>
            <span className="font-medium">소스 URL:</span> {generatedApi.url || 'N/A'}
          </div>
          {apiEndpoint && (
            <div>
              <span className="font-medium">API 엔드포인트:</span> 
              <code className="ml-2 bg-white px-2 py-1 rounded">{apiEndpoint}</code>
              <button
                onClick={() => copyToClipboard(apiEndpoint)}
                className="ml-2 text-blue-600 hover:text-blue-800"
              >
                📋 복사
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Swagger 문서 */}
      {isGenerating ? (
        <div className="bg-yellow-50 p-6 rounded-lg">
          <p className="text-center">API 문서 생성 중...</p>
        </div>
      ) : swaggerSpec ? (
        <div className="bg-green-50 p-6 rounded-lg">
          <h3 className="text-lg font-semibold mb-3">OpenAPI (Swagger) 문서</h3>
          <div className="bg-white p-4 rounded border">
            <pre className="text-sm overflow-x-auto max-h-60">
              {JSON.stringify(swaggerSpec, null, 2)}
            </pre>
          </div>
          <button
            onClick={() => copyToClipboard(JSON.stringify(swaggerSpec, null, 2))}
            className="mt-3 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
          >
            Swagger 문서 복사
          </button>
        </div>
      ) : (
        <div className="bg-gray-50 p-6 rounded-lg">
          <button
            onClick={generateSwaggerDocs}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            API 문서 생성하기
          </button>
        </div>
      )}

      {/* 사용 예제 */}
      <div className="bg-gray-50 p-6 rounded-lg">
        <h3 className="text-lg font-semibold mb-3">API 사용 예제</h3>
        <div className="space-y-4">
          {Object.entries(exampleUsage).map(([language, code]) => (
            <div key={language} className="bg-white p-4 rounded border">
              <div className="flex justify-between items-center mb-2">
                <h4 className="font-medium capitalize">{language}</h4>
                <button
                  onClick={() => copyToClipboard(code)}
                  className="text-blue-600 hover:text-blue-800"
                >
                  📋 복사
                </button>
              </div>
              <pre className="text-sm overflow-x-auto bg-gray-100 p-2 rounded">
                {code}
              </pre>
            </div>
          ))}
        </div>
      </div>

      {/* 응답 스키마 */}
      {generatedApi.schema && (
        <div className="bg-purple-50 p-6 rounded-lg">
          <h3 className="text-lg font-semibold mb-3">응답 데이터 스키마</h3>
          <div className="bg-white p-4 rounded border">
            <pre className="text-sm overflow-x-auto">
              {JSON.stringify(generatedApi.schema, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {/* 샘플 응답 */}
      {generatedApi.extractedData && (
        <div className="bg-indigo-50 p-6 rounded-lg">
          <h3 className="text-lg font-semibold mb-3">샘플 응답 데이터</h3>
          <div className="bg-white p-4 rounded border">
            <pre className="text-sm overflow-x-auto max-h-60">
              {JSON.stringify(generatedApi.extractedData, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {/* 다음 단계 버튼 */}
      <div className="text-center">
        <button
          onClick={onNext}
          className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          다음 단계: 배포 설정 →
        </button>
      </div>
    </div>
  );
} 