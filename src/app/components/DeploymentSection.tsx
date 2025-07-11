'use client';

import { useState } from 'react';

interface DeploymentSectionProps {
  generatedApi: any;
}

export function DeploymentSection({ generatedApi }: DeploymentSectionProps) {
  const [deploymentStatus, setDeploymentStatus] = useState<'idle' | 'deploying' | 'success' | 'error'>('idle');
  const [deploymentUrl, setDeploymentUrl] = useState('');
  const [deploymentLogs, setDeploymentLogs] = useState<string[]>([]);
  const [envVars, setEnvVars] = useState({
    OPENAI_API_KEY: '',
    PLAYWRIGHT_API_KEY: '',
    DATABASE_URL: '',
  });

  const handleEnvVarChange = (key: string, value: string) => {
    setEnvVars(prev => ({ ...prev, [key]: value }));
  };

  const generateDeploymentConfig = () => {
    const vercelConfig = {
      name: `vibeploy-api-${Date.now()}`,
      version: 2,
      builds: [
        {
          src: 'src/app/api/**/*.ts',
          use: '@vercel/node'
        }
      ],
      routes: [
        {
          src: '/api/(.*)',
          dest: '/src/app/api/$1'
        }
      ],
      env: envVars
    };

    const deployScript = `#!/bin/bash
# VibePloy 자동 배포 스크립트

echo "🚀 VibePloy API 배포를 시작합니다..."

# Vercel CLI 설치 확인
if ! command -v vercel &> /dev/null; then
    echo "📦 Vercel CLI 설치 중..."
    npm install -g vercel
fi

# 환경 변수 설정
echo "🔧 환경 변수 설정 중..."
${Object.entries(envVars).map(([key, value]) => 
  `vercel env add ${key} "${value}" production`
).join('\n')}

# 배포 실행
echo "🏗️ 배포 실행 중..."
vercel --prod --yes

echo "✅ 배포 완료!"
`;

    return { vercelConfig, deployScript };
  };

  const handleDeploy = async () => {
    if (!generatedApi) {
      alert('먼저 API를 생성해주세요.');
      return;
    }

    setDeploymentStatus('deploying');
    setDeploymentLogs(['배포 시작...']);

    try {
      // 배포 설정 생성
      const { vercelConfig, deployScript } = generateDeploymentConfig();
      
      // 배포 API 호출
      const response = await fetch('/api/deploy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          apiData: generatedApi,
          vercelConfig,
          deployScript,
          envVars
        }),
      });

      if (!response.ok) {
        throw new Error('배포에 실패했습니다.');
      }

      const { url, logs } = await response.json();
      setDeploymentUrl(url);
      setDeploymentLogs(logs);
      setDeploymentStatus('success');
    } catch (error) {
      console.error('배포 오류:', error);
      setDeploymentLogs(prev => [...prev, `오류: ${error instanceof Error ? error.message : '알 수 없는 오류'}`]);
      setDeploymentStatus('error');
    }
  };

  const testApiEndpoint = async () => {
    if (!deploymentUrl) return;

    try {
      const response = await fetch(`${deploymentUrl}/api/test`);
      const data = await response.json();
      alert(`API 테스트 성공!\n응답: ${JSON.stringify(data, null, 2)}`);
    } catch (error) {
      alert(`API 테스트 실패: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('클립보드에 복사되었습니다!');
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
        <h2 className="text-2xl font-bold text-gray-900 mb-4">배포 및 인프라 관리</h2>
        <p className="text-gray-600 mb-6">
          생성된 API를 Vercel을 통해 클라우드에 배포하고 관리하세요.
        </p>
      </div>

      {/* 환경 변수 설정 */}
      <div className="bg-yellow-50 p-6 rounded-lg">
        <h3 className="text-lg font-semibold mb-3">환경 변수 설정</h3>
        <div className="space-y-4">
          {Object.entries(envVars).map(([key, value]) => (
            <div key={key}>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {key}
              </label>
              <input
                type="password"
                value={value}
                onChange={(e) => handleEnvVarChange(key, e.target.value)}
                placeholder={`${key}를 입력하세요`}
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          ))}
        </div>
      </div>

      {/* 배포 설정 미리보기 */}
      <div className="bg-blue-50 p-6 rounded-lg">
        <h3 className="text-lg font-semibold mb-3">배포 설정</h3>
        <div className="space-y-4">
          <div>
            <h4 className="font-medium mb-2">Vercel 설정 (vercel.json)</h4>
            <div className="bg-white p-4 rounded border">
              <pre className="text-sm overflow-x-auto">
                {JSON.stringify(generateDeploymentConfig().vercelConfig, null, 2)}
              </pre>
            </div>
            <button
              onClick={() => copyToClipboard(JSON.stringify(generateDeploymentConfig().vercelConfig, null, 2))}
              className="mt-2 px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
            >
              복사
            </button>
          </div>
          
          <div>
            <h4 className="font-medium mb-2">배포 스크립트 (deploy.sh)</h4>
            <div className="bg-white p-4 rounded border">
              <pre className="text-sm overflow-x-auto">
                {generateDeploymentConfig().deployScript}
              </pre>
            </div>
            <button
              onClick={() => copyToClipboard(generateDeploymentConfig().deployScript)}
              className="mt-2 px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
            >
              복사
            </button>
          </div>
        </div>
      </div>

      {/* 배포 실행 */}
      <div className="bg-green-50 p-6 rounded-lg">
        <h3 className="text-lg font-semibold mb-3">배포 실행</h3>
        <div className="space-y-4">
          <button
            onClick={handleDeploy}
            disabled={deploymentStatus === 'deploying'}
            className={`px-6 py-3 rounded-md font-medium ${
              deploymentStatus === 'deploying'
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-700'
            } text-white`}
          >
            {deploymentStatus === 'deploying' ? '배포 중...' : '🚀 Vercel에 배포하기'}
          </button>

          {/* 배포 상태 */}
          {deploymentStatus !== 'idle' && (
            <div className="mt-4">
              <h4 className="font-medium mb-2">배포 상태</h4>
              <div className={`p-3 rounded ${
                deploymentStatus === 'success' ? 'bg-green-100 text-green-800' :
                deploymentStatus === 'error' ? 'bg-red-100 text-red-800' :
                'bg-blue-100 text-blue-800'
              }`}>
                {deploymentStatus === 'success' && '✅ 배포 성공!'}
                {deploymentStatus === 'error' && '❌ 배포 실패'}
                {deploymentStatus === 'deploying' && '🔄 배포 중...'}
              </div>
            </div>
          )}

          {/* 배포 로그 */}
          {deploymentLogs.length > 0 && (
            <div className="mt-4">
              <h4 className="font-medium mb-2">배포 로그</h4>
              <div className="bg-black text-green-400 p-3 rounded font-mono text-sm max-h-40 overflow-y-auto">
                {deploymentLogs.map((log, index) => (
                  <div key={index}>{log}</div>
                ))}
              </div>
            </div>
          )}

          {/* 배포 성공 시 URL 표시 */}
          {deploymentUrl && (
            <div className="mt-4 p-4 bg-white rounded border">
              <h4 className="font-medium mb-2">🎉 배포 완료!</h4>
              <div className="space-y-2">
                <div>
                  <span className="font-medium">배포 URL:</span>
                  <a
                    href={deploymentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-2 text-blue-600 hover:text-blue-800 underline"
                  >
                    {deploymentUrl}
                  </a>
                  <button
                    onClick={() => copyToClipboard(deploymentUrl)}
                    className="ml-2 text-blue-600 hover:text-blue-800"
                  >
                    📋
                  </button>
                </div>
                <div>
                  <span className="font-medium">API 엔드포인트:</span>
                  <code className="ml-2 bg-gray-100 px-2 py-1 rounded text-sm">
                    {deploymentUrl}/api/scrape
                  </code>
                </div>
              </div>
              <div className="mt-3 space-x-2">
                <button
                  onClick={testApiEndpoint}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  API 테스트
                </button>
                <button
                  onClick={() => window.open(`${deploymentUrl}/api/docs`, '_blank')}
                  className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
                >
                  API 문서 보기
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 브라우저 자동화 테스트 */}
      <div className="bg-purple-50 p-6 rounded-lg">
        <h3 className="text-lg font-semibold mb-3">브라우저 자동화 테스트</h3>
        <p className="text-gray-600 mb-4">
          배포된 API가 올바르게 작동하는지 자동으로 테스트합니다.
        </p>
        <div className="space-y-2">
          <button
            onClick={() => alert('브라우저 자동화 테스트 실행 중... (구현 예정)')}
            className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
          >
            🤖 자동화 테스트 실행
          </button>
          <div className="text-sm text-gray-500">
            * Playwright를 사용한 E2E 테스트 실행
          </div>
        </div>
      </div>

      {/* 모니터링 및 관리 */}
      <div className="bg-gray-50 p-6 rounded-lg">
        <h3 className="text-lg font-semibold mb-3">모니터링 및 관리</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white p-4 rounded border">
            <h4 className="font-medium mb-2">성능 모니터링</h4>
            <p className="text-sm text-gray-600 mb-3">API 응답 시간 및 사용량 추적</p>
            <button className="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700">
              대시보드 보기
            </button>
          </div>
          <div className="bg-white p-4 rounded border">
            <h4 className="font-medium mb-2">로그 관리</h4>
            <p className="text-sm text-gray-600 mb-3">에러 로그 및 액세스 로그 확인</p>
            <button className="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700">
              로그 보기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 