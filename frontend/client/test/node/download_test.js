const Airtable = require('airtable')
const {expect} = require('chai')
const fs = require('fs')
const _sortBy = require('lodash/sortBy')
const sinon = require('sinon')

const sandbox = sinon.createSandbox()


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
      'appMRMtWV61Kibt37': {
        'Event Types': [
          {
            'fields': {
              'event_location': "salon de l'agriculture",
              'event_location_prefix': 'au prochain',
              'rome_prefix': 'A',
            },
          },
        ],
      },
      // Advice base.
      'appXmyc7yYj0pOcae': {
        'advice_modules': [],
        'email_templates': [],
        'strategy_goals': [
          {'fields':
            {
              'content': "Je connais des villes offrant plus d'opportunités",
              'goal_id': 'better-cities',
              'strategy_ids': ['other-leads', 'get-moving'],
            },
          },
        ],
        'strategy_testimonials': [
          {'fields':
            {
              'content': "J'ai adoré",
              'created_at': '2/13/2019',
              'is_male': false,
              'job': 'Informaticienne',
              'name': 'Petra',
              'rating': 3,
              'strategy_ids': ['other-leads', 'get-moving'],
            },
          },
        ],
      },
      // Translations.
      'appkEc8N0Bw4Uok43': {'translations': [
        {
          'fields': {
            'fr_FR@tu': 'au prochain',
            'string': 'au prochain',
          },
        },
        {
          'fields': {
            'fr_FR@tu': 'Informaticienne',
            'string': 'Informaticienne',
          },
        },
        {
          'fields': {
            'fr_FR@tu': "salon de l'agriculture",
            'string': "salon de l'agriculture",
          },
        },
        {
          'fields': {
            'fr_FR@tu': "J'ai adoré",
            'string': "J'ai adoré",
          },
        },
        {
          'fields': {
            'fr_FR@tu': 'Je connais des villes offrant plus de possibilités.',
            'string': "Je connais des villes offrant plus d'opportunités",
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
        'src/components/advisor/data/advice_modules_fr_FR@tu.json': '{\n}\n',
        'src/components/advisor/data/categories.json': '{\n}\n',
        'src/components/advisor/data/email_templates.json': '{\n}\n',
        'src/components/advisor/data/email_templates_fr_FR@tu.json': '{\n}\n',
        'src/components/advisor/data/events.json': `{
  "A": {
    "atNext": "au prochain",
    "eventLocation": "salon de l'agriculture"
  }
}
`,
        'src/components/advisor/data/events_fr_FR@tu.json': `{
  "A": {
    "atNext": "au prochain",
    "eventLocation": "salon de l'agriculture"
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
        'src/components/strategist/data/goals_fr_FR@tu.json': `{
  "get-moving": [
    {
      "content": "Je connais des villes offrant plus de possibilités.",
      "goalId": "better-cities"
    }
  ],
  "other-leads": [
    {
      "content": "Je connais des villes offrant plus de possibilités.",
      "goalId": "better-cities"
    }
  ]
}
`,
        'src/components/strategist/data/testimonials.json': `{
  "get-moving": [
    {
      "content": "J'ai adoré",
      "createdAt": "2/13/2019",
      "isMale": false,
      "job": "Informaticienne",
      "name": "Petra",
      "rating": 3
    }
  ],
  "other-leads": [
    {
      "content": "J'ai adoré",
      "createdAt": "2/13/2019",
      "isMale": false,
      "job": "Informaticienne",
      "name": "Petra",
      "rating": 3
    }
  ]
}
`,
        'src/components/strategist/data/testimonials_fr_FR@tu.json': `{
  "get-moving": [
    {
      "content": "J'ai adoré",
      "createdAt": "2/13/2019",
      "isMale": false,
      "job": "Informaticienne",
      "name": "Petra",
      "rating": 3
    }
  ],
  "other-leads": [
    {
      "content": "J'ai adoré",
      "createdAt": "2/13/2019",
      "isMale": false,
      "job": "Informaticienne",
      "name": "Petra",
      "rating": 3
    }
  ]
}
`,
      }), 0))
    })
  })

  it('should restrict the download to specific table if specified in argument', () => {
    // TODO(pascal): Add more data expectations.
    sandbox.stub(Airtable.prototype, 'base').callsFake(airtableMock({
      // ROME base.
      'appMRMtWV61Kibt37': {
        'Event Types': [
          {
            'fields': {
              'event_location': "salon de l'agriculture",
              'event_location_prefix': 'au prochain',
              'rome_prefix': 'A',
            },
          },
        ],
      },
      // Advice base.
      'appXmyc7yYj0pOcae': {
        'advice_modules': [],
        'email_templates': [],
        'strategy_goals': [
          {'fields':
            {
              'content': "Je connais des villes offrant plus d'opportunités",
              'goal_id': 'better-cities',
              'strategy_ids': ['other-leads', 'get-moving'],
            },
          },
        ],
        'strategy_testimonials': [
          {'fields':
            {
              'content': "J'ai adoré",
              'created_at': '2/13/2019',
              'is_male': false,
              'job': 'Informaticienne',
              'name': 'Petra',
              'rating': 3,
              'strategy_ids': ['other-leads', 'get-moving'],
            },
          },
        ],
      },
      // Translations.
      'appkEc8N0Bw4Uok43': {'translations': [
        {
          'fields': {
            'fr_FR@tu': 'au prochain',
            'string': 'au prochain',
          },
        },
        {
          'fields': {
            'fr_FR@tu': 'Informaticienne',
            'string': 'Informaticienne',
          },
        },
        {
          'fields': {
            'fr_FR@tu': "salon de l'agriculture",
            'string': "salon de l'agriculture",
          },
        },
        {
          'fields': {
            'fr_FR@tu': "J'ai adoré",
            'string': "J'ai adoré",
          },
        },
        {
          'fields': {
            'fr_FR@tu': 'Je connais des villes offrant plus de possibilités.',
            'string': "Je connais des villes offrant plus d'opportunités",
          },
        },
      ]},
    }))
    process.argv = ['node', 'download.js', 'events']
    return require('../../download.js').then(() => {
      // TODO(cyrille): Fallback to Map deep-equality once
      // https://github.com/chaijs/chai/issues/1228 is resolved.
      expect(_sortBy([...filesWritten], 0)).to.deep.eq(_sortBy(Object.entries({
        'src/components/advisor/data/events.json': `{
  "A": {
    "atNext": "au prochain",
    "eventLocation": "salon de l'agriculture"
  }
}
`,
        'src/components/advisor/data/events_fr_FR@tu.json': `{
  "A": {
    "atNext": "au prochain",
    "eventLocation": "salon de l'agriculture"
  }
}
`,
      }), 0))
    })
  })
})
