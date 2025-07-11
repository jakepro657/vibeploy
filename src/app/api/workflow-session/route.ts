import { NextRequest, NextResponse } from 'next/server';

// 워크플로우 세션 관리 API
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');
  const action = searchParams.get('action');

  if (!sessionId) {
    return NextResponse.json(
      { 
        success: false,
        error: '세션 ID가 필요합니다.'
      },
      { status: 400 }
    );
  }

  try {
    // execute-workflow 라우트에서 세션 상태 확인
    const response = await fetch(`${request.nextUrl.origin}/api/execute-workflow`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sessionId,
        sessionAction: action || 'get_status'
      })
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });

  } catch (error) {
    console.error('세션 상태 조회 오류:', error);
    return NextResponse.json(
      { 
        success: false,
        error: '세션 상태를 조회할 수 없습니다.'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, action, inputs } = body;

    if (!sessionId) {
      return NextResponse.json(
        { 
          success: false,
          error: '세션 ID가 필요합니다.'
        },
        { status: 400 }
      );
    }

    if (!action) {
      return NextResponse.json(
        { 
          success: false,
          error: '액션이 필요합니다.'
        },
        { status: 400 }
      );
    }

    // execute-workflow 라우트로 요청 전달
    const response = await fetch(`${request.nextUrl.origin}/api/execute-workflow`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sessionId,
        sessionAction: action,
        sessionData: { inputs }
      })
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });

  } catch (error) {
    console.error('세션 액션 처리 오류:', error);
    return NextResponse.json(
      { 
        success: false,
        error: '세션 액션을 처리할 수 없습니다.'
      },
      { status: 500 }
    );
  }
} 