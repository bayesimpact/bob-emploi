import Airtable from 'airtable'
import {expect} from 'chai'
import fs from 'fs'
import _sortBy from 'lodash/sortBy'
import sinon from 'sinon'
import download from '../../node/download'

const sandbox = sinon.createSandbox()

/* eslint-disable camelcase */

// TODO(pascal): Move to its own package.
interface TableSelector {
  readonly view?: string
}


function getRandomHash(): string {
  return (Math.random() * 36).toString(36)
}


class AirtableError {
  error: string

  message: string

  statusCode: number

  constructor(error: string, message: string, statusCode: number) {
    this.error = error
    this.message = message
    this.statusCode = statusCode
  }
}


class AirtableMockTable<T> {
  readonly base: AirtableMockBase<T>

  readonly data: readonly {fields: T; id: string}[]

  readonly tableId: string

  readonly selector?: TableSelector

  constructor(base: AirtableMockBase<T>, tableId: string, selector?: TableSelector) {
    if (!base.data[tableId]) {
      throw new AirtableError(
        'NOT_FOUND',
        `Could not find table ${tableId} in application ${base.appId}`,
        404)
    }
    this.base = base
    this.data = base.data[tableId].map(
      ({fields, id}: {fields: T; id?: string}) => ({fields, id: id || getRandomHash()}))
    this.tableId = tableId
    this.selector = selector
  }

  select(selector: TableSelector): AirtableMockTable<T> {
    return new AirtableMockTable<T>(this.base, this.tableId, selector)
  }

  all(): Promise<readonly {fields: T; id: string}[]> {
    return Promise.resolve(this.data)
  }
}


class AirtableMockBase<T> {
  appId: string

  data: {[tableId: string]: readonly {fields: T; id?: string}[]}

  constructor(data: {[tableId: string]: readonly {fields: T; id?: string}[]}, appId: string) {
    this.data = data
    this.appId = appId
  }
}


function airtableMock<T>(
  data: {[appId: string]: {[tableId: string]: readonly {fields: T; id?: string}[]}}) {
  return (appId: string) => {
    if (!data[appId]) {
      throw new Error(`No Airtable data for app "${appId}"`)
    }
    const base = new AirtableMockBase(data[appId], appId)
    return (tableName: string): AirtableMockTable<T> => new AirtableMockTable<T>(base, tableName)
  }
}


describe('download.ts', () => {
  const filesWritten = new Map()
  beforeEach(() => {
    Airtable.apiKey = 'test-api-key'
    sandbox.stub(fs, 'writeFile').callsFake((filename, content) => {
      filesWritten.set(filename, content)
      return Promise.resolve()
    })
  })

  afterEach(() => {
    filesWritten.clear()
    sandbox.restore()
  })

  it('should run properly', async () => {
    // TODO(pascal): Add more data expectations.
    // @ts-ignore (We know we are doing some bad stuff here, but it's the easiest way to test)
    sandbox.stub(Airtable.prototype, 'base').callsFake(airtableMock({
      // ROME base.
      appMRMtWV61Kibt37: {
        VAE_Stats: [
          {
            fields: {
              name: "Éducateur spécialisé (diplôme d'État)",
              rome_ids: ['K1207'],
              vae_ratio_in_diploma: 43,
            },
            id: 'receducspe002',
          },
        ],
      },
      // Advice base.
      appXmyc7yYj0pOcae: {
        advice_modules: [
          {fields: {
            advice_id: 'some-advice',
            goal: 'atteindre la lune',
            short_title: 'lune',
            theme_id: ['rec12345'],
            title: 'Luner comme un lunatique',
            user_gain_callout: '2x',
            user_gain_details: 'plus de travail',
          }},
        ],
        convince_illustrations: [
          {fields: {
            highlight: 'Top 20%',
            id: 'top-20',
            main_challenges: ['stuck-market', 'bravo'],
            text: 'You are **the best**',
          }},
          {fields: {
            highlight: '+25%',
            id: '25-more',
            main_challenges: ['bravo'],
            text: 'You even rock more than you think',
          }},
        ],
        diagnostic_main_challenges: [
          {fields: {category_id: 'bravo'}},
          {fields: {
            category_id: 'stuck-market',
            metric_details: "Le marché c'est important.",
            metric_title: 'Marché',
          }},
        ],
        email_templates: [],
        impact_measurement: [
          {fields:
              {
                action_id: 'explore-jobs',
                name: 'Explorer des métiers qui me correspondent',
              },
          },
        ],
        resource_themes: [
          {
            fields: {
              name: 'Choisir un métier',
              order: 3,
              theme_id: 'choose-a-job',
            },
          },
        ],
        strategy_goals: [
          {fields:
              {
                content: "Je connais des villes offrant plus d'opportunités",
                goal_id: 'better-cities',
                strategy_ids: ['other-leads', 'get-moving'],
              },
          },
        ],
      },
    }))
    await download([])
    // TODO(cyrille): Fallback to Map deep-equality once
    // https://github.com/chaijs/chai/issues/1228 is resolved.
    expect(_sortBy([...filesWritten], 0)).to.deep.eq(_sortBy(Object.entries({
      'src/components/advisor/data/advice_modules.json': `{
  "some-advice": {
    "goal": "some-advice:goal",
    "resourceTheme": "rec12345",
    "shortTitle": "some-advice:short_title",
    "title": "some-advice:title",
    "titleXStars": {
    },
    "userGainCallout": "2x",
    "userGainDetails": "some-advice:user_gain_details"
  }
}
`,
      'src/components/advisor/data/diagnosticIllustrations.json': `{
  "bravo": [
    {
      "highlight": "top-20:highlight",
      "text": "top-20:text"
    },
    {
      "highlight": "25-more:highlight",
      "text": "25-more:text"
    }
  ],
  "stuck-market": [
    {
      "highlight": "top-20:highlight",
      "text": "top-20:text"
    }
  ]
}
`,
      'src/components/advisor/data/email_templates.json': '{\n}\n',
      'src/components/advisor/data/resource_themes.json': `[
  {
    "name": "choose-a-job:name",
    "themeId": "choose-a-job"
  }
]
`,
      'src/components/advisor/data/vae.json': `[
  {
    "name": "receducspe002:name",
    "romeIds": [
      "K1207"
    ],
    "vaeRatioInDiploma": 43
  }
]
`,
      'src/components/strategist/data/diagnosticMainChallenges.json': `{
  "bravo": {
  },
  "stuck-market": {
    "metricDetails": "stuck-market:metric_details",
    "metricTitle": "stuck-market:metric_title"
  }
}
`,
      'src/components/strategist/data/goals.json': `{
  "get-moving": [
    {
      "content": "better-cities:content",
      "goalId": "better-cities"
    }
  ],
  "other-leads": [
    {
      "content": "better-cities:content",
      "goalId": "better-cities"
    }
  ]
}
`,
      'src/components/strategist/data/impactMeasurement.json': `[
  {
    "actionId": "explore-jobs",
    "name": "explore-jobs:name"
  }
]
`,
      'src/translations/fr/adviceModules.json': `{
  "some-advice:goal": "atteindre la lune",
  "some-advice:short_title": "lune",
  "some-advice:title": "Luner comme un lunatique",
  "some-advice:user_gain_details": "plus de travail"
}
`,
      'src/translations/fr/diagnosticIllustrations.json': `{
  "25-more:highlight": "+25%",
  "25-more:text": "You even rock more than you think",
  "top-20:highlight": "Top 20%",
  "top-20:text": "You are **the best**"
}
`,
      'src/translations/fr/diagnosticMainChallenges.json': `{
  "stuck-market:metric_details": "Le marché c'est important.",
  "stuck-market:metric_title": "Marché"
}
`,
      'src/translations/fr/goals.json': `{
  "better-cities:content": "Je connais des villes offrant plus d'opportunités"
}
`,
      'src/translations/fr/impactMeasurement.json': `{
  "explore-jobs:name": "Explorer des métiers qui me correspondent"
}
`,
      'src/translations/fr/resourceThemes.json': `{
  "choose-a-job:name": "Choisir un métier"
}
`,
      'src/translations/fr/vae.json': `{
  "receducspe002:name": "Éducateur spécialisé (diplôme d'État)"
}
`,
    }), 0))
  })

  it('should restrict the download to specific table if specified in argument', async () => {
    // TODO(pascal): Add more data expectations.
    // @ts-ignore (We know we are doing some bad stuff here, but it's the easiest way to test)
    sandbox.stub(Airtable.prototype, 'base').callsFake(airtableMock({
      // ROME base.
      appMRMtWV61Kibt37: {
        VAE_Stats: [
          {
            fields: {
              name: "Éducateur spécialisé (diplôme d'État)",
              rome_ids: ['K1207'],
              vae_ratio_in_diploma: 43,
            },
            id: 'receducspe002',
          },
        ],
      },
      // Advice base.
      appXmyc7yYj0pOcae: {
        advice_modules: [],
        diagnostic_main_challenges: [
          {fields: {category_id: 'bravo'}},
          {fields: {
            category_id: 'stuck-market',
            metric_details: "Le marché c'est important.",
            metric_title: 'Marché',
          }},
        ],
        email_templates: [],
        strategy_goals: [
          {fields:
            {
              content: "Je connais des villes offrant plus d'opportunités",
              goal_id: 'better-cities',
              strategy_ids: ['other-leads', 'get-moving'],
            },
          },
        ],
      },
    }))
    await download(['goals'])
    // TODO(cyrille): Fallback to Map deep-equality once
    // https://github.com/chaijs/chai/issues/1228 is resolved.
    expect(_sortBy([...filesWritten], 0)).to.deep.eq(_sortBy(Object.entries({
      'src/components/strategist/data/goals.json': `{
  "get-moving": [
    {
      "content": "better-cities:content",
      "goalId": "better-cities"
    }
  ],
  "other-leads": [
    {
      "content": "better-cities:content",
      "goalId": "better-cities"
    }
  ]
}
`,
      'src/translations/fr/goals.json': `{
  "better-cities:content": "Je connais des villes offrant plus d'opportunités"
}
`,
    }), 0))
  })
})
