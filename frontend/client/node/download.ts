import Airtable, {FieldSet, Record as AirtableRecord, Records} from 'airtable'
import fs from 'fs'
import stringify from 'json-stable-stringify'
import _fromPairs from 'lodash/fromPairs'
import _mapValues from 'lodash/mapValues'
import {fileURLToPath} from 'url'
import 'json5/lib/register'

import airtableFields from '../airtable_fields.json5'

type CollectionName = keyof typeof airtableFields

type AirtableFieldValue = FieldSet[string]

/* eslint-disable no-console */

// This file downloads from airtable static data to be put in the JavaScript application. To use it
// run :
// docker-compose run --rm frontend-dev npm run download
//
// Or pick a specific table to download:
//
// docker-compose run --rm frontend-dev npm run download diagnosticMainChallenges
//
// For each data file, the gathering of information is in five steps:
// - download the data from airtable as a list of records (easy step).
//      This is done using airtable API, which is asynchronous, so we get a promise of a list of
//      records, which are (for our purposes) objects with an `id` field and a `fields` field which
//      contains all the fields from the table. This steps only need the necessary info to fetch
//      from airtable (base, table and view)
// - translate that list in all specified languages, using the `translateRecords` function
//      This function returns an object of the form {original: [...], fr_FR: [...], ...} with the
//      original and translated lists. Since getting the translation information is asynchronous,
//      the function rather returns a promise of this object. This steps only need the languages to
//      translate into and the fields to translate.
// - apply a function on each record, to extract what is actually needed from it (easy step).
//      This step will contain the logic of what we actually want to get from the table, so it is
//      heavily dependant on the downloaded data.
// - reduce the data gathered from each record into one object.
//      The two last steps are done using the `reduceRecord` function, which takes as parameters
//      the mapping function (from the previous step) and the reducing function (from this step) to
//      build a state-free reducer. By state-free, I mean that it should have no side-effect,
//      because it will be run several times (for each translated version). The reducing function
//      also depends on the specific data (more precisely on the schema in which we put the data).
// - write the result to JSON files.
//      This is done by the `writeToJson` function if no translation is needed or the
//      `writeWithTranslations` function. This last one takes as input an object with keys as given
//      from `translateRecords`, so the steps in between can be applied uniformally using
//      lodash/mapValues. This step is mainly implemented inside the helper functions, but some
//      preparation might be needed in some cases, depending on the data (see `writeWithTranslation`
//      doc for preparation handling).

const isDryRun = !!process.env.DRY_RUN

const throwError = (err: string) => {
  console.log(err)
  if (!isDryRun) {
    throw new Error(err)
  }
}


const maybeThrowError = (err: Error|null) => {
  if (err) {
    throwError(err.message || JSON.stringify(err))
  }
}

// STEP 1 //

const downloadFromAirtable = async <TFields extends FieldSet>(collection: CollectionName):
Promise<Records<TFields>> => {
  console.log(`Downloading for ${collection}`)
  const {altTable, base, table, view} = airtableFields[collection]
  const airtableBase = new Airtable().base(base)
  try {
    return await airtableBase<TFields>(table).select({view}).all()
  } catch (error) {
    if (error.statusCode !== 404 || !altTable) {
      throw error
    }
    return await airtableBase<TFields>(altTable).select({view}).all()
  }
}

// STEP 2 //

// Gather strings that will be translated.
// The output is a tuple with the records updated with fields replaced by keys, and a map of
// those keys to the French values.
const gatherTranslations = <TFields extends FieldSet>(
  collection: CollectionName, airTableRecords: readonly AirtableRecord<TFields>[],
): [readonly AirtableRecord<TFields>[], Record<string, string>] => {
  const {idField, translatableFields} = airtableFields[collection]
  // Make one records list for each lang.
  const translatedStrings: Record<string, string> = {}
  if (!translatableFields) {
    return [airTableRecords, translatedStrings]
  }
  const updatedRecords = airTableRecords.map(({fields, ...record}) => new AirtableRecord<TFields>(
    record._table,
    '',
    {
      ...record,
      fields: _mapValues(fields, (value, field) => {
        if (!translatableFields.includes(field)) {
          return value
        }
        const recordId = idField ? fields[idField] : record.id
        if (value) {
          translatedStrings[`${recordId}:${field}`] = value as string
        }
        return `${recordId}:${field}`
      }) as TFields,
    },
  ))
  return [updatedRecords, translatedStrings]
}


// Step 3 //

type Mutable<T> = {
  -readonly [k in keyof T]: T[k]
}

const convertToSnakeCase = (camelCase: string): string => {
  return camelCase.split(/(?=[\dA-Z])/).map(s => s.toLowerCase()).join('_')
}

const readFromSnakeCaseFields = <T extends string>(
  {fields}: AirtableRecord<FieldSet>,
  camelCaseFieldNames: readonly T[],
): {readonly [k in T]?: AirtableFieldValue} => {
  const result: {[k in T]?: AirtableFieldValue} = {}
  for (const camelCaseFieldName of camelCaseFieldNames) {
    result[camelCaseFieldName] = fields[convertToSnakeCase(camelCaseFieldName)]
  }
  return result
}

const mapAdviceModules = (record: AirtableRecord<FieldSet>): [string, download.AdviceModule] => {
  const {adviceId, themeId, title1Star, title2Stars, title3Stars, ...otherFields} =
    readFromSnakeCaseFields(record, [
      'adviceId',
      'staticExplanations',
      'goal',
      'shortTitle',
      'themeId',
      'title',
      'title1Star',
      'title2Stars',
      'title3Stars',
      'userGainCallout',
      'userGainDetails',
    ] as const)
  if (title1Star && title1Star === title2Stars && title1Star === title3Stars) {
    throwError(`The advice module "${adviceId}" has a
    redundant title. Clear the title_x_star properties and only keep the
    title.`)
  }
  const newModule = {
    titleXStars: {
      1: title1Star,
      2: title2Stars,
      3: title3Stars,
    },
    ...otherFields,
  } as Mutable<download.AdviceModule>
  if (!otherFields.goal) {
    throwError(`Advice ${adviceId} does not have a goal set.`)
  }
  const [resourceTheme] = (themeId as readonly string[]) || []
  if (resourceTheme) {
    newModule.resourceTheme = resourceTheme
  }
  return [adviceId as string, newModule]
}

const mapEmailTemplates = (record: AirtableRecord<FieldSet>): [string, download.EmailTemplate] => {
  const {adviceId, ...otherFields} = readFromSnakeCaseFields(record, [
    'adviceId',
    'content',
    'filters',
    'personalizations',
    'reason',
    'title',
    'type',
  ] as const)
  return [
    adviceId as string,
    otherFields as download.EmailTemplate,
  ]
}

const mapStrategyGoals = (record: AirtableRecord<FieldSet>) => readFromSnakeCaseFields(
  record, ['content', 'goalId', 'stepTitle', 'strategyIds']) as download.StrategyGoal

const mapDiagnosticMainChallenge = (record: AirtableRecord<FieldSet>):
[string, bayes.bob.DiagnosticMainChallenge] => {
  const {categoryId, ...otherFields} = readFromSnakeCaseFields(record, [
    'achievementText',
    'bobExplanation',
    'categoryId',
    'description',
    'descriptionAnswer',
    'emoji',
    'interestingHighlight',
    'interestingText',
    'metricDetails',
    'metricNotReached',
    'metricReached',
    'metricTitle',
    'opportunityHighlight',
    'opportunityText',
  ] as const)
  return [categoryId as string, otherFields as bayes.bob.DiagnosticMainChallenge]
}

const mapDiagnosticIllustrations = (record: AirtableRecord<FieldSet>) => readFromSnakeCaseFields(
  record, ['highlight', 'mainChallenges', 'text']) as download.Illustration

const mapResourceTheme = (record: AirtableRecord<FieldSet>) =>
  readFromSnakeCaseFields(record, ['name', 'themeId'])

const mapVae = (record: AirtableRecord<FieldSet>) =>
  readFromSnakeCaseFields(record, ['name', 'vaeRatioInDiploma', 'romeIds'])

const mapImpactMeasurement = (record: AirtableRecord<FieldSet>) => readFromSnakeCaseFields(
  record, ['actionId', 'name']) as download.ImpactMeasurement

// Step 4 //

function reduceRecords<T, R extends Record<string, unknown>>(
  recordToResult: (records: AirtableRecord<FieldSet>) => T,
  reduceResults: (acc: R, result: T) => R,
) {
  return (records: Records<FieldSet>): R => records.map(recordToResult).reduce(
    (acc: R, result: T) => reduceResults(acc, result), {} as R)
}

const reduceAdviceModules =
  (records: Records<FieldSet>) => Object.fromEntries(records.map(mapAdviceModules))

const reduceEmailTemplates = reduceRecords(
  mapEmailTemplates,
  (
    emailTemplates: Record<string, readonly download.EmailTemplate []>,
    [adviceId, newTemplate]: [string, download.EmailTemplate],
  ): Record<string, readonly download.EmailTemplate[]> => {
    return {
      ...emailTemplates,
      [adviceId]: [
        ...emailTemplates[adviceId] || [],
        newTemplate,
      ],
    }
  },
)

const reduceStrategyGoals = reduceRecords(mapStrategyGoals,
  (
    strategies: Record<string, readonly download.StrategyGoal[]>,
    {strategyIds, ...goalProps}: download.StrategyGoal,
  ): Record<string, readonly download.StrategyGoal[]> => {
    const updatedStrategies = _fromPairs((strategyIds || []).map(strategyId => {
      if (strategies[strategyId] && strategies[strategyId].length > 5) {
        throw new Error(`Strategy ${strategyId} has too many goals, please reduce to at most 6.`)
      }
      return [strategyId, [
        ...strategies[strategyId] || [],
        goalProps,
      ]]
    }))
    return {
      ...strategies,
      ...updatedStrategies,
    }
  },
)

const reduceDiagnosticMainChallenges = (records: Records<FieldSet>) =>
  Object.fromEntries(records.map(mapDiagnosticMainChallenge))

const reduceDiagnosticIllustrations = reduceRecords(mapDiagnosticIllustrations,
  (
    illustrations: Record<string, readonly download.Illustration[]>,
    {mainChallenges, ...illustrationProps}: download.Illustration,
  ): Record<string, readonly download.Illustration[]> => {
    const updatedIllustrations = _fromPairs((mainChallenges || []).map(
      (categoryId: string) => ([categoryId, [
        ...illustrations[categoryId] || [],
        illustrationProps,
      ]])))
    return {
      ...illustrations,
      ...updatedIllustrations,
    }
  },
)

const reduceVae = (records: Records<FieldSet>) => records.slice(0, 10).map(mapVae)

const reduceImpactMeasurement = (records: Records<FieldSet>) => records.map(mapImpactMeasurement)

type Reducer<U> = (records: Records<FieldSet>) => U

const reducers: Record<string, Reducer<unknown>> = {
  adviceModules: reduceAdviceModules,
  diagnosticIllustrations: reduceDiagnosticIllustrations,
  diagnosticMainChallenges: reduceDiagnosticMainChallenges,
  emailTemplates: reduceEmailTemplates,
  goals: reduceStrategyGoals,
  impactMeasurement: reduceImpactMeasurement,
  resourceThemes: records => records.map(mapResourceTheme),
  vae: reduceVae,
}

// Step 5 //

const writeToJson = <T>(jsonFile: string, jsonObject: T): void => {
  if (isDryRun) {
    return
  }
  fs.writeFile(jsonFile, stringify(jsonObject, {space: 2}) + '\n', maybeThrowError)
}

const writeWithTranslations = <T>(
  collection: CollectionName, records: T, translations: Record<string, string>): void => {
  const {output} = airtableFields[collection]
  writeToJson(output, records)
  if (Object.keys(translations).length) {
    writeToJson(`src/translations/fr/${collection}.json`, translations)
  }
}

// Wrap it all //

const importCollection = async (collection: CollectionName): Promise<void> => {
  // Step 1.
  const rawRecords = await downloadFromAirtable(collection)
  // Step 2.
  const [records, translations] = gatherTranslations(collection, rawRecords)
  // Step 3 & 4.
  const reducer = reducers[collection]
  if (!reducer) {
    throw new Error(`No reducer for collection: ${collection}`)
  }
  const reducedRecords = reducer(records)
  // Step 5.
  writeWithTranslations(collection, reducedRecords, translations)
}

function download(collections: readonly string[]): Promise<unknown> {
  const shouldDownloadAll = !collections.length
  const downloadable = Object.keys(airtableFields) as readonly CollectionName[]
  const toDownload = new Set(collections)

  const unrecognized = [...toDownload].
    filter(table => !downloadable.includes(table as CollectionName))
  if (unrecognized.length) {
    const isPlural = unrecognized.length > 1
    throw new Error(`"${unrecognized.join('", "')}"
      ${isPlural ? 'are not valid table names' : 'is not a valid table name'},
      it should be one of: "${downloadable.join('", "')}"`)
  }
  return Promise.all(downloadable.
    filter((key) => shouldDownloadAll || toDownload.has(key)).
    map(importCollection))
}


export default download

async function downloadAndLogError(collections: readonly string[]): Promise<void> {
  try {
    await download(collections)
  } catch (error) {
    console.log(error)
    // eslint-disable-next-line unicorn/no-process-exit
    process.exit(1)
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  downloadAndLogError(process.argv.slice(2))
}
