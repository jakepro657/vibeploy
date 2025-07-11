import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const apiData = await request.json();

    if (!apiData.schema || !apiData.description) {
      return NextResponse.json(
        { error: 'API 스키마와 설명이 필요합니다.' },
        { status: 400 }
      );
    }

    const swagger = generateSwaggerSpec(apiData);
    const endpoint = generateEndpoint(apiData);

    return NextResponse.json({
      swagger,
      endpoint,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Swagger 생성 오류:', error);
    return NextResponse.json(
      { error: 'Swagger 문서 생성에 실패했습니다.' },
      { status: 500 }
    );
  }
}

function generateSwaggerSpec(apiData: any) {
  const { schema, description, url } = apiData;
  
  const swagger = {
    openapi: '3.0.0',
    info: {
      title: 'VibePloy Generated API',
      description: description || '자동 생성된 웹 크롤링 API',
      version: '1.0.0',
      contact: {
        name: 'VibePloy',
        url: 'https://vibeploy.com'
      }
    },
    servers: [
      {
        url: process.env.API_URL || 'http://localhost:3000',
        description: 'Development server'
      }
    ],
    paths: {
      '/api/scrape': {
        get: {
          summary: '웹 데이터 크롤링',
          description: `${url}에서 구조화된 데이터를 추출합니다.`,
          parameters: [
            {
              name: 'Authorization',
              in: 'header',
              required: true,
              schema: {
                type: 'string',
                format: 'Bearer {token}'
              },
              description: 'API 인증 토큰'
            },
            {
              name: 'refresh',
              in: 'query',
              required: false,
              schema: {
                type: 'boolean',
                default: false
              },
              description: '캐시된 데이터를 새로고침할지 여부'
            }
          ],
          responses: {
            '200': {
              description: '성공적으로 데이터를 추출했습니다.',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: {
                        type: 'boolean',
                        example: true
                      },
                      data: schema,
                      timestamp: {
                        type: 'string',
                        format: 'date-time',
                        example: '2024-01-01T00:00:00Z'
                      },
                      source: {
                        type: 'string',
                        example: url
                      },
                      cached: {
                        type: 'boolean',
                        example: false
                      }
                    }
                  }
                }
              }
            },
            '400': {
              description: '잘못된 요청',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      error: {
                        type: 'string',
                        example: '잘못된 요청 형식입니다.'
                      }
                    }
                  }
                }
              }
            },
            '401': {
              description: '인증 실패',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      error: {
                        type: 'string',
                        example: '올바른 인증 토큰이 필요합니다.'
                      }
                    }
                  }
                }
              }
            },
            '429': {
              description: '요청 제한 초과',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      error: {
                        type: 'string',
                        example: '너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해주세요.'
                      }
                    }
                  }
                }
              }
            },
            '500': {
              description: '서버 오류',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      error: {
                        type: 'string',
                        example: '데이터 추출에 실패했습니다.'
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/api/health': {
        get: {
          summary: 'API 상태 확인',
          description: 'API 서버의 상태를 확인합니다.',
          responses: {
            '200': {
              description: 'API 서버가 정상적으로 동작 중입니다.',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      status: {
                        type: 'string',
                        example: 'healthy'
                      },
                      timestamp: {
                        type: 'string',
                        format: 'date-time'
                      },
                      version: {
                        type: 'string',
                        example: '1.0.0'
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    components: {
      schemas: {
        ExtractedData: schema,
        ErrorResponse: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: '오류 메시지'
            }
          }
        }
      },
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      }
    },
    security: [
      {
        BearerAuth: []
      }
    ]
  };

  return swagger;
}

function generateEndpoint(apiData: any) {
  const { schema, description, url } = apiData;
  
  // 고유한 엔드포인트 ID 생성
  const endpointId = generateEndpointId(description);
  
  const endpoint = {
    id: endpointId,
    path: `/api/scrape/${endpointId}`,
    method: 'GET',
    description: description,
    source: url,
    schema: schema,
    created: new Date().toISOString(),
    status: 'active'
  };

  return endpoint;
}

function generateEndpointId(description: string): string {
  // 설명을 기반으로 고유한 엔드포인트 ID 생성
  const cleaned = description
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  
  const timestamp = Date.now().toString(36);
  return `${cleaned.substring(0, 20)}-${timestamp}`;
} 