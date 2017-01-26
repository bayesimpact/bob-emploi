var path = require('path')
var srcPath = path.join(__dirname, '/../src/')

module.exports = {
  devtool: 'eval',
  entry: './test/loadtests.js',
  module: {
    rules: [
      {
        test: /\.(png|jpg|gif|svg|woff|woff2|css|sass|scss|less|styl)$/,
        use: 'null-loader',
      },
      {
        include: [
          path.join(__dirname, '/../src'),
          path.join(__dirname, '/../test'),
        ],
        test: /\.(js|jsx)$/,
        use: 'babel-loader',
      },
    ],
  },
  resolve: {
    alias: {
      actions: srcPath + 'actions/',
      api: srcPath + '/../bob_emploi/frontend/api',
      components: srcPath + 'components/',
      config: srcPath + 'config/' + process.env.REACT_WEBPACK_ENV,
      helpers: path.join(__dirname, '/../test/helpers'),
      images: srcPath + 'images/',
      store: srcPath + 'store/',
      styles: srcPath + 'styles/',
    },
    extensions: ['.js', '.jsx', '_pb.js'],
  },
}
