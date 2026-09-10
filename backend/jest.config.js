module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  moduleDirectories: ['node_modules', '<rootDir>'],
  collectCoverageFrom: ['src/**/*.ts', 'services/**/*.ts', 'utils/**/*.ts', '!src/index.ts'],
  coverageDirectory: 'coverage',
};
