import { getRepository } from 'typeorm'
import fixture from '../fixtures/JobRun.fixture.json'
import { createChainlinkNode } from '../../entity/ChainlinkNode'
import { JobRun, fromString } from '../../entity/JobRun'
import { search, count } from '../../queries/search'

describe('search and count', () => {
  beforeEach(async () => {
    const [chainlinkNode] = await createChainlinkNode(
      'job-run-search-chainlink-node',
    )

    const jrA = fromString(JSON.stringify(fixture))
    jrA.chainlinkNodeId = chainlinkNode.id
    jrA.createdAt = new Date('2019-04-08T01:00:00.000Z')
    await getRepository(JobRun).save(jrA)

    const fixtureB = Object.assign({}, fixture, {
      jobId: 'jobB',
      runId: 'runB',
    })
    const jrB = fromString(JSON.stringify(fixtureB))
    jrB.chainlinkNodeId = chainlinkNode.id
    jrB.createdAt = new Date('2019-04-09T01:00:00.000Z')
    jrB.txHash = 'fixtureBTxHash'
    jrB.requester = 'fixtureBRequester'
    jrB.requestId = 'fixtureBRequestID'
    await getRepository(JobRun).save(jrB)

    const fixtureC = Object.assign({}, fixture, {
      jobId: 'jobB',
      runId: 'runC',
    })
    const jrC = fromString(JSON.stringify(fixtureC))
    jrC.chainlinkNodeId = chainlinkNode.id
    jrC.createdAt = new Date('2019-05-09T01:00:00.000Z')
    jrC.txHash = 'fixtureCTxHash'
    jrC.requester = 'fixtureCRequester'
    jrC.requestId = 'fixtureCRequestID'
    await getRepository(JobRun).save(jrC)

    const fixtureD = Object.assign({}, fixture, {
      jobId: 'jobD',
      runId: 'runD',
    })
    const jrD = fromString(JSON.stringify(fixtureD))
    jrD.chainlinkNodeId = chainlinkNode.id
    jrD.createdAt = new Date('2019-05-09T01:00:00.000Z')
    jrD.txHash =
      '0x0458b93fc1cc51807089ae2794ea80ce26abee69a4541bdf1181305290514839'
    jrD.requester = '0x56F83bE0b26B1B4B641a2ecAd74b037e131989E2'
    jrD.requestId =
      '0xc4cb943023a30d9102406799150bae23665517ab4b230d41b54490baa3aad42c'
    await getRepository(JobRun).save(jrD)
  })

  it('returns no results when no query is supplied', async () => {
    let results
    results = await search({ searchQuery: undefined })
    expect(results).toHaveLength(0)
    results = await search({ searchQuery: null })
    expect(results).toHaveLength(0)
  })

  it('returns results in descending order by createdAt', async () => {
    const results = await search({ searchQuery: 'jobB' })
    expect(results.length).toEqual(2)
    expect(results[0].runId).toEqual('runC')
    expect(results[1].runId).toEqual('runB')
  })

  it('can set a limit', async () => {
    const results = await search({ searchQuery: 'jobB', limit: 1 })
    expect(results).toHaveLength(1)
    expect(results[0].runId).toEqual('runC')
  })

  it('can set a page with a 1 based index', async () => {
    let results

    results = await search({
      limit: 1,
      page: 1,
      searchQuery: 'jobB',
    })
    expect(results[0].runId).toEqual('runC')

    results = await search({
      limit: 1,
      page: 2,
      searchQuery: 'jobB',
    })
    expect(results[0].runId).toEqual('runB')
  })

  it('returns no results for blank search', async () => {
    const results = await search({ searchQuery: '' })
    expect(results).toHaveLength(0)
  })

  it('returns one result for an exact match on jobId', async () => {
    const results = await search({
      searchQuery: 'f1xtureAaaaaaaaaaaaaaaaaaaaaaaaa',
    })
    expect(results).toHaveLength(1)
  })

  it('returns one result for an exact match on jobId and runId', async () => {
    const results = await search({
      searchQuery: `${'f1xtureAaaaaaaaaaaaaaaaaaaaaaaaa'} aeb2861d306645b1ba012079aeb2e53a`,
    })
    expect(results).toHaveLength(1)
  })

  it('returns two results when two matching runIds are supplied', async () => {
    const results = await search({ searchQuery: 'runB runC' })
    expect(results).toHaveLength(2)
  })

  it('returns one result for an exact match on requester', async () => {
    const requester = 'fixtureBRequester'
    const results = await search({ searchQuery: requester })
    expect(results).toHaveLength(1)
  })

  it('returns one result for a case insensitive match on requester', async () => {
    const requester = 'FIXTUREBREQUESTER'
    const results = await search({ searchQuery: requester })
    expect(results).toHaveLength(1)
  })

  it('returns one result for an exact match on requestId', async () => {
    const requestId = 'fixtureBRequestID'
    const results = await search({ searchQuery: requestId })
    expect(results).toHaveLength(1)
  })

  it('returns one result for an exact match on txHash', async () => {
    const txHash = 'fixtureBTxHash'
    const results = await search({ searchQuery: txHash })
    expect(results).toHaveLength(1)
  })

  it('finds matches for search tokens with or without 0x prefixes', async () => {
    const txHash =
      '0458b93fc1cc51807089ae2794ea80ce26abee69a4541bdf1181305290514839'
    const requester = '56F83bE0b26B1B4B641a2ecAd74b037e131989E2'
    const requestId =
      'c4cb943023a30d9102406799150bae23665517ab4b230d41b54490baa3aad42c'
    const resultsTxHash = await search({ searchQuery: txHash })
    const resultsRequester = await search({ searchQuery: requester })
    const resultsRequestId = await search({ searchQuery: requestId })
    expect(resultsTxHash).toHaveLength(1)
    expect(resultsRequester).toHaveLength(1)
    expect(resultsRequestId).toHaveLength(1)
    const resultsPrefixedTxHash = await search({
      searchQuery: '0x' + txHash,
    })
    const resultsPrefixedRequester = await search({
      searchQuery: '0x' + requester,
    })
    const resultsPrefixedRequestId = await search({
      searchQuery: '0x' + requestId,
    })
    expect(resultsPrefixedTxHash).toHaveLength(1)
    expect(resultsPrefixedRequester).toHaveLength(1)
    expect(resultsPrefixedRequestId).toHaveLength(1)
  })

  it('returns the number of results matching the search query', async () => {
    const countResult = await count({ searchQuery: 'runB runC' })
    expect(countResult).toEqual(2)
  })
})
