// TODO(cyrille): Migrate to typescript.
const Airtable = require('airtable')
const {expect} = require('chai')
const fs = require('fs')
const _sortBy = require('lodash/sortBy')
const sinon = require('sinon')

const sandbox = sinon.createSandbox()

/* eslint-disable camelcase */


// TODO(pascal): Move to its own package.
class AirtableMockTable {
  constructor(base, tableId) {
    if (!base.data[tableId]) {
      throw new Error(`No Airtable data for table "${base.baseId}.${tableId}"`)
    }
    this.base = base
    this.data = base.data[tableId]
    this.tableId = tableId
    this.selector = null
  }

  select(selector) {
    this.selector = selector
    return this
  }

  all() {
    return Promise.resolve(this.data)
  }
}


class AirtableMockBase {
  constructor(data, baseId) {
    this.data = data
    this.baseId = baseId
  }

  table(tableId) {
    return new AirtableMockTable(this, tableId)
  }
}


function airtableMock(data) {
  return baseId => {
    if (!data[baseId]) {
      throw new Error(`No Airtable data for base "${baseId}"`)
    }
    return new AirtableMockBase(data[baseId], baseId)
  }
}


describe('download.js', () => {
  const filesWritten = new Map()
  beforeEach(() => {
    Airtable.apiKey = 'test-api-key'
    sandbox.stub(fs, 'writeFile').callsFake((filename, content) => {
      return new Promise(resolve => {
        filesWritten.set(filename, content)
        resolve()
      })
    })
  })

  afterEach(() => {
    filesWritten.clear()
    sandbox.restore()
    delete require.cache[require.resolve('../../download.js')]
  })

  it('should run properly', () => {
    // TODO(pascal): Add more data expectations.
    sandbox.stub(Airtable.prototype, 'base').callsFake(airtableMock({
      // ROME base.
      appMRMtWV61Kibt37: {
        'Event Types': [
          {
            fields: {
              event_location: "salon de l'agriculture",
              event_location_prefix: 'au prochain',
              rome_prefix: 'A',
            },
          },
        ],
        'VAE Stats': [
          {fields: {
            name: "Éducateur spécialisé (diplôme d'État)",
            rome_ids: ['K1207'],
            vae_ratio_in_diploma: 43,
          }},
        ],
      },
      // Advice base.
      appXmyc7yYj0pOcae: {
        advice_modules: [],
        diagnostic_categories: [
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
      // Translations.
      appkEc8N0Bw4Uok43: {translations: [
        {
          fields: {
            'fr@tu': 'au prochain',
            'string': 'au prochain',
          },
        },
        {
          fields: {
            'fr@tu': 'Informaticienne',
            'string': 'Informaticienne',
          },
        },
        {
          fields: {
            'fr@tu': "salon de l'agriculture",
            'string': "salon de l'agriculture",
          },
        },
        {
          fields: {
            'fr@tu': "J'ai adoré",
            'string': "J'ai adoré",
          },
        },
        {
          fields: {
            'en': 'I know some cities',
            'fr@tu': 'Je connais des villes avec plus.',
            'string': "Je connais des villes offrant plus d'opportunités",
          },
        },
        {
          fields: {
            'en': 'Market is important',
            'fr@tu': "Le marché c'est important pour toi.",
            'string': "Le marché c'est important.",
          },
        },
        {
          fields: {
            'en': 'Market',
            'fr@tu': 'Marché',
            'string': 'Marché',
          },
        },
        {
          fields: {
            fr: 'Le marché masculin',
            string: "Le marché c'est important._MASCULINE",
          },
        },
        {
          fields: {
            fr: 'Le marché féminin',
            string: "Le marché c'est important._FEMININE",
          },
        },
      ]},
    }))
    process.argv = ['node', 'download.js']
    return require('../../download.js').then(() => {
      // TODO(cyrille): Fallback to Map deep-equality once
      // https://github.com/chaijs/chai/issues/1228 is resolved.
      expect(_sortBy([...filesWritten], 0)).to.deep.eq(_sortBy(Object.entries({
        'src/components/advisor/data/advice_modules.json': '{\n}\n',
        'src/components/advisor/data/email_templates.json': '{\n}\n',
        'src/components/advisor/data/vae.json': `[
  {
    "name": "Éducateur spécialisé (diplôme d'État)",
    "romeIds": [
      "K1207"
    ],
    "vaeRatioInDiploma": 43
  }
]
`,
        'src/components/strategist/data/categories.json': `{
  "bravo": {
  },
  "stuck-market": {
    "metricDetails": "Le marché c'est important.",
    "metricTitle": "Marché"
  }
}
`,
        'src/components/strategist/data/goals.json': `{
  "get-moving": [
    {
      "content": "Je connais des villes offrant plus d'opportunités",
      "goalId": "better-cities"
    }
  ],
  "other-leads": [
    {
      "content": "Je connais des villes offrant plus d'opportunités",
      "goalId": "better-cities"
    }
  ]
}
`,
        'src/translations/en/categories.json': `{
  "Le marché c'est important.": "Market is important",
  "Marché": "Market"
}
`,
        'src/translations/en/goals.json': `{
  "Je connais des villes offrant plus d'opportunités": "I know some cities"
}
`,
        'src/translations/fr/categories.json': `{
  "Le marché c'est important._FEMININE": "Le marché féminin",
  "Le marché c'est important._MASCULINE": "Le marché masculin"
}
`,
        'src/translations/fr@tu/categories.json': `{
  "Le marché c'est important.": "Le marché c'est important pour toi."
}
`,
        'src/translations/fr@tu/goals.json': `{
  "Je connais des villes offrant plus d'opportunités": "Je connais des villes avec plus."
}
`,
      }), 0))
    })
  })

  it('should restrict the download to specific table if specified in argument', () => {
    // TODO(pascal): Add more data expectations.
    sandbox.stub(Airtable.prototype, 'base').callsFake(airtableMock({
      // ROME base.
      appMRMtWV61Kibt37: {
        'Event Types': [
          {
            fields: {
              event_location: "salon de l'agriculture",
              event_location_prefix: 'au prochain',
              rome_prefix: 'A',
            },
          },
        ],
      },
      // Advice base.
      appXmyc7yYj0pOcae: {
        advice_modules: [],
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
      // Translations.
      appkEc8N0Bw4Uok43: {translations: [
        {
          fields: {
            'fr@tu': 'au prochain',
            'string': 'au prochain',
          },
        },
        {
          fields: {
            'fr@tu': 'Informaticienne',
            'string': 'Informaticienne',
          },
        },
        {
          fields: {
            'fr@tu': "salon de l'agriculture",
            'string': "salon de l'agriculture",
          },
        },
        {
          fields: {
            'fr@tu': "J'ai adoré",
            'string': "J'ai adoré",
          },
        },
        {
          fields: {
            'en': 'I know some cities',
            'fr@tu': 'Je connais des villes avec plus.',
            'string': "Je connais des villes offrant plus d'opportunités",
          },
        },
      ]},
    }))
    process.argv = ['node', 'download.js', 'strategyGoals']
    return require('../../download.js').then(() => {
      // TODO(cyrille): Fallback to Map deep-equality once
      // https://github.com/chaijs/chai/issues/1228 is resolved.
      expect(_sortBy([...filesWritten], 0)).to.deep.eq(_sortBy(Object.entries({
        'src/components/strategist/data/goals.json': `{
  "get-moving": [
    {
      "content": "Je connais des villes offrant plus d'opportunités",
      "goalId": "better-cities"
    }
  ],
  "other-leads": [
    {
      "content": "Je connais des villes offrant plus d'opportunités",
      "goalId": "better-cities"
    }
  ]
}
`,
        'src/translations/en/goals.json': `{
  "Je connais des villes offrant plus d'opportunités": "I know some cities"
}
`,
        'src/translations/fr@tu/goals.json': `{
  "Je connais des villes offrant plus d'opportunités": "Je connais des villes avec plus."
}
`,
      }), 0))
    })
  })
})
