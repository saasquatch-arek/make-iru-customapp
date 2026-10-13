const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const { test } = require('node:test');

// Use Make's actual IML runtime, either installed as a package or bundled with
// the Make Apps Editor. No custom IML functions are registered in these tests.
function runtime() {
    if (process.env.MAKE_IML_RUNTIME_PATH) return require(process.env.MAKE_IML_RUNTIME_PATH);
    try { return require('@integromat/iml'); } catch (error) {
        if (error.code !== 'MODULE_NOT_FOUND') throw error;
    }
    const extensions = path.join(os.homedir(), '.vscode', 'extensions');
    const candidates = fs.existsSync(extensions)
        ? fs.readdirSync(extensions).filter(name => name.startsWith('integromat.apps-sdk-')) : [];
    for (const name of candidates.reverse()) {
        const modulePath = path.join(extensions, name, 'node_modules', '@integromat', 'iml');
        if (fs.existsSync(modulePath)) return require(modulePath);
    }
    throw new Error('Install @integromat/iml or set MAKE_IML_RUNTIME_PATH to the Make IML runtime.');
}
const { IML } = runtime();
const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'makecomapp.json'), 'utf8'));
const config = JSON.parse(fs.readFileSync(path.join(root,
    manifest.components.module.searchsn.codeFiles.communication), 'utf8'));

function evaluate(expression, data) {
    const ast = IML.parse(expression);
    assert.equal(IML.errors.length, 0, expression + ': ' + JSON.stringify(IML.errors));
    return IML.execute(ast, data);
}
function filter(versions, parameters = {}) {
    const body = versions.map(os_version => ({ os_version }));
    const data = { parameters, body };
    data.temp = Object.fromEntries(Object.entries(config.response.temp)
        .map(([key, expression]) => [key, evaluate(expression, data)]));
    return evaluate(config.response.iterate.container, data)
        .filter(item => evaluate(config.response.iterate.condition, { ...data, item }));
}
function check(versions, below, contains, expected) {
    assert.deepEqual(filter(versions, { osVersionBelow: below, osVersionContainsAny: contains })
        .map(device => device.os_version), expected);
}

test('numeric ordering, zero components, and Rapid Security Response suffixes', () => {
    check(['26.6.1', '26.7', '26.7.0', '26.10', '25.9'], '26.7', '', ['26.6.1', '25.9']);
    check(['26.9', '26.10', '26.8.9', '26.9.1'], '26.10', '', ['26.9', '26.8.9', '26.9.1']);
    check(['9.10', '10.1', '9.9'], '10', '', ['9.10', '9.9']);
    check(['26.6', '26.6.0', '26.6.0.0', '26.6.0.1'], '26.6.0', '', []);
    check(['26.006.0', '26.5.10', '26.6.0 (a)'], '26.6', '', ['26.5.10']);
    check(['26.6 (a)', '26.7 (b)', '26.6.0.0.1'], '26.7', '', ['26.6 (a)', '26.6.0.0.1']);
    check(['', null, 'unknown', '24H2', ' 26.5 '], '26.7', '', [' 26.5 ']);
    check(['26.5'], '26.bad', '', []);
});

test('comma-separated substrings are literal OR matches', () => {
    check(['26.6.1', '26.7', '26.7.2', '26.8'], '', '26.6., 26.7', ['26.6.1', '26.7', '26.7.2']);
    check(['26x6y1', '26.6.1', '26.7'], '', '26.6., , 26.7,', ['26.6.1', '26.7']);
    check(['26.6', '26.6.1'], '', '26.6.', ['26.6.1']);
    for (const literal of ['a|b', 'x+y', '[a]', '$&', 'a\\b', 'a/b', '(a)', 'x^y', 'x?y', 'x*y', '{a}']) {
        check([literal, 'unrelated'], '', literal, [literal]);
    }
});

test('combined filters and empty filters preserve their intended meaning', () => {
    check(['26.6.1', '26.7', '26.7.1', '25.6'], '26.7', '26.6., 26.7', ['26.6.1']);
    check(['', null, '24H2', '26.7'], undefined, undefined, ['', null, '24H2', '26.7']);
    check(['26.6', '26.7'], '', ' , ', ['26.6', '26.7']);
    check([], '26.7', '26.6., 26.7', []);
});

test('component ordering agrees with integer comparisons over varied versions', () => {
    const versions = ['0', '0.0.1', '9.99', '10', '26.6', '26.10', '100.2.30', '999999999.999999999'];
    const reference = (left, right) => {
        const a = left.split('.').map(Number); const b = right.split('.').map(Number);
        for (let index = 0; index < Math.max(a.length, b.length); index++) {
            if ((a[index] || 0) !== (b[index] || 0)) return (a[index] || 0) < (b[index] || 0);
        }
        return false;
    };
    for (const below of versions) check(versions, below, '', versions.filter(value => reference(value, below)));
});

function search(versions, inputs) {
    const parameters = { limit: 10, offset: 0, ...inputs };
    const size = evaluate(config.qs.limit, { parameters });
    let offset = evaluate(config.qs.offset, { parameters });
    const results = []; let requests = 0;
    for (let page = 1; page <= 51; page++) {
        requests++;
        const body = versions.slice(offset, offset + size);
        results.push(...filter(body, parameters));
        if (results.length >= parameters.limit || !evaluate(config.pagination.condition, { body })) break;
        offset = evaluate(config.pagination.qs.offset, { parameters, pagination: { page: page + 1 } });
    }
    return { results: results.slice(0, parameters.limit), requests };
}
test('pagination continues through pages with no matches and stops on an empty API page', () => {
    let result = search([...Array(300).fill('26.8'), '26.6.1', '26.7.2'],
        { limit: 2, osVersionContainsAny: '26.6., 26.7' });
    assert.deepEqual(result.results.map(value => value.os_version), ['26.6.1', '26.7.2']);
    assert.equal(result.requests, 2);
    result = search(Array(50).fill('26.8'), { limit: 2, osVersionBelow: '26.7' });
    assert.equal(result.results.length, 0); assert.equal(result.requests, 2);
    result = search(['26.5', '26.5', '26.7', '26.6'], { limit: 1, offset: 2, osVersionBelow: '26.7' });
    assert.equal(result.results[0].os_version, '26.6');
    result = search(Array(650).fill('26.6'), { limit: 601 });
    assert.equal(result.results.length, 601); assert.equal(result.requests, 3);
});

test('deployment manifest has no custom function dependency', () => {
    assert.deepEqual(manifest.components.function, {});
    for (const origin of manifest.origins) assert.deepEqual(origin.idMapping.function, []);
    assert.ok(!JSON.stringify(config).includes('filterDeviceOsVersions'));
});
