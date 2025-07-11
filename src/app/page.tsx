'use client';

import { useState } from 'react';
import { WebScrapingInterface } from './components/WebScrapingInterface';
import { ApiDocumentation } from './components/ApiDocumentation';
import { DeploymentSection } from './components/DeploymentSection';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'scraping' | 'documentation' | 'deployment'>('scraping');
  const [generatedApi, setGeneratedApi] = useState<any>(null);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">VibePloy</h1>
          <p className="text-lg text-gray-600">자연어로 웹 크롤링 API를 생성하고 배포하세요</p>
        </header>

        {/* Navigation Tabs */}
        <nav className="flex justify-center mb-8">
          <div className="bg-white rounded-lg shadow-md p-1">
            <button
              onClick={() => setActiveTab('scraping')}
              className={`px-6 py-3 rounded-md font-medium transition-all ${
                activeTab === 'scraping'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-gray-600 hover:text-blue-600'
              }`}
            >
              웹 크롤링 설정
            </button>
            <button
              onClick={() => setActiveTab('documentation')}
              className={`px-6 py-3 rounded-md font-medium transition-all ${
                activeTab === 'documentation'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-gray-600 hover:text-blue-600'
              }`}
            >
              API 문서
            </button>
            <button
              onClick={() => setActiveTab('deployment')}
              className={`px-6 py-3 rounded-md font-medium transition-all ${
                activeTab === 'deployment'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-gray-600 hover:text-blue-600'
              }`}
            >
              배포
            </button>
          </div>
        </nav>

        {/* Main Content */}
        <main className="bg-white rounded-lg shadow-lg p-8">
          {activeTab === 'scraping' && (
            <WebScrapingInterface 
              onApiGenerated={setGeneratedApi}
              onNext={() => setActiveTab('documentation')}
            />
          )}
          {activeTab === 'documentation' && (
            <ApiDocumentation
              generatedApi={generatedApi}
              onNext={() => setActiveTab('deployment')}
            />
          )}
          {activeTab === 'deployment' && (
            <DeploymentSection 
              generatedApi={generatedApi}
            />
          )}
        </main>

        {/* Footer */}
        <footer className="text-center mt-8 text-gray-500">
          <p>Powered by Next.js, OpenAI, and Playwright</p>
        </footer>
      </div>
    </div>
  );
}
