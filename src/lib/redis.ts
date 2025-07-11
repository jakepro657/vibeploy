import { Redis } from '@upstash/redis';

// Redis 클라이언트 인스턴스 생성
export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
});

// 캐시 키 생성 헬퍼
export const getCacheKey = (type: string, id: string) => {
  return `vibeploy:${type}:${id}`;
};

// 결과 저장 헬퍼
export const storeResult = async (endpoint: string, data: any, ttl: number = 3600) => {
  const key = getCacheKey('results', endpoint);
  await redis.setex(key, ttl, JSON.stringify({
    data,
    timestamp: new Date().toISOString(),
    endpoint
  }));
};

// 결과 조회 헬퍼
export const getResult = async (endpoint: string) => {
  const key = getCacheKey('results', endpoint);
  const result = await redis.get(key);
  return result ? JSON.parse(result as string) : null;
};

// 스키마 저장 헬퍼
export const storeSchema = async (schemaId: string, schema: any) => {
  const key = getCacheKey('schemas', schemaId);
  await redis.set(key, JSON.stringify({
    schema,
    createdAt: new Date().toISOString(),
    schemaId
  }));
};

// 스키마 조회 헬퍼
export const getSchema = async (schemaId: string) => {
  const key = getCacheKey('schemas', schemaId);
  const result = await redis.get(key);
  return result ? JSON.parse(result as string) : null;
};

// 배포된 API 라우트 저장 헬퍼
export const storeRoute = async (routeId: string, config: any) => {
  const key = getCacheKey('routes', routeId);
  await redis.set(key, JSON.stringify({
    config,
    createdAt: new Date().toISOString(),
    routeId,
    status: 'active'
  }));
  
  // 전체 라우트 리스트에도 추가
  await redis.sadd('vibeploy:routes:list', routeId);
};

// 배포된 API 라우트 조회 헬퍼
export const getRoute = async (routeId: string) => {
  const key = getCacheKey('routes', routeId);
  const result = await redis.get(key);
  return result ? JSON.parse(result as string) : null;
};

// 모든 라우트 목록 조회 헬퍼
export const getAllRoutes = async () => {
  const routeIds = await redis.smembers('vibeploy:routes:list');
  const routes = await Promise.all(
    routeIds.map(async (id) => {
      const route = await getRoute(id);
      return route;
    })
  );
  return routes.filter(Boolean);
};

// 스케줄링 정보 저장 헬퍼
export const storeSchedule = async (routeId: string, scheduleConfig: any) => {
  const key = getCacheKey('schedules', routeId);
  await redis.set(key, JSON.stringify({
    scheduleConfig,
    routeId,
    createdAt: new Date().toISOString(),
    status: 'active'
  }));
};

// 스케줄링 정보 조회 헬퍼
export const getSchedule = async (routeId: string) => {
  const key = getCacheKey('schedules', routeId);
  const result = await redis.get(key);
  return result ? JSON.parse(result as string) : null;
};

// API 키 저장 헬퍼
export const storeApiKey = async (apiKey: string, keyInfo: any) => {
  const key = getCacheKey('apikeys', apiKey);
  await redis.set(key, JSON.stringify({
    ...keyInfo,
    createdAt: new Date().toISOString(),
    apiKey,
    usageCount: 0
  }));
};

// API 키 조회 헬퍼
export const getApiKey = async (apiKey: string) => {
  const key = getCacheKey('apikeys', apiKey);
  const result = await redis.get(key);
  return result ? JSON.parse(result as string) : null;
};

// API 키 사용량 업데이트 헬퍼
export const updateApiKeyUsage = async (apiKey: string) => {
  const key = getCacheKey('apikeys', apiKey);
  const keyInfo = await getApiKey(apiKey);
  
  if (keyInfo) {
    keyInfo.usageCount = (keyInfo.usageCount || 0) + 1;
    keyInfo.lastUsed = new Date().toISOString();
    await redis.set(key, JSON.stringify(keyInfo));
  }
};

// API 키 삭제 헬퍼
export const deleteApiKey = async (apiKey: string) => {
  const key = getCacheKey('apikeys', apiKey);
  await redis.del(key);
};

// API 키 상태 업데이트 헬퍼
export const updateApiKeyStatus = async (apiKey: string, status: 'active' | 'inactive' | 'suspended') => {
  const key = getCacheKey('apikeys', apiKey);
  const keyInfo = await getApiKey(apiKey);
  
  if (keyInfo) {
    keyInfo.status = status;
    keyInfo.updatedAt = new Date().toISOString();
    await redis.set(key, JSON.stringify(keyInfo));
  }
}; 