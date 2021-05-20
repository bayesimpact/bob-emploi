import {expect} from 'chai'
import React from 'react'
import {LocalizableString} from 'store/i18n'

import {LocalizedSelectOption} from 'components/select'

// TODO(pascal): Generate this file.

import companyCreationToolsFr from '../../src/deployments/fr/company_creation_tools'
import companyCreationToolsUk from '../../src/deployments/uk/company_creation_tools'
import companyCreationToolsUsa from '../../src/deployments/usa/company_creation_tools'

import pressFr from '../../src/deployments/fr/press'
import pressUk from '../../src/deployments/uk/press'
import pressUsa from '../../src/deployments/usa/press'

import * as profileOptionsFr from '../../src/deployments/fr/profile_options'
import * as profileOptionsUk from '../../src/deployments/uk/profile_options'
import * as profileOptionsUsa from '../../src/deployments/usa/profile_options'

import reorientationToolsFr from '../../src/deployments/fr/reorientation_tools'
import reorientationToolsUk from '../../src/deployments/uk/reorientation_tools'
import reorientationToolsUsa from '../../src/deployments/usa/reorientation_tools'

import * as userExamplesFr from '../../src/deployments/fr/user_examples'
import * as userExamplesUk from '../../src/deployments/uk/user_examples'
import * as userExamplesUsa from '../../src/deployments/usa/user_examples'

function checkType<T>(unusedA: T): boolean {
  return true
}

interface SelectOption<T = string> extends LocalizedSelectOption<T> {
  readonly equivalent?: LocalizableString
}

interface Tool {
  description: string
  from: React.ReactNode
  logo: string
  name: string
  url: string
}

interface Modules {
  companyCreationTools: readonly {
    description: string
    from: string
    logo: string
    name: string
    url: string
  }[]
  press: readonly {
    imageAltText: string
    imageSrc: string
    title: string
    url: string
  }[]
  profileOptions: {DEGREE_OPTIONS: readonly SelectOption<bayes.bob.DegreeLevel>[]}
  reorientationTools: (hasHandicap?: boolean, departementId?: string) => readonly Tool[]
  userExamples: {
    sampleCities: readonly bayes.bob.FrenchCity[]
    sampleJobs: readonly {
      codeOgr: string
      feminineName?: LocalizableString
      jobGroup: {
        name: LocalizableString
        romeId: string
      }
      masculineName?: LocalizableString
      name: LocalizableString
    }[]
  }
}

checkType<Modules['companyCreationTools']>(companyCreationToolsFr)
checkType<Modules['companyCreationTools']>(companyCreationToolsUk)
checkType<Modules['companyCreationTools']>(companyCreationToolsUsa)

checkType<Modules['press']>(pressFr)
checkType<Modules['press']>(pressUk)
checkType<Modules['press']>(pressUsa)

checkType<Modules['profileOptions']>(profileOptionsFr)
checkType<Modules['profileOptions']>(profileOptionsUk)
checkType<Modules['profileOptions']>(profileOptionsUsa)

checkType<Modules['reorientationTools']>(reorientationToolsFr)
checkType<Modules['reorientationTools']>(reorientationToolsUk)
checkType<Modules['reorientationTools']>(reorientationToolsUsa)

checkType<Modules['userExamples']>(userExamplesFr)
checkType<Modules['userExamples']>(userExamplesUk)
checkType<Modules['userExamples']>(userExamplesUsa)

const testedDeployments = ['fr', 'uk', 'usa']
const testedModuleNames = [
  'company_creation_tools',
  'press',
  'profile_options',
  'reorientation_tools',
  'user_examples',
]

describe('All deployment TypeScript files', () => {
  it('are tested for types', () => {
    const tsContext = require.context('../../src/deployments', true, /.*\.tsx?$/)
    const allTestedModules = testedDeployments.
      map(deployment => testedModuleNames.map(name => `./${deployment}/${name}.ts`)).
      reduce((a: readonly string[], b: readonly string[]): readonly string[] => [...a, ...b], [])
    expect(tsContext.keys().map(name => name.replace(/\.tsx$/, '.ts'))).to.eql(allTestedModules)
  })
})
