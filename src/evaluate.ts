
import { Script } from 'vm';
import { dirname } from 'path';

const Module = require('module');

/**
 * Evaluates given source as a node module using given globals.
 *
 * @return exports
 */
export function evaluate(source : string, moduleName : string, globals : any) : any {
  const { version, arch, platform, release, env } = process;

  const sandbox = {
    ...globals,
  };

  sandbox.exports = {};
  sandbox.require = requireLike(moduleName)
  sandbox.module = {
    filename: moduleName,
    id: moduleName,
    parent: module,
    require: sandbox.require,

    get exports() {
      return sandbox.exports;
    },
    set exports(val : any) {
      sandbox.exports = val;
    },
  };
  sandbox.process = {
    title: moduleName,
    version,
    arch,
    platform,
    release,
    env,
  };
  sandbox.global = sandbox;

  const script = new Script(`${makeGlobals};makeGlobals(global);${removeShebang(source)}`);
  script.runInNewContext(sandbox, { filename: moduleName, displayErrors: true });

  return sandbox.exports;
}

export default evaluate;

function requireLike(path : string) {
  const parentModule = new Module(path);
  parentModule.filename = path;
  parentModule.paths = Module._nodeModulePaths(dirname(path));

  const requireLike : any = function requireLike(file : string) {
    return Module._load(file, parentModule);
  };

  requireLike.resolve = function(request : string) : string {
    return Module._resolveFilename(request, parentModule);
  }
  requireLike.main = process.mainModule;
  requireLike.extensions = require.extensions;
  requireLike.cache = require.cache;

  return requireLike;
}

function removeShebang(source : string) {
	return source.replace(/^\#\!.*/, '');
}

function makeGlobals(global : NodeJS.Global) {
  const { Buffer } = require('buffer');
  const {
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    setImmediate,
    clearImmediate,
  } = require('timers');

  global.Array = Array;
  global.ArrayBuffer = ArrayBuffer;
  global.Boolean = Boolean;
  global.Buffer = Buffer;
  global.DataView = DataView;
  global.Date = Date;
  global.Error = Error;
  global.EvalError = EvalError;
  global.Float32Array = Float32Array;
  global.Float64Array = Float64Array;
  global.Function = Function;
  global.GLOBAL = global;
  global.Int16Array = Int16Array;
  global.Int32Array = Int32Array;
  global.Int8Array = Int8Array;
  global.Intl = Intl;
  global.JSON = JSON;
  global.Map = Map;
  global.Math = Math;
  global.Number = Number;
  global.Object = Object;
  global.Promise = Promise;
  global.RangeError = RangeError;
  global.ReferenceError = ReferenceError;
  global.RegExp = RegExp;
  global.Set = Set;
  global.String = String;
  global.Symbol = Symbol;
  global.SyntaxError = SyntaxError;
  global.TypeError = TypeError;
  global.URIError = URIError;
  global.Uint16Array = Uint16Array;
  global.Uint32Array = Uint32Array;
  global.Uint8Array = Uint8Array;
  global.Uint8ClampedArray = Uint8ClampedArray;
  global.WeakMap = WeakMap;
  global.WeakSet = WeakSet;
  global.clearImmediate = clearImmediate;
  global.clearInterval = clearInterval;
  global.clearTimeout = clearTimeout;
  global.console = console;
  global.decodeURI = decodeURI;
  global.decodeURIComponent = decodeURIComponent;
  global.encodeURI = encodeURI;
  global.encodeURIComponent = encodeURIComponent;
  global.escape = escape;
  global.eval = eval;
  global.global = global;
  global.isFinite = isFinite;
  global.isNaN = isNaN;
  global.parseFloat = parseFloat;
  global.parseInt = parseInt;
  global.root = global;
  global.setImmediate = setImmediate;
  global.setInterval = setInterval;
  global.setTimeout = setTimeout;
  global.unescape = unescape;
}

