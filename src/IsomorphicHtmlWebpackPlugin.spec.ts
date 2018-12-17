
import * as webpack from 'webpack';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

import { IsomorphicHtmlWebpackPlugin } from "./IsomorphicHtmlWebpackPlugin";

describe('IsomorphicHtmlWebpackPlugin', () => {
  let tempdir : string;
  let sources : string;
  let output : string;
  let generatedHtml : string;

  let bundler : webpack.Compiler;

  beforeEach(() => {
    tempdir = fs.mkdtempSync(path.join(os.tmpdir(), 'IsomorphicHtmlWebpackPlugin-test-'));
    sources = path.join(tempdir, 'src');
    output = path.join(tempdir, 'output');

    fs.mkdirSync(sources);
    fs.mkdirSync(output);
    process.chdir(sources);

    const mainPath = path.join(sources, 'test.js');
    const aPath = path.join(sources, 'a.js');
    const bPath = path.join(sources, 'b.js');
    generatedHtml = path.join(output, 'index.html');

    fs.writeFileSync(mainPath, `
      exports = function(stats, locals) {
        var c = locals.c;

        import('./a').then(function(a) {
          import('./b').then(function(b) {
            return { 'index.html': (a + b + c + d) };
          });
        });
      }
    `);
    fs.writeFileSync(aPath, `exports = 'a';`);
    fs.writeFileSync(bPath, `exports = 'b';`);

    bundler = webpack({
      entry: {
        test: [
          mainPath,
        ],
      },
      output: {
        path: output,
        filename: '[chunkhash].js',
      },
      resolve: {
        extensions: [
          '.js',
        ],
      },
      plugins: [
        new IsomorphicHtmlWebpackPlugin({
          entry: 'test',
          locals: { c: 'c' },
          globals: { d: 'd' },
        }),
      ],
    });
  });
  afterEach(() => {
    fs.readdirSync(output)
      .forEach(file => {
        fs.unlinkSync(path.join(output, file));
      })
    ;
    fs.rmdirSync(output);
    fs.readdirSync(sources)
      .forEach(file => {
        fs.unlinkSync(path.join(sources, file));
      })
    ;
    fs.rmdirSync(sources);
    fs.rmdirSync(tempdir);
  });

  it('works', done => {
    bundler.run((err, stats) => {
      if (err) {
        done(err);
        return;
      }
      if (stats.hasErrors()) {
        done(new Error(stats.toString('errors-only')));
        return;
      }
      const generatedCode = fs.readFileSync(generatedHtml);
      generatedCode.toString('utf-8').should.equal('abcd');
      done();
    });
  });
});

