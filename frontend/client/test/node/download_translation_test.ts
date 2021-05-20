import Airtable from 'airtable'
import {expect} from 'chai'
import {promises as fs} from 'fs'
import _sortBy from 'lodash/sortBy'
import sinon from 'sinon'
import translateAll from '../../node/download_translations'

const sandbox = sinon.createSandbox()


// TODO(pascal): Move to its own package.
interface TableSelector {
  readonly view?: string
}


function getRandomHash(): string {
  return (Math.random() * 36).toString(36)
}


class AirtableMockTable<T> {
  readonly base: AirtableMockBase<T>

  readonly data: readonly {fields: T; id: string}[]

  readonly tableId: string

  readonly selector?: TableSelector

  constructor(base: AirtableMockBase<T>, tableId: string, selector?: TableSelector) {
    if (!base.data[tableId]) {
      throw new Error(`No Airtable data for table "${base.appId}.${tableId}"`)
    }
    this.base = base
    this.data = base.data[tableId].map((fields: T) => ({fields, id: getRandomHash()}))
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

  data: {[tableId: string]: readonly T[]}

  constructor(data: {[tableId: string]: readonly T[]}, appId: string) {
    this.data = data
    this.appId = appId
  }
}


function airtableMock<T>(
  data: {[appId: string]: {[tableId: string]: readonly T[]}}) {
  return (appId: string) => {
    if (!data[appId]) {
      throw new Error(`No Airtable data for app "${appId}"`)
    }
    const base = new AirtableMockBase(data[appId], appId)
    return (tableName: string): AirtableMockTable<T> => new AirtableMockTable<T>(base, tableName)
  }
}


describe('translateAll', () => {
  const filesWritten = new Map()
  const filesToRead = new Map()
  beforeEach(() => {
    // @ts-ignore (We know we are doing some bad stuff here, but it's the easiest way to test)
    sandbox.stub(Airtable, 'apiKey').value('test-api-key')
    sandbox.stub(fs, 'writeFile').callsFake(
      (path: string|Buffer|URL|fs.FileHandle, data: unknown) => {
        return new Promise(resolve => {
          filesWritten.set(path as string, data)
          resolve()
        })
      })
    sandbox.stub(fs, 'mkdir').callsFake((): Promise<undefined> => {
      return Promise.resolve(undefined)
    })
    sandbox.stub(fs, 'readdir').callsFake(
      // @ts-ignore (The full typing for readdir is a pain).
      (folder: string|Buffer|URL): Promise<readonly string[]> => {
        return new Promise(resolve => {
          resolve([...filesToRead.keys()].
            filter((filename: string) => filename.startsWith(folder as string)).
            map((filename: string) => filename.slice((folder as string).length + 1)))
        })
      })
    sandbox.stub(fs, 'readFile').callsFake(
      (filename: string|Buffer|URL|fs.FileHandle): Promise<string> => {
        return new Promise(resolve => {
          if (!filesToRead.has(filename)) {
            throw new Error(`${filename} is not defined and cannot be read`)
          }
          resolve(filesToRead.get(filename))
        })
      })
  })

  afterEach(() => {
    filesToRead.clear()
    filesWritten.clear()
    translateAll.resetCache()
    sandbox.restore()
  })

  it('should run properly', async () => {
    filesToRead.set('i18n_extract/translation.json', `{
      "A string to translate": ""
    }`)
    filesToRead.set('i18n_extract/other_namespace.json', `{
      "A string to translate in another namespace": ""
    }`)
    // @ts-ignore Too complex to type the whole thing properly.
    sandbox.stub(Airtable.prototype, 'base').callsFake(airtableMock({
      // Translations.
      appkEc8N0Bw4Uok43: {translations: [
        {
          fr: 'A string to translate in French',
          string: 'A string to translate',
        },
        {
          fr: 'A string in another namespace in French',
          string: 'A string to translate in another namespace',
        },
      ]},
    }))
    await translateAll(['i18n_extract'], 'i18n_out', ['fr'])
    // TODO(cyrille): Fallback to Map deep-equality once
    // https://github.com/chaijs/chai/issues/1228 is resolved.
    expect(_sortBy([...filesWritten], 0)).to.deep.eq(_sortBy(Object.entries({
      'i18n_out/fr/other_namespace.json': `{
  "A string to translate in another namespace": "A string in another namespace in French"
}
`,
      'i18n_out/fr/translation.json': `{
  "A string to translate": "A string to translate in French"
}
`,
    }), 0))
  })

  it('should run keep translation with contexts as well', async () => {
    filesToRead.set('i18n_extract/translation.json', `{
      "A string_with_underscores": "",
      "Another string": ""
    }`)
    // @ts-ignore Too complex to type the whole thing properly.
    sandbox.stub(Airtable.prototype, 'base').callsFake(airtableMock({
      // Translations.
      appkEc8N0Bw4Uok43: {translations: [
        {
          fr: 'A',
          string: 'A string_with_underscores',
        },
        {
          fr: 'B',
          string: 'Another string',
        },
        // The same strings but with a context.
        {
          fr: 'C',
          string: 'A string_with_underscores_context',
        },
        {
          fr: 'D',
          string: 'Another string_context',
        },
        // The same strings but with a context that itself contains an underscore.
        {
          fr: 'E',
          string: 'A string_with_underscores_double_context',
        },
        {
          fr: 'F',
          string: 'Another string_double_context',
        },
        // Other strings.
        {
          fr: 'G',
          string: 'Another translation not related',
        },
        {
          fr: 'H',
          string: 'Another translation not related_context',
        },
      ]},
    }))
    await translateAll(['i18n_extract'], 'i18n_out', ['fr'])
    // TODO(cyrille): Fallback to Map deep-equality once
    // https://github.com/chaijs/chai/issues/1228 is resolved.
    expect(_sortBy([...filesWritten], 0)).to.deep.eq(_sortBy(Object.entries({
      'i18n_out/fr/translation.json': `{
  "A string_with_underscores": "A",
  "A string_with_underscores_context": "C",
  "A string_with_underscores_double_context": "E",
  "Another string": "B",
  "Another string_context": "D",
  "Another string_double_context": "F"
}
`,
    }), 0))
  })

  it('should not duplicate translations if one can rely on fallback', async () => {
    filesToRead.set('i18n_extract/translation.json', `{
      "A string to translate": "",
      "Centre": ""
    }`)
    // @ts-ignore Too complex to type the whole thing properly.
    sandbox.stub(Airtable.prototype, 'base').callsFake(airtableMock({
      // Translations.
      appkEc8N0Bw4Uok43: {translations: [
        {
          'en': 'A string to translate in English',
          // The translations is the same in en_UK and en, so no need to write it for en_UK.
          'en_UK': 'A string to translate in English',
          // The translation in French is the same than the key, so no need to write it.
          'fr@tu': 'A string to translate',
          'string': 'A string to translate',
        },
        {
          en: 'American English Center',
          // The translation in en_UK is the same as the key, but different than English.
          // eslint-disable-next-line camelcase
          en_UK: 'Centre',
          string: 'Centre',
        },
      ]},
    }))
    await translateAll(['i18n_extract'], 'i18n_out', ['en', 'en_UK', 'fr'])
    // TODO(cyrille): Fallback to Map deep-equality once
    // https://github.com/chaijs/chai/issues/1228 is resolved.
    expect(_sortBy([...filesWritten], 0)).to.deep.eq(_sortBy(Object.entries({
      'i18n_out/en/translation.json': `{
  "A string to translate": "A string to translate in English",
  "Centre": "American English Center"
}
`,
      'i18n_out/en_UK/translation.json': `{
  "Centre": "Centre"
}
`,
    }), 0))
  })

  it('should find translations prefixed by the namespace', async () => {
    filesToRead.set('i18n_extract/adviceModules.json', `{
      "my-advice:title": "Title",
      "my-advice:goal": "Goal"
    }`)
    // @ts-ignore Too complex to type the whole thing properly.
    sandbox.stub(Airtable.prototype, 'base').callsFake(airtableMock({
      // Translations.
      appkEc8N0Bw4Uok43: {translations: [
        {
          en: 'The title in English',
          string: 'adviceModules:my-advice:title',
        },
        {
          en: 'The title in English in feminine form',
          string: 'adviceModules:my-advice:title_FEMININE',
        },
        {
          en: 'The title in English but without the prefix in the key',
          string: 'my-advice:title',
        },
        {
          en: 'The goal in English',
          string: 'adviceModules:my-advice:goal',
        },
      ]},
    }))
    await translateAll(['i18n_extract'], 'i18n_out', ['en'])
    // TODO(cyrille): Fallback to Map deep-equality once
    // https://github.com/chaijs/chai/issues/1228 is resolved.
    expect(_sortBy([...filesWritten], 0)).to.deep.eq(_sortBy(Object.entries({
      'i18n_out/en/adviceModules.json': `{
  "my-advice:goal": "The goal in English",
  "my-advice:title": "The title in English",
  "my-advice:title_FEMININE": "The title in English in feminine form"
}
`,
    }), 0))
  })
})
