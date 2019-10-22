import {expect} from 'chai'
import React from 'react'
import TestRenderer from 'react-test-renderer'

import {tutoyer, vouvoyer} from 'store/french'

import {Markdown} from 'components/theme'
import {DiagnosticText} from 'components/pages/connected/project/diagnostic'


describe('DiagnosticText', (): void => {
  it('should render the default text properly with vous', (): void => {
    const instance = TestRenderer.create(<DiagnosticText
      userYou={vouvoyer} diagnosticSentences="" />).root
    expect(instance.findByType(Markdown).props.content).to.include('de vous proposer')
  })

  it('should render the default text properly with tu', (): void => {
    const instance = TestRenderer.create(<DiagnosticText
      userYou={tutoyer} diagnosticSentences="" />).root
    expect(instance.findByType(Markdown).props.content).to.include('de te proposer')
  })
})
