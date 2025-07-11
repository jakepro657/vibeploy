import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    return NextResponse.json({
      status: 'healthy',
      message: 'VibePloy API가 정상적으로 동작하고 있습니다.',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      endpoints: {
        scrape: '/api/scrape',
        health: '/api/health',
        docs: '/api/docs',
        test: '/api/test'
      }
    });
  } catch (error) {
    console.error('테스트 API 오류:', error);
    return NextResponse.json(
      { error: '테스트 API 실행에 실패했습니다.' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { url, testType } = await request.json();
    
    if (!url) {
      return NextResponse.json(
        { error: '테스트할 URL이 필요합니다.' },
        { status: 400 }
      );
    }

    // 기본 테스트 실행
    const testResult = await runBasicTests(url, testType);
    
    return NextResponse.json({
      success: true,
      url,
      testType: testType || 'basic',
      results: testResult,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('API 테스트 오류:', error);
    return NextResponse.json(
      { error: 'API 테스트에 실패했습니다.' },
      { status: 500 }
    );
  }
}

async function runBasicTests(url: string, testType?: string) {
  const results = {
    urlValidation: false,
    connectivity: false,
    responseTime: 0,
    statusCode: 0,
    contentType: '',
    errors: [] as string[]
  };

  try {
    // URL 유효성 검사
    const urlObject = new URL(url);
    results.urlValidation = true;

    // 연결 테스트
    const startTime = Date.now();
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'VibePloy-Bot/1.0'
      }
    });
    
    results.responseTime = Date.now() - startTime;
    results.statusCode = response.status;
    results.contentType = response.headers.get('content-type') || '';
    results.connectivity = response.ok;

    if (!response.ok) {
      results.errors.push(`HTTP ${response.status}: ${response.statusText}`);
    }

    // 추가 테스트 (testType에 따라)
    if (testType === 'detailed') {
      const additionalTests = await runDetailedTests(url);
      return { ...results, ...additionalTests };
    }

  } catch (error) {
    results.errors.push(`테스트 실행 오류: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
  }

  return results;
}

async function runDetailedTests(url: string) {
  const detailedResults = {
    htmlStructure: false,
    jsEnabled: false,
    loadTime: 0,
    pageSize: 0,
    metaTags: {} as Record<string, string>,
    extractableContent: [] as string[]
  };

  try {
    // HTML 구조 분석
    const response = await fetch(url);
    const html = await response.text();
    
    detailedResults.pageSize = html.length;
    detailedResults.htmlStructure = html.includes('<html') && html.includes('</html>');
    
    // 메타 태그 추출
    const titleMatch = html.match(/<title>(.*?)<\/title>/i);
    if (titleMatch) {
      detailedResults.metaTags.title = titleMatch[1];
    }
    
    const descMatch = html.match(/<meta name="description" content="(.*?)"/i);
    if (descMatch) {
      detailedResults.metaTags.description = descMatch[1];
    }

    // 추출 가능한 콘텐츠 탐지
    const contentIndicators = ['h1', 'h2', '.title', '.price', '.description', '.product'];
    for (const indicator of contentIndicators) {
      if (html.includes(indicator)) {
        detailedResults.extractableContent.push(indicator);
      }
    }

  } catch (error) {
    console.error('상세 테스트 오류:', error);
  }

  return detailedResults;
} 