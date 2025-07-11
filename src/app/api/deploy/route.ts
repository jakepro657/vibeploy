import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { storeRoute, storeSchedule } from '@/lib/redis';
import { generateUniqueId } from '@/lib/utils';

// 요청 스키마 정의
const DeployRequest = z.object({
  name: z.string().min(1, 'API 이름이 필요합니다.'),
  description: z.string().optional(),
  schema: z.object({
    dataSchema: z.any(),
    actions: z.array(z.any()),
    metadata: z.object({
      title: z.string().optional(),
      description: z.string().optional(),
      category: z.string().optional(),
      complexity: z.enum(['low', 'medium', 'high']).optional(),
      estimatedTime: z.number().optional(),
      tags: z.array(z.string()).optional()
    }).optional()
  }),
  urls: z.array(z.string().url()).min(1, '최소 하나의 URL이 필요합니다.'),
  schedule: z.string().optional(), // CRON 형식
  parameters: z.record(z.any()).optional(),
  config: z.object({
    caching: z.boolean().optional().default(true),
    cacheTtl: z.number().optional().default(3600),
    retries: z.number().optional().default(3),
    timeout: z.number().optional().default(60000),
    apiKey: z.string().optional()
  }).optional()
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const deployData = DeployRequest.parse(body);

    // 고유한 API 엔드포인트 ID 생성
    const endpointId = generateUniqueId(deployData.name);
    
    // API 설정 저장
    const apiConfig = {
      ...deployData,
      endpointId,
      status: 'active',
      deployedAt: new Date().toISOString(),
      lastRun: null,
      nextRun: deployData.schedule ? calculateNextRun(deployData.schedule) : null,
      usage: {
        totalCalls: 0,
        successfulCalls: 0,
        failedCalls: 0,
        lastCall: null
      }
    };

    // Redis에 API 라우트 저장
    await storeRoute(endpointId, apiConfig);

    // 스케줄 설정이 있는 경우 저장
    if (deployData.schedule) {
      await storeSchedule(endpointId, {
        schedule: deployData.schedule,
        enabled: true,
        timezone: 'Asia/Seoul'
      });
    }

    // 배포 결과 반환
    const deploymentResult = {
      success: true,
      endpointId,
      url: `${process.env.NEXT_PUBLIC_API_ROUTE}/api/results/${endpointId}`,
      apiKey: deployData.config?.apiKey || generateApiKey(),
      endpoints: {
        getData: `${process.env.NEXT_PUBLIC_API_ROUTE}/api/results/${endpointId}`,
        getStatus: `${process.env.NEXT_PUBLIC_API_ROUTE}/api/status/${endpointId}`,
        getConfig: `${process.env.NEXT_PUBLIC_API_ROUTE}/api/config/${endpointId}`,
        documentation: `${process.env.NEXT_PUBLIC_API_ROUTE}/api/docs/${endpointId}`
      },
      schema: deployData.schema,
      config: {
        caching: deployData.config?.caching ?? true,
        cacheTtl: deployData.config?.cacheTtl ?? 3600,
        retries: deployData.config?.retries ?? 3,
        timeout: deployData.config?.timeout ?? 60000,
        schedule: deployData.schedule || null
      },
      usage: {
        totalCalls: 0,
        successfulCalls: 0,
        failedCalls: 0,
        lastCall: null
      },
      metadata: {
        deployedAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        version: '1.0.0',
        status: 'active'
      }
    };

    return NextResponse.json(deploymentResult, { status: 201 });
  } catch (error) {
    console.error('배포 오류:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          success: false,
          error: '배포 데이터가 유효하지 않습니다.',
          details: error.errors
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { 
        success: false,
        error: '배포에 실패했습니다.',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// API 키 생성 함수
function generateApiKey(): string {
  return 'sk_' + Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// 다음 실행 시간 계산 함수
function calculateNextRun(cronExpression: string): string | null {
  try {
    // 간단한 CRON 파싱 예시 (실제로는 cron 라이브러리 사용 권장)
    const now = new Date();
    const nextRun = new Date(now.getTime() + 60 * 60 * 1000); // 1시간 후로 임시 설정
    return nextRun.toISOString();
  } catch (error) {
    console.error('CRON 표현식 파싱 오류:', error);
    return null;
  }
}

// GET 요청 처리 (배포된 API 목록 조회)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = parseInt(searchParams.get('offset') || '0');
    const status = searchParams.get('status');
    const category = searchParams.get('category');

    // Redis에서 배포된 API 목록 조회
    const { getAllRoutes } = await import('@/lib/redis');
    const allRoutes = await getAllRoutes();

    // 필터링
    let filteredRoutes = allRoutes;
    
    if (status) {
      filteredRoutes = filteredRoutes.filter(route => route.config.status === status);
    }
    
    if (category) {
      filteredRoutes = filteredRoutes.filter(route => 
        route.config.schema?.metadata?.category === category
      );
    }

    // 페이지네이션
    const paginatedRoutes = filteredRoutes.slice(offset, offset + limit);

    return NextResponse.json({
      success: true,
      data: paginatedRoutes,
      pagination: {
        total: filteredRoutes.length,
        limit,
        offset,
        hasMore: offset + limit < filteredRoutes.length
      },
      metadata: {
        timestamp: new Date().toISOString(),
        totalDeployed: allRoutes.length,
        activeRoutes: allRoutes.filter(r => r.config.status === 'active').length,
        inactiveRoutes: allRoutes.filter(r => r.config.status === 'inactive').length
      }
    });
  } catch (error) {
    console.error('API 목록 조회 오류:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'API 목록을 조회할 수 없습니다.'
      },
      { status: 500 }
    );
  }
}

// DELETE 요청 처리 (API 엔드포인트 삭제)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const endpointId = searchParams.get('endpointId');

    if (!endpointId) {
      return NextResponse.json(
        { 
          success: false,
          error: 'endpointId가 필요합니다.'
        },
        { status: 400 }
      );
    }

    // Redis에서 API 라우트 삭제
    const { redis, getCacheKey } = await import('@/lib/redis');
    
    // 라우트 설정 삭제
    const routeKey = getCacheKey('routes', endpointId);
    await redis.del(routeKey);
    
    // 라우트 목록에서 제거
    await redis.srem('vibeploy:routes:list', endpointId);
    
    // 스케줄 설정 삭제
    const scheduleKey = getCacheKey('schedules', endpointId);
    await redis.del(scheduleKey);
    
    // 캐시된 결과 삭제
    const resultKey = getCacheKey('results', endpointId);
    await redis.del(resultKey);

    return NextResponse.json({
      success: true,
      message: `API 엔드포인트 ${endpointId}가 성공적으로 삭제되었습니다.`,
      metadata: {
        deletedAt: new Date().toISOString(),
        endpointId
      }
    });
  } catch (error) {
    console.error('API 삭제 오류:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'API 삭제에 실패했습니다.'
      },
      { status: 500 }
    );
  }
} 