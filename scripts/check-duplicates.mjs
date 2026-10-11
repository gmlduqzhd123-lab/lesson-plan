import { main, published } from './lib.mjs';
main(async () => console.log(`중복 검사 통과: ${(await published()).length}개 공개 자료의 ID·SHA-256이 고유합니다.`));
