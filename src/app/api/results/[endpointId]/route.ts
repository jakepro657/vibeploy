import { NextRequest, NextResponse } from 'next/server';
import { getRoute, getResult, storeResult } from '@/lib/redis';
import { retry } from '@/lib/utils';

export async function GET(
  request: NextRequest,
  { params }: { params: { endpointId: string } }
) {
  try {
    const { endpointId } = params;
    const { searchParams } = new URL(request.url);
    
    // API 키 검증 (선택사항)
    const apiKey = request.headers.get('Authorization')?.replace('Bearer ', '');
    
    // API 설정 조회
    const routeConfig = await getRoute(endpointId);
    if (!routeConfig) {
      return NextResponse.json(
        { 
          success: false,
          error: 'API 엔드포인트를 찾을 수 없습니다.'
        },
        { status: 404 }
      );
    }

    // API 키 검증 (설정된 경우)
    if (routeConfig.config.config?.apiKey && apiKey !== routeConfig.config.config.apiKey) {
      return NextResponse.json(
        { 
          success: false,
          error: '유효하지 않은 API 키입니다.'
        },
        { status: 401 }
      );
    }

    // 쿼리 매개변수 처리
    const forceRefresh = searchParams.get('refresh') === 'true';
    const format = searchParams.get('format') || 'json';
    
    // 캐시된 결과 조회 (forceRefresh가 false인 경우)
    if (!forceRefresh) {
      const cachedResult = await getResult(endpointId);
      if (cachedResult) {
        // 사용량 업데이트
        await updateUsageStats(endpointId, true);
        
        return NextResponse.json({
          success: true,
          data: cachedResult.data,
          metadata: {
            ...cachedResult,
            cached: true,
            requestId: generateRequestId(),
            usage: await getUsageStats(endpointId)
          }
        });
      }
    }

    // 실시간 데이터 추출 실행
    const extractedData = await executeDataExtraction(routeConfig.config);
    
    // 결과 캐싱
    const cacheTtl = routeConfig.config.config?.cacheTtl || 3600;
    await storeResult(endpointId, extractedData, cacheTtl);
    
    // 사용량 업데이트
    await updateUsageStats(endpointId, true);
    
    return NextResponse.json({
      success: true,
      data: extractedData,
      metadata: {
        timestamp: new Date().toISOString(),
        endpoint: endpointId,
        cached: false,
        requestId: generateRequestId(),
        executionTime: null, // 실행 시간 측정 필요
        usage: await getUsageStats(endpointId)
      }
    });
  } catch (error) {
    console.error('결과 조회 오류:', error);
    
    // 사용량 업데이트 (실패)
    await updateUsageStats(params.endpointId, false);
    
    return NextResponse.json(
      { 
        success: false,
        error: '데이터를 조회할 수 없습니다.',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

async function executeDataExtraction(config: any) {
  const { urls, schema, actions, parameters } = config;
  
  try {
    // 여러 URL에서 데이터 추출
    const results = await Promise.all(
      urls.map(async (url: string) => {
        return await retry(async () => {
          const response = await fetch(`${process.env.NEXT_PUBLIC_API_ROUTE}/api/execute-workflow`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              url,
              schema,
              actions,
              parameters,
              executeWorkflow: true
            })
          });
          
          if (!response.ok) {
            throw new Error(`데이터 추출 실패: ${response.statusText}`);
          }
          
          const data = await response.json();
          return {
            url,
            success: data.success,
            data: data.data,
            error: data.error
          };
        }, 3);
      })
    );
    
    // 결과 집계
    const successfulResults = results.filter(r => r.success);
    const failedResults = results.filter(r => !r.success);
    
    return {
      results: successfulResults.map(r => r.data),
      metadata: {
        total: results.length,
        successful: successfulResults.length,
        failed: failedResults.length,
        urls: urls,
        executedAt: new Date().toISOString(),
        errors: failedResults.map(r => ({ url: r.url, error: r.error }))
      }
    };
  } catch (error) {
    throw new Error(`데이터 추출 실행 실패: ${error}`);
  }
}

async function updateUsageStats(endpointId: string, success: boolean) {
  try {
    const routeConfig = await getRoute(endpointId);
    if (!routeConfig) return;
    
    const updatedConfig = {
      ...routeConfig.config,
      usage: {
        ...routeConfig.config.usage,
        totalCalls: (routeConfig.config.usage.totalCalls || 0) + 1,
        successfulCalls: success 
          ? (routeConfig.config.usage.successfulCalls || 0) + 1 
          : (routeConfig.config.usage.successfulCalls || 0),
        failedCalls: !success 
          ? (routeConfig.config.usage.failedCalls || 0) + 1 
          : (routeConfig.config.usage.failedCalls || 0),
        lastCall: new Date().toISOString()
      }
    };
    
    const { storeRoute } = await import('@/lib/redis');
    await storeRoute(endpointId, updatedConfig);
  } catch (error) {
    console.error('사용량 통계 업데이트 실패:', error);
  }
}

async function getUsageStats(endpointId: string) {
  try {
    const routeConfig = await getRoute(endpointId);
    return routeConfig?.config.usage || {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      lastCall: null
    };
  } catch (error) {
    console.error('사용량 통계 조회 실패:', error);
    return {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      lastCall: null
    };
  }
}

function generateRequestId(): string {
  return 'req_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// POST 요청 처리 (수동 데이터 추출 트리거)
export async function POST(
  request: NextRequest,
  { params }: { params: { endpointId: string } }
) {
  try {
    const { endpointId } = params;
    const body = await request.json();
    
    // API 키 검증
    const apiKey = request.headers.get('Authorization')?.replace('Bearer ', '');
    
    // API 설정 조회
    const routeConfig = await getRoute(endpointId);
    if (!routeConfig) {
      return NextResponse.json(
        { 
          success: false,
          error: 'API 엔드포인트를 찾을 수 없습니다.'
        },
        { status: 404 }
      );
    }

    // API 키 검증 (설정된 경우)
    if (routeConfig.config.config?.apiKey && apiKey !== routeConfig.config.config.apiKey) {
      return NextResponse.json(
        { 
          success: false,
          error: '유효하지 않은 API 키입니다.'
        },
        { status: 401 }
      );
    }

    // 사용자 제공 매개변수 병합
    const mergedConfig = {
      ...routeConfig.config,
      parameters: {
        ...routeConfig.config.parameters,
        ...body.parameters
      }
    };

    // 실시간 데이터 추출 실행
    const extractedData = await executeDataExtraction(mergedConfig);
    
    // 결과 캐싱
    const cacheTtl = routeConfig.config.config?.cacheTtl || 3600;
    await storeResult(endpointId, extractedData, cacheTtl);
    
    // 사용량 업데이트
    await updateUsageStats(endpointId, true);
    
    return NextResponse.json({
      success: true,
      data: extractedData,
      metadata: {
        timestamp: new Date().toISOString(),
        endpoint: endpointId,
        cached: false,
        requestId: generateRequestId(),
        triggeredBy: 'manual',
        usage: await getUsageStats(endpointId)
      }
    });
  } catch (error) {
    console.error('수동 데이터 추출 오류:', error);
    
    // 사용량 업데이트 (실패)
    await updateUsageStats(params.endpointId, false);
    
    return NextResponse.json(
      { 
        success: false,
        error: '데이터 추출에 실패했습니다.',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 