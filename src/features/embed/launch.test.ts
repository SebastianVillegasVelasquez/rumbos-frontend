import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parseHostOrigin } from './hostOrigin.ts'
import { hostOriginMatches, parseLaunchResult } from './launch.ts'

const launch = {
  accessToken: 'tok',
  tokenType: 'Bearer',
  expiresIn: 900,
  role: 'student',
  courseId: 7,
  hostOrigin: 'https://moodle.example',
}

describe('parseLaunchResult', () => {
  it('accepts a well-formed answer', () => {
    assert.deepEqual(parseLaunchResult(launch), launch)
  })

  it('accepts a numeric-string course id', () => {
    assert.equal(parseLaunchResult({ ...launch, courseId: '7' })?.courseId, 7)
  })

  it('rejects anything malformed', () => {
    assert.equal(parseLaunchResult({ ...launch, accessToken: '' }), null)
    assert.equal(parseLaunchResult({ ...launch, tokenType: 'Basic' }), null)
    assert.equal(parseLaunchResult({ ...launch, role: 'admin' }), null)
    assert.equal(parseLaunchResult({ ...launch, expiresIn: -1 }), null)
    assert.equal(parseLaunchResult({ ...launch, courseId: 0 }), null)
    assert.equal(parseLaunchResult({ ...launch, hostOrigin: undefined }), null)
    assert.equal(parseLaunchResult('token'), null)
  })
})

describe('parseHostOrigin', () => {
  it('accepts an exact https origin', () => {
    assert.equal(parseHostOrigin('https://moodle.example'), 'https://moodle.example')
    assert.equal(parseHostOrigin('https://moodle.example:8443'), 'https://moodle.example:8443')
  })

  it('rejects anything that is more than the origin', () => {
    assert.equal(parseHostOrigin('https://moodle.example/'), null)
    assert.equal(parseHostOrigin('https://moodle.example/some/path'), null)
    assert.equal(parseHostOrigin('https://moodle.example?x=1'), null)
    assert.equal(parseHostOrigin('https://moodle.example#frag'), null)
    assert.equal(parseHostOrigin('https://user:pw@moodle.example'), null)
  })

  it('rejects missing, malformed and non-http schemes', () => {
    assert.equal(parseHostOrigin(null), null)
    assert.equal(parseHostOrigin(''), null)
    assert.equal(parseHostOrigin('javascript:alert(1)'), null)
    assert.equal(parseHostOrigin('data:text/html,x'), null)
    assert.equal(parseHostOrigin('not a url'), null)
  })

  it('rejects http unless it is localhost in a development build', () => {
    assert.equal(parseHostOrigin('http://moodle.example'), null)
    assert.equal(parseHostOrigin('http://moodle.example', true), null)
    assert.equal(parseHostOrigin('http://localhost:5173'), null)
    assert.equal(parseHostOrigin('http://localhost:5173', true), 'http://localhost:5173')
    assert.equal(parseHostOrigin('http://127.0.0.1:5173', true), 'http://127.0.0.1:5173')
    assert.equal(parseHostOrigin('http://localhost.evil.example', true), null)
  })
})

describe('hostOriginMatches', () => {
  it('compares origins, not strings', () => {
    assert.ok(hostOriginMatches('https://moodle.example/', 'https://moodle.example'))
    assert.ok(!hostOriginMatches('https://evil.example', 'https://moodle.example'))
    assert.ok(!hostOriginMatches('http://moodle.example', 'https://moodle.example'))
    assert.ok(!hostOriginMatches('nonsense', 'https://moodle.example'))
  })
})
