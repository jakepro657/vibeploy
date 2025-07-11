import { NextRequest, NextResponse } from 'next/server';
import { getAllRoutes, getRoute } from '@/lib/redis';

// GET 요청 처리 (배포된 API 라우트 목록 조회)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = parseInt(searchParams.get('offset') || '0');
    const status = searchParams.get('status');
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    // Redis에서 모든 라우트 조회
    const allRoutes = await getAllRoutes();

    // 필터링
    let filteredRoutes = allRoutes;
    
    // 상태 필터
    if (status) {
      filteredRoutes = filteredRoutes.filter(route => route.config.status === status);
    }
    
    // 카테고리 필터
    if (category) {
      filteredRoutes = filteredRoutes.filter(route => 
        route.config.schema?.metadata?.category === category
      );
    }

    // 검색 필터
    if (search) {
      const searchLower = search.toLowerCase();
      filteredRoutes = filteredRoutes.filter(route =>
        route.config.name?.toLowerCase().includes(searchLower) ||
        route.config.description?.toLowerCase().includes(searchLower) ||
        route.config.schema?.metadata?.title?.toLowerCase().includes(searchLower)
      );
    }

    // 정렬
    filteredRoutes.sort((a, b) => {
      const aValue = a.config[sortBy] || a.config.schema?.metadata?.[sortBy];
      const bValue = b.config[sortBy] || b.config.schema?.metadata?.[sortBy];
      
      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    // 페이지네이션
    const paginatedRoutes = filteredRoutes.slice(offset, offset + limit);

    // 통계 계산
    const stats = {
      total: allRoutes.length,
      active: allRoutes.filter(r => r.config.status === 'active').length,
      inactive: allRoutes.filter(r => r.config.status === 'inactive').length,
      scheduled: allRoutes.filter(r => r.config.schedule).length,
      categories: [...new Set(allRoutes.map(r => r.config.schema?.metadata?.category).filter(Boolean))],
      totalCalls: allRoutes.reduce((sum, r) => sum + (r.config.usage?.totalCalls || 0), 0),
      successfulCalls: allRoutes.reduce((sum, r) => sum + (r.config.usage?.successfulCalls || 0), 0),
      failedCalls: allRoutes.reduce((sum, r) => sum + (r.config.usage?.failedCalls || 0), 0)
    };

    return NextResponse.json({
      success: true,
      data: paginatedRoutes.map(route => ({
        endpointId: route.routeId,
        name: route.config.name,
        description: route.config.description,
        status: route.config.status,
        urls: route.config.urls,
        schema: route.config.schema,
        schedule: route.config.schedule,
        usage: route.config.usage,
        metadata: {
          createdAt: route.createdAt,
          deployedAt: route.config.deployedAt,
          lastRun: route.config.lastRun,
          nextRun: route.config.nextRun,
          category: route.config.schema?.metadata?.category,
          complexity: route.config.schema?.metadata?.complexity,
          estimatedTime: route.config.schema?.metadata?.estimatedTime,
          tags: route.config.schema?.metadata?.tags
        },
        endpoints: {
          getData: `${process.env.NEXT_PUBLIC_API_ROUTE}/api/results/${route.routeId}`,
          getStatus: `${process.env.NEXT_PUBLIC_API_ROUTE}/api/status/${route.routeId}`,
          getConfig: `${process.env.NEXT_PUBLIC_API_ROUTE}/api/config/${route.routeId}`,
          documentation: `${process.env.NEXT_PUBLIC_API_ROUTE}/api/docs/${route.routeId}`
        }
      })),
      pagination: {
        total: filteredRoutes.length,
        limit,
        offset,
        hasMore: offset + limit < filteredRoutes.length,
        pages: Math.ceil(filteredRoutes.length / limit),
        currentPage: Math.floor(offset / limit) + 1
      },
      stats,
      metadata: {
        timestamp: new Date().toISOString(),
        filters: {
          status,
          category,
          search
        },
        sorting: {
          sortBy,
          sortOrder
        }
      }
    });
  } catch (error) {
    console.error('라우트 목록 조회 오류:', error);
    return NextResponse.json(
      { 
        success: false,
        error: '라우트 목록을 조회할 수 없습니다.',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// POST 요청 처리 (라우트 상태 업데이트)
export async function POST(request: NextRequest) {
  try {
    const { action, endpointId, data } = await request.json();

    if (!endpointId) {
      return NextResponse.json(
        { 
          success: false,
          error: 'endpointId가 필요합니다.'
        },
        { status: 400 }
      );
    }

    const routeConfig = await getRoute(endpointId);
    if (!routeConfig) {
      return NextResponse.json(
        { 
          success: false,
          error: '라우트를 찾을 수 없습니다.'
        },
        { status: 404 }
      );
    }

    const { storeRoute } = await import('@/lib/redis');
    let updatedConfig = { ...routeConfig.config };

    switch (action) {
      case 'activate':
        updatedConfig.status = 'active';
        break;
        
      case 'deactivate':
        updatedConfig.status = 'inactive';
        break;
        
      case 'update':
        updatedConfig = {
          ...updatedConfig,
          ...data,
          lastUpdated: new Date().toISOString()
        };
        break;
        
      case 'trigger':
        // 수동으로 데이터 추출 트리거
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_ROUTE}/api/results/${endpointId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            parameters: data?.parameters || {}
          })
        });
        
        if (!response.ok) {
          throw new Error('데이터 추출 트리거 실패');
        }
        
        const result = await response.json();
        return NextResponse.json({
          success: true,
          message: '데이터 추출이 성공적으로 실행되었습니다.',
          data: result
        });
        
      default:
        return NextResponse.json(
          { 
            success: false,
            error: '지원되지 않는 액션입니다.'
          },
          { status: 400 }
        );
    }

    // 업데이트된 설정 저장
    await storeRoute(endpointId, updatedConfig);

    return NextResponse.json({
      success: true,
      message: `라우트 ${action} 작업이 완료되었습니다.`,
      data: {
        endpointId,
        action,
        updatedAt: new Date().toISOString(),
        config: updatedConfig
      }
    });
  } catch (error) {
    console.error('라우트 업데이트 오류:', error);
    return NextResponse.json(
      { 
        success: false,
        error: '라우트 업데이트에 실패했습니다.',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 