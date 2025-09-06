/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/pages', '<rootDir>/tests'],
  testMatch: [
    '**/__tests__/**/*.+(ts|tsx|js)',
    '**/?(*.)+(spec|test).+(ts|tsx|js)'
  ],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: {
        jsx: 'react',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
      },
    }]
  },
  // Handle ESM modules properly for pnpm
  transformIgnorePatterns: [
    // Transform nanoid and any other ESM packages
    'node_modules/(?!(nanoid|@supabase|@anthropic-ai|groq-sdk)/)',
    '\\.pnpm/(?!(nanoid.*|@supabase.*|@anthropic-ai.*|groq-sdk.*)/)'
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@api/(.*)$': '<rootDir>/pages/api/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1',
    // Mock nanoid for testing to avoid ESM issues
    '^nanoid$': '<rootDir>/tests/mocks/nanoid.mock.js',
    // Mock CSS modules and static assets if needed
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    'pages/api/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/types/**',
    '!pages/api/**/*.d.ts',
    '!**/node_modules/**',
    '!**/.next/**',
  ],
  // Fixed typo: coverageThresholds -> coverageThreshold
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 75,
      lines: 80,
      statements: 80,
    },
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  testTimeout: 30000,
  verbose: true,
  clearMocks: true,
  restoreMocks: true,
  // Additional settings for pnpm compatibility
  testPathIgnorePatterns: [
    '/node_modules/',
    '/.pnpm/',
    '/.next/',
    '/dist/',
    '/.turbo/',
  ],
  // Ensure proper module resolution with pnpm
  modulePaths: ['<rootDir>'],
  // Resolver for pnpm
  moduleDirectories: ['node_modules', '<rootDir>'],
};