import { FluxAggregatorVis } from 'components/aggregatorVis'
import { AnswerHistory } from 'components/answerHistory'
import { DeviationHistory } from 'components/deviationHistory'
import { Header } from 'components/header'
import { OracleTable } from 'components/oracleTable'
import { FeedConfig } from 'config'
import React, { useEffect } from 'react'
import { connect, MapDispatchToProps } from 'react-redux'
import { fluxAggregatorOperations } from 'state/ducks/aggregator'
import { DispatchBinding } from '@chainlink/ts-helpers'

interface OwnProps {
  config: FeedConfig
}

interface DispatchProps {
  initContract: DispatchBinding<typeof fluxAggregatorOperations.initContract>
  clearState: DispatchBinding<typeof fluxAggregatorOperations.clearState>
}

interface Props extends OwnProps, DispatchProps {}

const Page: React.FC<Props> = ({ initContract, clearState, config }) => {
  useEffect(() => {
    async function init() {
      try {
        await initContract(config)
      } catch (error) {
        console.error('Could not initiate contract:', error)
      }
    }
    init()

    return clearState
  }, [initContract, clearState, config])

  return (
    <>
      <div className="page-container-full-width">
        <Header />
      </div>
      <div className="page-wrapper network-page">
        <FluxAggregatorVis config={config} />
        {config.history && <AnswerHistory config={config} />}
        {config.history && <DeviationHistory config={config} />}
        <OracleTable />
      </div>
    </>
  )
}

const mapDispatchToProps: MapDispatchToProps<DispatchProps, OwnProps> = {
  initContract: fluxAggregatorOperations.initContract,
  clearState: fluxAggregatorOperations.clearState,
}

export default connect(null, mapDispatchToProps)(Page)
