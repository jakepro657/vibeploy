import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { description, actions } = await request.json();

    if (!description) {
      return NextResponse.json(
        { error: '설명이 필요합니다.' },
        { status: 400 }
      );
    }

    // OpenAI API를 사용한 스키마 생성
    const schema = await generateSchemaWithOpenAI(description, actions);

    return NextResponse.json(schema);
  } catch (error) {
    console.error('스키마 생성 오류:', error);
    return NextResponse.json(
      { error: '스키마 생성에 실패했습니다.' },
      { status: 500 }
    );
  }
}

async function generateSchemaWithOpenAI(description: string, actions?: any[]) {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  
  if (!OPENAI_API_KEY) {
    console.warn('OpenAI API 키가 없습니다. Mock 데이터를 사용합니다.');
    return generateMockSchema(description, actions);
  }

  try {
    const systemPrompt = `당신은 Magnitude 스타일의 vision-first 브라우저 자동화 전문가입니다. CSS 셀렉터에 의존하지 않고 시각적 요소 설명을 통해 작업을 수행합니다.

사용자의 설명을 분석하여 다음을 포함한 JSON 스키마를 생성해주세요:

1. 추출할 데이터 필드 (시각적 설명 포함)
2. 자연어 기반 브라우저 액션 시퀀스
3. Vision AI가 이해할 수 있는 요소 설명

다음 형식으로 응답해주세요:
{
  "dataSchema": {
    "type": "object",
    "properties": {
      "필드명": {
        "type": "string/number/boolean",
        "description": "필드 설명",
        "visualDescription": "시각적 요소 설명 (예: '상품 제목이 표시된 큰 텍스트')"
      }
    },
    "required": ["필수필드"]
  },
  "actions": [
    {
      "type": "navigate",
      "url": "{{url}}",
      "description": "대상 웹사이트로 이동"
    },
    {
      "type": "act",
      "instruction": "자연어 액션 설명 (예: '로그인 버튼을 클릭하세요')",
      "description": "수행할 작업에 대한 설명",
      "data": {
        "inputValue": "{{value}}"
      }
    },
    {
      "type": "extract",
      "instruction": "추출할 데이터에 대한 자연어 설명",
      "description": "데이터 추출 작업"
    }
  ]
}`;

    const userPrompt = `
사용자 설명: "${description}"

${actions ? `기존 액션: ${JSON.stringify(actions, null, 2)}` : ''}

위 설명을 바탕으로 웹 스크래핑과 브라우저 자동화에 필요한 스키마와 액션 시퀀스를 생성해주세요.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API 오류: ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      throw new Error('OpenAI 응답이 비어있습니다.');
    }

    // JSON 추출
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('유효한 JSON을 찾을 수 없습니다.');
    }

    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error('OpenAI API 호출 실패:', error);
    return generateMockSchema(description, actions);
  }
}

function generateMockSchema(description: string, actions?: any[]) {
  // Magnitude 스타일의 vision-first 접근 방식을 사용한 임시 스키마 생성
  const commonFields = {
    title: { 
      type: 'string', 
      description: '제목', 
      visualDescription: '페이지 상단에 크게 표시된 주요 제목 텍스트'
    },
    price: { 
      type: 'string', 
      description: '가격', 
      visualDescription: '통화 기호와 함께 표시된 숫자로 된 가격 정보'
    },
    image: { 
      type: 'string', 
      description: '이미지 URL', 
      visualDescription: '주요 상품이나 콘텐츠를 보여주는 대표 이미지'
    },
    rating: { 
      type: 'number', 
      description: '평점', 
      visualDescription: '별점이나 숫자로 표시된 평가 점수'
    },
    description: { 
      type: 'string', 
      description: '설명', 
      visualDescription: '상세한 설명이 포함된 긴 텍스트 영역'
    },
    link: { 
      type: 'string', 
      description: '링크', 
      visualDescription: '클릭 가능한 링크 또는 버튼'
    },
    category: { 
      type: 'string', 
      description: '카테고리', 
      visualDescription: '분류나 카테고리를 나타내는 텍스트 라벨'
    },
    brand: { 
      type: 'string', 
      description: '브랜드', 
      visualDescription: '브랜드명이나 제조사명이 표시된 텍스트'
    },
    stock: { 
      type: 'number', 
      description: '재고', 
      visualDescription: '재고 수량을 나타내는 숫자'
    },
    reviews: { 
      type: 'number', 
      description: '리뷰 수', 
      visualDescription: '리뷰나 후기 개수를 나타내는 숫자'
    }
  };

  const dataSchema = {
    type: 'object',
    properties: {} as Record<string, any>,
    required: [] as string[]
  };

  // 설명에 따라 관련 필드 자동 선택
  const descLower = description.toLowerCase();
  
  if (descLower.includes('제품') || descLower.includes('상품')) {
    dataSchema.properties.title = commonFields.title;
    dataSchema.properties.price = commonFields.price;
    dataSchema.properties.image = commonFields.image;
    dataSchema.properties.rating = commonFields.rating;
    dataSchema.required = ['title', 'price'];
  }
  
  if (descLower.includes('가격')) {
    dataSchema.properties.price = commonFields.price;
    if (!dataSchema.required.includes('price')) dataSchema.required.push('price');
  }
  
  if (descLower.includes('이미지') || descLower.includes('사진')) {
    dataSchema.properties.image = commonFields.image;
  }
  
  if (descLower.includes('평점') || descLower.includes('별점')) {
    dataSchema.properties.rating = commonFields.rating;
  }
  
  if (descLower.includes('리뷰')) {
    dataSchema.properties.reviews = commonFields.reviews;
  }
  
  if (descLower.includes('브랜드')) {
    dataSchema.properties.brand = commonFields.brand;
  }
  
  if (descLower.includes('카테고리')) {
    dataSchema.properties.category = commonFields.category;
  }
  
  if (descLower.includes('재고')) {
    dataSchema.properties.stock = commonFields.stock;
  }
  
  if (descLower.includes('링크') || descLower.includes('url')) {
    dataSchema.properties.link = commonFields.link;
  }
  
  if (descLower.includes('설명') || descLower.includes('내용')) {
    dataSchema.properties.description = commonFields.description;
  }

  // 기본 필드가 없다면 일반적인 필드 추가
  if (Object.keys(dataSchema.properties).length === 0) {
    dataSchema.properties.title = commonFields.title;
    dataSchema.properties.description = commonFields.description;
    dataSchema.properties.link = commonFields.link;
    dataSchema.required = ['title'];
  }

  // Magnitude 스타일의 vision-first 액션 시퀀스 생성
  const defaultActions: any[] = [
    {
      type: 'navigate',
      url: '{{url}}',
      description: '대상 웹사이트로 이동'
    },
    {
      type: 'act',
      instruction: '페이지가 완전히 로드될 때까지 기다리세요',
      description: '페이지 로드 대기'
    }
  ];

  // 자연어 기반 액션 추가
  if (descLower.includes('로그인')) {
    defaultActions.push({
      type: 'act',
      instruction: '이메일 또는 사용자명 입력 필드를 찾아 {{email}}을 입력하세요',
      description: '사용자 계정 정보 입력',
      data: { inputValue: '{{email}}' }
    });
    defaultActions.push({
      type: 'act',
      instruction: '비밀번호 입력 필드를 찾아 {{password}}를 입력하세요',
      description: '비밀번호 입력',
      data: { inputValue: '{{password}}' }
    });
    defaultActions.push({
      type: 'act',
      instruction: '로그인 버튼을 클릭하세요',
      description: '로그인 실행'
    });
  }

  if (descLower.includes('검색')) {
    defaultActions.push({
      type: 'act',
      instruction: '검색 입력 필드를 찾아 {{searchTerm}}을 입력하세요',
      description: '검색어 입력',
      data: { inputValue: '{{searchTerm}}' }
    });
    defaultActions.push({
      type: 'act',
      instruction: '검색 버튼을 클릭하거나 Enter 키를 누르세요',
      description: '검색 실행'
    });
  }

  if (descLower.includes('클릭') || descLower.includes('버튼')) {
    defaultActions.push({
      type: 'act',
      instruction: '{{actionDescription}}에 해당하는 버튼이나 링크를 클릭하세요',
      description: '지정된 요소 클릭',
      data: { target: '{{buttonDescription}}' }
    });
  }

  defaultActions.push({
    type: 'extract',
    instruction: '페이지에서 요청된 데이터를 시각적으로 식별하고 추출하세요',
    description: '데이터 추출 실행'
  });

  return {
    dataSchema,
    actions: actions || defaultActions
  };
} 