import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import {
  clearHostActivities,
  getActivityList,
  getActivityView,
  markActivityListLoading,
  markActivityOpening,
  setHostActivities,
  setHostActivityClosed,
  setHostActivityOpenFailed,
  setHostActivityOpened,
} from './hostActivities.ts'

beforeEach(clearHostActivities)

describe('the conversation about one activity', () => {
  it('is seen only after it was asked for, shown and then closed', () => {
    assert.equal(getActivityView(41).status, 'idle')
    markActivityOpening(41)
    assert.equal(getActivityView(41).status, 'opening')
    setHostActivityOpened(41)
    assert.equal(getActivityView(41).status, 'open')
    setHostActivityClosed(41)
    assert.equal(getActivityView(41).status, 'seen')
  })
  it('a closed message out of the blue completes nothing', () => {
    setHostActivityClosed(41)
    assert.equal(getActivityView(41).status, 'idle')
    markActivityOpening(41)
    setHostActivityClosed(41)
    assert.equal(getActivityView(41).status, 'opening', 'closed before opened is not a view')
  })
  it('an answer about another activity changes nothing here', () => {
    markActivityOpening(41)
    setHostActivityOpened(42)
    setHostActivityOpenFailed(42, 'forbidden')
    assert.equal(getActivityView(41).status, 'opening')
    assert.equal(getActivityView(42).status, 'idle')
  })
  it('an unasked opened shows nothing', () => {
    setHostActivityOpened(41)
    assert.equal(getActivityView(41).status, 'idle')
  })
  it('a failure keeps its reason, and asking again starts over', () => {
    markActivityOpening(41)
    setHostActivityOpenFailed(41, 'forbidden')
    assert.deepEqual(getActivityView(41), { status: 'failed', reason: 'forbidden' })
    markActivityOpening(41)
    assert.equal(getActivityView(41).status, 'opening')
  })
  it('the end of the session forgets what was seen', () => {
    markActivityOpening(41)
    setHostActivityOpened(41)
    setHostActivityClosed(41)
    clearHostActivities()
    assert.equal(getActivityView(41).status, 'idle')
  })
})

describe('the list of activities', () => {
  it('goes from idle to loading to ready or error', () => {
    assert.equal(getActivityList().status, 'idle')
    markActivityListLoading()
    assert.equal(getActivityList().status, 'loading')
    setHostActivities({ type: 'rumbos:host-activities', v: 1, items: [] })
    assert.equal(getActivityList().status, 'ready')
    setHostActivities({ type: 'rumbos:host-activities', v: 1, error: 'capability' })
    assert.deepEqual(getActivityList(), { status: 'error', error: 'capability' })
  })
})
