const pluginConfig = {
  customTransComponents: [['components/i18n_trans', 'default']],
  defaultContexts: [''],
  keySeparator: null,
  nsSeparator: null,
  outputPath: 'i18n/extract/{{ns}}.json',
  tFunctionNames: ['prepareT', 't'],
  useI18nextDefaultValue: true,
}

module.exports = {
  extends: './.babelrc',
  overrides: [
    {
      plugins: [['i18next-extract', {...pluginConfig, defaultNS: 'advisor'}]],
      test: ['src/components/advisor/*', 'src/components/advisor.tsx'],
    },
    {
      plugins: [['i18next-extract', {...pluginConfig, defaultNS: 'staticAdvice'}]],
      test: 'src/components/pages/static/static_advice/*',
    },
    {
      plugins: [['i18next-extract', {...pluginConfig, defaultNS: 'opengraph'}]],
      test: 'release/lambdas/opengraph_redirect.js',
    },
    {
      plugins: [['i18next-extract', {...pluginConfig, defaultNS: 'landing'}]],
      test: 'src/components/pages/landing.tsx',
    },
    {
      exclude: ['src/components/advisor.tsx'],
      plugins: [['i18next-extract', {...pluginConfig, defaultNS: 'components'}]],
      test: ['src/components/*.tsx'],
    },
  ],
  plugins: [['i18next-extract', pluginConfig]],
}
