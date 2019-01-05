
import { Plugin, Compiler, Stats, compilation } from 'webpack';
import { Source, RawSource } from 'webpack-sources';
import * as path from 'path';
import * as jsdom from 'jsdom';

import 'offensive/assertions/fieldThat/register';
import 'offensive/assertions/aString/register';
import 'offensive/assertions/Undefined/register';
import 'offensive/assertions/anObject/register';
import 'offensive/assertions/aFunction/register';
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
  (locals : any, webpackStats : Stats) : Promise<StaticHtmlMap>;
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
type FetchResource = (url : string, oprions : jsdom.FetchOptions) => Promise<Buffer>;

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
    if (webpackStats.hasErrors()) {
      console.log(`${PLUGIN_NAME}: Bailing out due to previous errors...`);
      return;
    }
    prepareFakeBrowser(globals, fetchResource.bind(null, compilation));

    try {
      const initAsset = findInitialAsset(entry, compilation, webpackStats);

      const source = initAsset.source();
      const generatorExports = evaluate(source, entry, globals);

      check(generatorExports.default, `'${entry}' entry point's exports.default`).is.aFunction();
      const generate = generatorExports.default as GeneratorFunction;

      const generatedHtml = await generate(locals, webpackStats);
      check(generatedHtml, 'generatedHtml').is.anObject();

      Object.keys(generatedHtml)
        .forEach(fileName => exportAsset(compilation, fileName, generatedHtml[fileName]));

    } catch (err) {
      compilation.errors.push(err.stack);
    }
  }
}

export default IsomorphicHtmlWebpackPlugin;

function findInitialAsset(entry : string, compilation : Compilation, stats : Stats) : Source {
  const json = stats.toJson()
  const chunkNames = json.assetsByChunkName[entry];

  if (!chunkNames) {
    throw new Error(`couldn't find entry point '${entry}'`);
  }
  // Webpack outputs an array for each chunk when using sourcemaps
  if (chunkNames instanceof Array) {
    const name = chunkNames.filter(name => name.endsWith('.js'))[0];
    return compilation.assets[name];
  }
  return compilation.assets[chunkNames];
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

function prepareFakeBrowser(globals : any, fetch : FetchResource) {
  if (!globals.hasOwnProperty('window')) {
    const resources = new jsdom.ResourceLoader();
    resources.fetch = fetch;

    const dom = new jsdom.JSDOM('<script></script>', {
      runScripts: 'dangerously',
      resources,
      pretendToBeVisual: true,
    });
    Object.defineProperty(globals, 'window', {
      get: () => dom.window,
      set: (value : any) => { throw new Error('window is readonly'); },
      enumerable: true,
    });
  }
  if (!globals.hasOwnProperty('self')) {
    Object.defineProperty(globals, 'self', {
      get: () => globals.window,
      set: (value : any) => { throw new Error('self is readonly'); },
      enumerable: true,
    });
  }

  const windowPropsForwardedToGlobalScope = [
    'document',
    'setTimeout',
    'clearTimeout',
    'console',
  ];

  windowPropsForwardedToGlobalScope.forEach(key => {
    if (!globals.hasOwnProperty(key)) {
      Object.defineProperty(globals, key, {
        get: () => globals.window[key],
        set: (value : any) => { throw new Error(`${key} is readonly`); },
        enumerable: true,
      });
    }
  });
}

async function fetchResource(
  compilation : Compilation,
  url : string,
  options : jsdom.FetchOptions,
) : Promise<Buffer> {
  const { output } = compilation.compiler.options;
  const asset = compilation.assets[removePublicPath(url, output)];
  return Buffer.from(asset.source());
}

function removePublicPath(url : string, output ?: { publicPath ?: string }) {
  if (!output || !output.publicPath) {
    return url;
  }
  return url.substring(output.publicPath.length);
}

