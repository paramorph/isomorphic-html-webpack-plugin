
import evaluate from './evaluate';

describe('evaluate(...)', () => {
  it('exports a variable', () => {
    const exports = evaluate('exports.var0 = \'val0\';', 'test', {});
    exports.should.eql({ var0: 'val0' });
  });
  it('exports redeclared exports', () => {
    const exports = evaluate('exports = { var1: \'val1\' };', 'test', {});
    exports.var1.should.equal('val1');
  });

  it('exports a variable defined via module variable', () => {
    const exports = evaluate('module.exports.var0 = \'val0\';', 'test', {});
    exports.should.eql({ var0: 'val0' });
  });
  it('exports redeclared exports defined via module variable', () => {
    const exports = evaluate('module.exports = { var1: \'val1\' };', 'test', {});
    exports.var1.should.equal('val1');
  });

  it('uses globals', () => {
    const exports = evaluate('exports.var3 = var3;', 'test', { var3: 'var3' });
    exports.should.eql({ var3: 'var3' });
  });
  it('uses globals via global variable', () => {
    const exports = evaluate('exports.var4 = global.var4;', 'test', { var4: 'var4' });
    exports.should.eql({ var4: 'var4' });
  });

  it('sets module\'s file name', () => {
    const exports = evaluate('exports.var5 = module.filename;', 'test', {});
    exports.should.eql({ var5: 'test' });
  });
  it('sets module\'s id', () => {
    const exports = evaluate('exports.var6 = module.id;', 'test', {});
    exports.should.eql({ var6: 'test' });
  });

  it('defines require which loads a local file', () => {
    const exports = evaluate(`
      const evaluate = require("./evaluate").default;
      exports = evaluate("exports.var7 = \'val7\';", "test2", {});
    `, 'test', {});
    exports.should.eql({ var7: 'val7' });
  });
  it('defines require which loads a global module', () => {
    const exports = evaluate(`
      const fs = require("fs");
      const var8 = fs.readFileSync("./evaluate.ts");
      exports = { var8 };
    `, 'test', {});
    exports.var8.length.should.not.equal(0);
  });
});

