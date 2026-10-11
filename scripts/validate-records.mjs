import { main, published } from './lib.mjs';
main(async () => console.log(`정적 자료 검증 통과: ${(await published()).length}개 (승인·경로·크기·SHA-256)`));
