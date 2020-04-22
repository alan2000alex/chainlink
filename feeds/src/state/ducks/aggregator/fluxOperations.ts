import { FeedConfig } from 'config'
import { ethers } from 'ethers'
import _ from 'lodash'
import FluxAggregatorAbi from '../../../contracts/FluxAggregatorAbi.json'
import FluxAggregatorContract from '../../../contracts/FluxAggregatorContract'
import * as actions from './actions'
import { AppState } from 'state'
import { Actions } from 'state/actions'
import { ThunkAction } from 'redux-thunk'

export default class FluxOperations {
  static contractInstance: any

  static fetchOracleList() {
    return async (dispatch: any, getState: any) => {
      if (getState().aggregator.oracleList) {
        return
      }
      try {
        const payload = await FluxOperations.contractInstance.oracles()
        dispatch(actions.setOracleList(payload))
      } catch {
        console.error('Could not fetch oracle list ')
      }
    }
  }

  static fetchLatestCompletedAnswerId(): ThunkAction<
    void,
    AppState,
    void,
    Actions
  > {
    return async (dispatch: any) => {
      try {
        const payload = await FluxOperations.contractInstance.latestRound()
        dispatch(actions.setLatestCompletedAnswerId(payload))
        return payload
      } catch {
        console.error('Could not fetch latest completed answer id')
      }
    }
  }

  static fetchLatestAnswer(): ThunkAction<void, AppState, void, Actions> {
    return async (dispatch: any) => {
      try {
        const payload = await FluxOperations.contractInstance.latestAnswer()
        dispatch(actions.setLatestAnswer(payload))
      } catch {
        console.error('Could not fetch latest answer')
      }
    }
  }

  static fetchLatestAnswerTimestamp(): ThunkAction<
    void,
    AppState,
    void,
    Actions
  > {
    return async (dispatch: any) => {
      try {
        const payload = await FluxOperations.contractInstance.latestTimestamp()
        dispatch(actions.setLatestAnswerTimestamp(payload))
        return payload
      } catch {
        console.error('Could not fetch latest answer timestamp')
      }
    }
  }

  static fetchOracleAnswersById(
    request: any,
  ): ThunkAction<void, AppState, void, Actions> {
    return async (dispatch: any, getState: any) => {
      try {
        const currentLogs = getState().aggregator.oracleAnswers
        const logs = await FluxOperations.contractInstance.submissionReceivedLogs(
          request,
        )
        const withTimestamp = await FluxOperations.contractInstance.addBlockTimestampToLogs(
          logs,
        )
        const withGasAndTimeStamp = await FluxOperations.contractInstance.addGasPriceToLogs(
          withTimestamp,
        )

        const uniquePayload = _.uniqBy(
          [...withGasAndTimeStamp, ...currentLogs],
          l => l.sender,
        )

        dispatch(actions.setOracleAnswers(uniquePayload))
      } catch {
        console.error('Could not fetch oracle answers')
      }
    }
  }

  static fetchLatestRequestTimestamp = (
    request: any,
  ): ThunkAction<void, AppState, void, Actions> => {
    return async (dispatch: any) => {
      try {
        const logs = await FluxOperations.contractInstance.newRoundLogs(request)
        const startedAt = logs?.[logs.length - 1].startedAt
        dispatch(actions.setLatestRequestTimestamp(startedAt))
      } catch {
        console.error('Could not fetch request time')
      }
    }
  }

  static fetchMinimumAnswers(): ThunkAction<void, AppState, void, Actions> {
    return async (dispatch: any) => {
      try {
        const payload = await FluxOperations.contractInstance.minimumAnswers()
        dispatch(actions.setMinumumAnswers(payload))
      } catch {
        console.error('Could not fetch minimum answers')
      }
    }
  }

  static fetchAnswerHistory(
    fromBlock: number,
  ): ThunkAction<void, AppState, void, Actions> {
    return async (dispatch: any) => {
      try {
        const payload = await FluxOperations.contractInstance.answerUpdatedLogs(
          {
            fromBlock,
          },
        )
        const uniquePayload = _.uniqBy(payload, (e: any) => {
          return e.answerId
        })

        dispatch(actions.setAnswerHistory(uniquePayload))
      } catch {
        console.error('Could not fetch answer history')
      }
    }
  }

  static initListeners() {
    return async (dispatch: any, getState: any) => {
      FluxOperations.contractInstance.listenSubmissionReceivedEvent(
        async (responseLog: any) => {
          const { minimumAnswers } = getState().aggregator
          const oracleAnswers = getState().aggregator.oracleAnswers || []
          const updatedAnswers = oracleAnswers.map((response: any) => {
            return response.sender === responseLog.sender
              ? responseLog
              : response
          })

          dispatch(actions.setOracleAnswers(updatedAnswers))

          const latestIdAnswers = _.filter(updatedAnswers, {
            answerId: responseLog.answerId,
          })

          if (latestIdAnswers.length >= minimumAnswers) {
            FluxOperations.fetchLatestAnswer()(dispatch, getState)
            FluxOperations.fetchLatestAnswerTimestamp()(dispatch, getState)
          }
        },
      )

      FluxOperations.contractInstance.listenNewRoundEvent(
        async (responseLog: any) => {
          await FluxOperations.fetchLatestCompletedAnswerId()(
            dispatch,
            getState,
          )
          dispatch(actions.setPendingAnswerId(responseLog.answerId))
          dispatch(actions.setLatestRequestTimestamp(responseLog.startedAt))
        },
      )
    }
  }

  /**
   * Initialise aggregator contract and fill the store with all necessery data for a visualisation page.
   * @param config FeedsConfig
   */

  static initContract(config: FeedConfig) {
    return async (dispatch: any, getState: any) => {
      dispatch(actions.clearState())

      try {
        FluxOperations.contractInstance?.kill()
      } catch {
        console.error('Could not close the contract instance')
      }

      try {
        ethers.utils.getAddress(config.contractAddress)
      } catch (error) {
        throw new Error('Wrong contract address')
      }

      dispatch(actions.setConfig(config))
      dispatch(actions.setContractAddress(config.contractAddress))

      FluxOperations.contractInstance = new FluxAggregatorContract(
        config,
        FluxAggregatorAbi,
      )

      // Oracle addresses
      await FluxOperations.fetchOracleList()(dispatch, getState)

      // Minimum oracle responses
      FluxOperations.fetchMinimumAnswers()(dispatch, getState)

      // Set answer Id
      const reportingAnswerId = await FluxOperations.contractInstance.reportingRound()
      dispatch(actions.setPendingAnswerId(reportingAnswerId))

      // Current answers
      await FluxOperations.fetchLatestAnswerTimestamp()(dispatch, getState)

      // Fetch previous answers
      const currentBlockNumber = await FluxOperations.contractInstance.provider.getBlockNumber()
      const latestAnswerId = await FluxOperations.contractInstance.latestRound()
      const fromBlock =
        currentBlockNumber <= 6700 ? 0 : currentBlockNumber - 6700 // ~6700 blocks per day

      await FluxOperations.fetchOracleAnswersById({
        round: latestAnswerId,
        fromBlock,
      })(dispatch, getState)

      // Fetch latest answers
      await FluxOperations.fetchOracleAnswersById({
        round: reportingAnswerId,
        fromBlock,
      })(dispatch, getState)

      /**
       * Oracle Latest Request Time
       * Used to calculate hearbeat countdown timer
       */
      if (config.heartbeat) {
        FluxOperations.fetchLatestRequestTimestamp({
          round: reportingAnswerId,
          fromBlock,
        })(dispatch, getState)
      }

      // Current answer
      FluxOperations.fetchLatestAnswer()(dispatch, getState)

      // initalise listeners
      FluxOperations.initListeners()(dispatch, getState)

      if (config.history) {
        FluxOperations.fetchAnswerHistory(fromBlock)(dispatch, getState)
      }
    }
  }

  static clearState() {
    return async (dispatch: any) => {
      try {
        FluxOperations.contractInstance.kill()
      } catch {
        console.error('Could not clear the contract')
      }

      dispatch(actions.clearState())
    }
  }
}
