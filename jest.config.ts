// MIDAS — Jest Configuration
// jest.config.ts (root)

import type { Config } from 'jest'

const config: Config = {
  projects: [
    {
      displayName: 'api',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/packages/api/src/**/*.test.ts', '<rootDir>/packages/api/src/**/__tests__/**/*.test.ts'],
      transform: { '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/packages/api/tsconfig.json' }] },
      moduleNameMapper: {
        '^@midas/shared$': '<rootDir>/packages/shared/src/index.ts',
      },
      setupFilesAfterFramework: ['<rootDir>/packages/api/src/__tests__/setup.ts'],
    },
    {
      displayName: 'shared',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/packages/shared/src/**/*.test.ts'],
      transform: { '^.+\\.tsx?$': ['ts-jest', {}] },
    },
  ],
  collectCoverage: false,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'],
}

export default config
