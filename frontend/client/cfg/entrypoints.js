// ATTENTION: Keep in sync with frontend/release/nginx.conf.
// TODO(cyrille): Use prefixes to generate rewrite.
module.exports = {
  'app': {
    entry: './src/entry',
    htmlFilename: 'index.html',
    usesHotLoader: true,
  },
  'bootstrap': {
    entry: './src/bootstrap_entry',
    htmlFilename: 'bootstrap.html',
    prefixes: [
      '/conseiller/nouveau-profil-et-projet',
      '/conseiller/ressources',
    ],
    rewrite: /^\/conseiller\/(nouveau-profil-et-projet|ressources)/,
    usesHotLoader: true,
  },
  'eval': {
    entry: './src/eval_entry',
    htmlFilename: 'eval.html',
    prefixes: ['/eval'],
    rewrite: /^\/eval($|\/)/,
    usesHotLoader: true,
  },
  'import-from-imilo': {
    entry: './src/import-from-imilo/entry',
  },
  'mini-onboarding': {
    entry: './src/mini_onboarding_entry',
    htmlFilename: 'mini-onboarding.html',
    prefixes: ['/mini', '/unml/a-li'],
    rewrite: /^\/(mini|unml\/a-li)/,
    usesHotLoader: true,
  },
  'nps': {
    entry: './src/components/pages/nps',
    htmlFilename: 'nps.html',
    prefixes: ['/retours'],
    rewrite: /^\/retours$/,
  },
  'statusUpdate': {
    entry: './src/components/pages/status_update',
    htmlFilename: 'statut.html',
    prefixes: ['/statut'],
    rewrite: /^\/statut($|\/)/,
  },
  'unsubscribe': {
    entry: './src/components/pages/unsubscribe',
    htmlFilename: 'unsubscribe.html',
    prefixes: ['/unsubscribe'],
    rewrite: /^\/unsubscribe/,
  },
}
