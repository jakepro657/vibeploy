// 고유한 ID 생성 함수
export function generateUniqueId(prefix: string): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substr(2, 9);
  const cleanPrefix = prefix.toLowerCase().replace(/[^a-z0-9]/g, '-');
  return `${cleanPrefix}-${timestamp}-${randomPart}`;
}

// 문자열을 슬러그로 변환하는 함수
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// 깊은 복사 함수
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  if (obj instanceof Date) {
    return new Date(obj.getTime()) as T;
  }
  
  if (obj instanceof Array) {
    return obj.map(item => deepClone(item)) as T;
  }
  
  if (typeof obj === 'object') {
    const cloned = {} as T;
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloned[key] = deepClone(obj[key]);
      }
    }
    return cloned;
  }
  
  return obj;
}

// 지연 함수
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 재시도 함수
export async function retry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (i === maxRetries) {
        throw lastError;
      }
      await delay(delayMs * Math.pow(2, i)); // 지수적 백오프
    }
  }
  
  throw lastError!;
}

// 시간 포맷팅 함수
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m ${remainingSeconds}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  } else {
    return `${remainingSeconds}s`;
  }
}

// 날짜 포맷팅 함수
export function formatDate(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// 바이트 크기 포맷팅 함수
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// 배열 청크 분할 함수
export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

// 객체에서 특정 키만 선택하는 함수
export function pick<T, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  const result = {} as Pick<T, K>;
  for (const key of keys) {
    if (key in obj) {
      result[key] = obj[key];
    }
  }
  return result;
}

// 객체에서 특정 키를 제외하는 함수
export function omit<T, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
  const result = { ...obj };
  for (const key of keys) {
    delete result[key];
  }
  return result;
} 