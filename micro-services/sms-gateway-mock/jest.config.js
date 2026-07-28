/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testPathIgnorePatterns: ['dist/', 'src/'],
  coverageReporters: ['json-summary', 'lcov'],
  collectCoverageFrom: ['<rootDir>/src/**/*.ts'],
  setupFiles: ['<rootDir>/test/setup.ts'],
  moduleNameMapper: {
    '^../../../src/store/messageStore$': '<rootDir>/src/store/messageStore.ts',
    '^../../../src/routes/sendSmsHelpers$':
      '<rootDir>/src/routes/sendSmsHelpers.ts',
    '^../../../src/utils/redaction$': '<rootDir>/src/utils/redaction.ts',
    '^../../../src/middleware/cors$': '<rootDir>/src/middleware/cors.ts',
    '^../../../src/api$': '<rootDir>/src/api.ts'
  },
  transform: {
    '^.+\\.(t|j)s$': [
      'ts-jest',
      {
        isolatedModules: true
      }
    ]
  }
};
