/* global describe, it */

const parser = require('../')
const chai = require('chai')
const expect = chai.expect

const tests = require('./tests.json')

describe('city-directory-entry-parser', () => {
  tests
    .forEach((test) => {
      it(`"${test.input}"`, () => {
        const parsed = parser(test.input)
        expect(parsed).to.deep.equal(test.output)
      })
    })
})
