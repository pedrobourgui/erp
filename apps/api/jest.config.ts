import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: { '^.+\\.(t|j)s$': 'ts-jest' },
  collectCoverageFrom: [
    '**/*.(service|controller|guard|interceptor).ts',
    '!**/node_modules/**',
  ],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    // Workspace packages ship raw TypeScript; point jest at the source so
    // ts-jest transforms it instead of choking on ESM inside node_modules.
    '^@erp/constants$': '<rootDir>/../../../packages/constants/src/index.ts',
    '^@erp/shared-types$': '<rootDir>/../../../packages/shared-types/src/index.ts',
    '^@erp/validators$': '<rootDir>/../../../packages/validators/src/index.ts',
  },
};

export default config;
