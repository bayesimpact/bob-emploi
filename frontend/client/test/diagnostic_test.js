import {expect} from 'chai'
import React from 'react'
import TestRenderer from 'react-test-renderer'

import {Markdown} from 'components/theme'
import {DiagnosticText} from 'components/pages/connected/project/diagnostic'


describe('DiagnosticText', () => {
  it('should render the default text properly with vous', () => {
    const instance = TestRenderer.create(<DiagnosticText userYou={(tu, vous) => vous} />).root
    expect(instance.findByType(Markdown).props.content).to.include('de vous proposer')
  })

  it('should render the default text properly with tu', () => {
    const instance = TestRenderer.create(<DiagnosticText userYou={tu => tu} />).root
    expect(instance.findByType(Markdown).props.content).to.include('de te proposer')
  })
})
