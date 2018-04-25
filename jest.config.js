

module.exports = {
  moduleFileExtensions: [
    'js',
    'node',
  ],
  // setupFiles: [
  //   '<rootDir>/test/unit/setup',
  // ],
  collectCoverage: true,
  // snapshotSerializers: [
  // ],
  coverageDirectory: '<rootDir>/test/unit/coverage',
  collectCoverageFrom: [
    'lib/**/*.{js}',
    '!**/node_modules/**',
    '!**/*+(spec|test).?(f|functional).js',
  ],
  coverageReporters: ['json', 'lcov', 'text-summary'],
  // transform: {
  // },
}
