// @ts-ignore
'use strict'
require('@babel/polyfill')

// Add support for all files in the test directory.
const testsContext = require.context('.', true, /_(test|helper)\.[jt]sx?$/)
testsContext.keys().forEach(testsContext)
