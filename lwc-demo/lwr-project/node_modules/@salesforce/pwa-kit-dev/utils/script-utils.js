"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.walkDir = exports.readCredentials = exports.parseLog = exports.glob = exports.getPwaKitDependencies = exports.getProjectPkg = exports.getProjectDependencyTree = exports.getPkgJSON = exports.getLowestPackageVersion = exports.getCredentialsFile = exports.defaultMessage = exports.createBundle = exports.DEFAULT_DOCS_URL = exports.DEFAULT_CLOUD_ORIGIN = exports.CloudAPIClient = void 0;
var _os = _interopRequireDefault(require("os"));
var _path = _interopRequireDefault(require("path"));
var _archiver = _interopRequireDefault(require("archiver"));
var _nodeFetch = _interopRequireDefault(require("node-fetch"));
var _url = require("url");
var _fsExtra = require("fs-extra");
var _minimatch = require("minimatch");
var _gitRevSync = _interopRequireDefault(require("git-rev-sync"));
var _validator = _interopRequireDefault(require("validator"));
var _child_process = require("child_process");
var _semver = _interopRequireDefault(require("semver"));
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), !0).forEach(function (r) { _defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
function _defineProperty(e, r, t) { return (r = _toPropertyKey(r)) in e ? Object.defineProperty(e, r, { value: t, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = t, e; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == typeof i ? i : i + ""; }
function _toPrimitive(t, r) { if ("object" != typeof t || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != typeof i) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
function asyncGeneratorStep(n, t, e, r, o, a, c) { try { var i = n[a](c), u = i.value; } catch (n) { return void e(n); } i.done ? t(u) : Promise.resolve(u).then(r, o); }
function _asyncToGenerator(n) { return function () { var t = this, e = arguments; return new Promise(function (r, o) { var a = n.apply(t, e); function _next(n) { asyncGeneratorStep(a, r, o, _next, _throw, "next", n); } function _throw(n) { asyncGeneratorStep(a, r, o, _next, _throw, "throw", n); } _next(void 0); }); }; } /*
 * Copyright (c) 2022, Salesforce, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
const DEFAULT_CLOUD_ORIGIN = exports.DEFAULT_CLOUD_ORIGIN = 'https://cloud.mobify.com';
const DEFAULT_DOCS_URL = exports.DEFAULT_DOCS_URL = 'https://developer.salesforce.com/docs/commerce/pwa-kit-managed-runtime/guide/pushing-and-deploying-bundles.html';
/**
 * Get the package info for pwa-kit-dev.
 */
const getPkgJSON = exports.getPkgJSON = /*#__PURE__*/function () {
  var _ref = _asyncToGenerator(function* () {
    const candidates = [_path.default.join(__dirname, '..', 'package.json'), _path.default.join(__dirname, '..', '..', 'package.json')];
    for (const candidate of candidates) {
      try {
        const data = yield (0, _fsExtra.readJson)(candidate);
        return data;
      } catch {
        // Keep looking
      }
    }
    return {
      name: '@salesforce/pwa-kit-dev',
      version: 'unknown'
    };
  });
  return function getPkgJSON() {
    return _ref.apply(this, arguments);
  };
}();

/**
 * Get the package info for the current project.
 */
const getProjectPkg = exports.getProjectPkg = /*#__PURE__*/function () {
  var _ref2 = _asyncToGenerator(function* () {
    const p = _path.default.join(process.cwd(), 'package.json');
    try {
      const data = yield (0, _fsExtra.readJson)(p);
      return data;
    } catch {
      throw new Error(`Could not read project package at "${p}"`);
    }
  });
  return function getProjectPkg() {
    return _ref2.apply(this, arguments);
  };
}();

/**
 * Get the set of file paths within a specific directory
 * @param dir Directory to walk
 * @returns Set of file paths within the directory
 */
const walkDir = exports.walkDir = /*#__PURE__*/function () {
  var _ref3 = _asyncToGenerator(function* (dir, baseDir, fileSet) {
    fileSet = fileSet || new Set();
    const entries = yield (0, _fsExtra.readdir)(dir, {
      withFileTypes: true
    });
    yield Promise.all(entries.map( /*#__PURE__*/function () {
      var _ref4 = _asyncToGenerator(function* (entry) {
        const entryPath = _path.default.join(dir, entry.name);
        if (entry.isDirectory()) {
          yield walkDir(entryPath, baseDir, fileSet);
        } else {
          var _fileSet;
          (_fileSet = fileSet) === null || _fileSet === void 0 ? void 0 : _fileSet.add(entryPath.replace(baseDir + _path.default.sep, ''));
        }
      });
      return function (_x4) {
        return _ref4.apply(this, arguments);
      };
    }()));
    return fileSet;
  });
  return function walkDir(_x, _x2, _x3) {
    return _ref3.apply(this, arguments);
  };
}();
/**
 * Returns a DependencyTree that includes the versions of all packages
 * including their dependencies within the project.
 *
 * @returns A DependencyTree with the versions of all dependencies
 */
const getProjectDependencyTree = exports.getProjectDependencyTree = /*#__PURE__*/function () {
  var _ref5 = _asyncToGenerator(function* () {
    // When executing this inside template-retail-react-app, the output of `npm ls` exceeds the
    // max buffer size that child_process can handle, so we can't use that directly. The max string
    // size is much larger, so writing/reading a temp file is a functional workaround.
    const tmpDir = yield (0, _fsExtra.mkdtemp)(_path.default.join(_os.default.tmpdir(), 'pwa-kit-dev-'));
    const destination = _path.default.join(tmpDir, 'npm-ls.json');
    try {
      (0, _child_process.execSync)(`npm ls --all --json > ${destination}`);
      return yield (0, _fsExtra.readJson)(destination, 'utf8');
    } catch (_) {
      // Don't prevent bundles from being pushed if this step fails
      return null;
    } finally {
      // Remove temp file asynchronously after returning; ignore failures
      void (0, _fsExtra.rm)(destination).catch(() => {});
    }
  });
  return function getProjectDependencyTree() {
    return _ref5.apply(this, arguments);
  };
}();

/**
 * Returns the lowest version of a package installed.
 *
 * @param packageName - The name of the package to get the lowest version for
 * @param dependencyTree - The dependency tree including all package versions
 * @returns The lowest version of the given package that is installed
 */
const getLowestPackageVersion = (packageName, dependencyTree) => {
  let lowestVersion = null;
  function search(tree) {
    for (const key in tree.dependencies) {
      const dependency = tree.dependencies[key];
      if (key === packageName) {
        const version = dependency.version;
        if (!lowestVersion || _semver.default.lt(version, lowestVersion)) {
          lowestVersion = version;
        }
      }
      if (dependency.dependencies) {
        search(dependency);
      }
    }
  }
  search(dependencyTree);
  return lowestVersion ?? 'unknown';
};

/**
 * Returns the versions of all PWA Kit dependencies of a project.
 * This will search the dependency tree for the lowest version of each PWA Kit package.
 *
 * @param dependencyTree - The dependency tree including all package versions
 * @returns The versions of all dependencies of the project.
 */
exports.getLowestPackageVersion = getLowestPackageVersion;
const getPwaKitDependencies = dependencyTree => {
  const pwaKitDependencies = ['@salesforce/pwa-kit-react-sdk', '@salesforce/pwa-kit-runtime', '@salesforce/pwa-kit-dev'];

  // pwa-kit package versions are not always listed as direct dependencies
  // in the package.json such as when a bundle is using template extensibility
  const nestedPwaKitDependencies = {};
  pwaKitDependencies.forEach(packageName => {
    nestedPwaKitDependencies[packageName] = getLowestPackageVersion(packageName, dependencyTree);
  });
  return nestedPwaKitDependencies;
};
exports.getPwaKitDependencies = getPwaKitDependencies;
class CloudAPIClient {
  constructor(params) {
    this.opts = {
      origin: params.origin || DEFAULT_CLOUD_ORIGIN,
      fetch: params.fetch || _nodeFetch.default,
      credentials: params.credentials
    };
  }
  getAuthHeader() {
    const {
      username,
      api_key
    } = this.opts.credentials;
    const encoded = Buffer.from(`${username}:${api_key}`, 'binary').toString('base64');
    return {
      Authorization: `Basic ${encoded}`
    };
  }
  getHeaders() {
    var _this = this;
    return _asyncToGenerator(function* () {
      const pkg = yield getPkgJSON();
      return _objectSpread({
        'User-Agent': `${pkg.name}@${pkg.version}`
      }, _this.getAuthHeader());
    })();
  }
  throwForStatus(res) {
    return _asyncToGenerator(function* () {
      if (res.status < 400) {
        return;
      }
      const body = yield res.text();
      let error;
      try {
        error = JSON.parse(body);
      } catch {
        error = {}; // Cloud doesn't always return JSON
      }
      if (res.status === 403) {
        error.docs_url = 'https://developer.salesforce.com/docs/commerce/pwa-kit-managed-runtime/guide/mrt-overview.html#users,-abilities,-and-roles';
      }
      throw new Error([`HTTP ${res.status}`, error.message || body, `For more information visit ${error.docs_url || DEFAULT_DOCS_URL}`].join('\n'));
    })();
  }
  push(bundle, projectSlug, target) {
    var _this2 = this;
    return _asyncToGenerator(function* () {
      const base = `api/projects/${projectSlug}/builds/`;
      const pathname = target ? base + `${target}/` : base;
      const url = new _url.URL(_this2.opts.origin);
      url.pathname = pathname;
      const body = Buffer.from(JSON.stringify(bundle));
      const headers = _objectSpread(_objectSpread({}, yield _this2.getHeaders()), {}, {
        'Content-Length': body.length.toString()
      });
      const res = yield _this2.opts.fetch(url.toString(), {
        body,
        method: 'POST',
        headers
      });
      yield _this2.throwForStatus(res);
      return yield res.json();
    })();
  }
  createLoggingToken(project, environment) {
    var _this3 = this;
    return _asyncToGenerator(function* () {
      const url = new _url.URL(_this3.opts.origin);
      url.pathname = `/api/projects/${project}/target/${environment}/jwt/`;
      const headers = _objectSpread(_objectSpread({}, yield _this3.getHeaders()), {}, {
        // Annoyingly, the new logging endpoint only accepts an
        // Authorization header that is inconsistent with our older APIs!
        Authorization: `Bearer ${_this3.opts.credentials.api_key}`
      });
      const res = yield _this3.opts.fetch(url.toString(), {
        method: 'POST',
        headers
      });
      yield _this3.throwForStatus(res);
      const data = yield res.json();
      return data['token'];
    })();
  }

  /** Polls MRT for deployment status every 30 seconds. */
  waitForDeploy(project, environment) {
    var _this4 = this;
    return _asyncToGenerator(function* () {
      return new Promise((resolve, reject) => {
        /** Milliseconds to wait between checks. */
        const delay = 30_000;
        /** Check the deployment status to see whether it has finished. */
        const check = /*#__PURE__*/function () {
          var _ref6 = _asyncToGenerator(function* () {
            const url = new _url.URL(`/api/projects/${project}/target/${environment}`, _this4.opts.origin);
            const res = yield _this4.opts.fetch(url, {
              headers: yield _this4.getHeaders()
            });
            if (!res.ok) {
              var _json;
              const text = yield res.text();
              let json;
              try {
                if (text) json = JSON.parse(text);
              } catch (_) {} // eslint-disable-line no-empty
              const message = ((_json = json) === null || _json === void 0 ? void 0 : _json.detail) ?? text;
              // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
              const detail = message ? `: ${message}` : '';
              throw new Error(`${res.status} ${res.statusText}${detail}`);
            }
            const data = yield res.json();
            if (typeof data.state !== 'string') {
              return reject(new Error('An unknown state occurred when polling the deployment.'));
            }
            switch (data.state) {
              case 'CREATE_IN_PROGRESS':
              case 'PUBLISH_IN_PROGRESS':
                // In progress - check again after the next delay
                // `check` is async, so we need to use .catch to properly handle errors
                setTimeout(() => void check().catch(reject), delay);
                return;
              case 'CREATE_FAILED':
              case 'PUBLISH_FAILED':
                // Failed - reject with failure
                return reject(new Error('Deployment failed.'));
              case 'ACTIVE':
                // Success!
                return resolve();
              default:
                // Unknown - reject with confusion
                return reject(new Error(`Unknown deployment state "${data.state}".`));
            }
          });
          return function check() {
            return _ref6.apply(this, arguments);
          };
        }();
        // Start checking after the first delay!
        setTimeout(() => void check().catch(reject), delay);
      });
    })();
  }
}
exports.CloudAPIClient = CloudAPIClient;
const defaultMessage = (gitInstance = _gitRevSync.default) => {
  try {
    return `${gitInstance.branch()}: ${gitInstance.short()}`;
  } catch (err) {
    if ((err === null || err === void 0 ? void 0 : err.code) === 'ENOENT') {
      console.log('Using default bundle message as no message was provided and not in a Git repo.');
    }
    return 'PWA Kit Bundle';
  }
};
exports.defaultMessage = defaultMessage;
const createBundle = exports.createBundle = /*#__PURE__*/function () {
  var _ref7 = _asyncToGenerator(function* ({
    message,
    ssr_parameters,
    ssr_only,
    ssr_shared,
    buildDirectory,
    projectSlug
  }) {
    message = message || defaultMessage();
    const tmpDir = yield (0, _fsExtra.mkdtemp)(_path.default.join(_os.default.tmpdir(), 'pwa-kit-dev-'));
    const destination = _path.default.join(tmpDir, 'build.tar');
    const filesInArchive = [];
    let bundle_metadata = {};
    if (ssr_only.length === 0 || ssr_shared.length === 0) {
      throw new Error('no ssrOnly or ssrShared files are defined');
    }
    return Promise.resolve().then(() => (0, _fsExtra.stat)(buildDirectory)).catch(() => {
      const fullPath = _path.default.join(process.cwd(), buildDirectory);
      throw new Error(`Build directory at path "${fullPath}" not found.\n` + 'Run `pwa-kit-dev build` first!');
    }).then(() => new Promise((resolve, reject) => {
      const output = (0, _fsExtra.createWriteStream)(destination);
      const archive = (0, _archiver.default)('tar');
      archive.pipe(output);

      // See https://web.archive.org/web/20160712064705/http://archiverjs.com/docs/global.html#TarEntryData
      const newRoot = _path.default.join(projectSlug, 'bld', '');
      // WARNING: There are a lot of type assertions here because we use a very old
      // version of archiver, and the types provided don't match the docs. :\
      archive.directory(buildDirectory, '', entry => {
        const stats = entry.stats;
        if (stats !== null && stats !== void 0 && stats.isFile() && entry.name) {
          filesInArchive.push(entry.name);
        }
        entry.prefix = newRoot;
        return entry;
      });
      archive.on('error', reject);
      output.on('finish', resolve);
      archive.finalize();
    })).then( /*#__PURE__*/_asyncToGenerator(function* () {
      const {
        dependencies = {},
        devDependencies = {},
        ccExtensibility = {
          extends: '',
          overridesDir: ''
        }
      } = yield getProjectPkg();
      const extendsTemplate = 'node_modules/' + ccExtensibility.extends;
      let cc_overrides = [];
      if (ccExtensibility.overridesDir) {
        const overrides_files = yield walkDir(ccExtensibility.overridesDir, ccExtensibility.overridesDir);
        cc_overrides = Array.from(overrides_files).filter(item => (0, _fsExtra.existsSync)(_path.default.join(extendsTemplate, item)));
      }
      const dependencyTree = yield getProjectDependencyTree();
      // If we can't load the dependency tree, pretend that it's empty.
      // TODO: Should we report an error?
      const pwaKitDeps = dependencyTree ? getPwaKitDependencies(dependencyTree) : {};
      bundle_metadata = {
        dependencies: _objectSpread(_objectSpread(_objectSpread({}, dependencies), devDependencies), pwaKitDeps ?? {}),
        cc_overrides: cc_overrides
      };
    })).then(() => (0, _fsExtra.readFile)(destination)).then(data => {
      const encoding = 'base64';
      return {
        message,
        encoding,
        data: data.toString(encoding),
        ssr_parameters,
        ssr_only: filesInArchive.filter(glob(ssr_only)),
        ssr_shared: filesInArchive.filter(glob(ssr_shared)),
        bundle_metadata
      };
    })
    // This is a false positive. The promise returned by `.finally()` won't resolve until
    // the `rm()` completes!
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    .finally(() => (0, _fsExtra.rm)(tmpDir, {
      recursive: true
    }));
  });
  return function createBundle(_x5) {
    return _ref7.apply(this, arguments);
  };
}();
const glob = patterns => {
  // The patterns can include negations, so matching is done against all
  // the patterns. A match is true if a given path matches any pattern and
  // does not match any negating patterns.

  const allPatterns = (patterns || []).map(pattern => new _minimatch.Minimatch(pattern, {
    nocomment: true
  })).filter(pattern => !pattern.empty);
  const positivePatterns = allPatterns.filter(pattern => !pattern.negate);
  const negativePatterns = allPatterns.filter(pattern => pattern.negate);
  return path => {
    if (path) {
      const positive = positivePatterns.some(pattern => pattern.match(path));
      const negative = negativePatterns.some(pattern => !pattern.match(path));
      return positive && !negative;
    }
    return false;
  };
};
exports.glob = glob;
const getCredentialsFile = (cloudOrigin, credentialsFile) => {
  if (credentialsFile) {
    return credentialsFile;
  } else {
    const url = new _url.URL(cloudOrigin);
    const host = url.host;
    const suffix = host === 'cloud.mobify.com' ? '' : `--${host}`;
    return _path.default.join(_os.default.homedir(), `.mobify${suffix}`);
  }
};
exports.getCredentialsFile = getCredentialsFile;
const readCredentials = exports.readCredentials = /*#__PURE__*/function () {
  var _ref9 = _asyncToGenerator(function* (filepath) {
    try {
      const data = yield (0, _fsExtra.readJson)(filepath);
      return {
        username: data.username,
        api_key: data.api_key
      };
    } catch (e) {
      throw new Error(`Credentials file "${filepath}" not found.\n` + 'Visit https://runtime.commercecloud.com/account/settings for ' + 'steps on authorizing your computer to push bundles.');
    }
  });
  return function readCredentials(_x6) {
    return _ref9.apply(this, arguments);
  };
}();
const parseLog = log => {
  const parts = log.trim().split('\t');
  let requestId, shortRequestId, level;
  if (parts.length >= 3 && _validator.default.isISO8601(parts[0]) && _validator.default.isUUID(parts[1]) && _validator.default.isAlpha(parts[2])) {
    // An application log
    parts.shift();
    requestId = parts.shift();
    level = parts.shift();
  } else {
    // A platform log
    const words = parts[0].split(' ');
    level = words.shift();
    parts[0] = words.join(' ');
  }
  const message = parts.join('\t');
  const match = /(?<id>[a-f\d]{8})/.exec(requestId || message);
  if (match) {
    var _match$groups;
    shortRequestId = (_match$groups = match.groups) === null || _match$groups === void 0 ? void 0 : _match$groups.id;
  }
  return {
    level,
    message,
    shortRequestId
  };
};
exports.parseLog = parseLog;