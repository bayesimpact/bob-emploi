import React from 'react'
import {Provider} from 'react-redux'
import ShallowRenderer from 'react-test-renderer/shallow'
import configureStore from 'redux-mock-store'

import {ADVICE_MODULES} from 'components/advisor'


function noOp<T>(action: T): T {
  return action
}


const raiseOnExplore = (): void => {
  throw 'onExplore was called during first render'
}
const noExplore = (): (() => void) => raiseOnExplore
const noOpTranslate = (text: string): string => text


describe('Advice module', (): void => {
  for (const [adviceId, advice] of Object.entries(ADVICE_MODULES)) {
    describe(`"${adviceId}"`, (): void => {
      const {ExpandedAdviceCardContent} = advice
      const mockStore = configureStore([])

      it('has an expanded card that renders properly on mobile', (): void => {
        const store = mockStore({
          app: {
            adviceData: {},
            specificJobs: {},
          },
          user: {},
        })
        ShallowRenderer.createRenderer().render(<Provider store={store}>
          <ExpandedAdviceCardContent
            advice={{adviceId}}
            dispatch={noOp}
            handleExplore={noExplore}
            profile={{}}
            project={{projectId: '0'}}
            t={noOpTranslate} />
        </Provider>)
      })
    })
  }
})
