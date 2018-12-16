
import { Plugin, Compiler, Stats, compilation } from 'webpack';
import { Source, RawSource } from 'webpack-sources';
import * as path from 'path';

import 'offensive/assertions/fieldThat/register';
import 'offensive/assertions/aString/register';
import 'offensive/assertions/Undefined/register';
import 'offensive/assertions/anObject/register';
import check from 'offensive';

import evaluate from './evaluate';

/**
 * @class IsomorphicHtmlWebpackPlugin
 *
 * A webpack plugin which expects one of entry points to export a function
 * which implements GeneratorFunction interface. It evaluates the entry point
 * using configured global variables and uses calls the generator function
 * with configured locals and webpack compilation stats object as arguments.
 * After generating the files, the plugin exports them as webpack assets.
 *
 * The plugin works very similar to static-site-generator-webpack-plugin
 * but it's much simpler in its interface and also supports webpack's code-
 * splitted entry points.
 *
 * @author Maciej Chałapuk (maciej@chalapuk.pl)
 */

/**
 * Map (fileName => htmlSource) returned from generator function.
 */
export type StaticHtmlMap = { [filename : string] : string };

/**
 * Interface which must be implemented by default export of entry point
 * which will be used to generate static HTML.
 */
export interface GeneratorFunction {
  (webpackStats : Stats, locals : any) : Promise<StaticHtmlMap>;
}

export interface Options {
  /**
   * Name of entry point that creates generator function.
   */
  entry : string;
  /**
   * An object which will be passed as `locals` argument
   * to generator function.
   */
  locals ?: any;
  /**
   * An object fields of which will be added to global scope
   * when evaluating the script.
   */
  globals ?: any;
}

const PLUGIN_NAME = 'isomorphic-html-webpack-plugin';
type Compilation = compilation.Compilation;
type Asset = compilation.Asset;

export class IsomorphicHtmlWebpackPlugin implements Plugin {
  readonly options : Options;

  constructor(options : Options) {
    this.options = {
      entry: check(options.entry, 'options.entry').is.aString(),
      locals: check(options.locals, 'options.locals').is.anObject.or.Undefined(),
      globals: check(options.globals, 'options.globals').is.anObject.or.Undefined(),
    };
  }

  apply(compiler : Compiler) {
    compiler.hooks.thisCompilation.tap(PLUGIN_NAME, (compilation : Compilation) => {
      compilation.hooks.optimizeAssets.tapPromise(PLUGIN_NAME, () => this.generate(compilation));
    });
  }

  private async generate(compilation : Compilation) : Promise<void> {
    const { entry, locals = {}, globals = {} } = this.options;

    const webpackStats = compilation.getStats();

    try {
      const assets = findAssets(entry, compilation, webpackStats);

      const source = assets.map(asset => asset.source()).join('\n');
      const generatorModule = evaluate(source, entry, globals);

      if (!generatorModule.hasOwnProperty('default')) {
        throw new Error(`entry point \'${entry}\' doesn't have a default export`);
      }
      if (typeof generatorModule !== 'function') {
        throw new Error(
          `default export from entry point '${entry}' must be a function; got ${typeof generatorModule}`
        );
      }
      const generate = generatorModule.default as GeneratorFunction;
      const generatedHtml = await generate(webpackStats, locals);

      Object.keys(generatedHtml)
        .forEach(fileName => exportAsset(compilation, fileName, generatedHtml[fileName]));

    } catch (err) {
      compilation.errors.push(err.stack);
    }
  }
}

export default IsomorphicHtmlWebpackPlugin;

function findAssets(entry : string, compilation : Compilation, stats : Stats) : Source[] {
  const asset = compilation.assets[entry];

  if (asset) {
    return [ asset ];
  }

  const json = stats.toJson()
  const chunkNames = json.assetsByChunkName[entry];

  if (!chunkNames) {
    throw new Error(`couldn't find entry point '${entry}'`);
  }
  // Webpack outputs an array for each chunk when using sourcemaps
  if (chunkNames instanceof Array) {
    return chunkNames.map(chunk => compilation.assets[chunk]);
  }
  return [ compilation.assets[chunkNames] ];
}

function exportAsset(compilation : Compilation, fileName : string, source : string) {
  const assetName = pathToAssetName(fileName);

  if (compilation.assets[assetName]) {
    throw new Error(`asset of name '${assetName}' already exported`);
  }
  compilation.assets[assetName] = new RawSource(source);
}

function pathToAssetName(outputPath : string) {
  // Remove leading slashes
  let outputFileName = outputPath.replace(/^(\/|\\)/, '');

  if (!/\.(html?)$/i.test(outputFileName)) {
    outputFileName = path.join(outputFileName, 'index.html');
  }
  return outputFileName;
}

