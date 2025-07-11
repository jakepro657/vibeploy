# KT 통신사 가입 자동화 프롬프트

KT 통신사 온라인 가입 페이지에서 개인/일반 고객의 기기변경 또는 번호이동 신청을 자동화합니다. 

## 필수 추출 데이터 필드

- 신청 완료 여부: .btn_e63838.btn_large:text("완료") 버튼 클릭 성공 여부
- 주문 번호: 신청 완료 후 생성되는 주문 번호
- 인증 상태: SMS 인증 완료 여부
- 신청 타입: 기기변경 또는 번호이동
- 선택 요금제: 선택된 요금제 정보
- 할인 유형: 선택약정 또는 공시지원금
- 배송 주소: 입력된 배송지 정보

## 자동화 액션 시퀀스

### 1단계: 페이지 이동 및 초기 설정
- 대상 URL로 이동 ({{link4}})
- .btn_w220.btn_e63838.btn_large 버튼 클릭
- text=개인/일반 텍스트가 포함된 요소 클릭

### 2단계: 신청 유형 선택
- 조건: {{telChange}} 값이 "기변"인 경우
  - text=기기변경 텍스트가 포함된 요소 클릭
- 조건: {{telChange}} 값이 "번이"인 경우  
  - text=번호이동 텍스트가 포함된 요소 클릭
- .btn_e63838.btn_large 버튼 클릭

### 3단계: 약관 동의
- text='필수 및 고객 혜택 제공 선택 동의' 텍스트가 포함된 요소 클릭

### 4단계: 본인확인 정보 입력
- #baseNm 셀렉터에 {{name}} 값 입력 후 Enter 키 입력
- #baseRegno1 셀렉터에 {{birth}} 값 입력 후 Enter 키 입력  
- #baseSexInfo 셀렉터에서 {{gender}} 옵션 선택

### 5단계: 본인인증 팝업 처리 (첫 번째 팝업)
- #certBtn 셀렉터 클릭하여 팝업 열기
- 팝업 로드 대기

### 6단계: 본인인증 팝업 처리 (두 번째 팝업)  
- 첫 번째 팝업에서 #certBtn 셀렉터 클릭하여 두 번째 팝업 열기
- 두 번째 팝업에서 #telcomKT 셀렉터 클릭 (통신사 선택)
- text='문자(SMS) 인증' 텍스트가 포함된 요소로 스크롤 후 클릭
- text='본인확인 이용 동의' 텍스트가 포함된 요소 클릭
- #btnMobileCertStart 셀렉터 클릭

### 7단계: 개인정보 입력
- #userName 셀렉터에 {{name}} 값 입력 후 Enter 키 입력
- #btnSubmit 셀렉터 클릭
- #myNum1 셀렉터에 {{rrnFront}} 값 입력 (100ms 딜레이)
- #myNum2 셀렉터에 {{rrnBack}} 값 입력 (100ms 딜레이)
- #mobileNo 셀렉터에 {{phone}} 값 입력 (100ms 딜레이)

### 8단계: 보안문자 처리
- #simpleCaptchaImg 셀렉터로 스크롤
- 보안문자 이미지 인식 및 입력 처리 (Vision AI 활용)

### 9단계: SMS 인증번호 입력 대기
- SMS 인증번호 입력 필드 대기
- 사용자로부터 인증번호 입력 받기 ({{smsCode}})

### 10단계: 배송 정보 입력
- [name="custCtn2"] 셀렉터로 스크롤
- custCtn2, custCtn3 필드에 {{phone}} 번호 분할 입력
- a.btn_39a7a8:has-text('우편번호 찾기') 셀렉터 클릭하여 주소 팝업 열기

### 11단계: 주소 검색 및 선택 (첫 번째)
- 주소 팝업에서 #srchCon 셀렉터에 {{address}} 값 입력
- #searAddr 셀렉터 클릭하여 주소 검색
- .result-addr1.w590 셀렉터 클릭하여 검색 결과 선택
- div.jibun > span 셀렉터의 첫 번째 요소 클릭
- input.result-addr2 셀렉터에 {{detailAddress}} 값 입력
- button.submit 셀렉터 클릭하여 주소 등록

### 12단계: 수령인 정보 입력
- #custRecvName 셀렉터에 {{name}} 값 입력
- ordererCtn2, ordererCtn3 필드에 {{phone}} 번호 분할 입력
- [name="mvHandsetNo32"] 셀렉터로 스크롤
- mvHandsetNo32, mvHandsetNo33 필드에 {{phone}} 번호 분할 입력
- button[name="KT고객인증"] 셀렉터 클릭하여 고객 인증

### 13단계: 요금제 선택
- #priceSel button 셀렉터의 5번째 버튼(nth(4)) 클릭

### 14단계: 주소 검색 및 선택 (두 번째)
- button[name="주 생활지역 찾기"] 셀렉터 클릭하여 주소 팝업 열기
- 주소 팝업에서 #srchCon 셀렉터에 {{address}} 값 입력
- #searAddr 셀렉터 클릭하여 주소 검색
- .result-addr1.w590 셀렉터 클릭하여 검색 결과 선택
- div.jibun > span 셀렉터의 첫 번째 요소 클릭
- button.submit 셀렉터 클릭하여 주소 등록

### 15단계: 서비스 옵션 선택
- [name="coverageInfo_btn"] 셀렉터 클릭하여 동의
- button[name="확인"] 셀렉터 클릭
- msg.transMsg:has-text("지원금 방식별 할인혜택") 셀렉터로 스크롤

### 16단계: 할인 유형 선택
- 조건: {{discountType}} 값이 "선약"인 경우
  - button[name="선택약정(요금할인)"] 셀렉터 클릭
- 조건: {{discountType}} 값이 "공시"인 경우
  - button[name="공시지원금(심플)"] 셀렉터 클릭

### 17단계: 유심 선택
- msg.transMsg:has-text("유심구매") 셀렉터로 스크롤
- 조건: {{telChange}} 값이 "기변"인 경우
  - button[name="현재유심 사용"] 셀렉터 클릭
- 조건: {{telChange}} 값이 "번이"인 경우
  - button[name="신규 유심 구매"] 셀렉터 클릭

### 18단계: 부가 서비스 설정
- button.act-notReg[name="showCareCd_btn"] 셀렉터 클릭 (핸드폰 보험)
- msg.transMsg:has-text("연락처변경 서비스 신청") 셀렉터로 스크롤
- button[name="cntplcChgSvcYn_btn"]:has-text("신청 안함") 셀렉터 클릭
- span.transMsg:has-text("번호도용 문자차단서비스") 셀렉터 클릭

### 19단계: 최종 동의 및 비밀번호 입력
- input[type="checkbox"][name="svcChgInfo"] 셀렉터로 스크롤 후 체크박스 클릭
- #formPwd 셀렉터에 "sungjiai1234" 입력
- #formPwd1 셀렉터에 "sungjiai1234" 입력
- #fnOpenLayerBtn 셀렉터 클릭 (작성완료)

### 20단계: 최종 완료
- button.btn_e63838.btn_large:text("완료") 셀렉터 클릭
- 버튼이 보이지 않는 경우 JavaScript로 강제 활성화 후 클릭

## 매개변수 정의

- {{link4}}: 대상 KT 가입 페이지 URL
- {{name}}: 신청자 이름
- {{birth}}: 생년월일 (6자리)
- {{gender}}: 성별 (남/여)
- {{rrnFront}}: 주민등록번호 앞자리
- {{rrnBack}}: 주민등록번호 뒷자리
- {{phone}}: 휴대폰 번호
- {{telChange}}: 신청 유형 ("기변" 또는 "번이")
- {{address}}: 주소
- {{detailAddress}}: 상세 주소
- {{discountType}}: 할인 유형 ("선약" 또는 "공시")
- {{smsCode}}: SMS 인증번호 (사용자 입력)

## 특별 처리 사항

1. **팝업 처리**: 여러 단계의 팝업이 순차적으로 열리므로 각 팝업의 로드 완료를 대기
2. **SMS 인증**: 보안문자 처리 후 SMS 발송되면 사용자 입력 대기
3. **다이얼로그 자동 처리**: 알림창이 뜨면 자동으로 '확인' 클릭
4. **스크롤 처리**: 요소가 화면에 보이지 않을 경우 자동 스크롤
5. **입력 딜레이**: 일부 입력 필드는 100ms 딜레이로 자연스러운 입력 시뮬레이션
6. **조건부 실행**: telChange, discountType 값에 따른 분기 처리
7. **에러 복구**: 버튼이 비활성화된 경우 JavaScript로 강제 활성화 

[!MOST IMPORTANT] 결국 중요한건 모든 CSS 셀렉터를 빠짐 없이 사용하여 워크플로우를 정확하고 빠짐없이 만드는게 중요