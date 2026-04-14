export default {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/__tests__/**/*.test.ts"],
  collectCoverageFrom: [
    "src/domain/**/*.ts",
    "src/crypto/**/*.ts",
    "src/services/**/*.ts",
    "!src/**/__tests__/**",
  ],
  coverageThreshold: {
    global: {
      lines: 70,
    },
  },
};
