const RUNTIME_PUBLIC_PATH = "server/chunks/ssr/[turbopack]_runtime.js";
const RELATIVE_ROOT_PATH = "..";
const ASSET_PREFIX = "/_next/";
/**
 * This file contains runtime types and functions that are shared between all
 * TurboPack ECMAScript runtimes.
 *
 * It will be prepended to the runtime code of each runtime.
 */ /* eslint-disable @typescript-eslint/no-unused-vars */ /// <reference path="./runtime-types.d.ts" />
const REEXPORTED_OBJECTS = new WeakMap();
/**
 * Constructs the `__turbopack_context__` object for a module.
 */ function Context(module, exports) {
    this.m = module;
    // We need to store this here instead of accessing it from the module object to:
    // 1. Make it available to factories directly, since we rewrite `this` to
    //    `__turbopack_context__.e` in CJS modules.
    // 2. Support async modules which rewrite `module.exports` to a promise, so we
    //    can still access the original exports object from functions like
    //    `esmExport`
    // Ideally we could find a new approach for async modules and drop this property altogether.
    this.e = exports;
}
const contextPrototype = Context.prototype;
const hasOwnProperty = Object.prototype.hasOwnProperty;
const toStringTag = typeof Symbol !== 'undefined' && Symbol.toStringTag;
function defineProp(obj, name, options) {
    if (!hasOwnProperty.call(obj, name)) Object.defineProperty(obj, name, options);
}
function getOverwrittenModule(moduleCache, id) {
    let module = moduleCache[id];
    if (!module) {
        // This is invoked when a module is merged into another module, thus it wasn't invoked via
        // instantiateModule and the cache entry wasn't created yet.
        module = createModuleObject(id);
        moduleCache[id] = module;
    }
    return module;
}
/**
 * Creates the module object. Only done here to ensure all module objects have the same shape.
 */ function createModuleObject(id) {
    return {
        exports: {},
        error: undefined,
        id,
        namespaceObject: undefined
    };
}
const BindingTag_Value = 0;
/**
 * Adds the getters to the exports object.
 */ function esm(exports, bindings) {
    defineProp(exports, '__esModule', {
        value: true
    });
    if (toStringTag) defineProp(exports, toStringTag, {
        value: 'Module'
    });
    let i = 0;
    while(i < bindings.length){
        const propName = bindings[i++];
        const tagOrFunction = bindings[i++];
        if (typeof tagOrFunction === 'number') {
            if (tagOrFunction === BindingTag_Value) {
                defineProp(exports, propName, {
                    value: bindings[i++],
                    enumerable: true,
                    writable: false
                });
            } else {
                throw new Error(`unexpected tag: ${tagOrFunction}`);
            }
        } else {
            const getterFn = tagOrFunction;
            if (typeof bindings[i] === 'function') {
                const setterFn = bindings[i++];
                defineProp(exports, propName, {
                    get: getterFn,
                    set: setterFn,
                    enumerable: true
                });
            } else {
                defineProp(exports, propName, {
                    get: getterFn,
                    enumerable: true
                });
            }
        }
    }
    Object.seal(exports);
}
/**
 * Makes the module an ESM with exports
 */ function esmExport(bindings, id) {
    let module;
    let exports;
    if (id != null) {
        module = getOverwrittenModule(this.c, id);
        exports = module.exports;
    } else {
        module = this.m;
        exports = this.e;
    }
    module.namespaceObject = exports;
    esm(exports, bindings);
}
contextPrototype.s = esmExport;
function ensureDynamicExports(module, exports) {
    let reexportedObjects = REEXPORTED_OBJECTS.get(module);
    if (!reexportedObjects) {
        REEXPORTED_OBJECTS.set(module, reexportedObjects = []);
        module.exports = module.namespaceObject = new Proxy(exports, {
            get (target, prop) {
                if (hasOwnProperty.call(target, prop) || prop === 'default' || prop === '__esModule') {
                    return Reflect.get(target, prop);
                }
                for (const obj of reexportedObjects){
                    const value = Reflect.get(obj, prop);
                    if (value !== undefined) return value;
                }
                return undefined;
            },
            ownKeys (target) {
                const keys = Reflect.ownKeys(target);
                for (const obj of reexportedObjects){
                    for (const key of Reflect.ownKeys(obj)){
                        if (key !== 'default' && !keys.includes(key)) keys.push(key);
                    }
                }
                return keys;
            }
        });
    }
    return reexportedObjects;
}
/**
 * Dynamically exports properties from an object
 */ function dynamicExport(object, id) {
    let module;
    let exports;
    if (id != null) {
        module = getOverwrittenModule(this.c, id);
        exports = module.exports;
    } else {
        module = this.m;
        exports = this.e;
    }
    const reexportedObjects = ensureDynamicExports(module, exports);
    if (typeof object === 'object' && object !== null) {
        reexportedObjects.push(object);
    }
}
contextPrototype.j = dynamicExport;
function exportValue(value, id) {
    let module;
    if (id != null) {
        module = getOverwrittenModule(this.c, id);
    } else {
        module = this.m;
    }
    module.exports = value;
}
contextPrototype.v = exportValue;
function exportNamespace(namespace, id) {
    let module;
    if (id != null) {
        module = getOverwrittenModule(this.c, id);
    } else {
        module = this.m;
    }
    module.exports = module.namespaceObject = namespace;
}
contextPrototype.n = exportNamespace;
function createGetter(obj, key) {
    return ()=>obj[key];
}
/**
 * @returns prototype of the object
 */ const getProto = Object.getPrototypeOf ? (obj)=>Object.getPrototypeOf(obj) : (obj)=>obj.__proto__;
/** Prototypes that are not expanded for exports */ const LEAF_PROTOTYPES = [
    null,
    getProto({}),
    getProto([]),
    getProto(getProto)
];
/**
 * @param raw
 * @param ns
 * @param allowExportDefault
 *   * `false`: will have the raw module as default export
 *   * `true`: will have the default property as default export
 */ function interopEsm(raw, ns, allowExportDefault) {
    const bindings = [];
    let defaultLocation = -1;
    for(let current = raw; (typeof current === 'object' || typeof current === 'function') && !LEAF_PROTOTYPES.includes(current); current = getProto(current)){
        for (const key of Object.getOwnPropertyNames(current)){
            bindings.push(key, createGetter(raw, key));
            if (defaultLocation === -1 && key === 'default') {
                defaultLocation = bindings.length - 1;
            }
        }
    }
    // this is not really correct
    // we should set the `default` getter if the imported module is a `.cjs file`
    if (!(allowExportDefault && defaultLocation >= 0)) {
        // Replace the binding with one for the namespace itself in order to preserve iteration order.
        if (defaultLocation >= 0) {
            // Replace the getter with the value
            bindings.splice(defaultLocation, 1, BindingTag_Value, raw);
        } else {
            bindings.push('default', BindingTag_Value, raw);
        }
    }
    esm(ns, bindings);
    return ns;
}
function createNS(raw) {
    if (typeof raw === 'function') {
        return function(...args) {
            return raw.apply(this, args);
        };
    } else {
        return Object.create(null);
    }
}
function esmImport(id) {
    const module = getOrInstantiateModuleFromParent(id, this.m);
    // any ES module has to have `module.namespaceObject` defined.
    if (module.namespaceObject) return module.namespaceObject;
    // only ESM can be an async module, so we don't need to worry about exports being a promise here.
    const raw = module.exports;
    return module.namespaceObject = interopEsm(raw, createNS(raw), raw && raw.__esModule);
}
contextPrototype.i = esmImport;
function asyncLoader(moduleId) {
    const loader = this.r(moduleId);
    return loader(esmImport.bind(this));
}
contextPrototype.A = asyncLoader;
// Add a simple runtime require so that environments without one can still pass
// `typeof require` CommonJS checks so that exports are correctly registered.
const runtimeRequire = // @ts-ignore
typeof require === 'function' ? require : function require1() {
    throw new Error('Unexpected use of runtime require');
};
contextPrototype.t = runtimeRequire;
function commonJsRequire(id) {
    return getOrInstantiateModuleFromParent(id, this.m).exports;
}
contextPrototype.r = commonJsRequire;
/**
 * Remove fragments and query parameters since they are never part of the context map keys
 *
 * This matches how we parse patterns at resolving time.  Arguably we should only do this for
 * strings passed to `import` but the resolve does it for `import` and `require` and so we do
 * here as well.
 */ function parseRequest(request) {
    // Per the URI spec fragments can contain `?` characters, so we should trim it off first
    // https://datatracker.ietf.org/doc/html/rfc3986#section-3.5
    const hashIndex = request.indexOf('#');
    if (hashIndex !== -1) {
        request = request.substring(0, hashIndex);
    }
    const queryIndex = request.indexOf('?');
    if (queryIndex !== -1) {
        request = request.substring(0, queryIndex);
    }
    return request;
}
/**
 * `require.context` and require/import expression runtime.
 */ function moduleContext(map) {
    function moduleContext(id) {
        id = parseRequest(id);
        if (hasOwnProperty.call(map, id)) {
            return map[id].module();
        }
        const e = new Error(`Cannot find module '${id}'`);
        e.code = 'MODULE_NOT_FOUND';
        throw e;
    }
    moduleContext.keys = ()=>{
        return Object.keys(map);
    };
    moduleContext.resolve = (id)=>{
        id = parseRequest(id);
        if (hasOwnProperty.call(map, id)) {
            return map[id].id();
        }
        const e = new Error(`Cannot find module '${id}'`);
        e.code = 'MODULE_NOT_FOUND';
        throw e;
    };
    moduleContext.import = async (id)=>{
        return await moduleContext(id);
    };
    return moduleContext;
}
contextPrototype.f = moduleContext;
/**
 * Returns the path of a chunk defined by its data.
 */ function getChunkPath(chunkData) {
    return typeof chunkData === 'string' ? chunkData : chunkData.path;
}
function isPromise(maybePromise) {
    return maybePromise != null && typeof maybePromise === 'object' && 'then' in maybePromise && typeof maybePromise.then === 'function';
}
function isAsyncModuleExt(obj) {
    return turbopackQueues in obj;
}
function createPromise() {
    let resolve;
    let reject;
    const promise = new Promise((res, rej)=>{
        reject = rej;
        resolve = res;
    });
    return {
        promise,
        resolve: resolve,
        reject: reject
    };
}
// Load the CompressedmoduleFactories of a chunk into the `moduleFactories` Map.
// The CompressedModuleFactories format is
// - 1 or more module ids
// - a module factory function
// So walking this is a little complex but the flat structure is also fast to
// traverse, we can use `typeof` operators to distinguish the two cases.
function installCompressedModuleFactories(chunkModules, offset, moduleFactories, newModuleId) {
    let i = offset;
    while(i < chunkModules.length){
        let moduleId = chunkModules[i];
        let end = i + 1;
        // Find our factory function
        while(end < chunkModules.length && typeof chunkModules[end] !== 'function'){
            end++;
        }
        if (end === chunkModules.length) {
            throw new Error('malformed chunk format, expected a factory function');
        }
        // Each chunk item has a 'primary id' and optional additional ids. If the primary id is already
        // present we know all the additional ids are also present, so we don't need to check.
        if (!moduleFactories.has(moduleId)) {
            const moduleFactoryFn = chunkModules[end];
            applyModuleFactoryName(moduleFactoryFn);
            newModuleId?.(moduleId);
            for(; i < end; i++){
                moduleId = chunkModules[i];
                moduleFactories.set(moduleId, moduleFactoryFn);
            }
        }
        i = end + 1; // end is pointing at the last factory advance to the next id or the end of the array.
    }
}
// everything below is adapted from webpack
// https://github.com/webpack/webpack/blob/6be4065ade1e252c1d8dcba4af0f43e32af1bdc1/lib/runtime/AsyncModuleRuntimeModule.js#L13
const turbopackQueues = Symbol('turbopack queues');
const turbopackExports = Symbol('turbopack exports');
const turbopackError = Symbol('turbopack error');
function resolveQueue(queue) {
    if (queue && queue.status !== 1) {
        queue.status = 1;
        queue.forEach((fn)=>fn.queueCount--);
        queue.forEach((fn)=>fn.queueCount-- ? fn.queueCount++ : fn());
    }
}
function wrapDeps(deps) {
    return deps.map((dep)=>{
        if (dep !== null && typeof dep === 'object') {
            if (isAsyncModuleExt(dep)) return dep;
            if (isPromise(dep)) {
                const queue = Object.assign([], {
                    status: 0
                });
                const obj = {
                    [turbopackExports]: {},
                    [turbopackQueues]: (fn)=>fn(queue)
                };
                dep.then((res)=>{
                    obj[turbopackExports] = res;
                    resolveQueue(queue);
                }, (err)=>{
                    obj[turbopackError] = err;
                    resolveQueue(queue);
                });
                return obj;
            }
        }
        return {
            [turbopackExports]: dep,
            [turbopackQueues]: ()=>{}
        };
    });
}
function asyncModule(body, hasAwait) {
    const module = this.m;
    const queue = hasAwait ? Object.assign([], {
        status: -1
    }) : undefined;
    const depQueues = new Set();
    const { resolve, reject, promise: rawPromise } = createPromise();
    const promise = Object.assign(rawPromise, {
        [turbopackExports]: module.exports,
        [turbopackQueues]: (fn)=>{
            queue && fn(queue);
            depQueues.forEach(fn);
            promise['catch'](()=>{});
        }
    });
    const attributes = {
        get () {
            return promise;
        },
        set (v) {
            // Calling `esmExport` leads to this.
            if (v !== promise) {
                promise[turbopackExports] = v;
            }
        }
    };
    Object.defineProperty(module, 'exports', attributes);
    Object.defineProperty(module, 'namespaceObject', attributes);
    function handleAsyncDependencies(deps) {
        const currentDeps = wrapDeps(deps);
        const getResult = ()=>currentDeps.map((d)=>{
                if (d[turbopackError]) throw d[turbopackError];
                return d[turbopackExports];
            });
        const { promise, resolve } = createPromise();
        const fn = Object.assign(()=>resolve(getResult), {
            queueCount: 0
        });
        function fnQueue(q) {
            if (q !== queue && !depQueues.has(q)) {
                depQueues.add(q);
                if (q && q.status === 0) {
                    fn.queueCount++;
                    q.push(fn);
                }
            }
        }
        currentDeps.map((dep)=>dep[turbopackQueues](fnQueue));
        return fn.queueCount ? promise : getResult();
    }
    function asyncResult(err) {
        if (err) {
            reject(promise[turbopackError] = err);
        } else {
            resolve(promise[turbopackExports]);
        }
        resolveQueue(queue);
    }
    body(handleAsyncDependencies, asyncResult);
    if (queue && queue.status === -1) {
        queue.status = 0;
    }
}
contextPrototype.a = asyncModule;
/**
 * A pseudo "fake" URL object to resolve to its relative path.
 *
 * When UrlRewriteBehavior is set to relative, calls to the `new URL()` will construct url without base using this
 * runtime function to generate context-agnostic urls between different rendering context, i.e ssr / client to avoid
 * hydration mismatch.
 *
 * This is based on webpack's existing implementation:
 * https://github.com/webpack/webpack/blob/87660921808566ef3b8796f8df61bd79fc026108/lib/runtime/RelativeUrlRuntimeModule.js
 */ const relativeURL = function relativeURL(inputUrl) {
    const realUrl = new URL(inputUrl, 'x:/');
    const values = {};
    for(const key in realUrl)values[key] = realUrl[key];
    values.href = inputUrl;
    values.pathname = inputUrl.replace(/[?#].*/, '');
    values.origin = values.protocol = '';
    values.toString = values.toJSON = (..._args)=>inputUrl;
    for(const key in values)Object.defineProperty(this, key, {
        enumerable: true,
        configurable: true,
        value: values[key]
    });
};
relativeURL.prototype = URL.prototype;
contextPrototype.U = relativeURL;
/**
 * Utility function to ensure all variants of an enum are handled.
 */ function invariant(never, computeMessage) {
    throw new Error(`Invariant: ${computeMessage(never)}`);
}
/**
 * A stub function to make `require` available but non-functional in ESM.
 */ function requireStub(_moduleId) {
    throw new Error('dynamic usage of require is not supported');
}
contextPrototype.z = requireStub;
// Make `globalThis` available to the module in a way that cannot be shadowed by a local variable.
contextPrototype.g = globalThis;
function applyModuleFactoryName(factory) {
    // Give the module factory a nice name to improve stack traces.
    Object.defineProperty(factory, 'name', {
        value: 'module evaluation'
    });
}
/// <reference path="../shared/runtime-utils.ts" />
/// A 'base' utilities to support runtime can have externals.
/// Currently this is for node.js / edge runtime both.
/// If a fn requires node.js specific behavior, it should be placed in `node-external-utils` instead.
async function externalImport(id) {
    let raw;
    try {
        switch (id) {
  case "next/dist/compiled/@vercel/og/index.node.js":
    raw = await import("next/dist/compiled/@vercel/og/index.edge.js");
    break;
  default:
    raw = await import(id);
};
    } catch (err) {
        // TODO(alexkirsz) This can happen when a client-side module tries to load
        // an external module we don't provide a shim for (e.g. querystring, url).
        // For now, we fail semi-silently, but in the future this should be a
        // compilation error.
        throw new Error(`Failed to load external module ${id}: ${err}`);
    }
    if (raw && raw.__esModule && raw.default && 'default' in raw.default) {
        return interopEsm(raw.default, createNS(raw), true);
    }
    return raw;
}
contextPrototype.y = externalImport;
function externalRequire(id, thunk, esm = false) {
    let raw;
    try {
        raw = thunk();
    } catch (err) {
        // TODO(alexkirsz) This can happen when a client-side module tries to load
        // an external module we don't provide a shim for (e.g. querystring, url).
        // For now, we fail semi-silently, but in the future this should be a
        // compilation error.
        throw new Error(`Failed to load external module ${id}: ${err}`);
    }
    if (!esm || raw.__esModule) {
        return raw;
    }
    return interopEsm(raw, createNS(raw), true);
}
externalRequire.resolve = (id, options)=>{
    return require.resolve(id, options);
};
contextPrototype.x = externalRequire;
/* eslint-disable @typescript-eslint/no-unused-vars */ const path = require('path');
const relativePathToRuntimeRoot = path.relative(RUNTIME_PUBLIC_PATH, '.');
// Compute the relative path to the `distDir`.
const relativePathToDistRoot = path.join(relativePathToRuntimeRoot, RELATIVE_ROOT_PATH);
const RUNTIME_ROOT = path.resolve(__filename, relativePathToRuntimeRoot);
// Compute the absolute path to the root, by stripping distDir from the absolute path to this file.
const ABSOLUTE_ROOT = path.resolve(__filename, relativePathToDistRoot);
/**
 * Returns an absolute path to the given module path.
 * Module path should be relative, either path to a file or a directory.
 *
 * This fn allows to calculate an absolute path for some global static values, such as
 * `__dirname` or `import.meta.url` that Turbopack will not embeds in compile time.
 * See ImportMetaBinding::code_generation for the usage.
 */ function resolveAbsolutePath(modulePath) {
    if (modulePath) {
        return path.join(ABSOLUTE_ROOT, modulePath);
    }
    return ABSOLUTE_ROOT;
}
Context.prototype.P = resolveAbsolutePath;
/* eslint-disable @typescript-eslint/no-unused-vars */ /// <reference path="../shared/runtime-utils.ts" />
function readWebAssemblyAsResponse(path) {
    const { createReadStream } = require('fs');
    const { Readable } = require('stream');
    const stream = createReadStream(path);
    // @ts-ignore unfortunately there's a slight type mismatch with the stream.
    return new Response(Readable.toWeb(stream), {
        headers: {
            'content-type': 'application/wasm'
        }
    });
}
async function compileWebAssemblyFromPath(path) {
    const response = readWebAssemblyAsResponse(path);
    return await WebAssembly.compileStreaming(response);
}
async function instantiateWebAssemblyFromPath(path, importsObj) {
    const response = readWebAssemblyAsResponse(path);
    const { instance } = await WebAssembly.instantiateStreaming(response, importsObj);
    return instance.exports;
}
/* eslint-disable @typescript-eslint/no-unused-vars */ /// <reference path="../shared/runtime-utils.ts" />
/// <reference path="../shared-node/base-externals-utils.ts" />
/// <reference path="../shared-node/node-externals-utils.ts" />
/// <reference path="../shared-node/node-wasm-utils.ts" />
var SourceType = /*#__PURE__*/ function(SourceType) {
    /**
   * The module was instantiated because it was included in an evaluated chunk's
   * runtime.
   * SourceData is a ChunkPath.
   */ SourceType[SourceType["Runtime"] = 0] = "Runtime";
    /**
   * The module was instantiated because a parent module imported it.
   * SourceData is a ModuleId.
   */ SourceType[SourceType["Parent"] = 1] = "Parent";
    return SourceType;
}(SourceType || {});
process.env.TURBOPACK = '1';
const nodeContextPrototype = Context.prototype;
const url = require('url');
const moduleFactories = new Map();
nodeContextPrototype.M = moduleFactories;
const moduleCache = Object.create(null);
nodeContextPrototype.c = moduleCache;
/**
 * Returns an absolute path to the given module's id.
 */ function resolvePathFromModule(moduleId) {
    const exported = this.r(moduleId);
    const exportedPath = exported?.default ?? exported;
    if (typeof exportedPath !== 'string') {
        return exported;
    }
    const strippedAssetPrefix = exportedPath.slice(ASSET_PREFIX.length);
    const resolved = path.resolve(RUNTIME_ROOT, strippedAssetPrefix);
    return url.pathToFileURL(resolved).href;
}
nodeContextPrototype.R = resolvePathFromModule;
function loadRuntimeChunk(sourcePath, chunkData) {
    if (typeof chunkData === 'string') {
        loadRuntimeChunkPath(sourcePath, chunkData);
    } else {
        loadRuntimeChunkPath(sourcePath, chunkData.path);
    }
}
const loadedChunks = new Set();
const unsupportedLoadChunk = Promise.resolve(undefined);
const loadedChunk = Promise.resolve(undefined);
const chunkCache = new Map();
function clearChunkCache() {
    chunkCache.clear();
}
function loadRuntimeChunkPath(sourcePath, chunkPath) {
    if (!isJs(chunkPath)) {
        // We only support loading JS chunks in Node.js.
        // This branch can be hit when trying to load a CSS chunk.
        return;
    }
    if (loadedChunks.has(chunkPath)) {
        return;
    }
    try {
        const resolved = path.resolve(RUNTIME_ROOT, chunkPath);
        const chunkModules = requireChunk(chunkPath);
        installCompressedModuleFactories(chunkModules, 0, moduleFactories);
        loadedChunks.add(chunkPath);
    } catch (cause) {
        let errorMessage = `Failed to load chunk ${chunkPath}`;
        if (sourcePath) {
            errorMessage += ` from runtime for chunk ${sourcePath}`;
        }
        const error = new Error(errorMessage, {
            cause
        });
        error.name = 'ChunkLoadError';
        throw error;
    }
}
function loadChunkAsync(chunkData) {
    const chunkPath = typeof chunkData === 'string' ? chunkData : chunkData.path;
    if (!isJs(chunkPath)) {
        // We only support loading JS chunks in Node.js.
        // This branch can be hit when trying to load a CSS chunk.
        return unsupportedLoadChunk;
    }
    let entry = chunkCache.get(chunkPath);
    if (entry === undefined) {
        try {
            // resolve to an absolute path to simplify `require` handling
            const resolved = path.resolve(RUNTIME_ROOT, chunkPath);
            // TODO: consider switching to `import()` to enable concurrent chunk loading and async file io
            // However this is incompatible with hot reloading (since `import` doesn't use the require cache)
            const chunkModules = requireChunk(chunkPath);
            installCompressedModuleFactories(chunkModules, 0, moduleFactories);
            entry = loadedChunk;
        } catch (cause) {
            const errorMessage = `Failed to load chunk ${chunkPath} from module ${this.m.id}`;
            const error = new Error(errorMessage, {
                cause
            });
            error.name = 'ChunkLoadError';
            // Cache the failure promise, future requests will also get this same rejection
            entry = Promise.reject(error);
        }
        chunkCache.set(chunkPath, entry);
    }
    // TODO: Return an instrumented Promise that React can use instead of relying on referential equality.
    return entry;
}
contextPrototype.l = loadChunkAsync;
function loadChunkAsyncByUrl(chunkUrl) {
    const path1 = url.fileURLToPath(new URL(chunkUrl, RUNTIME_ROOT));
    return loadChunkAsync.call(this, path1);
}
contextPrototype.L = loadChunkAsyncByUrl;
async function loadWebAssembly(chunkPath, _edgeModule, imports) {
  const mod = await loadWasmChunk(chunkPath);
  const { exports } = await WebAssembly.instantiate(mod, imports);
  return exports;
}
contextPrototype.w = loadWebAssembly;
function loadWebAssemblyModule(chunkPath, _edgeModule) {
  return loadWasmChunk(chunkPath);
}
contextPrototype.u = loadWebAssemblyModule;
function getWorkerBlobURL(_chunks) {
    throw new Error('Worker blobs are not implemented yet for Node.js');
}
nodeContextPrototype.b = getWorkerBlobURL;
function instantiateModule(id, sourceType, sourceData) {
    const moduleFactory = moduleFactories.get(id);
    if (typeof moduleFactory !== 'function') {
        // This can happen if modules incorrectly handle HMR disposes/updates,
        // e.g. when they keep a `setTimeout` around which still executes old code
        // and contains e.g. a `require("something")` call.
        let instantiationReason;
        switch(sourceType){
            case 0:
                instantiationReason = `as a runtime entry of chunk ${sourceData}`;
                break;
            case 1:
                instantiationReason = `because it was required from module ${sourceData}`;
                break;
            default:
                invariant(sourceType, (sourceType)=>`Unknown source type: ${sourceType}`);
        }
        throw new Error(`Module ${id} was instantiated ${instantiationReason}, but the module factory is not available.`);
    }
    const module1 = createModuleObject(id);
    const exports = module1.exports;
    moduleCache[id] = module1;
    const context = new Context(module1, exports);
    // NOTE(alexkirsz) This can fail when the module encounters a runtime error.
    try {
        moduleFactory(context, module1, exports);
    } catch (error) {
        module1.error = error;
        throw error;
    }
    module1.loaded = true;
    if (module1.namespaceObject && module1.exports !== module1.namespaceObject) {
        // in case of a circular dependency: cjs1 -> esm2 -> cjs1
        interopEsm(module1.exports, module1.namespaceObject);
    }
    return module1;
}
/**
 * Retrieves a module from the cache, or instantiate it if it is not cached.
 */ // @ts-ignore
function getOrInstantiateModuleFromParent(id, sourceModule) {
    const module1 = moduleCache[id];
    if (module1) {
        if (module1.error) {
            throw module1.error;
        }
        return module1;
    }
    return instantiateModule(id, 1, sourceModule.id);
}
/**
 * Instantiates a runtime module.
 */ function instantiateRuntimeModule(chunkPath, moduleId) {
    return instantiateModule(moduleId, 0, chunkPath);
}
/**
 * Retrieves a module from the cache, or instantiate it as a runtime module if it is not cached.
 */ // @ts-ignore TypeScript doesn't separate this module space from the browser runtime
function getOrInstantiateRuntimeModule(chunkPath, moduleId) {
    const module1 = moduleCache[moduleId];
    if (module1) {
        if (module1.error) {
            throw module1.error;
        }
        return module1;
    }
    return instantiateRuntimeModule(chunkPath, moduleId);
}
const regexJsUrl = /\.js(?:\?[^#]*)?(?:#.*)?$/;
/**
 * Checks if a given path/URL ends with .js, optionally followed by ?query or #fragment.
 */ function isJs(chunkUrlOrPath) {
    return regexJsUrl.test(chunkUrlOrPath);
}
module.exports = (sourcePath)=>({
        m: (id)=>getOrInstantiateRuntimeModule(sourcePath, id),
        c: (chunkData)=>loadRuntimeChunk(sourcePath, chunkData)
    });


//# sourceMappingURL=%5Bturbopack%5D_runtime.js.map

  function requireChunk(chunkPath) {
    switch(chunkPath) {
      case "server/chunks/[turbopack]_runtime.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/[turbopack]_runtime.js");
      case "server/chunks/src_instrumentation_ts_18ea1a8f._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/src_instrumentation_ts_18ea1a8f._.js");
      case "server/chunks/[externals]_next_dist_db0236a7._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/[externals]_next_dist_db0236a7._.js");
      case "server/chunks/[root-of-the-server]__da755d89._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__da755d89._.js");
      case "server/chunks/ssr/[root-of-the-server]__3c58cd61._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/[root-of-the-server]__3c58cd61._.js");
      case "server/chunks/ssr/[root-of-the-server]__7cf10b92._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/[root-of-the-server]__7cf10b92._.js");
      case "server/chunks/ssr/[root-of-the-server]__e683c88a._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/[root-of-the-server]__e683c88a._.js");
      case "server/chunks/ssr/[root-of-the-server]__fa3cad48._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/[root-of-the-server]__fa3cad48._.js");
      case "server/chunks/ssr/[turbopack]_runtime.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/[turbopack]_runtime.js");
      case "server/chunks/ssr/_61b58078._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/_61b58078._.js");
      case "server/chunks/ssr/_81860dfa._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/_81860dfa._.js");
      case "server/chunks/ssr/_f862241d._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/_f862241d._.js");
      case "server/chunks/ssr/_next-internal_server_app__not-found_page_actions_554ec2bf.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/_next-internal_server_app__not-found_page_actions_554ec2bf.js");
      case "server/chunks/ssr/node_modules_framer-motion_dist_es_render_components_motion_proxy_mjs_b72b0714._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/node_modules_framer-motion_dist_es_render_components_motion_proxy_mjs_b72b0714._.js");
      case "server/chunks/ssr/node_modules_next_dist_174ae28d._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/node_modules_next_dist_174ae28d._.js");
      case "server/chunks/ssr/node_modules_next_dist_2e5d1b2c._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/node_modules_next_dist_2e5d1b2c._.js");
      case "server/chunks/ssr/node_modules_next_dist_4b9a0874._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/node_modules_next_dist_4b9a0874._.js");
      case "server/chunks/ssr/node_modules_next_dist_61a87db9._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/node_modules_next_dist_61a87db9._.js");
      case "server/chunks/ssr/node_modules_next_dist_client_components_2fffaa3a._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/node_modules_next_dist_client_components_2fffaa3a._.js");
      case "server/chunks/ssr/node_modules_next_dist_esm_build_templates_app-page_3941aac0.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/node_modules_next_dist_esm_build_templates_app-page_3941aac0.js");
      case "server/chunks/ssr/node_modules_next_dist_esm_eedfc1fd._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/node_modules_next_dist_esm_eedfc1fd._.js");
      case "server/chunks/ssr/node_modules_next_dist_shared_lib_9df7a042._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/node_modules_next_dist_shared_lib_9df7a042._.js");
      case "server/chunks/ssr/node_modules_sonner_dist_index_mjs_1addfdea._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/node_modules_sonner_dist_index_mjs_1addfdea._.js");
      case "server/chunks/ssr/src_app_loading_tsx_7fa31b7f._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/src_app_loading_tsx_7fa31b7f._.js");
      case "server/chunks/ssr/src_lib_streak-tracker_ts_fff81be2._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/src_lib_streak-tracker_ts_fff81be2._.js");
      case "server/chunks/ssr/[root-of-the-server]__3f8add5b._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/[root-of-the-server]__3f8add5b._.js");
      case "server/chunks/ssr/[root-of-the-server]__b9356576._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/[root-of-the-server]__b9356576._.js");
      case "server/chunks/ssr/_next-internal_server_app__global-error_page_actions_75761787.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/_next-internal_server_app__global-error_page_actions_75761787.js");
      case "server/chunks/ssr/node_modules_next_dist_08570d7f._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/node_modules_next_dist_08570d7f._.js");
      case "server/chunks/ssr/[root-of-the-server]__6b778474._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/[root-of-the-server]__6b778474._.js");
      case "server/chunks/ssr/[root-of-the-server]__826e1691._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/[root-of-the-server]__826e1691._.js");
      case "server/chunks/ssr/[root-of-the-server]__f27fbcfb._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/[root-of-the-server]__f27fbcfb._.js");
      case "server/chunks/ssr/_7eabe576._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/_7eabe576._.js");
      case "server/chunks/ssr/_d7f5f9bd._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/_d7f5f9bd._.js");
      case "server/chunks/ssr/_next-internal_server_app_about_page_actions_6fff35e4.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/_next-internal_server_app_about_page_actions_6fff35e4.js");
      case "server/chunks/ssr/node_modules_next_86789c40._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/node_modules_next_86789c40._.js");
      case "server/chunks/ssr/node_modules_next_dist_7990385d._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/node_modules_next_dist_7990385d._.js");
      case "server/chunks/ssr/node_modules_next_dist_client_components_builtin_global-error_ece394eb.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/node_modules_next_dist_client_components_builtin_global-error_ece394eb.js");
      case "server/chunks/ssr/node_modules_next_dist_client_components_builtin_unauthorized_15817684.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/node_modules_next_dist_client_components_builtin_unauthorized_15817684.js");
      case "server/chunks/ssr/src_app_about_page_tsx_7012f683._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/src_app_about_page_tsx_7012f683._.js");
      case "server/chunks/ssr/[root-of-the-server]__37946083._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/[root-of-the-server]__37946083._.js");
      case "server/chunks/ssr/[root-of-the-server]__5a935176._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/[root-of-the-server]__5a935176._.js");
      case "server/chunks/ssr/_ac0a1f1d._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/_ac0a1f1d._.js");
      case "server/chunks/ssr/_next-internal_server_app_admin-dashboard-secret_page_actions_0e10be93.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/_next-internal_server_app_admin-dashboard-secret_page_actions_0e10be93.js");
      case "server/chunks/ssr/node_modules_next_dist_da6b475a._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/node_modules_next_dist_da6b475a._.js");
      case "server/chunks/ssr/node_modules_next_f2865b38._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/node_modules_next_f2865b38._.js");
      case "server/chunks/ssr/src_app_admin-dashboard-secret_page_tsx_88b74806._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/src_app_admin-dashboard-secret_page_tsx_88b74806._.js");
      case "server/chunks/ssr/[root-of-the-server]__43a6a3c5._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/[root-of-the-server]__43a6a3c5._.js");
      case "server/chunks/ssr/[root-of-the-server]__4608d236._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/[root-of-the-server]__4608d236._.js");
      case "server/chunks/ssr/_b6b16886._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/_b6b16886._.js");
      case "server/chunks/ssr/_d066e745._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/_d066e745._.js");
      case "server/chunks/ssr/_next-internal_server_app_admin-email_page_actions_93504466.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/_next-internal_server_app_admin-email_page_actions_93504466.js");
      case "server/chunks/ssr/node_modules_b2313611._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/node_modules_b2313611._.js");
      case "server/chunks/ssr/node_modules_f4b880de._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/node_modules_f4b880de._.js");
      case "server/chunks/ssr/src_app_admin-email_page_tsx_0d980a3d._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/src_app_admin-email_page_tsx_0d980a3d._.js");
      case "server/chunks/ssr/[root-of-the-server]__bfe4ac94._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/[root-of-the-server]__bfe4ac94._.js");
      case "server/chunks/ssr/_53cdc8fc._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/_53cdc8fc._.js");
      case "server/chunks/ssr/_next-internal_server_app_admin-panel_page_actions_5484fd27.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/_next-internal_server_app_admin-panel_page_actions_5484fd27.js");
      case "server/chunks/ssr/node_modules_next_dist_023b6025._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/node_modules_next_dist_023b6025._.js");
      case "server/chunks/ssr/[root-of-the-server]__3913eb56._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/[root-of-the-server]__3913eb56._.js");
      case "server/chunks/ssr/[root-of-the-server]__73f532ef._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/[root-of-the-server]__73f532ef._.js");
      case "server/chunks/ssr/_793f54d6._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/_793f54d6._.js");
      case "server/chunks/ssr/_b4c8ffca._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/_b4c8ffca._.js");
      case "server/chunks/ssr/_next-internal_server_app_admin-secret_page_actions_bd52fccf.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/_next-internal_server_app_admin-secret_page_actions_bd52fccf.js");
      case "server/chunks/ssr/src_app_admin-secret_page_tsx_68022dc5._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/src_app_admin-secret_page_tsx_68022dc5._.js");
      case "server/chunks/ssr/[root-of-the-server]__77f4be6e._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/[root-of-the-server]__77f4be6e._.js");
      case "server/chunks/ssr/[root-of-the-server]__94c8be29._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/[root-of-the-server]__94c8be29._.js");
      case "server/chunks/ssr/_3cda1652._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/_3cda1652._.js");
      case "server/chunks/ssr/_next-internal_server_app_admin-secure_page_actions_32c07210.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/_next-internal_server_app_admin-secure_page_actions_32c07210.js");
      case "server/chunks/ssr/src_app_admin-secure_page_tsx_663e3aa2._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/src_app_admin-secure_page_tsx_663e3aa2._.js");
      case "server/chunks/ssr/[root-of-the-server]__e2b182fb._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/[root-of-the-server]__e2b182fb._.js");
      case "server/chunks/ssr/_045231ba._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/_045231ba._.js");
      case "server/chunks/ssr/_46fa2782._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/_46fa2782._.js");
      case "server/chunks/ssr/_bfcdf9a7._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/_bfcdf9a7._.js");
      case "server/chunks/ssr/_e5a5440a._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/_e5a5440a._.js");
      case "server/chunks/ssr/_next-internal_server_app_admin-subscriptions_page_actions_b8cc4235.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/_next-internal_server_app_admin-subscriptions_page_actions_b8cc4235.js");
      case "server/chunks/ssr/node_modules_@radix-ui_react-popper_dist_index_mjs_0d6fc757._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/node_modules_@radix-ui_react-popper_dist_index_mjs_0d6fc757._.js");
      case "server/chunks/ssr/node_modules_f45c9d77._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/node_modules_f45c9d77._.js");
      case "server/chunks/ssr/src_app_admin-subscriptions_page_tsx_40ed296f._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/src_app_admin-subscriptions_page_tsx_40ed296f._.js");
      case "server/chunks/ssr/src_components_ui_select_tsx_4c0f64d8._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/src_components_ui_select_tsx_4c0f64d8._.js");
      case "server/chunks/ssr/[root-of-the-server]__7935b03c._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/[root-of-the-server]__7935b03c._.js");
      case "server/chunks/ssr/[root-of-the-server]__a26eb3a9._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/[root-of-the-server]__a26eb3a9._.js");
      case "server/chunks/ssr/[root-of-the-server]__a4447530._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/[root-of-the-server]__a4447530._.js");
      case "server/chunks/ssr/_a3bc8430._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/_a3bc8430._.js");
      case "server/chunks/ssr/_cc0905cd._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/_cc0905cd._.js");
      case "server/chunks/ssr/_next-internal_server_app_affiliate_page_actions_bda5fb01.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/_next-internal_server_app_affiliate_page_actions_bda5fb01.js");
      case "server/chunks/[root-of-the-server]__23c42034._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__23c42034._.js");
      case "server/chunks/[root-of-the-server]__f408c708._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__f408c708._.js");
      case "server/chunks/_54566c02._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/_54566c02._.js");
      case "server/chunks/_next-internal_server_app_api_achievements_onboarding_route_actions_cf1c2d13.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_achievements_onboarding_route_actions_cf1c2d13.js");
      case "server/chunks/node_modules_@supabase_ssr_3239988b._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/node_modules_@supabase_ssr_3239988b._.js");
      case "server/chunks/node_modules_@supabase_supabase-js_dist_index_mjs_669a44bf._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/node_modules_@supabase_supabase-js_dist_index_mjs_669a44bf._.js");
      case "server/chunks/[root-of-the-server]__0d747054._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__0d747054._.js");
      case "server/chunks/[root-of-the-server]__bd001b0d._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__bd001b0d._.js");
      case "server/chunks/_next-internal_server_app_api_admin_affiliate-withdrawals_route_actions_f6ea684b.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_admin_affiliate-withdrawals_route_actions_f6ea684b.js");
      case "server/chunks/[root-of-the-server]__ec564f8a._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__ec564f8a._.js");
      case "server/chunks/_next-internal_server_app_api_admin_affiliates_route_actions_d9f2e95c.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_admin_affiliates_route_actions_d9f2e95c.js");
      case "server/chunks/[root-of-the-server]__fdb06d21._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__fdb06d21._.js");
      case "server/chunks/_next-internal_server_app_api_admin_auto-update-email_route_actions_fd4433f7.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_admin_auto-update-email_route_actions_fd4433f7.js");
      case "server/chunks/node_modules_9f27c91d._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/node_modules_9f27c91d._.js");
      case "server/chunks/node_modules_next_dist_esm_build_templates_app-route_9aa93c4e.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/node_modules_next_dist_esm_build_templates_app-route_9aa93c4e.js");
      case "server/chunks/src_lib_644623fa._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/src_lib_644623fa._.js");
      case "server/chunks/src_lib_email_ts_798d0278._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/src_lib_email_ts_798d0278._.js");
      case "server/chunks/[root-of-the-server]__cb3b1611._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__cb3b1611._.js");
      case "server/chunks/_next-internal_server_app_api_admin_email-broadcast_route_actions_c5b11fdc.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_admin_email-broadcast_route_actions_c5b11fdc.js");
      case "server/chunks/[root-of-the-server]__16cba1d3._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__16cba1d3._.js");
      case "server/chunks/_next-internal_server_app_api_admin_email-stats_route_actions_1fe8c6bf.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_admin_email-stats_route_actions_1fe8c6bf.js");
      case "server/chunks/[root-of-the-server]__b36f2bf4._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__b36f2bf4._.js");
      case "server/chunks/_next-internal_server_app_api_admin_plans_[id]_route_actions_3d8f532b.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_admin_plans_[id]_route_actions_3d8f532b.js");
      case "server/chunks/[root-of-the-server]__606cae6f._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__606cae6f._.js");
      case "server/chunks/_next-internal_server_app_api_admin_plans_route_actions_a2c5e9d9.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_admin_plans_route_actions_a2c5e9d9.js");
      case "server/chunks/[root-of-the-server]__f3201f1f._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__f3201f1f._.js");
      case "server/chunks/_next-internal_server_app_api_admin_pro-promo-log_route_actions_01297b22.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_admin_pro-promo-log_route_actions_01297b22.js");
      case "server/chunks/node_modules_next_dist_esm_build_templates_app-route_5669c1da.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/node_modules_next_dist_esm_build_templates_app-route_5669c1da.js");
      case "server/chunks/[root-of-the-server]__57a8c364._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__57a8c364._.js");
      case "server/chunks/_next-internal_server_app_api_admin_search-user_route_actions_a5c3a93a.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_admin_search-user_route_actions_a5c3a93a.js");
      case "server/chunks/[root-of-the-server]__202b10ac._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__202b10ac._.js");
      case "server/chunks/_next-internal_server_app_api_admin_setup_route_actions_2623bd0f.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_admin_setup_route_actions_2623bd0f.js");
      case "server/chunks/[root-of-the-server]__8e6b05c4._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__8e6b05c4._.js");
      case "server/chunks/_next-internal_server_app_api_admin_social-links_[id]_route_actions_875c5113.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_admin_social-links_[id]_route_actions_875c5113.js");
      case "server/chunks/[root-of-the-server]__9868bd04._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__9868bd04._.js");
      case "server/chunks/_next-internal_server_app_api_admin_social-links_route_actions_a56f5dc2.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_admin_social-links_route_actions_a56f5dc2.js");
      case "server/chunks/[root-of-the-server]__f11504ee._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__f11504ee._.js");
      case "server/chunks/ce889_server_app_api_admin_subscriptions_[id]_activate_route_actions_94eec6fa.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ce889_server_app_api_admin_subscriptions_[id]_activate_route_actions_94eec6fa.js");
      case "server/chunks/node_modules_next_dist_esm_build_templates_app-route_f43a9baf.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/node_modules_next_dist_esm_build_templates_app-route_f43a9baf.js");
      case "server/chunks/[root-of-the-server]__468942b1._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__468942b1._.js");
      case "server/chunks/ce889_server_app_api_admin_subscriptions_[id]_deactivate_route_actions_4d52f009.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ce889_server_app_api_admin_subscriptions_[id]_deactivate_route_actions_4d52f009.js");
      case "server/chunks/[root-of-the-server]__81edde38._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__81edde38._.js");
      case "server/chunks/_next-internal_server_app_api_admin_subscriptions_[id]_route_actions_b8d98685.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_admin_subscriptions_[id]_route_actions_b8d98685.js");
      case "server/chunks/[root-of-the-server]__5747b2b2._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__5747b2b2._.js");
      case "server/chunks/_next-internal_server_app_api_admin_subscriptions_route_actions_86fc36f4.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_admin_subscriptions_route_actions_86fc36f4.js");
      case "server/chunks/[root-of-the-server]__32596ec1._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__32596ec1._.js");
      case "server/chunks/_next-internal_server_app_api_admin_sync-auth-users_route_actions_6b8f7b42.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_admin_sync-auth-users_route_actions_6b8f7b42.js");
      case "server/chunks/[root-of-the-server]__e014892b._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__e014892b._.js");
      case "server/chunks/_next-internal_server_app_api_admin_sync-users_route_actions_043700db.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_admin_sync-users_route_actions_043700db.js");
      case "server/chunks/[root-of-the-server]__7a372289._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__7a372289._.js");
      case "server/chunks/_next-internal_server_app_api_admin_users_[id]_route_actions_b7a31f56.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_admin_users_[id]_route_actions_b7a31f56.js");
      case "server/chunks/[root-of-the-server]__5d353bfe._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__5d353bfe._.js");
      case "server/chunks/_next-internal_server_app_api_admin_users_route_actions_595e9dd9.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_admin_users_route_actions_595e9dd9.js");
      case "server/chunks/node_modules_next_dist_esm_build_templates_app-route_607241d4.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/node_modules_next_dist_esm_build_templates_app-route_607241d4.js");
      case "server/chunks/[root-of-the-server]__66de5859._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__66de5859._.js");
      case "server/chunks/_next-internal_server_app_api_admin_withdrawals_route_actions_c197b684.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_admin_withdrawals_route_actions_c197b684.js");
      case "server/chunks/[root-of-the-server]__63a2712f._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__63a2712f._.js");
      case "server/chunks/_next-internal_server_app_api_affiliate_me_route_actions_24f14733.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_affiliate_me_route_actions_24f14733.js");
      case "server/chunks/[root-of-the-server]__3bfb0de1._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__3bfb0de1._.js");
      case "server/chunks/_next-internal_server_app_api_affiliate_referrals_route_actions_97da033e.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_affiliate_referrals_route_actions_97da033e.js");
      case "server/chunks/[root-of-the-server]__48f0ac69._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__48f0ac69._.js");
      case "server/chunks/_next-internal_server_app_api_affiliate_update-code_route_actions_aef292ec.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_affiliate_update-code_route_actions_aef292ec.js");
      case "server/chunks/[root-of-the-server]__c3423ebc._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__c3423ebc._.js");
      case "server/chunks/_next-internal_server_app_api_affiliate_withdraw_route_actions_27525965.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_affiliate_withdraw_route_actions_27525965.js");
      case "server/chunks/[root-of-the-server]__56da50de._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__56da50de._.js");
      case "server/chunks/_next-internal_server_app_api_ai_analyze-trade_route_actions_8a8ba3f2.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_ai_analyze-trade_route_actions_8a8ba3f2.js");
      case "server/chunks/[root-of-the-server]__1043fef5._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__1043fef5._.js");
      case "server/chunks/_next-internal_server_app_api_ai_chat_route_actions_43cdb436.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_ai_chat_route_actions_43cdb436.js");
      case "server/chunks/[root-of-the-server]__8e3c7440._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__8e3c7440._.js");
      case "server/chunks/_next-internal_server_app_api_ai_generate-image_route_actions_c85feafc.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_ai_generate-image_route_actions_c85feafc.js");
      case "server/chunks/[root-of-the-server]__8f1b52db._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__8f1b52db._.js");
      case "server/chunks/_next-internal_server_app_api_ai_recommendations_route_actions_e3db0ef7.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_ai_recommendations_route_actions_e3db0ef7.js");
      case "server/chunks/node_modules_next_dist_esm_build_templates_app-route_80f0ba25.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/node_modules_next_dist_esm_build_templates_app-route_80f0ba25.js");
      case "server/chunks/_next-internal_server_app_api_ai_route_actions_9ece58bc.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_ai_route_actions_9ece58bc.js");
      case "server/chunks/node_modules_next_dist_esm_build_templates_app-route_c8ae160e.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/node_modules_next_dist_esm_build_templates_app-route_c8ae160e.js");
      case "server/chunks/[root-of-the-server]__7a37f892._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__7a37f892._.js");
      case "server/chunks/_next-internal_server_app_api_ai_search_route_actions_6f61a239.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_ai_search_route_actions_6f61a239.js");
      case "server/chunks/[root-of-the-server]__15f4acec._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__15f4acec._.js");
      case "server/chunks/_next-internal_server_app_api_ai_tts_route_actions_1b4bb143.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_ai_tts_route_actions_1b4bb143.js");
      case "server/chunks/[root-of-the-server]__92b2b2a8._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__92b2b2a8._.js");
      case "server/chunks/_next-internal_server_app_api_ai_vlm_route_actions_dd38db49.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_ai_vlm_route_actions_dd38db49.js");
      case "server/chunks/[root-of-the-server]__05691846._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__05691846._.js");
      case "server/chunks/_next-internal_server_app_api_analytics_route_actions_ac389de2.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_analytics_route_actions_ac389de2.js");
      case "server/chunks/node_modules_next_dist_esm_build_templates_app-route_5f74e936.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/node_modules_next_dist_esm_build_templates_app-route_5f74e936.js");
      case "server/chunks/[root-of-the-server]__858de5e0._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__858de5e0._.js");
      case "server/chunks/_next-internal_server_app_api_auth_admin-login_route_actions_e2f05e65.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_auth_admin-login_route_actions_e2f05e65.js");
      case "server/chunks/[root-of-the-server]__6551e556._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__6551e556._.js");
      case "server/chunks/_next-internal_server_app_api_auth_check-verified_route_actions_f904d6d2.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_auth_check-verified_route_actions_f904d6d2.js");
      case "server/chunks/[root-of-the-server]__7764353c._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__7764353c._.js");
      case "server/chunks/_next-internal_server_app_api_auth_check-verify-status_route_actions_3e64aedd.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_auth_check-verify-status_route_actions_3e64aedd.js");
      case "server/chunks/[root-of-the-server]__5aeeaa0b._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__5aeeaa0b._.js");
      case "server/chunks/_next-internal_server_app_api_auth_ensure-profile_route_actions_b16db9a9.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_auth_ensure-profile_route_actions_b16db9a9.js");
      case "server/chunks/[root-of-the-server]__f0a6e3eb._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__f0a6e3eb._.js");
      case "server/chunks/_next-internal_server_app_api_auth_force-confirm_route_actions_dc447336.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_auth_force-confirm_route_actions_dc447336.js");
      case "server/chunks/[root-of-the-server]__345a272a._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__345a272a._.js");
      case "server/chunks/_next-internal_server_app_api_auth_register_route_actions_3564e727.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_auth_register_route_actions_3564e727.js");
      case "server/chunks/[root-of-the-server]__101ca6cd._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__101ca6cd._.js");
      case "server/chunks/_next-internal_server_app_api_auth_resend-verification_route_actions_700ce22c.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_auth_resend-verification_route_actions_700ce22c.js");
      case "server/chunks/[root-of-the-server]__24441972._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__24441972._.js");
      case "server/chunks/_next-internal_server_app_api_auth_reset-password-admin_route_actions_239acf8d.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_auth_reset-password-admin_route_actions_239acf8d.js");
      case "server/chunks/[root-of-the-server]__3d54425b._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__3d54425b._.js");
      case "server/chunks/_next-internal_server_app_api_auth_reset-password-public_route_actions_fa3f86f1.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_auth_reset-password-public_route_actions_fa3f86f1.js");
      case "server/chunks/[root-of-the-server]__eca59beb._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__eca59beb._.js");
      case "server/chunks/_next-internal_server_app_api_auth_send-confirmation_route_actions_fe4519d9.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_auth_send-confirmation_route_actions_fe4519d9.js");
      case "server/chunks/[root-of-the-server]__0cd6bfd7._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__0cd6bfd7._.js");
      case "server/chunks/_next-internal_server_app_api_auth_send-reset-password_route_actions_507a4722.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_auth_send-reset-password_route_actions_507a4722.js");
      case "server/chunks/[root-of-the-server]__fcc6cd94._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__fcc6cd94._.js");
      case "server/chunks/_next-internal_server_app_api_auth_signup_route_actions_3cc2654d.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_auth_signup_route_actions_3cc2654d.js");
      case "server/chunks/node_modules_next_dist_esm_build_templates_app-route_e2ef49e7.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/node_modules_next_dist_esm_build_templates_app-route_e2ef49e7.js");
      case "server/chunks/[root-of-the-server]__8c11139d._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__8c11139d._.js");
      case "server/chunks/_next-internal_server_app_api_auth_sync-profile_route_actions_66f3316a.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_auth_sync-profile_route_actions_66f3316a.js");
      case "server/chunks/[root-of-the-server]__6b8cc039._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__6b8cc039._.js");
      case "server/chunks/_next-internal_server_app_api_auth_sync-user_route_actions_12e24016.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_auth_sync-user_route_actions_12e24016.js");
      case "server/chunks/[root-of-the-server]__8acd0a45._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__8acd0a45._.js");
      case "server/chunks/_next-internal_server_app_api_auth_verify_route_actions_bc110aab.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_auth_verify_route_actions_bc110aab.js");
      case "server/chunks/[root-of-the-server]__385ce9c1._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__385ce9c1._.js");
      case "server/chunks/_next-internal_server_app_api_auth_verify-email_route_actions_c5f55e8f.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_auth_verify-email_route_actions_c5f55e8f.js");
      case "server/chunks/node_modules_next_dist_esm_build_templates_app-route_8cc478ba.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/node_modules_next_dist_esm_build_templates_app-route_8cc478ba.js");
      case "server/chunks/[root-of-the-server]__d50e045b._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__d50e045b._.js");
      case "server/chunks/_next-internal_server_app_api_auto-journal_debug_route_actions_827c1fd5.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_auto-journal_debug_route_actions_827c1fd5.js");
      case "server/chunks/src_lib_aiml-vision_ts_955b510c._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/src_lib_aiml-vision_ts_955b510c._.js");
      case "server/chunks/[root-of-the-server]__9fcb7c9b._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__9fcb7c9b._.js");
      case "server/chunks/_next-internal_server_app_api_auto-journal_route_actions_5da7ee94.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_auto-journal_route_actions_5da7ee94.js");
      case "server/chunks/node_modules_next_dist_esm_build_templates_app-route_3b2544a0.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/node_modules_next_dist_esm_build_templates_app-route_3b2544a0.js");
      case "server/chunks/[root-of-the-server]__edcdb1d6._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__edcdb1d6._.js");
      case "server/chunks/_next-internal_server_app_api_bugs_route_actions_d6634fe4.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_bugs_route_actions_d6634fe4.js");
      case "server/chunks/[root-of-the-server]__072fdba1._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__072fdba1._.js");
      case "server/chunks/_next-internal_server_app_api_community_leaderboard_route_actions_d485a10d.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_community_leaderboard_route_actions_d485a10d.js");
      case "server/chunks/[root-of-the-server]__181c6ad0._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__181c6ad0._.js");
      case "server/chunks/_next-internal_server_app_api_community_public-profile_route_actions_37f8d3a7.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_community_public-profile_route_actions_37f8d3a7.js");
      case "server/chunks/[root-of-the-server]__4e59f72a._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__4e59f72a._.js");
      case "server/chunks/_next-internal_server_app_api_community_share-trade_route_actions_c02454bd.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_community_share-trade_route_actions_c02454bd.js");
      case "server/chunks/[root-of-the-server]__8609fab9._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__8609fab9._.js");
      case "server/chunks/_next-internal_server_app_api_delete-account_route_actions_2c9f5e74.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_delete-account_route_actions_2c9f5e74.js");
      case "server/chunks/[root-of-the-server]__a143dca8._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__a143dca8._.js");
      case "server/chunks/_next-internal_server_app_api_equity-curve_route_actions_f47ee86d.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_equity-curve_route_actions_f47ee86d.js");
      case "server/chunks/[root-of-the-server]__c478d36d._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__c478d36d._.js");
      case "server/chunks/_next-internal_server_app_api_goals_route_actions_3a94876f.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_goals_route_actions_3a94876f.js");
      case "server/chunks/[root-of-the-server]__2fb0ef71._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__2fb0ef71._.js");
      case "server/chunks/_next-internal_server_app_api_health_route_actions_da3433c4.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_health_route_actions_da3433c4.js");
      case "server/chunks/_next-internal_server_app_api_journal_route_actions_ebf78a9c.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_journal_route_actions_ebf78a9c.js");
      case "server/chunks/node_modules_next_dist_esm_build_templates_app-route_54b7e7fa.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/node_modules_next_dist_esm_build_templates_app-route_54b7e7fa.js");
      case "server/chunks/[root-of-the-server]__2b4d7767._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__2b4d7767._.js");
      case "server/chunks/_next-internal_server_app_api_journal-entries_route_actions_71fc37dc.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_journal-entries_route_actions_71fc37dc.js");
      case "server/chunks/[root-of-the-server]__38bce55e._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__38bce55e._.js");
      case "server/chunks/_next-internal_server_app_api_landing-stats_route_actions_56747792.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_landing-stats_route_actions_56747792.js");
      case "server/chunks/[root-of-the-server]__3e91a96d._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__3e91a96d._.js");
      case "server/chunks/_next-internal_server_app_api_midtrans_create-transaction_route_actions_117135d4.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_midtrans_create-transaction_route_actions_117135d4.js");
      case "server/chunks/[root-of-the-server]__f94aa780._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__f94aa780._.js");
      case "server/chunks/ce889_server_app_api_midtrans_create-transaction-unverified_route_actions_78c4c0e8.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ce889_server_app_api_midtrans_create-transaction-unverified_route_actions_78c4c0e8.js");
      case "server/chunks/[root-of-the-server]__e77a419e._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__e77a419e._.js");
      case "server/chunks/_next-internal_server_app_api_midtrans_webhook_route_actions_75914cd3.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_midtrans_webhook_route_actions_75914cd3.js");
      case "server/chunks/[root-of-the-server]__01aece62._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__01aece62._.js");
      case "server/chunks/_next-internal_server_app_api_missions_claim_route_actions_e49696d9.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_missions_claim_route_actions_e49696d9.js");
      case "server/chunks/node_modules_next_dist_esm_build_templates_app-route_782f9953.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/node_modules_next_dist_esm_build_templates_app-route_782f9953.js");
      case "server/chunks/[externals]_next_dist_a6d89067._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/[externals]_next_dist_a6d89067._.js");
      case "server/chunks/_next-internal_server_app_api_news_route_actions_5b4368e1.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_news_route_actions_5b4368e1.js");
      case "server/chunks/node_modules_next_dist_esm_build_templates_app-route_40f601bd.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/node_modules_next_dist_esm_build_templates_app-route_40f601bd.js");
      case "server/chunks/[root-of-the-server]__44b709cd._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__44b709cd._.js");
      case "server/chunks/_next-internal_server_app_api_onboarding_route_actions_fbcdf9b4.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_onboarding_route_actions_fbcdf9b4.js");
      case "server/chunks/[root-of-the-server]__766cbfc1._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__766cbfc1._.js");
      case "server/chunks/_next-internal_server_app_api_pricing_route_actions_15721054.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_pricing_route_actions_15721054.js");
      case "server/chunks/[root-of-the-server]__6ba26008._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__6ba26008._.js");
      case "server/chunks/_next-internal_server_app_api_profile_me_route_actions_eecd12bd.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_profile_me_route_actions_eecd12bd.js");
      case "server/chunks/[root-of-the-server]__15ab7324._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__15ab7324._.js");
      case "server/chunks/_next-internal_server_app_api_promo_active_route_actions_c1ef8b84.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_promo_active_route_actions_c1ef8b84.js");
      case "server/chunks/[root-of-the-server]__50627208._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__50627208._.js");
      case "server/chunks/_next-internal_server_app_api_promo_apply_route_actions_6f250d19.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_promo_apply_route_actions_6f250d19.js");
      case "server/chunks/[root-of-the-server]__0f04ed93._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__0f04ed93._.js");
      case "server/chunks/_next-internal_server_app_api_promo_claim_route_actions_0c385f12.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_promo_claim_route_actions_0c385f12.js");
      case "server/chunks/[root-of-the-server]__167b4549._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__167b4549._.js");
      case "server/chunks/_next-internal_server_app_api_promo_create_route_actions_e6153ffc.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_promo_create_route_actions_e6153ffc.js");
      case "server/chunks/[root-of-the-server]__e06b828e._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__e06b828e._.js");
      case "server/chunks/_next-internal_server_app_api_promo_downgrade-expired_route_actions_0f0a54fd.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_promo_downgrade-expired_route_actions_0f0a54fd.js");
      case "server/chunks/[root-of-the-server]__be37fddc._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__be37fddc._.js");
      case "server/chunks/_next-internal_server_app_api_promo_validate_route_actions_64526466.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_promo_validate_route_actions_64526466.js");
      case "server/chunks/[root-of-the-server]__ca5190c7._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__ca5190c7._.js");
      case "server/chunks/_next-internal_server_app_api_reward_first-trade_route_actions_e947c034.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_reward_first-trade_route_actions_e947c034.js");
      case "server/chunks/[root-of-the-server]__26b4e8c9._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__26b4e8c9._.js");
      case "server/chunks/_next-internal_server_app_api_social-links_[id]_route_actions_058ad506.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_social-links_[id]_route_actions_058ad506.js");
      case "server/chunks/[root-of-the-server]__f537aaf8._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__f537aaf8._.js");
      case "server/chunks/_next-internal_server_app_api_social-links_route_actions_cb9bce1a.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_social-links_route_actions_cb9bce1a.js");
      case "server/chunks/[root-of-the-server]__74780c1c._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__74780c1c._.js");
      case "server/chunks/_next-internal_server_app_api_tags_route_actions_caf13f5f.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_tags_route_actions_caf13f5f.js");
      case "server/chunks/[root-of-the-server]__2a44f6dd._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__2a44f6dd._.js");
      case "server/chunks/_next-internal_server_app_api_todos_route_actions_7f61f60d.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_todos_route_actions_7f61f60d.js");
      case "server/chunks/[root-of-the-server]__2fa01769._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__2fa01769._.js");
      case "server/chunks/_next-internal_server_app_api_trade-upload_route_actions_cb7014fb.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_trade-upload_route_actions_cb7014fb.js");
      case "server/chunks/[root-of-the-server]__541d77b3._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__541d77b3._.js");
      case "server/chunks/_next-internal_server_app_api_trades_route_actions_8c92768e.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_trades_route_actions_8c92768e.js");
      case "server/chunks/node_modules_next_dist_esm_build_templates_app-route_cd67e8d7.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/node_modules_next_dist_esm_build_templates_app-route_cd67e8d7.js");
      case "server/chunks/[root-of-the-server]__1d1c1508._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__1d1c1508._.js");
      case "server/chunks/_next-internal_server_app_api_trading-accounts_[id]_route_actions_9b1f7707.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_trading-accounts_[id]_route_actions_9b1f7707.js");
      case "server/chunks/[root-of-the-server]__b0f0893d._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__b0f0893d._.js");
      case "server/chunks/ce889_server_app_api_trading-accounts_ensure-default_route_actions_4193f9ba.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ce889_server_app_api_trading-accounts_ensure-default_route_actions_4193f9ba.js");
      case "server/chunks/[root-of-the-server]__7883d241._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__7883d241._.js");
      case "server/chunks/_next-internal_server_app_api_trading-accounts_route_actions_e20fc5ac.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_trading-accounts_route_actions_e20fc5ac.js");
      case "server/chunks/[root-of-the-server]__7c639dd5._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__7c639dd5._.js");
      case "server/chunks/_next-internal_server_app_api_watchlist_route_actions_2d96d264.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_watchlist_route_actions_2d96d264.js");
      case "server/chunks/ssr/[root-of-the-server]__6ce51df4._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/[root-of-the-server]__6ce51df4._.js");
      case "server/chunks/ssr/[root-of-the-server]__aa223b82._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/[root-of-the-server]__aa223b82._.js");
      case "server/chunks/ssr/_9a91423b._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/_9a91423b._.js");
      case "server/chunks/ssr/_next-internal_server_app_auth_callback_page_actions_9407c5db.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/_next-internal_server_app_auth_callback_page_actions_9407c5db.js");
      case "server/chunks/ssr/[root-of-the-server]__68ea9250._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/[root-of-the-server]__68ea9250._.js");
      case "server/chunks/ssr/[root-of-the-server]__f16fb29f._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/[root-of-the-server]__f16fb29f._.js");
      case "server/chunks/ssr/_1f38bd90._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/_1f38bd90._.js");
      case "server/chunks/ssr/_next-internal_server_app_auth_checkout_page_actions_3fd68ffa.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/_next-internal_server_app_auth_checkout_page_actions_3fd68ffa.js");
      case "server/chunks/ssr/src_app_auth_checkout_page_tsx_86f100cc._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/src_app_auth_checkout_page_tsx_86f100cc._.js");
      case "server/chunks/ssr/[root-of-the-server]__d0779991._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/[root-of-the-server]__d0779991._.js");
      case "server/chunks/ssr/_612f54cd._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/_612f54cd._.js");
      case "server/chunks/ssr/_c394b0eb._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/_c394b0eb._.js");
      case "server/chunks/ssr/_next-internal_server_app_auth_forgot-password_page_actions_32350400.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/_next-internal_server_app_auth_forgot-password_page_actions_32350400.js");
      case "server/chunks/ssr/[root-of-the-server]__2bb8f460._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/[root-of-the-server]__2bb8f460._.js");
      case "server/chunks/ssr/[root-of-the-server]__a51f3b0d._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/[root-of-the-server]__a51f3b0d._.js");
      case "server/chunks/ssr/_17f182ca._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/_17f182ca._.js");
      case "server/chunks/ssr/_next-internal_server_app_auth_login_page_actions_1786e20a.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/_next-internal_server_app_auth_login_page_actions_1786e20a.js");
      case "server/chunks/ssr/src_app_auth_login_page_tsx_5e50bc8f._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/src_app_auth_login_page_tsx_5e50bc8f._.js");
      case "server/chunks/ssr/[root-of-the-server]__17ffb1db._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/[root-of-the-server]__17ffb1db._.js");
      case "server/chunks/ssr/[root-of-the-server]__a3f7c5b0._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/[root-of-the-server]__a3f7c5b0._.js");
      case "server/chunks/ssr/_abc407fb._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/_abc407fb._.js");
      case "server/chunks/ssr/_next-internal_server_app_auth_pending-verification_page_actions_487377d9.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/_next-internal_server_app_auth_pending-verification_page_actions_487377d9.js");
      case "server/chunks/ssr/[root-of-the-server]__0d0320fa._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/[root-of-the-server]__0d0320fa._.js");
      case "server/chunks/ssr/[root-of-the-server]__5e61838a._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/[root-of-the-server]__5e61838a._.js");
      case "server/chunks/ssr/_04c2e8f4._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/_04c2e8f4._.js");
      case "server/chunks/ssr/_next-internal_server_app_auth_reset-password_page_actions_77dd7c88.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/_next-internal_server_app_auth_reset-password_page_actions_77dd7c88.js");
      case "server/chunks/ssr/[root-of-the-server]__49dfdb35._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/[root-of-the-server]__49dfdb35._.js");
      case "server/chunks/ssr/[root-of-the-server]__87b63a84._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/[root-of-the-server]__87b63a84._.js");
      case "server/chunks/ssr/_1db3beb8._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/_1db3beb8._.js");
      case "server/chunks/ssr/_next-internal_server_app_auth_signup_page_actions_e8d4ef1c.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/_next-internal_server_app_auth_signup_page_actions_e8d4ef1c.js");
      case "server/chunks/ssr/src_app_auth_signup_page_tsx_69589a66._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/src_app_auth_signup_page_tsx_69589a66._.js");
      case "server/chunks/ssr/[root-of-the-server]__5c40ec20._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/[root-of-the-server]__5c40ec20._.js");
      case "server/chunks/ssr/[root-of-the-server]__ca5c6638._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/[root-of-the-server]__ca5c6638._.js");
      case "server/chunks/ssr/_babe6cf0._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/_babe6cf0._.js");
      case "server/chunks/ssr/_next-internal_server_app_auth_verify_page_actions_072076d4.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/_next-internal_server_app_auth_verify_page_actions_072076d4.js");
      case "server/chunks/ssr/[root-of-the-server]__75626607._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/[root-of-the-server]__75626607._.js");
      case "server/chunks/ssr/_16a0d2ca._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/_16a0d2ca._.js");
      case "server/chunks/ssr/_e7891628._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/_e7891628._.js");
      case "server/chunks/ssr/_next-internal_server_app_blog_[slug]_page_actions_ec3909d7.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/_next-internal_server_app_blog_[slug]_page_actions_ec3909d7.js");
      case "server/chunks/ssr/[root-of-the-server]__77294b7e._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/[root-of-the-server]__77294b7e._.js");
      case "server/chunks/ssr/_5cc230ea._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/_5cc230ea._.js");
      case "server/chunks/ssr/_f77b02be._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/_f77b02be._.js");
      case "server/chunks/ssr/_next-internal_server_app_blog_page_actions_cb4aaadc.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/_next-internal_server_app_blog_page_actions_cb4aaadc.js");
      case "server/chunks/ssr/[root-of-the-server]__dde42dff._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/[root-of-the-server]__dde42dff._.js");
      case "server/chunks/ssr/_d5d47efb._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/_d5d47efb._.js");
      case "server/chunks/ssr/_f864274f._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/_f864274f._.js");
      case "server/chunks/ssr/_next-internal_server_app_contact_page_actions_44e32ac3.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/_next-internal_server_app_contact_page_actions_44e32ac3.js");
      case "server/chunks/ssr/src_app_contact_page_tsx_1ffb045c._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/src_app_contact_page_tsx_1ffb045c._.js");
      case "server/chunks/ssr/[root-of-the-server]__54e3e9aa._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/[root-of-the-server]__54e3e9aa._.js");
      case "server/chunks/ssr/[root-of-the-server]__a43ed7b3._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/[root-of-the-server]__a43ed7b3._.js");
      case "server/chunks/ssr/_399ef4ca._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/_399ef4ca._.js");
      case "server/chunks/ssr/_next-internal_server_app_dashboard_admin_affiliate_page_actions_54c61036.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/_next-internal_server_app_dashboard_admin_affiliate_page_actions_54c61036.js");
      case "server/chunks/ssr/node_modules_@radix-ui_4b2ec0a7._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/node_modules_@radix-ui_4b2ec0a7._.js");
      case "server/chunks/ssr/src_app_dashboard_admin_affiliate_page_tsx_68fb436b._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/src_app_dashboard_admin_affiliate_page_tsx_68fb436b._.js");
      case "server/chunks/ssr/src_app_dashboard_layout_tsx_3fd7cd9c._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/src_app_dashboard_layout_tsx_3fd7cd9c._.js");
      case "server/chunks/ssr/src_app_dashboard_loading_tsx_351ce75f._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/src_app_dashboard_loading_tsx_351ce75f._.js");
      case "server/chunks/ssr/[root-of-the-server]__2b1ddac2._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/[root-of-the-server]__2b1ddac2._.js");
      case "server/chunks/ssr/[root-of-the-server]__2b348767._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/[root-of-the-server]__2b348767._.js");
      case "server/chunks/ssr/_0140855b._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/_0140855b._.js");
      case "server/chunks/ssr/_next-internal_server_app_dashboard_admin_page_actions_8bab4192.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/_next-internal_server_app_dashboard_admin_page_actions_8bab4192.js");
      case "server/chunks/ssr/src_app_dashboard_admin_page_tsx_a8471592._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/src_app_dashboard_admin_page_tsx_a8471592._.js");
      case "server/chunks/ssr/[root-of-the-server]__1ce01e03._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/[root-of-the-server]__1ce01e03._.js");
      case "server/chunks/ssr/[root-of-the-server]__f0465674._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/[root-of-the-server]__f0465674._.js");
      case "server/chunks/ssr/_d7f95c8e._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/_d7f95c8e._.js");
      case "server/chunks/ssr/_next-internal_server_app_dashboard_admin_promo-codes_page_actions_bbe39fe2.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/_next-internal_server_app_dashboard_admin_promo-codes_page_actions_bbe39fe2.js");
      case "server/chunks/ssr/src_app_dashboard_admin_promo-codes_page_tsx_8efdd0a8._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/src_app_dashboard_admin_promo-codes_page_tsx_8efdd0a8._.js");
      case "server/chunks/ssr/[root-of-the-server]__130e170b._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/[root-of-the-server]__130e170b._.js");
      case "server/chunks/ssr/_adfda310._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/_adfda310._.js");
      case "server/chunks/ssr/_e34d1455._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/_e34d1455._.js");
      case "server/chunks/ssr/_next-internal_server_app_dashboard_admin_social-links_page_actions_212ac5f5.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/_next-internal_server_app_dashboard_admin_social-links_page_actions_212ac5f5.js");
      case "server/chunks/ssr/[root-of-the-server]__4461d70c._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/[root-of-the-server]__4461d70c._.js");
      case "server/chunks/ssr/_1e7e0485._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/_1e7e0485._.js");
      case "server/chunks/ssr/_664a2dbd._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/_664a2dbd._.js");
      case "server/chunks/ssr/_next-internal_server_app_dashboard_chart_page_actions_2d6514f6.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/_next-internal_server_app_dashboard_chart_page_actions_2d6514f6.js");
      case "server/chunks/ssr/src_app_dashboard_chart_page_tsx_681d18f4._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/src_app_dashboard_chart_page_tsx_681d18f4._.js");
      case "server/chunks/ssr/[root-of-the-server]__9573548d._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/[root-of-the-server]__9573548d._.js");
      case "server/chunks/ssr/[root-of-the-server]__ac944300._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/[root-of-the-server]__ac944300._.js");
      case "server/chunks/ssr/_0a35d436._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/_0a35d436._.js");
      case "server/chunks/ssr/_next-internal_server_app_dashboard_connections_cleanup_page_actions_555f9ae7.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/_next-internal_server_app_dashboard_connections_cleanup_page_actions_555f9ae7.js");
      case "server/chunks/ssr/[root-of-the-server]__4d007199._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/[root-of-the-server]__4d007199._.js");
      case "server/chunks/ssr/[root-of-the-server]__96a8db1c._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/[root-of-the-server]__96a8db1c._.js");
      case "server/chunks/ssr/_55c0a3a8._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/_55c0a3a8._.js");
      case "server/chunks/ssr/_next-internal_server_app_dashboard_connections_page_actions_75983ec9.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/_next-internal_server_app_dashboard_connections_page_actions_75983ec9.js");
      case "server/chunks/ssr/src_app_dashboard_connections_page_tsx_0cf83334._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/src_app_dashboard_connections_page_tsx_0cf83334._.js");
      case "server/chunks/ssr/[root-of-the-server]__06fa80ae._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/[root-of-the-server]__06fa80ae._.js");
      case "server/chunks/ssr/[root-of-the-server]__cc74327b._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/[root-of-the-server]__cc74327b._.js");
      case "server/chunks/ssr/_35550ddc._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/_35550ddc._.js");
      case "server/chunks/ssr/_next-internal_server_app_dashboard_page_actions_7f01ccec.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/_next-internal_server_app_dashboard_page_actions_7f01ccec.js");
      case "server/chunks/ssr/[root-of-the-server]__c733409c._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/[root-of-the-server]__c733409c._.js");
      case "server/chunks/ssr/_7ab44763._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/_7ab44763._.js");
      case "server/chunks/ssr/_f94c43f8._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/_f94c43f8._.js");
      case "server/chunks/ssr/_next-internal_server_app_dashboard_social-links_page_actions_a388a274.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/_next-internal_server_app_dashboard_social-links_page_actions_a388a274.js");
      case "server/chunks/ssr/node_modules_beaea217._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/node_modules_beaea217._.js");
      case "server/chunks/ssr/[root-of-the-server]__0a47f079._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/[root-of-the-server]__0a47f079._.js");
      case "server/chunks/ssr/_a516143c._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/_a516143c._.js");
      case "server/chunks/ssr/_next-internal_server_app_disclaimer_page_actions_89d408dd.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/_next-internal_server_app_disclaimer_page_actions_89d408dd.js");
      case "server/chunks/ssr/node_modules_f6e2c724._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/node_modules_f6e2c724._.js");
      case "server/chunks/ssr/src_app_disclaimer_page_tsx_da6ad4b9._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/src_app_disclaimer_page_tsx_da6ad4b9._.js");
      case "server/chunks/ssr/[root-of-the-server]__f1683d58._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/[root-of-the-server]__f1683d58._.js");
      case "server/chunks/ssr/_04d00f45._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/_04d00f45._.js");
      case "server/chunks/ssr/_8751a1fd._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/_8751a1fd._.js");
      case "server/chunks/ssr/_next-internal_server_app_faq_page_actions_15af725e.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/_next-internal_server_app_faq_page_actions_15af725e.js");
      case "server/chunks/ssr/[root-of-the-server]__c90c6fe9._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/[root-of-the-server]__c90c6fe9._.js");
      case "server/chunks/ssr/[root-of-the-server]__f7b636a9._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/[root-of-the-server]__f7b636a9._.js");
      case "server/chunks/ssr/_23281ed2._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/_23281ed2._.js");
      case "server/chunks/ssr/_next-internal_server_app_page_actions_39d4fc33.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/_next-internal_server_app_page_actions_39d4fc33.js");
      case "server/chunks/ssr/src_app_page_tsx_a7111f3e._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/src_app_page_tsx_a7111f3e._.js");
      case "server/chunks/ssr/[root-of-the-server]__769857d1._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/[root-of-the-server]__769857d1._.js");
      case "server/chunks/ssr/_5369ed8e._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/_5369ed8e._.js");
      case "server/chunks/ssr/_824e1293._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/_824e1293._.js");
      case "server/chunks/ssr/_next-internal_server_app_privacy_page_actions_78bfea85.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/_next-internal_server_app_privacy_page_actions_78bfea85.js");
      case "server/chunks/ssr/[root-of-the-server]__34d06c4c._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/[root-of-the-server]__34d06c4c._.js");
      case "server/chunks/ssr/_3751851f._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/_3751851f._.js");
      case "server/chunks/ssr/_46999b92._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/_46999b92._.js");
      case "server/chunks/ssr/_next-internal_server_app_refund-policy_page_actions_9690bde4.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/_next-internal_server_app_refund-policy_page_actions_9690bde4.js");
      case "server/chunks/[root-of-the-server]__8f9c212b._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__8f9c212b._.js");
      case "server/chunks/_next-internal_server_app_robots_txt_route_actions_9118e90f.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_robots_txt_route_actions_9118e90f.js");
      case "server/chunks/ssr/[root-of-the-server]__1e81f2d0._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/[root-of-the-server]__1e81f2d0._.js");
      case "server/chunks/ssr/[root-of-the-server]__7dbfa241._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/[root-of-the-server]__7dbfa241._.js");
      case "server/chunks/ssr/_4023f91b._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/_4023f91b._.js");
      case "server/chunks/ssr/_next-internal_server_app_settings_page_actions_840229cd.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/_next-internal_server_app_settings_page_actions_840229cd.js");
      case "server/chunks/ssr/src_app_settings_page_tsx_64604ac7._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/src_app_settings_page_tsx_64604ac7._.js");
      case "server/chunks/[root-of-the-server]__8a255c71._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__8a255c71._.js");
      case "server/chunks/_next-internal_server_app_sitemap_xml_route_actions_12658ace.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_sitemap_xml_route_actions_12658ace.js");
      case "server/chunks/ssr/[root-of-the-server]__4a125ae9._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/[root-of-the-server]__4a125ae9._.js");
      case "server/chunks/ssr/_2939ce9b._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/_2939ce9b._.js");
      case "server/chunks/ssr/_8ebd8ef8._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/_8ebd8ef8._.js");
      case "server/chunks/ssr/_next-internal_server_app_terms_page_actions_3b82705a.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/_next-internal_server_app_terms_page_actions_3b82705a.js");
      case "server/chunks/ssr/[root-of-the-server]__35cd6bd1._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/[root-of-the-server]__35cd6bd1._.js");
      case "server/chunks/ssr/_dec29f13._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/_dec29f13._.js");
      case "server/chunks/ssr/_next-internal_server_app_test-promo_page_actions_d3f4bd17.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/_next-internal_server_app_test-promo_page_actions_d3f4bd17.js");
      case "server/chunks/ssr/src_3a302db0._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/src_3a302db0._.js");
      case "server/chunks/ssr/[root-of-the-server]__2b7108d1._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/[root-of-the-server]__2b7108d1._.js");
      case "server/chunks/ssr/_35187705._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/_35187705._.js");
      case "server/chunks/ssr/_6a07b04c._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/_6a07b04c._.js");
      case "server/chunks/ssr/_74d314d9._.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/_74d314d9._.js");
      case "server/chunks/ssr/_next-internal_server_app_upgrade_page_actions_2985c3c8.js": return require("/home/z/my-project/.open-next/server-functions/default/.next/server/chunks/ssr/_next-internal_server_app_upgrade_page_actions_2985c3c8.js");
      default:
        throw new Error(`Not found ${chunkPath}`);
    }
  }


  async function loadWasmChunk(chunkPath) {
    switch (chunkPath) {
      case "/home/z/my-project/.open-next/server-functions/default/node_modules/.prisma/client/query_engine_bg.wasm": return (await import("/home/z/my-project/.open-next/server-functions/default/node_modules/.prisma/client/query_engine_bg.wasm")).default;
      default:
        throw new Error(`Unknown wasm chunk: ${chunkPath}`);
    }
  }
