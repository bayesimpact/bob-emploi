var path = require('path')
var srcPath = path.join(__dirname, '/../src/')

// Add needed plugins here.
var BowerWebpackPlugin = require('bower-webpack-plugin')

module.exports = {
  devtool: 'eval',
  module: {
    loaders: [
      {
        loader: 'null-loader',
        test: /\.(png|jpg|gif|svg|woff|woff2|css|sass|scss|less|styl)$/,
      },
      {
        include: [
          path.join(__dirname, '/../src'),
          path.join(__dirname, '/../test'),
        ],
        loader: 'babel-loader',
        test: /\.(js|jsx)$/,
      },
    ],
  },
  plugins: [
    new BowerWebpackPlugin({
      searchResolveModulesDirectories: false,
    }),
  ],
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
    extensions: ['', '.js', '.jsx', '_pb.js'],
  },
}
