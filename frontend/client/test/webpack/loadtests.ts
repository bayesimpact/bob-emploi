// @ts-ignore
'use strict'

// Add support for all files in the test directory.
const testsContext = require.context('.', true, /_(test|helper)\.[jt]sx?$/)
for (const testContext of testsContext.keys()) {
  testsContext(testContext)
}
