
import { Script } from 'vm';
import { dirname } from 'path';

const Module = require('module');

/**
 * Evaluates given source as a node module using given globals.
 *
 * @return exports
 */
export function evaluate(source : string, moduleName : string, globals : any) : any {
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
  sandbox.global = sandbox;

  const script = new Script(removeShebang(source));
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

