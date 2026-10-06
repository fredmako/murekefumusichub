// node_modules/hono/dist/compose.js
var compose = (middleware, onError, onNotFound) => {
  return (context, next) => {
    let index = -1;
    return dispatch(0);
    async function dispatch(i) {
      if (i <= index) {
        throw new Error("next() called multiple times");
      }
      index = i;
      let res;
      let isError = false;
      let handler;
      if (middleware[i]) {
        handler = middleware[i][0][0];
        context.req.routeIndex = i;
      } else {
        handler = i === middleware.length && next || void 0;
      }
      if (handler) {
        try {
          res = await handler(context, () => dispatch(i + 1));
        } catch (err) {
          if (err instanceof Error && onError) {
            context.error = err;
            res = await onError(err, context);
            isError = true;
          } else {
            throw err;
          }
        }
      } else {
        if (context.finalized === false && onNotFound) {
          res = await onNotFound(context);
        }
      }
      if (res && (context.finalized === false || isError)) {
        context.res = res;
      }
      return context;
    }
  };
};

// node_modules/hono/dist/request/constants.js
var GET_MATCH_RESULT = /* @__PURE__ */ Symbol();

// node_modules/hono/dist/utils/buffer.js
var bufferToFormData = (arrayBuffer, contentType) => {
  const response = new Response(arrayBuffer, {
    headers: {
      // Normalize the media type (case-insensitive) while keeping parameters like the boundary
      "Content-Type": contentType.replace(/^[^;]+/, (mediaType) => mediaType.toLowerCase())
    }
  });
  return response.formData();
};

// node_modules/hono/dist/utils/body.js
var MAX_NESTING_DEPTH = 32;
var MAX_NESTED_OBJECTS = 1e4;
var isRawRequest = (request) => "headers" in request;
var parseBody = async (request, options = /* @__PURE__ */ Object.create(null)) => {
  const { all = false, dot = false } = options;
  const headers = isRawRequest(request) ? request.headers : request.raw.headers;
  const contentType = headers.get("Content-Type");
  const mediaType = contentType?.split(";")[0].trim().toLowerCase();
  if (mediaType === "multipart/form-data" || mediaType === "application/x-www-form-urlencoded") {
    return parseFormData(request, { all, dot });
  }
  return {};
};
async function parseFormData(request, options) {
  if (!isRawRequest(request) && request.bodyCache.formData) {
    return convertFormDataToBodyData(
      await request.bodyCache.formData,
      options
    );
  }
  const headers = isRawRequest(request) ? request.headers : request.raw.headers;
  const arrayBuffer = await request.arrayBuffer();
  const formDataPromise = bufferToFormData(arrayBuffer, headers.get("Content-Type") || "");
  if (!isRawRequest(request)) {
    request.bodyCache.formData = formDataPromise;
  }
  const formData = await formDataPromise;
  if (formData) {
    return convertFormDataToBodyData(formData, options);
  }
  return {};
}
function convertFormDataToBodyData(formData, options) {
  const form = /* @__PURE__ */ Object.create(null);
  const nestingState = { count: 0 };
  formData.forEach((value, key) => {
    const shouldParseAllValues = options.all || key.endsWith("[]");
    if (!shouldParseAllValues) {
      form[key] = value;
    } else {
      handleParsingAllValues(form, key, value);
    }
  });
  if (options.dot) {
    Object.entries(form).forEach(([key, value]) => {
      const shouldParseDotValues = key.includes(".");
      if (shouldParseDotValues) {
        handleParsingNestedValues(form, key, value, nestingState);
        delete form[key];
      }
    });
  }
  return form;
}
var handleParsingAllValues = (form, key, value) => {
  if (form[key] !== void 0) {
    if (Array.isArray(form[key])) {
      ;
      form[key].push(value);
    } else {
      form[key] = [form[key], value];
    }
  } else {
    if (!key.endsWith("[]")) {
      form[key] = value;
    } else {
      form[key] = [value];
    }
  }
};
var handleParsingNestedValues = (form, key, value, state) => {
  if (/(?:^|\.)__proto__\./.test(key)) {
    return;
  }
  let nestedForm = form;
  const keys = key.split(".", MAX_NESTING_DEPTH + 2);
  if (keys.length > MAX_NESTING_DEPTH + 1) {
    throwNestingLimitExceeded();
  }
  keys.forEach((key2, index) => {
    if (index === keys.length - 1) {
      nestedForm[key2] = value;
    } else {
      if (!nestedForm[key2] || typeof nestedForm[key2] !== "object" || Array.isArray(nestedForm[key2]) || nestedForm[key2] instanceof File) {
        if (state.count++ >= MAX_NESTED_OBJECTS) {
          throwNestingLimitExceeded();
        }
        nestedForm[key2] = /* @__PURE__ */ Object.create(null);
      }
      nestedForm = nestedForm[key2];
    }
  });
};
var throwNestingLimitExceeded = () => {
  throw new Error("Nesting limit exceeded");
};

// node_modules/hono/dist/utils/url.js
var splitPath = (path) => {
  const paths = path.split("/");
  if (paths[0] === "") {
    paths.shift();
  }
  return paths;
};
var splitRoutingPath = (routePath) => {
  const { groups, path } = extractGroupsFromPath(routePath);
  const paths = splitPath(path);
  return replaceGroupMarks(paths, groups);
};
var extractGroupsFromPath = (path) => {
  const groups = [];
  path = path.replace(/\{[^}]+\}/g, (match2, index) => {
    const mark = `@${index}`;
    groups.push([mark, match2]);
    return mark;
  });
  return { groups, path };
};
var replaceGroupMarks = (paths, groups) => {
  for (let i = groups.length - 1; i >= 0; i--) {
    const [mark] = groups[i];
    for (let j = paths.length - 1; j >= 0; j--) {
      if (paths[j].includes(mark)) {
        paths[j] = paths[j].replace(mark, groups[i][1]);
        break;
      }
    }
  }
  return paths;
};
var patternCache = {};
var getPattern = (label, next) => {
  if (label === "*") {
    return "*";
  }
  const match2 = label.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
  if (match2) {
    const cacheKey = `${label}#${next}`;
    if (!patternCache[cacheKey]) {
      if (match2[2]) {
        patternCache[cacheKey] = next && next[0] !== ":" && next[0] !== "*" ? [cacheKey, match2[1], new RegExp(`^${match2[2]}(?=/${next})`)] : [label, match2[1], new RegExp(`^${match2[2]}$`)];
      } else {
        patternCache[cacheKey] = [label, match2[1], true];
      }
    }
    return patternCache[cacheKey];
  }
  return null;
};
var tryDecode = (str, decoder) => {
  try {
    return decoder(str);
  } catch {
    return str.replace(/(?:%[0-9A-Fa-f]{2})+/g, (match2) => {
      try {
        return decoder(match2);
      } catch {
        return match2;
      }
    });
  }
};
var tryDecodeURI = (str) => tryDecode(str, decodeURI);
var getPath = (request) => {
  const url = request.url;
  const start = url.indexOf("/", url.indexOf(":") + 4);
  let i = start;
  for (; i < url.length; i++) {
    const charCode = url.charCodeAt(i);
    if (charCode === 37) {
      const queryIndex = url.indexOf("?", i);
      const hashIndex = url.indexOf("#", i);
      const end = queryIndex === -1 ? hashIndex === -1 ? void 0 : hashIndex : hashIndex === -1 ? queryIndex : Math.min(queryIndex, hashIndex);
      const path = url.slice(start, end);
      return tryDecodeURI(path.includes("%25") ? path.replace(/%25/g, "%2525") : path);
    } else if (charCode === 63 || charCode === 35) {
      break;
    }
  }
  return url.slice(start, i);
};
var getPathNoStrict = (request) => {
  const result = getPath(request);
  return result.length > 1 && result.at(-1) === "/" ? result.slice(0, -1) : result;
};
var mergePath = (base, sub, ...rest) => {
  if (rest.length) {
    sub = mergePath(sub, ...rest);
  }
  return `${base?.[0] === "/" ? "" : "/"}${base}${sub === "/" ? "" : `${base?.at(-1) === "/" ? "" : "/"}${sub?.[0] === "/" ? sub.slice(1) : sub}`}`;
};
var checkOptionalParameter = (path) => {
  if (path.charCodeAt(path.length - 1) !== 63 || !path.includes(":")) {
    return null;
  }
  const segments = path.split("/");
  const results = [];
  let basePath = "";
  segments.forEach((segment) => {
    if (segment !== "" && !/\:/.test(segment)) {
      basePath += "/" + segment;
    } else if (/\:/.test(segment)) {
      if (segment.charCodeAt(segment.length - 1) === 63) {
        if (results.length === 0 && basePath === "") {
          results.push("/");
        } else {
          results.push(basePath);
        }
        const optionalSegment = segment.slice(0, -1);
        basePath += "/" + optionalSegment;
        results.push(basePath);
      } else {
        basePath += "/" + segment;
      }
    }
  });
  return results.filter((v, i, a) => a.indexOf(v) === i);
};
var tryDecodeURIComponent = (str) => str.indexOf("%") !== -1 ? tryDecode(str, decodeURIComponent_) : str;
var _decodeURI = (value) => {
  if (value.indexOf("+") !== -1) {
    value = value.replace(/\+/g, " ");
  }
  return tryDecodeURIComponent(value);
};
var _getQueryParam = (url, key, multiple) => {
  const hashIndex = url.indexOf("#", 8);
  if (hashIndex !== -1) {
    url = url.slice(0, hashIndex);
  }
  let encoded;
  if (!multiple && key && key.indexOf("%") === -1 && key.indexOf("+") === -1) {
    let keyIndex2 = url.indexOf("?", 8);
    if (keyIndex2 === -1) {
      return void 0;
    }
    if (!url.startsWith(key, keyIndex2 + 1)) {
      keyIndex2 = url.indexOf(`&${key}`, keyIndex2 + 1);
    }
    while (keyIndex2 !== -1) {
      const trailingKeyCode = url.charCodeAt(keyIndex2 + key.length + 1);
      if (trailingKeyCode === 61) {
        const valueIndex = keyIndex2 + key.length + 2;
        const endIndex = url.indexOf("&", valueIndex);
        return _decodeURI(url.slice(valueIndex, endIndex === -1 ? void 0 : endIndex));
      } else if (trailingKeyCode == 38 || isNaN(trailingKeyCode)) {
        return "";
      }
      keyIndex2 = url.indexOf(`&${key}`, keyIndex2 + 1);
    }
    encoded = /[%+]/.test(url);
    if (!encoded) {
      return void 0;
    }
  }
  const results = /* @__PURE__ */ Object.create(null);
  encoded ??= /[%+]/.test(url);
  let keyIndex = url.indexOf("?", 8);
  while (keyIndex !== -1) {
    const nextKeyIndex = url.indexOf("&", keyIndex + 1);
    let valueIndex = url.indexOf("=", keyIndex);
    if (valueIndex > nextKeyIndex && nextKeyIndex !== -1) {
      valueIndex = -1;
    }
    let name = url.slice(
      keyIndex + 1,
      valueIndex === -1 ? nextKeyIndex === -1 ? void 0 : nextKeyIndex : valueIndex
    );
    if (encoded) {
      name = _decodeURI(name);
    }
    keyIndex = nextKeyIndex;
    if (name === "") {
      continue;
    }
    let value;
    if (valueIndex === -1) {
      value = "";
    } else {
      value = url.slice(valueIndex + 1, nextKeyIndex === -1 ? void 0 : nextKeyIndex);
      if (encoded) {
        value = _decodeURI(value);
      }
    }
    if (multiple) {
      if (!(results[name] && Array.isArray(results[name]))) {
        results[name] = [];
      }
      ;
      results[name].push(value);
    } else {
      results[name] ??= value;
    }
  }
  return key ? results[key] : results;
};
var getQueryParam = _getQueryParam;
var getQueryParams = (url, key) => {
  return _getQueryParam(url, key, true);
};
var decodeURIComponent_ = decodeURIComponent;

// node_modules/hono/dist/request.js
var HonoRequest = class {
  /**
   * `.raw` can get the raw Request object.
   *
   * @see {@link https://hono.dev/docs/api/request#raw}
   *
   * @example
   * ```ts
   * // For Cloudflare Workers
   * app.post('/', async (c) => {
   *   const metadata = c.req.raw.cf?.hostMetadata?
   *   ...
   * })
   * ```
   */
  raw;
  #validatedData;
  // Short name of validatedData
  #matchResult;
  routeIndex = 0;
  /**
   * `.path` can get the pathname of the request.
   *
   * @see {@link https://hono.dev/docs/api/request#path}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const pathname = c.req.path // `/about/me`
   * })
   * ```
   */
  path;
  bodyCache = {};
  constructor(request, path = "/", matchResult = [[]]) {
    this.raw = request;
    this.path = path;
    this.#matchResult = matchResult;
  }
  param(key) {
    return key ? this.#getDecodedParam(key) : this.#getAllDecodedParams();
  }
  #getDecodedParam(key) {
    const paramKey = this.#matchResult[0][this.routeIndex]?.[1][key];
    const param = this.#getParamValue(paramKey);
    return param && tryDecodeURIComponent(param);
  }
  #getAllDecodedParams() {
    const decoded = {};
    const keys = Object.keys(this.#matchResult[0][this.routeIndex]?.[1] ?? {});
    for (const key of keys) {
      const value = this.#getParamValue(this.#matchResult[0][this.routeIndex][1][key]);
      if (value !== void 0) {
        decoded[key] = tryDecodeURIComponent(value);
      }
    }
    return decoded;
  }
  #getParamValue(paramKey) {
    return this.#matchResult[1] ? this.#matchResult[1][paramKey] : paramKey;
  }
  query(key) {
    return getQueryParam(this.url, key);
  }
  queries(key) {
    return getQueryParams(this.url, key);
  }
  header(name) {
    if (name) {
      return this.raw.headers.get(name) ?? void 0;
    }
    const headerData = /* @__PURE__ */ Object.create(null);
    this.raw.headers.forEach((value, key) => {
      headerData[key] = value;
    });
    return headerData;
  }
  async parseBody(options) {
    return parseBody(this, options);
  }
  #cachedBody = (key) => {
    const { bodyCache, raw: raw2 } = this;
    const cachedBody = bodyCache[key];
    if (cachedBody) {
      return cachedBody;
    }
    for (const anyCachedKey in bodyCache) {
      return bodyCache[anyCachedKey].then((body) => {
        if (anyCachedKey === "json") {
          body = JSON.stringify(body);
        }
        return new Response(body)[key]();
      });
    }
    return bodyCache[key] = raw2[key]();
  };
  /**
   * `.json()` can parse Request body of type `application/json`
   *
   * @see {@link https://hono.dev/docs/api/request#json}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.json()
   * })
   * ```
   */
  json() {
    return this.#cachedBody("text").then((text) => JSON.parse(text));
  }
  /**
   * `.text()` can parse Request body of type `text/plain`
   *
   * @see {@link https://hono.dev/docs/api/request#text}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.text()
   * })
   * ```
   */
  text() {
    return this.#cachedBody("text");
  }
  /**
   * `.arrayBuffer()` parse Request body as an `ArrayBuffer`
   *
   * @see {@link https://hono.dev/docs/api/request#arraybuffer}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.arrayBuffer()
   * })
   * ```
   */
  arrayBuffer() {
    return this.#cachedBody("arrayBuffer");
  }
  /**
   * `.bytes()` parses the request body as a `Uint8Array`.
   *
   * @see {@link https://hono.dev/docs/api/request#bytes}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.bytes()
   * })
   * ```
   */
  bytes() {
    return this.#cachedBody("arrayBuffer").then((buffer) => new Uint8Array(buffer));
  }
  /**
   * Parses the request body as a `Blob`.
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.blob();
   * });
   * ```
   * @see https://hono.dev/docs/api/request#blob
   */
  blob() {
    return this.#cachedBody("blob");
  }
  /**
   * Parses the request body as `FormData`.
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.formData();
   * });
   * ```
   * @see https://hono.dev/docs/api/request#formdata
   */
  formData() {
    return this.#cachedBody("formData");
  }
  /**
   * Adds validated data to the request.
   *
   * @param target - The target of the validation.
   * @param data - The validated data to add.
   */
  addValidatedData(target, data) {
    ;
    (this.#validatedData ??= {})[target] = data;
  }
  valid(target) {
    return this.#validatedData?.[target];
  }
  /**
   * `.url()` can get the request url strings.
   *
   * @see {@link https://hono.dev/docs/api/request#url}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const url = c.req.url // `http://localhost:8787/about/me`
   *   ...
   * })
   * ```
   */
  get url() {
    return this.raw.url;
  }
  /**
   * `.method()` can get the method name of the request.
   *
   * @see {@link https://hono.dev/docs/api/request#method}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const method = c.req.method // `GET`
   * })
   * ```
   */
  get method() {
    return this.raw.method;
  }
  get [GET_MATCH_RESULT]() {
    return this.#matchResult;
  }
  /**
   * `.matchedRoutes()` can return a matched route in the handler
   *
   * @deprecated
   *
   * Use matchedRoutes helper defined in "hono/route" instead.
   *
   * @see {@link https://hono.dev/docs/api/request#matchedroutes}
   *
   * @example
   * ```ts
   * app.use('*', async function logger(c, next) {
   *   await next()
   *   c.req.matchedRoutes.forEach(({ handler, method, path }, i) => {
   *     const name = handler.name || (handler.length < 2 ? '[handler]' : '[middleware]')
   *     console.log(
   *       method,
   *       ' ',
   *       path,
   *       ' '.repeat(Math.max(10 - path.length, 0)),
   *       name,
   *       i === c.req.routeIndex ? '<- respond from here' : ''
   *     )
   *   })
   * })
   * ```
   */
  get matchedRoutes() {
    return this.#matchResult[0].map(([[, route]]) => route);
  }
  /**
   * `routePath()` can retrieve the path registered within the handler
   *
   * @deprecated
   *
   * Use routePath helper defined in "hono/route" instead.
   *
   * @see {@link https://hono.dev/docs/api/request#routepath}
   *
   * @example
   * ```ts
   * app.get('/posts/:id', (c) => {
   *   return c.json({ path: c.req.routePath })
   * })
   * ```
   */
  get routePath() {
    return this.#matchResult[0].map(([[, route]]) => route)[this.routeIndex].path;
  }
};

// node_modules/hono/dist/utils/html.js
var HtmlEscapedCallbackPhase = {
  Stringify: 1,
  BeforeStream: 2,
  Stream: 3
};
var raw = (value, callbacks) => {
  const escapedString = new String(value);
  escapedString.isEscaped = true;
  escapedString.callbacks = callbacks;
  return escapedString;
};
var resolveCallback = async (str, phase, preserveCallbacks, context, buffer) => {
  if (typeof str === "object" && !(str instanceof String)) {
    if (!(str instanceof Promise)) {
      str = str.toString();
    }
    if (str instanceof Promise) {
      str = await str;
    }
  }
  const callbacks = str.callbacks;
  if (!callbacks?.length) {
    return Promise.resolve(str);
  }
  if (buffer) {
    buffer[0] += str;
  } else {
    buffer = [str];
  }
  const resStr = Promise.all(callbacks.map((c) => c({ phase, buffer, context }))).then(
    (res) => Promise.all(
      res.filter(Boolean).map((str2) => resolveCallback(str2, phase, false, context, buffer))
    ).then(() => buffer[0])
  );
  if (preserveCallbacks) {
    return raw(await resStr, callbacks);
  } else {
    return resStr;
  }
};

// node_modules/hono/dist/context.js
var TEXT_PLAIN = "text/plain; charset=UTF-8";
var setDefaultContentType = (contentType, headers) => {
  return {
    "Content-Type": contentType,
    ...headers
  };
};
var createResponseInstance = (body, init) => new Response(body, init);
var Context = class {
  #rawRequest;
  #req;
  /**
   * `.env` can get bindings (environment variables, secrets, KV namespaces, D1 database, R2 bucket etc.) in Cloudflare Workers.
   *
   * @see {@link https://hono.dev/docs/api/context#env}
   *
   * @example
   * ```ts
   * // Environment object for Cloudflare Workers
   * app.get('*', async c => {
   *   const counter = c.env.COUNTER
   * })
   * ```
   */
  env = {};
  #var;
  finalized = false;
  /**
   * `.error` can get the error object from the middleware if the Handler throws an error.
   *
   * @see {@link https://hono.dev/docs/api/context#error}
   *
   * @example
   * ```ts
   * app.use('*', async (c, next) => {
   *   await next()
   *   if (c.error) {
   *     // do something...
   *   }
   * })
   * ```
   */
  error;
  #status;
  #executionCtx;
  #res;
  #layout;
  #renderer;
  #notFoundHandler;
  #preparedHeaders;
  #matchResult;
  #path;
  /**
   * Creates an instance of the Context class.
   *
   * @param req - The Request object.
   * @param options - Optional configuration options for the context.
   */
  constructor(req, options) {
    this.#rawRequest = req;
    if (options) {
      this.#executionCtx = options.executionCtx;
      this.env = options.env;
      this.#notFoundHandler = options.notFoundHandler;
      this.#path = options.path;
      this.#matchResult = options.matchResult;
    }
  }
  /**
   * `.req` is the instance of {@link HonoRequest}.
   */
  get req() {
    this.#req ??= new HonoRequest(this.#rawRequest, this.#path, this.#matchResult);
    return this.#req;
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#event}
   * The FetchEvent associated with the current request.
   *
   * @throws Will throw an error if the context does not have a FetchEvent.
   */
  get event() {
    if (this.#executionCtx && "respondWith" in this.#executionCtx) {
      return this.#executionCtx;
    } else {
      throw Error("This context has no FetchEvent");
    }
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#executionctx}
   * The ExecutionContext associated with the current request.
   *
   * @throws Will throw an error if the context does not have an ExecutionContext.
   */
  get executionCtx() {
    if (this.#executionCtx) {
      return this.#executionCtx;
    } else {
      throw Error("This context has no ExecutionContext");
    }
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#res}
   * The Response object for the current request.
   */
  get res() {
    return this.#res ||= createResponseInstance(null, {
      headers: this.#preparedHeaders ??= new Headers()
    });
  }
  /**
   * Sets the Response object for the current request.
   *
   * @param _res - The Response object to set.
   */
  set res(_res) {
    if (this.#res && _res) {
      _res = createResponseInstance(_res.body, _res);
      for (const [k, v] of this.#res.headers.entries()) {
        if (k === "content-type") {
          continue;
        }
        if (k === "set-cookie") {
          const cookies = this.#res.headers.getSetCookie();
          _res.headers.delete("set-cookie");
          for (const cookie of cookies) {
            _res.headers.append("set-cookie", cookie);
          }
        } else {
          _res.headers.set(k, v);
        }
      }
    }
    this.#res = _res;
    this.finalized = true;
  }
  /**
   * `.render()` can create a response within a layout.
   *
   * @see {@link https://hono.dev/docs/api/context#render-setrenderer}
   *
   * @example
   * ```ts
   * app.get('/', (c) => {
   *   return c.render('Hello!')
   * })
   * ```
   */
  render = (...args) => {
    this.#renderer ??= (content) => this.html(content);
    return this.#renderer(...args);
  };
  /**
   * Sets the layout for the response.
   *
   * @param layout - The layout to set.
   * @returns The layout function.
   */
  setLayout = (layout) => this.#layout = layout;
  /**
   * Gets the current layout for the response.
   *
   * @returns The current layout function.
   */
  getLayout = () => this.#layout;
  /**
   * `.setRenderer()` can set the layout in the custom middleware.
   *
   * @see {@link https://hono.dev/docs/api/context#render-setrenderer}
   *
   * @example
   * ```tsx
   * app.use('*', async (c, next) => {
   *   c.setRenderer((content) => {
   *     return c.html(
   *       <html>
   *         <body>
   *           <p>{content}</p>
   *         </body>
   *       </html>
   *     )
   *   })
   *   await next()
   * })
   * ```
   */
  setRenderer = (renderer) => {
    this.#renderer = renderer;
  };
  /**
   * `.header()` can set headers.
   *
   * @see {@link https://hono.dev/docs/api/context#header}
   *
   * @example
   * ```ts
   * app.get('/welcome', (c) => {
   *   // Set headers
   *   c.header('X-Message', 'Hello!')
   *   c.header('Content-Type', 'text/plain')
   *
   *   // Append multiple headers using the append option (e.g. Vary)
   *   c.header('Vary', 'Accept-Encoding', { append: true })
   *   c.header('Vary', 'User-Agent', { append: true })
   *
   *   return c.body('Thank you for coming')
   * })
   * ```
   */
  header = (name, value, options) => {
    if (this.finalized) {
      this.#res = createResponseInstance(this.#res.body, this.#res);
    }
    const headers = this.#res ? this.#res.headers : this.#preparedHeaders ??= new Headers();
    if (value === void 0) {
      headers.delete(name);
    } else if (options?.append) {
      headers.append(name, value);
    } else {
      headers.set(name, value);
    }
  };
  status = (status) => {
    this.#status = status;
  };
  /**
   * `.set()` can set the value specified by the key.
   *
   * @see {@link https://hono.dev/docs/api/context#set-get}
   *
   * @example
   * ```ts
   * app.use('*', async (c, next) => {
   *   c.set('message', 'Hono is hot!!')
   *   await next()
   * })
   * ```
   */
  set = (key, value) => {
    this.#var ??= /* @__PURE__ */ new Map();
    this.#var.set(key, value);
  };
  /**
   * `.get()` can use the value specified by the key.
   *
   * @see {@link https://hono.dev/docs/api/context#set-get}
   *
   * @example
   * ```ts
   * app.get('/', (c) => {
   *   const message = c.get('message')
   *   return c.text(`The message is "${message}"`)
   * })
   * ```
   */
  get = (key) => {
    return this.#var ? this.#var.get(key) : void 0;
  };
  /**
   * `.var` can access the value of a variable.
   *
   * @see {@link https://hono.dev/docs/api/context#var}
   *
   * @example
   * ```ts
   * const result = c.var.client.oneMethod()
   * ```
   */
  // c.var.propName is a read-only
  get var() {
    if (!this.#var) {
      return {};
    }
    return Object.fromEntries(this.#var);
  }
  #newResponse(data, arg, headers) {
    let responseHeaders = this.#res ? new Headers(this.#res.headers) : this.#preparedHeaders;
    if (typeof arg === "object" && arg.headers) {
      responseHeaders ??= new Headers();
      for (const [key, value] of new Headers(arg.headers)) {
        if (key === "set-cookie") {
          responseHeaders.append(key, value);
        } else {
          responseHeaders.set(key, value);
        }
      }
    }
    if (headers) {
      if (!responseHeaders) {
        let count = 0;
        for (const k in headers) {
          if (++count > 1 || typeof headers[k] !== "string") {
            responseHeaders = new Headers();
            break;
          }
        }
      }
      if (responseHeaders) {
        for (const k in headers) {
          const v = headers[k];
          if (typeof v === "string") {
            responseHeaders.set(k, v);
          } else {
            responseHeaders.delete(k);
            for (const v2 of v) {
              responseHeaders.append(k, v2);
            }
          }
        }
      }
    }
    const status = typeof arg === "number" ? arg : arg?.status ?? this.#status;
    return createResponseInstance(data, {
      status,
      headers: responseHeaders ?? headers
    });
  }
  newResponse = (...args) => this.#newResponse(...args);
  /**
   * `.body()` can return the HTTP response.
   * You can set headers with `.header()` and set HTTP status code with `.status`.
   * This can also be set in `.text()`, `.json()` and so on.
   *
   * @see {@link https://hono.dev/docs/api/context#body}
   *
   * @example
   * ```ts
   * app.get('/welcome', (c) => {
   *   // Set headers
   *   c.header('X-Message', 'Hello!')
   *   c.header('Content-Type', 'text/plain')
   *   // Set HTTP status code
   *   c.status(201)
   *
   *   // Return the response body
   *   return c.body('Thank you for coming')
   * })
   * ```
   */
  body = (data, arg, headers) => this.#newResponse(data, arg, headers);
  /**
   * `.text()` can render text as `Content-Type:text/plain`.
   *
   * @see {@link https://hono.dev/docs/api/context#text}
   *
   * @example
   * ```ts
   * app.get('/say', (c) => {
   *   return c.text('Hello!')
   * })
   * ```
   */
  text = (text, arg, headers) => {
    return !this.#preparedHeaders && !this.#status && !arg && !headers && !this.finalized ? new Response(text) : this.#newResponse(
      text,
      arg,
      setDefaultContentType(TEXT_PLAIN, headers)
    );
  };
  /**
   * `.json()` can render JSON as `Content-Type:application/json`.
   *
   * @see {@link https://hono.dev/docs/api/context#json}
   *
   * @example
   * ```ts
   * app.get('/api', (c) => {
   *   return c.json({ message: 'Hello!' })
   * })
   * ```
   */
  json = (object, arg, headers) => {
    return this.#newResponse(
      JSON.stringify(object),
      arg,
      setDefaultContentType("application/json", headers)
    );
  };
  html = (html, arg, headers) => {
    const res = (html2) => this.#newResponse(html2, arg, setDefaultContentType("text/html; charset=UTF-8", headers));
    return typeof html === "object" ? resolveCallback(html, HtmlEscapedCallbackPhase.Stringify, false, {}).then(res) : res(html);
  };
  /**
   * `.redirect()` can Redirect, default status code is 302.
   *
   * @see {@link https://hono.dev/docs/api/context#redirect}
   *
   * @example
   * ```ts
   * app.get('/redirect', (c) => {
   *   return c.redirect('/')
   * })
   * app.get('/redirect-permanently', (c) => {
   *   return c.redirect('/', 301)
   * })
   * ```
   */
  redirect = (location, status) => {
    const locationString = String(location);
    this.header(
      "Location",
      // Multibyes should be encoded
      // eslint-disable-next-line no-control-regex
      !/[^\x00-\xFF]/.test(locationString) ? locationString : encodeURI(locationString)
    );
    return this.newResponse(null, status ?? 302);
  };
  /**
   * `.notFound()` can return the Not Found Response.
   *
   * @see {@link https://hono.dev/docs/api/context#notfound}
   *
   * @example
   * ```ts
   * app.get('/notfound', (c) => {
   *   return c.notFound()
   * })
   * ```
   */
  notFound = () => {
    this.#notFoundHandler ??= () => createResponseInstance();
    return this.#notFoundHandler(this);
  };
};

// node_modules/hono/dist/router.js
var METHOD_NAME_ALL = "ALL";
var METHOD_NAME_ALL_LOWERCASE = "all";
var METHODS = ["get", "post", "put", "delete", "options", "patch", "query"];
var MESSAGE_MATCHER_IS_ALREADY_BUILT = "Can not add a route since the matcher is already built.";
var UnsupportedPathError = class extends Error {
};

// node_modules/hono/dist/utils/constants.js
var COMPOSED_HANDLER = "__COMPOSED_HANDLER";

// node_modules/hono/dist/hono-base.js
var notFoundHandler = (c) => {
  return c.text("404 Not Found", 404);
};
var errorHandler = (err, c) => {
  if ("getResponse" in err) {
    const res = err.getResponse();
    return c.newResponse(res.body, res);
  }
  console.error(err);
  return c.text("Internal Server Error", 500);
};
var Hono = class _Hono {
  get;
  post;
  put;
  delete;
  options;
  patch;
  query;
  all;
  on;
  use;
  /*
    This class is like an abstract class and does not have a router.
    To use it, inherit the class and implement router in the constructor.
  */
  router;
  getPath;
  // Cannot use `#` because it requires visibility at JavaScript runtime.
  _basePath = "/";
  #path = "/";
  routes = [];
  constructor(options = {}) {
    const allMethods = [...METHODS, METHOD_NAME_ALL_LOWERCASE];
    allMethods.forEach((method) => {
      this[method] = (args1, ...args) => {
        const methodName = method.toUpperCase();
        if (typeof args1 === "string") {
          this.#path = args1;
        } else {
          this.#addRoute(methodName, this.#path, args1);
        }
        args.forEach((handler) => {
          this.#addRoute(methodName, this.#path, handler);
        });
        return this;
      };
    });
    this.on = (method, path, ...handlers) => {
      for (const p of [path].flat()) {
        this.#path = p;
        for (const m of [method].flat()) {
          const methodName = m.toUpperCase();
          for (const handler of handlers) {
            this.#addRoute(methodName, this.#path, handler);
          }
        }
      }
      return this;
    };
    this.use = (arg1, ...handlers) => {
      if (typeof arg1 === "string") {
        this.#path = arg1;
      } else {
        this.#path = "*";
        handlers.unshift(arg1);
      }
      handlers.forEach((handler) => {
        this.#addRoute(METHOD_NAME_ALL, this.#path, handler);
      });
      return this;
    };
    const { strict, ...optionsWithoutStrict } = options;
    Object.assign(this, optionsWithoutStrict);
    this.getPath = strict ?? true ? options.getPath ?? getPath : getPathNoStrict;
  }
  #clone() {
    const clone = new _Hono({
      router: this.router,
      getPath: this.getPath
    });
    clone.errorHandler = this.errorHandler;
    clone.#notFoundHandler = this.#notFoundHandler;
    clone.routes = this.routes;
    return clone;
  }
  #notFoundHandler = notFoundHandler;
  // Cannot use `#` because it requires visibility at JavaScript runtime.
  errorHandler = errorHandler;
  /**
   * `.route()` allows grouping other Hono instance in routes.
   *
   * @see {@link https://hono.dev/docs/api/routing#grouping}
   *
   * @param {string} path - base Path
   * @param {Hono} app - other Hono instance
   * @returns {Hono} routed Hono instance
   *
   * @example
   * ```ts
   * const app = new Hono()
   * const app2 = new Hono()
   *
   * app2.get("/user", (c) => c.text("user"))
   * app.route("/api", app2) // GET /api/user
   * ```
   */
  route(path, app2) {
    const subApp = this.basePath(path);
    app2.routes.map((r) => {
      let handler;
      if (app2.errorHandler === errorHandler) {
        handler = r.handler;
      } else {
        handler = async (c, next) => (await compose([], app2.errorHandler)(c, () => r.handler(c, next))).res;
        handler[COMPOSED_HANDLER] = r.handler;
      }
      subApp.#addRoute(r.method, r.path, handler, r.basePath);
    });
    return this;
  }
  /**
   * `.basePath()` allows base paths to be specified.
   *
   * @see {@link https://hono.dev/docs/api/routing#base-path}
   *
   * @param {string} path - base Path
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * const api = new Hono().basePath('/api')
   * ```
   */
  basePath(path) {
    const subApp = this.#clone();
    subApp._basePath = mergePath(this._basePath, path);
    return subApp;
  }
  /**
   * `.onError()` handles an error and returns a customized Response.
   *
   * @see {@link https://hono.dev/docs/api/hono#error-handling}
   *
   * @param {ErrorHandler} handler - request Handler for error
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * app.onError((err, c) => {
   *   console.error(`${err}`)
   *   return c.text('Custom Error Message', 500)
   * })
   * ```
   */
  onError = (handler) => {
    this.errorHandler = handler;
    return this;
  };
  /**
   * `.notFound()` allows you to customize a Not Found Response.
   *
   * @see {@link https://hono.dev/docs/api/hono#not-found}
   *
   * @param {NotFoundHandler} handler - request handler for not-found
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * app.notFound((c) => {
   *   return c.text('Custom 404 Message', 404)
   * })
   * ```
   */
  notFound = (handler) => {
    this.#notFoundHandler = handler;
    return this;
  };
  /**
   * `.mount()` allows you to mount applications built with other frameworks into your Hono application.
   *
   * @see {@link https://hono.dev/docs/api/hono#mount}
   *
   * @param {string} path - base Path
   * @param {Function} applicationHandler - other Request Handler
   * @param {MountOptions} [options] - options of `.mount()`
   * @returns {Hono} mounted Hono instance
   *
   * @example
   * ```ts
   * import { Router as IttyRouter } from 'itty-router'
   * import { Hono } from 'hono'
   * // Create itty-router application
   * const ittyRouter = IttyRouter()
   * // GET /itty-router/hello
   * ittyRouter.get('/hello', () => new Response('Hello from itty-router'))
   *
   * const app = new Hono()
   * app.mount('/itty-router', ittyRouter.handle)
   * ```
   *
   * @example
   * ```ts
   * const app = new Hono()
   * // Send the request to another application without modification.
   * app.mount('/app', anotherApp, {
   *   replaceRequest: (req) => req,
   * })
   * ```
   */
  mount(path, applicationHandler, options) {
    let replaceRequest;
    let optionHandler;
    if (options) {
      if (typeof options === "function") {
        optionHandler = options;
      } else {
        optionHandler = options.optionHandler;
        if (options.replaceRequest === false) {
          replaceRequest = (request) => request;
        } else {
          replaceRequest = options.replaceRequest;
        }
      }
    }
    const getOptions = optionHandler ? (c) => {
      const options2 = optionHandler(c);
      return Array.isArray(options2) ? options2 : [options2];
    } : (c) => {
      let executionContext = void 0;
      try {
        executionContext = c.executionCtx;
      } catch {
      }
      return [c.env, executionContext];
    };
    replaceRequest ||= (() => {
      const mergedPath = mergePath(this._basePath, path);
      const pathPrefixLength = mergedPath === "/" ? 0 : mergedPath.length;
      return (request) => {
        const url = new URL(request.url);
        url.pathname = this.getPath(request).slice(pathPrefixLength) || "/";
        return new Request(url, request);
      };
    })();
    const handler = async (c, next) => {
      const res = await applicationHandler(replaceRequest(c.req.raw), ...getOptions(c));
      if (res) {
        return res;
      }
      await next();
    };
    this.#addRoute(METHOD_NAME_ALL, mergePath(path, "*"), handler);
    return this;
  }
  #addRoute(method, path, handler, baseRoutePath) {
    path = mergePath(this._basePath, path);
    const r = {
      basePath: baseRoutePath !== void 0 ? mergePath(this._basePath, baseRoutePath) : this._basePath,
      path,
      method,
      handler
    };
    this.router.add(method, path, [handler, r]);
    this.routes.push(r);
  }
  #handleError(err, c) {
    if (err instanceof Error) {
      return this.errorHandler(err, c);
    }
    throw err;
  }
  #dispatch(request, executionCtx, env, method) {
    if (method === "HEAD") {
      return (async () => new Response(null, await this.#dispatch(request, executionCtx, env, "GET")))();
    }
    const path = this.getPath(request, { env });
    const matchResult = this.router.match(method, path);
    const c = new Context(request, {
      path,
      matchResult,
      env,
      executionCtx,
      notFoundHandler: this.#notFoundHandler
    });
    if (matchResult[0].length === 1) {
      let res;
      try {
        res = matchResult[0][0][0][0](c, async () => {
          c.res = await this.#notFoundHandler(c);
        });
      } catch (err) {
        return this.#handleError(err, c);
      }
      return res instanceof Promise ? res.then(
        (resolved) => resolved || (c.finalized ? c.res : this.#notFoundHandler(c))
      ).catch((err) => this.#handleError(err, c)) : res ?? this.#notFoundHandler(c);
    }
    const composed = compose(matchResult[0], this.errorHandler, this.#notFoundHandler);
    return (async () => {
      try {
        const context = await composed(c);
        if (!context.finalized) {
          throw new Error(
            "Context is not finalized. Did you forget to return a Response object or `await next()`?"
          );
        }
        return context.res;
      } catch (err) {
        return this.#handleError(err, c);
      }
    })();
  }
  /**
   * `.fetch()` will be entry point of your app.
   *
   * @see {@link https://hono.dev/docs/api/hono#fetch}
   *
   * @param {Request} request - request Object of request
   * @param {Env} env - env Object
   * @param {ExecutionContext} executionCtx - context of execution
   * @returns {Response | Promise<Response>} response of request
   *
   */
  fetch = (request, ...rest) => {
    return this.#dispatch(request, rest[1], rest[0], request.method);
  };
  /**
   * `.request()` is a useful method for testing.
   * You can pass a URL or pathname to send a GET request.
   * app will return a Response object.
   * ```ts
   * test('GET /hello is ok', async () => {
   *   const res = await app.request('/hello')
   *   expect(res.status).toBe(200)
   * })
   * ```
   * @see https://hono.dev/docs/api/hono#request
   */
  request = (input, requestInit, Env, executionCtx) => {
    if (input instanceof Request) {
      return this.fetch(requestInit ? new Request(input, requestInit) : input, Env, executionCtx);
    }
    input = input.toString();
    return this.fetch(
      new Request(
        /^https?:\/\//.test(input) ? input : `http://localhost${mergePath("/", input)}`,
        requestInit
      ),
      Env,
      executionCtx
    );
  };
  /**
   * `.fire()` automatically adds a global fetch event listener.
   * This can be useful for environments that adhere to the Service Worker API, such as non-ES module Cloudflare Workers.
   * @deprecated
   * Use `fire` from `hono/service-worker` instead.
   * ```ts
   * import { Hono } from 'hono'
   * import { fire } from 'hono/service-worker'
   *
   * const app = new Hono()
   * // ...
   * fire(app)
   * ```
   * @see https://hono.dev/docs/api/hono#fire
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API
   * @see https://developers.cloudflare.com/workers/reference/migrate-to-module-workers/
   */
  fire = () => {
    addEventListener("fetch", (event) => {
      event.respondWith(this.#dispatch(event.request, event, void 0, event.request.method));
    });
  };
};

// node_modules/hono/dist/router/utils.js
var createNullObject = () => /* @__PURE__ */ Object.create(null);

// node_modules/hono/dist/router/reg-exp-router/matcher.js
var emptyParam = [];
function match(method, path) {
  const matchers = this.buildAllMatchers();
  const match2 = ((method2, path2) => {
    const matcher = matchers[method2] || matchers[METHOD_NAME_ALL];
    const staticMatch = matcher[2][path2];
    if (staticMatch) {
      return staticMatch;
    }
    const match3 = path2.match(matcher[0]);
    if (!match3) {
      return [[], emptyParam];
    }
    const index = match3.indexOf("", 1);
    return [matcher[1][index], match3];
  });
  this.match = match2;
  return match2(method, path);
}

// node_modules/hono/dist/router/reg-exp-router/node.js
var LABEL_REG_EXP_STR = "[^/]+";
var ONLY_WILDCARD_REG_EXP_STR = ".*";
var TAIL_WILDCARD_REG_EXP_STR = "(?:|/.*)";
var PATH_ERROR = /* @__PURE__ */ Symbol();
var regExpMetaChars = new Set(".\\+*[^]$()");
function compareKey(a, b) {
  if (a.length === 1) {
    return b.length === 1 ? a < b ? -1 : 1 : -1;
  }
  if (b.length === 1) {
    return 1;
  }
  if (a === ONLY_WILDCARD_REG_EXP_STR || a === TAIL_WILDCARD_REG_EXP_STR) {
    return b === TAIL_WILDCARD_REG_EXP_STR ? -1 : 1;
  } else if (b === ONLY_WILDCARD_REG_EXP_STR || b === TAIL_WILDCARD_REG_EXP_STR) {
    return -1;
  }
  if (a === LABEL_REG_EXP_STR) {
    return 1;
  } else if (b === LABEL_REG_EXP_STR) {
    return -1;
  }
  return a.length === b.length ? a < b ? -1 : 1 : b.length - a.length;
}
var Node = class _Node {
  // handler index of a dynamic path, or -1 for a static path terminal
  #index;
  #varIndex;
  #children = createNullObject();
  insert(tokens, index, paramMap, context, isStatic) {
    let node = this;
    for (let i = 0, len = tokens.length; i < len; i++) {
      const token = tokens[i];
      const pattern = token.length === 1 ? token === "*" ? i === len - 1 ? ["", "", ONLY_WILDCARD_REG_EXP_STR] : ["", "", LABEL_REG_EXP_STR] : null : token === "/*" ? ["", "", TAIL_WILDCARD_REG_EXP_STR] : token.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
      let nextNode;
      if (pattern) {
        const name = pattern[1];
        let regexpStr = pattern[2] || LABEL_REG_EXP_STR;
        if (name && pattern[2]) {
          if (regexpStr === ".*") {
            throw PATH_ERROR;
          }
          regexpStr = regexpStr.replace(/^\((?!\?:)(?=[^)]+\)$)/, "(?:");
          if (/\((?!\?:)/.test(regexpStr)) {
            throw PATH_ERROR;
          }
          if (regexpStr.length === 1 && regExpMetaChars.has(regexpStr)) {
            throw PATH_ERROR;
          }
        }
        nextNode = node.#children[regexpStr];
        if (!nextNode) {
          if (regexpStr !== ONLY_WILDCARD_REG_EXP_STR && regexpStr !== TAIL_WILDCARD_REG_EXP_STR) {
            for (const k in node.#children) {
              if (
                // a single-char pattern coexists with single-char literals as a literal does
                (regexpStr.length > 1 || k.length > 1) && k !== ONLY_WILDCARD_REG_EXP_STR && k !== TAIL_WILDCARD_REG_EXP_STR
              ) {
                throw PATH_ERROR;
              }
            }
          }
          nextNode = node.#children[regexpStr] = new _Node();
        }
        if (name !== "") {
          nextNode.#varIndex ??= context.varIndex++;
          paramMap.push([name, nextNode.#varIndex]);
        }
      } else {
        nextNode = node.#children[token];
        if (!nextNode) {
          for (const k in node.#children) {
            if (k.length > 1 && k !== ONLY_WILDCARD_REG_EXP_STR && k !== TAIL_WILDCARD_REG_EXP_STR) {
              throw PATH_ERROR;
            }
          }
          nextNode = node.#children[token] = new _Node();
        }
      }
      node = nextNode;
    }
    if (node.#index !== void 0) {
      throw PATH_ERROR;
    }
    node.#index = isStatic ? -1 : index;
  }
  buildRegExpStr() {
    const childKeys = Object.keys(this.#children).sort(compareKey);
    const strList = childKeys.map((k) => {
      const c = this.#children[k];
      const childStr = c.buildRegExpStr();
      return childStr === "" ? "" : (typeof c.#varIndex === "number" ? `(${k})@${c.#varIndex}` : regExpMetaChars.has(k) ? `\\${k}` : k) + childStr;
    }).filter(Boolean);
    if (typeof this.#index === "number" && this.#index !== -1) {
      strList.unshift(`#${this.#index}`);
    }
    if (strList.length === 0) {
      return "";
    }
    if (strList.length === 1) {
      return strList[0];
    }
    return "(?:" + strList.join("|") + ")";
  }
};

// node_modules/hono/dist/router/reg-exp-router/trie.js
var Trie = class {
  #context = { varIndex: 0 };
  #root = new Node();
  #index = 0;
  // dynamic path -> [handler index, param assoc]; static paths are not registered
  paths = createNullObject();
  insert(path, isStatic) {
    if (isStatic) {
      this.#root.insert(path.split(""), 0, [], this.#context, true);
      return;
    }
    const paramAssoc = [];
    const groups = [];
    let markedPath = path;
    for (let i = 0; ; ) {
      let replaced = false;
      markedPath = markedPath.replace(/\{[^}]+\}/g, (m) => {
        const mark = `@\\${i}`;
        groups[i] = [mark, m];
        i++;
        replaced = true;
        return mark;
      });
      if (!replaced) {
        break;
      }
    }
    const tokens = markedPath.match(/(?::[^\/]+)|(?:\/\*$)|./g) || [];
    for (let i = groups.length - 1; i >= 0; i--) {
      const [mark] = groups[i];
      for (let j = tokens.length - 1; j >= 0; j--) {
        if (tokens[j].indexOf(mark) !== -1) {
          tokens[j] = tokens[j].replace(mark, groups[i][1]);
          break;
        }
      }
    }
    this.#root.insert(tokens, this.#index, paramAssoc, this.#context, false);
    this.paths[path] = [this.#index++, paramAssoc];
  }
  buildRegExp() {
    let regexp = this.#root.buildRegExpStr();
    if (regexp === "") {
      return [/^$/, [], []];
    }
    let captureIndex = 0;
    const indexReplacementMap = [];
    const paramReplacementMap = [];
    regexp = regexp.replace(/#(\d+)|@(\d+)|\.\*\$/g, (_, handlerIndex, paramIndex) => {
      if (handlerIndex !== void 0) {
        indexReplacementMap[++captureIndex] = Number(handlerIndex);
        return "$()";
      }
      if (paramIndex !== void 0) {
        paramReplacementMap[Number(paramIndex)] = ++captureIndex;
        return "";
      }
      return "";
    });
    return [new RegExp(`^${regexp}`), indexReplacementMap, paramReplacementMap];
  }
};

// node_modules/hono/dist/router/reg-exp-router/router.js
var wildcardRegExpCache = createNullObject();
function buildWildcardRegExp(path) {
  return wildcardRegExpCache[path] ??= new RegExp(
    `^${path.replace(
      /\/:[^/{}]+(?:\{\[\^\/]\+})?(?=[/{]|$)|\/?\*$|([.\\+*[^\]$()?{}|])/g,
      (match2, metaChar) => metaChar ? `\\${metaChar}` : match2 === "/*" ? TAIL_WILDCARD_REG_EXP_STR : match2 === "*" ? ONLY_WILDCARD_REG_EXP_STR : `/:${LABEL_REG_EXP_STR}`
    )}$`
  );
}
function findMiddleware(middleware, path) {
  for (const k of Object.keys(middleware).sort((a, b) => b.length - a.length)) {
    if (buildWildcardRegExp(k).test(path)) {
      return [...middleware[k]];
    }
  }
  return void 0;
}
var RegExpRouter = class {
  name = "RegExpRouter";
  #middleware;
  #routes;
  #tries;
  constructor() {
    this.#middleware = { [METHOD_NAME_ALL]: createNullObject() };
    this.#routes = { [METHOD_NAME_ALL]: createNullObject() };
    this.#tries = { [METHOD_NAME_ALL]: new Trie() };
  }
  #insertPath(method, path) {
    try {
      this.#tries[method].insert(path, !/\*|\/:/.test(path));
    } catch (e) {
      throw e === PATH_ERROR ? new UnsupportedPathError(path) : e;
    }
  }
  add(method, path, handler) {
    const middleware = this.#middleware;
    const routes = this.#routes;
    if (!middleware) {
      throw new Error(MESSAGE_MATCHER_IS_ALREADY_BUILT);
    }
    if (!middleware[method]) {
      this.#tries[method] = new Trie();
      for (const handlerMap of [middleware, routes]) {
        handlerMap[method] = createNullObject();
        for (const p in handlerMap[METHOD_NAME_ALL]) {
          handlerMap[method][p] = [...handlerMap[METHOD_NAME_ALL][p]];
          this.#insertPath(method, p);
        }
      }
    }
    if (path === "/*") {
      path = "*";
    }
    const methods = method === METHOD_NAME_ALL ? Object.keys(middleware) : [method];
    if (/\*$/.test(path)) {
      const re = buildWildcardRegExp(path);
      for (const m of methods) {
        if (!middleware[m][path]) {
          this.#insertPath(m, path);
          middleware[m][path] = findMiddleware(middleware[m], path) || findMiddleware(middleware[METHOD_NAME_ALL], path) || [];
        }
      }
      for (const handlerMap of [middleware, routes]) {
        for (const m of methods) {
          for (const p in handlerMap[m]) {
            re.test(p) && handlerMap[m][p].push([handler, path]);
          }
        }
      }
      return;
    }
    const paths = checkOptionalParameter(path) || [path];
    for (const path2 of paths) {
      for (const m of methods) {
        if (!routes[m][path2]) {
          this.#insertPath(m, path2);
          routes[m][path2] = findMiddleware(middleware[m], path2) || findMiddleware(middleware[METHOD_NAME_ALL], path2) || [];
        }
        routes[m][path2].push([handler, path2]);
      }
    }
  }
  match = match;
  buildAllMatchers() {
    const matchers = createNullObject();
    for (const method of Object.keys(this.#routes)) {
      matchers[method] = this.#buildMatcher(method);
    }
    this.#middleware = this.#routes = this.#tries = void 0;
    wildcardRegExpCache = createNullObject();
    return matchers;
  }
  #buildMatcher(method) {
    const middleware = this.#middleware[method];
    const routes = this.#routes[method];
    const trie = this.#tries[method];
    const staticMap = createNullObject();
    const handlerData = [];
    const [regexp, indexReplacementMap, paramReplacementMap] = trie.buildRegExp();
    for (const r of [middleware, routes]) {
      for (const path in r) {
        const handlers = r[path];
        const pathData = trie.paths[path];
        if (!pathData) {
          staticMap[path] = [handlers.map(([h]) => [h, createNullObject()]), emptyParam];
          continue;
        }
        handlerData[pathData[0]] = handlers.map(([h, handlerPath]) => [
          h,
          trie.paths[handlerPath][1].reduceRight((map, [key], i) => {
            map[key] = paramReplacementMap[pathData[1][i][1]];
            return map;
          }, createNullObject())
        ]);
      }
    }
    return [regexp, indexReplacementMap.map((i) => handlerData[i]), staticMap];
  }
};

// node_modules/hono/dist/router/smart-router/router.js
var SmartRouter = class {
  name = "SmartRouter";
  #routers = [];
  #routes = [];
  constructor(init) {
    this.#routers = init.routers;
  }
  add(method, path, handler) {
    if (!this.#routes) {
      throw new Error(MESSAGE_MATCHER_IS_ALREADY_BUILT);
    }
    this.#routes.push([method, path, handler]);
  }
  match(method, path) {
    if (!this.#routes) {
      throw new Error("Fatal error");
    }
    const routers = this.#routers;
    const routes = this.#routes;
    const len = routers.length;
    let i = 0;
    let res;
    for (; i < len; i++) {
      const router = routers[i];
      try {
        for (let i2 = 0, len2 = routes.length; i2 < len2; i2++) {
          router.add(...routes[i2]);
        }
        res = router.match(method, path);
      } catch (e) {
        if (e instanceof UnsupportedPathError) {
          continue;
        }
        throw e;
      }
      this.match = router.match.bind(router);
      this.#routers = [router];
      this.#routes = void 0;
      break;
    }
    if (i === len) {
      throw new Error("Fatal error");
    }
    this.name = `SmartRouter + ${this.activeRouter.name}`;
    return res;
  }
  get activeRouter() {
    if (this.#routes || this.#routers.length !== 1) {
      throw new Error("No active router has been determined yet.");
    }
    return this.#routers[0];
  }
};

// node_modules/hono/dist/router/trie-router/node.js
var emptyParams = createNullObject();
var order = 0;
var Node2 = class _Node2 {
  #methods = [];
  #children = createNullObject();
  #patterns = [];
  #pattern;
  #params = emptyParams;
  insert(method, path, handler) {
    let curNode = this;
    const parts = splitRoutingPath(path);
    const possibleKeys = /* @__PURE__ */ new Set();
    let i = 0;
    for (const p of parts) {
      const nextP = parts[++i];
      const pattern = getPattern(p, nextP) || (nextP === void 0 && p && p.indexOf("*") === p.length - 1 ? p : null);
      const isParam = Array.isArray(pattern);
      const key = isParam ? pattern[0] : pattern || p;
      const child = curNode.#children[key] ||= new _Node2();
      if (pattern && !child.#pattern) {
        child.#pattern = pattern;
        curNode.#patterns.push(child);
      }
      curNode = child;
      if (isParam) {
        possibleKeys.add(pattern[1]);
      }
    }
    curNode.#methods.push({
      [method]: {
        handler,
        possibleKeys: [...possibleKeys],
        score: ++order
      }
    });
  }
  #pushHandlerSets(handlerSets, node, method, nodeParams, params) {
    for (let i = 0, len = node.#methods.length; i < len; i++) {
      const m = node.#methods[i];
      const handlerSet = m[method] || m[METHOD_NAME_ALL];
      if (handlerSet) {
        handlerSet.params = createNullObject();
        handlerSets.push(handlerSet);
        for (let i2 = 0, len2 = handlerSet.possibleKeys.length; i2 < len2; i2++) {
          const key = handlerSet.possibleKeys[i2];
          handlerSet.params[key] = params?.[key] && !i2 ? params[key] : nodeParams[key] ?? params?.[key];
        }
      }
    }
  }
  search(method, path) {
    const handlerSets = [];
    this.#params = emptyParams;
    const curNode = this;
    let curNodes = [curNode];
    const parts = splitPath(path);
    const curNodesQueue = [];
    const len = parts.length;
    let partOffsets = null;
    for (let i = 0; i < len; i++) {
      const part = parts[i];
      const isLast = i === len - 1;
      const tempNodes = [];
      for (let j = 0, len2 = curNodes.length; j < len2; j++) {
        const node = curNodes[j];
        const nextNode = node.#children[part];
        if (nextNode) {
          nextNode.#params = node.#params;
          if (isLast) {
            if (nextNode.#children["*"]) {
              this.#pushHandlerSets(handlerSets, nextNode.#children["*"], method, node.#params);
            }
            this.#pushHandlerSets(handlerSets, nextNode, method, node.#params);
          } else {
            tempNodes.push(nextNode);
          }
        }
        for (const child of node.#patterns) {
          const pattern = child.#pattern;
          const params = node.#params === emptyParams ? {} : { ...node.#params };
          if (typeof pattern === "string") {
            if (pattern === "*" || part.startsWith(pattern.slice(0, -1))) {
              this.#pushHandlerSets(handlerSets, child, method, node.#params);
              if (pattern === "*") {
                child.#params = params;
                tempNodes.push(child);
              }
            }
            continue;
          }
          const [, name, matcher] = pattern;
          if (!part && matcher === true) {
            continue;
          }
          if (matcher !== true) {
            if (!partOffsets) {
              partOffsets = [];
              let offset = path[0] === "/" ? 1 : 0;
              for (let p = 0; p < len; p++) {
                partOffsets[p] = offset;
                offset += parts[p].length + 1;
              }
            }
            const restPathString = path.slice(partOffsets[i]);
            const m = matcher.exec(restPathString);
            if (m) {
              params[name] = m[0];
              this.#pushHandlerSets(handlerSets, child, method, node.#params, params);
              if (m[0].length === restPathString.length && child.#children["*"]) {
                this.#pushHandlerSets(
                  handlerSets,
                  child.#children["*"],
                  method,
                  node.#params,
                  params
                );
              }
              for (const _ in child.#children) {
                child.#params = params;
                const componentCount = m[0].match(/\//g)?.length ?? 0;
                const targetCurNodes = curNodesQueue[componentCount] ||= [];
                targetCurNodes.push(child);
                break;
              }
              continue;
            }
          }
          if (matcher === true || matcher.test(part)) {
            params[name] = part;
            if (isLast) {
              this.#pushHandlerSets(handlerSets, child, method, params, node.#params);
              if (child.#children["*"]) {
                this.#pushHandlerSets(
                  handlerSets,
                  child.#children["*"],
                  method,
                  params,
                  node.#params
                );
              }
            } else {
              child.#params = params;
              tempNodes.push(child);
            }
          }
        }
      }
      const shifted = curNodesQueue.shift();
      curNodes = shifted ? tempNodes.concat(shifted) : tempNodes;
    }
    if (handlerSets[1]) {
      handlerSets.sort((a, b) => {
        return a.score - b.score;
      });
    }
    return [handlerSets.map(({ handler, params }) => [handler, params])];
  }
};

// node_modules/hono/dist/router/trie-router/router.js
var TrieRouter = class {
  name = "TrieRouter";
  #node = new Node2();
  add(method, path, handler) {
    for (const result of checkOptionalParameter(path) || [path]) {
      this.#node.insert(method, result, handler);
    }
  }
  match(method, path) {
    return this.#node.search(method, path);
  }
};

// node_modules/hono/dist/hono.js
var Hono2 = class extends Hono {
  /**
   * Creates an instance of the Hono class.
   *
   * @param options - Optional configuration options for the Hono instance.
   */
  constructor(options = {}) {
    super(options);
    this.router = options.router ?? new SmartRouter({
      routers: [new RegExpRouter(), new TrieRouter()]
    });
  }
};

// worker.js
var app = new Hono2();
function base64url(input) {
  if (typeof input === "string") {
    return btoa(input).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  }
  const binary = Array.from(input).map((b) => String.fromCharCode(b)).join("");
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + "murekefu-salt-2026");
  const hash = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)));
}
async function verifyPassword(password, storedHash) {
  const hash = await hashPassword(password);
  return hash === storedHash;
}
async function createToken(payload, secret, expiresIn = 86400) {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1e3);
  const body = { ...payload, iat: now, exp: now + expiresIn };
  const encodedHeader = base64url(JSON.stringify(header));
  const encodedBody = base64url(JSON.stringify(body));
  const signingInput = `${encodedHeader}.${encodedBody}`;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signingInput));
  const encodedSig = base64url(String.fromCharCode(...new Uint8Array(sig)));
  return `${signingInput}.${encodedSig}`;
}
async function verifyToken(token, secret) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    const sig = Uint8Array.from(atob(parts[2].replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
    const valid = await crypto.subtle.verify("HMAC", key, sig, new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
    if (!valid) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    if (payload.exp < Math.floor(Date.now() / 1e3)) return null;
    return payload;
  } catch {
    return null;
  }
}
function generateId() {
  return crypto.randomUUID();
}
async function getUserByEmail(c, email) {
  const { results } = await c.env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(email.toLowerCase()).all();
  return results[0] || null;
}
async function getUserFromDb(c, id) {
  const { results } = await c.env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(id).all();
  return results[0] || null;
}
async function getUserRoles(c, userId) {
  const { results: userResults } = await c.env.DB.prepare("SELECT email FROM users WHERE id = ?").bind(userId).all();
  const userEmail = userResults[0]?.email;
  const { results } = await c.env.DB.prepare(
    "SELECT r.name FROM roles r JOIN user_roles ur ON r.id = ur.role_id WHERE ur.user_id = ?"
  ).bind(userId).all();
  const roles = ["buyer"];
  results.forEach((r) => {
    if (r.name && !roles.includes(r.name)) roles.push(r.name);
  });
  if (userEmail) {
    const { results: adminResults } = await c.env.DB.prepare(
      "SELECT id FROM admin_emails WHERE email = ? AND is_active = 1"
    ).bind(userEmail).all();
    if (adminResults.length > 0 && !roles.includes("admin")) {
      roles.push("admin");
      await c.env.DB.prepare(
        "INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)"
      ).bind(userId, "role_admin").run();
    }
  }
  return roles;
}
async function requireAuth(c) {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.substring(7);
  const payload = await verifyToken(token, c.env.JWT_SECRET);
  if (!payload) return null;
  const user = await getUserFromDb(c, payload.sub);
  if (!user) return null;
  const roles = await getUserRoles(c, user.id);
  return { ...user, roles };
}
async function requireAdmin(c) {
  const user = await requireAuth(c);
  if (!user) return { error: "Unauthorized", status: 401 };
  if (!user.roles.includes("admin")) return { error: "Admin access required", status: 403 };
  return user;
}
var ASSIGNABLE_ROLES = /* @__PURE__ */ new Set(["buyer", "learner", "composer", "admin"]);
async function assignRole(c, userId, roleName) {
  if (!ASSIGNABLE_ROLES.has(roleName)) return false;
  const { results } = await c.env.DB.prepare("SELECT id FROM roles WHERE name = ?").bind(roleName).all();
  if (!results[0]) return false;
  await c.env.DB.prepare("INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)").bind(userId, results[0].id).run();
  return true;
}
async function removeRole(c, userId, roleName) {
  if (!ASSIGNABLE_ROLES.has(roleName) || roleName === "buyer") return false;
  await c.env.DB.prepare("DELETE FROM user_roles WHERE user_id = ? AND role_id = (SELECT id FROM roles WHERE name = ?)").bind(userId, roleName).run();
  return true;
}
app.post("/api/auth/register", async (c) => {
  const body = await c.req.json();
  const email = body.email?.trim().toLowerCase();
  const password = body.password;
  if (!email || !password || password.length < 6) return c.json({ error: "Email and password (6+ chars) required" }, 400);
  const existing = await getUserByEmail(c, email);
  if (existing) return c.json({ error: "Email already registered" }, 409);
  const id = generateId();
  const passwordHash = await hashPassword(password);
  await c.env.DB.prepare("INSERT INTO users (id, email, password_hash, display_name) VALUES (?, ?, ?, ?)").bind(id, email, passwordHash, body.displayName || null).run();
  await c.env.DB.prepare("INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)").bind(id, "role_buyer").run();
  const token = await createToken({ sub: id, email, roles: ["buyer"] }, c.env.JWT_SECRET);
  return c.json({ token, user: { id, email, display_name: body.displayName, roles: ["buyer"] } });
});
app.post("/api/auth/login", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const email = (body.email || "").trim().toLowerCase();
  const password = body.password;
  if (!email || !password) return c.json({ error: "Email and password required" }, 400);
  const user = await getUserByEmail(c, email);
  if (!user || !user.password_hash) return c.json({ error: "Invalid credentials" }, 401);
  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) return c.json({ error: "Invalid credentials" }, 401);
  const roles = await getUserRoles(c, user.id);
  const token = await createToken({ sub: user.id, email: user.email, roles }, c.env.JWT_SECRET);
  return c.json({ token, user: { id: user.id, email: user.email, display_name: user.display_name, avatar_url: user.avatar_url, roles } });
});
app.get("/api/auth/oauth/google", async (c) => {
  const clientId = c.env.VITE_GOOGLE_CLIENT_ID || c.env.GOOGLE_CLIENT_ID;
  const redirectUri = "https://murekefumusichub.studio/auth/callback";
  if (!clientId) return c.json({ error: "Google OAuth not configured" }, 500);
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=openid%20email%20profile&access_type=offline`;
  return c.json({ url: authUrl });
});
app.post("/api/auth/oauth/google/callback", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { code, redirect_uri } = body;
  if (!code) return c.json({ error: "Authorization code required" }, 400);
  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: c.env.VITE_GOOGLE_CLIENT_ID || c.env.GOOGLE_CLIENT_ID || "",
        client_secret: c.env.GOOGLE_CLIENT_SECRET || "",
        redirect_uri: redirect_uri || "https://murekefumusichub.studio/auth/callback",
        grant_type: "authorization_code"
      })
    });
    if (!tokenRes.ok) {
      const errBody = await tokenRes.text();
      console.error("[oauth/callback] token exchange failed:", errBody);
      return c.json({ error: "Google token exchange failed" }, 400);
    }
    const tokenData = await tokenRes.json();
    const idToken = tokenData.id_token;
    if (!idToken) return c.json({ error: "No ID token from Google" }, 400);
    const tokenInfoRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
    if (!tokenInfoRes.ok) return c.json({ error: "Google verification failed" }, 400);
    const tokenInfo = await tokenInfoRes.json();
    const expectedAud = c.env.VITE_GOOGLE_CLIENT_ID || c.env.GOOGLE_CLIENT_ID;
    if (expectedAud && tokenInfo.aud !== expectedAud) return c.json({ error: "Invalid audience" }, 401);
    if (!tokenInfo.email_verified) return c.json({ error: "Email not verified" }, 401);
    const email = tokenInfo.email;
    const displayName = tokenInfo.name || null;
    const picture = tokenInfo.picture || null;
    let user = await getUserByEmail(c, email);
    if (!user) {
      const id = generateId();
      await c.env.DB.prepare("INSERT INTO users (id, email, display_name, avatar_url, email_verified) VALUES (?, ?, ?, ?, ?)").bind(id, email, displayName, picture, 1).run();
      await c.env.DB.prepare("INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)").bind(id, "role_buyer").run();
      user = await getUserFromDb(c, id);
    }
    const roles = await getUserRoles(c, user.id);
    const token = await createToken({ sub: user.id, email: user.email, roles }, c.env.JWT_SECRET);
    return c.json({ token, user: { id: user.id, email: user.email, display_name: user.display_name, avatar_url: user.avatar_url, roles } });
  } catch (e) {
    return c.json({ error: "Google verification failed" }, 400);
  }
});
app.post("/api/auth/oauth/google", async (c) => {
  const body = await c.req.json();
  const { idToken } = body;
  if (!idToken) return c.json({ error: "ID token required" }, 400);
  try {
    const tokenInfoRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`);
    if (!tokenInfoRes.ok) {
      return c.json({ error: "Google verification failed" }, 400);
    }
    const tokenInfo = await tokenInfoRes.json();
    const clientId = c.env.VITE_GOOGLE_CLIENT_ID;
    if (clientId && tokenInfo.aud !== clientId) {
      return c.json({ error: "Invalid audience" }, 401);
    }
    if (!tokenInfo.email_verified) {
      return c.json({ error: "Email not verified" }, 401);
    }
    const email = tokenInfo.email;
    const displayName = tokenInfo.name || null;
    const picture = tokenInfo.picture || null;
    let user = await getUserByEmail(c, email);
    if (!user) {
      const id = generateId();
      await c.env.DB.prepare("INSERT INTO users (id, email, display_name, avatar_url, email_verified) VALUES (?, ?, ?, ?, ?)").bind(id, email, displayName, picture, 1).run();
      await c.env.DB.prepare("INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)").bind(id, "role_buyer").run();
      user = await getUserFromDb(c, id);
    }
    const roles = await getUserRoles(c, user.id);
    const token = await createToken({ sub: user.id, email: user.email, roles }, c.env.JWT_SECRET);
    return c.json({ token, user: { id: user.id, email: user.email, display_name: user.display_name, avatar_url: user.avatar_url, roles } });
  } catch (e) {
    return c.json({ error: "Google verification failed" }, 400);
  }
});
function safeParseJson(value) {
  if (value === null || value === void 0) return null;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
function publicUser(user, roles) {
  return {
    id: user.id,
    email: user.email,
    display_name: user.display_name,
    avatar_url: user.avatar_url,
    phone: user.phone,
    roles: roles || user.roles || []
  };
}
app.get("/api/auth/me", async (c) => {
  const user = await requireAuth(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  const roles = await getUserRoles(c, user.id);
  return c.json({ user: publicUser(user, roles) });
});
app.get("/api/auth/verify", async (c) => {
  const user = await requireAuth(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  const roles = await getUserRoles(c, user.id);
  return c.json({ user: publicUser(user, roles) });
});
app.post("/api/auth/refresh", async (c) => {
  const user = await requireAuth(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  const roles = await getUserRoles(c, user.id);
  const token = await createToken({ sub: user.id, email: user.email, roles }, c.env.JWT_SECRET);
  return c.json({ token, user: publicUser(user, roles) });
});
app.post("/api/auth/update-password", async (c) => {
  const user = await requireAuth(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  let payload;
  try {
    payload = await c.req.json();
  } catch {
    payload = {};
  }
  const newPassword = String(payload.password || "");
  if (newPassword.length < 6) {
    return c.json({ error: "Password must be at least 6 characters" }, 400);
  }
  const currentPassword = String(payload.current_password || payload.currentPassword || "");
  if (currentPassword) {
    const valid = await verifyPassword(currentPassword, user.password_hash);
    if (!valid) return c.json({ error: "Current password is incorrect" }, 403);
  }
  const hash = await hashPassword(newPassword);
  await c.env.DB.prepare("UPDATE users SET password_hash = ? WHERE id = ?").bind(hash, user.id).run();
  return c.json({ success: true, user: publicUser(user, await getUserRoles(c, user.id)) });
});
app.post("/api/auth/reset-password", async (c) => {
  let payload;
  try {
    payload = await c.req.json();
  } catch {
    payload = {};
  }
  const email = String(payload.email || "").trim().toLowerCase();
  if (!email) return c.json({ error: "Email is required" }, 400);
  const user = await getUserByEmail(c, email);
  if (!user || !user.is_active) {
    return c.json({
      success: false,
      error: "Password reset is not available yet. Please contact an administrator."
    }, 503);
  }
  return c.json({
    success: false,
    error: "Password reset email delivery is not configured. Please contact an administrator."
  }, 503);
});
app.post("/api/auth/logout", async (c) => {
  return c.json({ success: true });
});
app.post("/api/request-role", async (c) => {
  const user = await requireAuth(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  const body = await c.req.json();
  const { requestedRole } = body;
  if (!["learner", "composer"].includes(requestedRole)) return c.json({ error: "Unsupported role" }, 400);
  const id = generateId();
  await c.env.DB.prepare(
    "INSERT INTO role_requests (id, user_id, requested_role, status, requested_at) VALUES (?, ?, ?, ?, ?)"
  ).bind(id, user.id, requestedRole, "pending", (/* @__PURE__ */ new Date()).toISOString()).run();
  return c.json({ success: true, requestId: id });
});
app.get("/api/request-role/status", async (c) => {
  const user = await requireAuth(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  const requestedRole = c.req.query("requestedRole");
  const allowedRoles = ["composer", "admin"];
  if (requestedRole && !allowedRoles.includes(requestedRole)) {
    return c.json({ error: "Unsupported role" }, 400);
  }
  try {
    const query = requestedRole ? "SELECT * FROM role_requests WHERE user_id = ? AND requested_role = ? ORDER BY requested_at DESC LIMIT 1" : "SELECT * FROM role_requests WHERE user_id = ? ORDER BY requested_at DESC";
    const params = requestedRole ? [user.id, requestedRole] : [user.id];
    const { results } = await c.env.DB.prepare(query).bind(...params).all();
    if (requestedRole) return c.json({ request: results[0] || null });
    const latest = {};
    for (const row of results || []) {
      if (row.requested_role && !latest[row.requested_role]) latest[row.requested_role] = row;
    }
    return c.json({
      roles: await getUserRoles(c, user.id),
      requests: {
        composer: latest.composer?.status || "none",
        admin: latest.admin?.status || "none"
      }
    });
  } catch (error) {
    console.error("[request-role/status]", error);
    return c.json({ error: "Unable to load role request status" }, 500);
  }
});
app.get("/api/request-role/invite-status", async (c) => {
  const user = await requireAuth(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  const requestedRole = c.req.query("requestedRole") || "composer";
  const { results: invites } = await c.env.DB.prepare(
    "SELECT * FROM invites WHERE email = ? AND used = 0"
  ).bind(user.email).all();
  if (invites.length > 0) {
    return c.json({ available: true, requestedRole, canAccept: true, invite: invites[0] });
  }
  return c.json({ available: false, requestedRole });
});
app.get("/api/users/by-auth-uid/:authUid", async (c) => {
  const authUid = c.req.param("authUid");
  const row = await getUserFromDb(c, authUid);
  if (!row) return c.json({}, 404);
  const roles = await getUserRoles(c, row.id);
  return c.json({
    id: row.id,
    auth_uid: row.id,
    email: row.email,
    display_name: row.display_name,
    phone: row.phone ?? null,
    avatar_url: row.avatar_url,
    theme_settings: row.theme_settings ? safeParseJson(row.theme_settings) : null,
    is_active: row.is_active,
    created_at: row.created_at,
    roles
  });
});
app.post("/api/users/ensure", async (c) => {
  const user = await requireAuth(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  let payload;
  try {
    payload = await c.req.json();
  } catch {
    payload = {};
  }
  const roles = await getUserRoles(c, user.id);
  const { results: existingRoles } = await c.env.DB.prepare("SELECT role_id FROM user_roles WHERE user_id = ?").bind(user.id).all();
  if (!existingRoles || existingRoles.length === 0) {
    await c.env.DB.prepare("INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)").bind(user.id, "role_buyer").run();
  }
  if (payload.display_name && !user.display_name) {
    await c.env.DB.prepare("UPDATE users SET display_name = ? WHERE id = ?").bind(payload.display_name, user.id).run();
  }
  if (payload.avatar_url && !user.avatar_url) {
    await c.env.DB.prepare("UPDATE users SET avatar_url = ? WHERE id = ?").bind(payload.avatar_url, user.id).run();
  }
  return c.json({
    success: true,
    user: {
      id: user.id,
      auth_uid: user.id,
      email: user.email,
      display_name: user.display_name || payload.display_name || null,
      phone: user.phone ?? null,
      avatar_url: user.avatar_url || payload.avatar_url || null,
      theme_settings: user.theme_settings ? safeParseJson(user.theme_settings) : null,
      roles
    }
  });
});
app.get("/api/users/:id", async (c) => {
  const row = await getUserFromDb(c, c.req.param("id"));
  if (!row) return c.json({}, 404);
  const roles = await getUserRoles(c, row.id);
  return c.json({ ...publicUser(row, roles), auth_uid: row.id, theme_settings: row.theme_settings ? safeParseJson(row.theme_settings) : null });
});
app.get("/api/user/roles/:userId", async (c) => {
  const roles = await getUserRoles(c, c.req.param("userId"));
  return c.json(roles);
});
app.put("/api/account", async (c) => {
  const user = await requireAuth(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  let body;
  try {
    body = await c.req.json();
  } catch (err) {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
  const { themeSettings, display_name, displayName, phone } = body || {};
  const newDisplayName = display_name ?? displayName;
  try {
    const sets = [];
    const binds = [];
    if (newDisplayName !== void 0) {
      sets.push("display_name = ?");
      binds.push(newDisplayName);
    }
    if (phone !== void 0) {
      sets.push("phone = ?");
      binds.push(phone);
    }
    if (themeSettings !== void 0) {
      const value = typeof themeSettings === "string" ? themeSettings : JSON.stringify(themeSettings);
      sets.push("theme_settings = ?");
      binds.push(value);
    }
    if (sets.length) {
      binds.push(user.id);
      await c.env.DB.prepare(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`).bind(...binds).run();
    }
  } catch (err) {
    console.error("[account] update failed:", err && err.message);
    return c.json({ error: "Failed to update account settings" }, 500);
  }
  const updated = await getUserFromDb(c, user.id);
  const roles = await getUserRoles(c, user.id);
  return c.json({
    user: updated ? { ...publicUser(updated, roles), theme_settings: safeParseJson(updated.theme_settings) } : null,
    theme_settings: updated?.theme_settings ? safeParseJson(updated.theme_settings) : themeSettings ?? null
  });
});
function decorateComposition(row) {
  if (!row) return row;
  return {
    ...row,
    file_url: row.pdf_r2_key ?? null,
    thumbnail_url: row.thumbnail_r2_key ?? null,
    midi_url: row.midi_r2_key ?? row.midi_url ?? null
  };
}
app.get("/api/compositions", async (c) => {
  const { results } = await c.env.DB.prepare("SELECT * FROM compositions WHERE deleted = 0 ORDER BY created_at DESC LIMIT 100").all();
  return c.json((results || []).map(decorateComposition));
});
app.get("/api/compositions/:id", async (c) => {
  const { results } = await c.env.DB.prepare("SELECT * FROM compositions WHERE id = ?").bind(c.req.param("id")).all();
  return c.json(results[0] ? decorateComposition(results[0]) : {});
});
app.get("/api/compositions/composer/:composerId", async (c) => {
  const { results } = await c.env.DB.prepare("SELECT * FROM compositions WHERE composer_id = ? AND deleted = 0 ORDER BY created_at DESC").bind(c.req.param("composerId")).all();
  return c.json((results || []).map(decorateComposition));
});
app.post("/api/compositions", async (c) => {
  const user = await requireAuth(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  const body = await c.req.json();
  const id = generateId();
  await c.env.DB.prepare(
    "INSERT INTO compositions (id, composer_id, title, description, category_id, price, pdf_r2_key, thumbnail_r2_key, midi_r2_key, is_published) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).bind(
    id,
    user.id,
    body.title,
    body.description || null,
    body.category_id || null,
    body.price || 0,
    body.file_url || body.pdf_r2_key || null,
    body.thumbnail_url || body.thumbnail_r2_key || null,
    body.midi_url || body.midi_r2_key || null,
    body.is_published ? 1 : 0
  ).run();
  return c.json({ success: true, id });
});
app.put("/api/compositions/:id", async (c) => {
  const user = await requireAuth(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  const body = await c.req.json();
  await c.env.DB.prepare(
    "UPDATE compositions SET title = ?, description = ?, category_id = ?, price = ?, pdf_r2_key = ?, thumbnail_r2_key = ?, midi_r2_key = ?, is_published = ? WHERE id = ? AND composer_id = ?"
  ).bind(
    body.title,
    body.description || null,
    body.category_id || null,
    body.price || 0,
    body.file_url || body.pdf_r2_key || null,
    body.thumbnail_url || body.thumbnail_r2_key || null,
    body.midi_url || body.midi_r2_key || null,
    body.is_published ? 1 : 0,
    c.req.param("id"),
    user.id
  ).run();
  return c.json({ success: true });
});
app.delete("/api/compositions/:id", async (c) => {
  const user = await requireAuth(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  await c.env.DB.prepare("UPDATE compositions SET deleted = 1 WHERE id = ? AND composer_id = ?").bind(c.req.param("id"), user.id).run();
  return c.json({ success: true });
});
app.get("/api/arrangements", async (c) => {
  const { results } = await c.env.DB.prepare("SELECT * FROM arrangements WHERE deleted = 0 ORDER BY created_at DESC LIMIT 100").all();
  return c.json(results);
});
app.get("/api/arrangements/arranger/:arrangerId", async (c) => {
  const { results } = await c.env.DB.prepare("SELECT * FROM arrangements WHERE arranger_id = ? AND deleted = 0 ORDER BY created_at DESC").bind(c.req.param("arrangerId")).all();
  return c.json(results);
});
app.get("/api/arrangements/:id", async (c) => {
  const { results } = await c.env.DB.prepare("SELECT * FROM arrangements WHERE id = ?").bind(c.req.param("id")).all();
  return c.json(results[0] || {});
});
app.post("/api/arrangements", async (c) => {
  const user = await requireAuth(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  const body = await c.req.json();
  const id = generateId();
  await c.env.DB.prepare(
    "INSERT INTO arrangements (id, arranger_id, title, description, category_id, price, file_url, thumbnail_url, is_published) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).bind(id, user.id, body.title, body.description || null, body.category_id || null, body.price || 0, body.file_url || null, body.thumbnail_url || null, body.is_published ? 1 : 0).run();
  return c.json({ success: true, id });
});
app.put("/api/arrangements/:id", async (c) => {
  const user = await requireAuth(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  const body = await c.req.json();
  await c.env.DB.prepare(
    "UPDATE arrangements SET title = ?, description = ?, category_id = ?, price = ?, file_url = ?, thumbnail_url = ?, is_published = ? WHERE id = ? AND arranger_id = ?"
  ).bind(body.title, body.description || null, body.category_id || null, body.price || 0, body.file_url || null, body.thumbnail_url || null, body.is_published ? 1 : 0, c.req.param("id"), user.id).run();
  return c.json({ success: true });
});
app.delete("/api/arrangements/:id", async (c) => {
  const user = await requireAuth(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  await c.env.DB.prepare("UPDATE arrangements SET deleted = 1 WHERE id = ? AND arranger_id = ?").bind(c.req.param("id"), user.id).run();
  return c.json({ success: true });
});
app.get("/api/categories", async (c) => {
  const { results } = await c.env.DB.prepare("SELECT * FROM categories ORDER BY name").all();
  return c.json(results);
});
app.get("/api/purchases", async (c) => {
  const user = await requireAuth(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  const { results } = await c.env.DB.prepare("SELECT * FROM purchases WHERE buyer_id = ? ORDER BY created_at DESC").bind(user.id).all();
  return c.json(results);
});
app.get("/api/purchases/recommendations", async (c) => {
  const user = await requireAuth(c);
  if (!user) return c.json({ recommendations: [] });
  const limit = parseInt(c.req.query("limit") || "6");
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM compositions WHERE is_published = 1 AND deleted = 0 ORDER BY created_at DESC LIMIT ?"
  ).bind(limit).all();
  return c.json({ recommendations: results });
});
app.post("/api/purchases", async (c) => {
  const user = await requireAuth(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  const body = await c.req.json();
  const id = generateId();
  await c.env.DB.prepare(
    "INSERT INTO purchases (id, buyer_id, composition_id, price_paid, payment_ref) VALUES (?, ?, ?, ?, ?)"
  ).bind(id, user.id, body.composition_id, body.price || 0, body.payment_ref || null).run();
  return c.json({ success: true, id });
});
app.get("/api/enrollments/my", async (c) => {
  const user = await requireAuth(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  const limit = parseInt(c.req.query("limit") || "24");
  const { results } = await c.env.DB.prepare("SELECT * FROM enrollments WHERE user_id = ? ORDER BY created_at DESC LIMIT ?").bind(user.id, limit).all();
  return c.json(results);
});
app.post("/api/enrollments", async (c) => {
  const user = await requireAuth(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  let body;
  try {
    body = await c.req.json();
  } catch {
    body = {};
  }
  const fullName = String(body.full_name || "").trim();
  const musicClass = String(body.music_class || "").trim();
  const skillLevel = String(body.skill_level || "").trim();
  if (!fullName) return c.json({ error: "full_name is required" }, 400);
  if (!musicClass) return c.json({ error: "music_class is required" }, 400);
  if (!skillLevel) return c.json({ error: "skill_level is required" }, 400);
  const email = String(body.email || user.email || "").trim().toLowerCase();
  if (!email) return c.json({ error: "email is required" }, 400);
  const { results: dupes } = await c.env.DB.prepare(
    `SELECT id FROM enrollments
       WHERE user_id = ? AND music_class = ? AND status IN ('pending','approved')
       LIMIT 1`
  ).bind(user.id, musicClass).all();
  if (dupes && dupes.length) {
    return c.json({ error: "You already have an application for this class" }, 409);
  }
  const id = generateId();
  await c.env.DB.prepare(
    `INSERT INTO enrollments
         (id, user_id, full_name, email, music_class, skill_level, notes, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', datetime('now'))`
  ).bind(
    id,
    user.id,
    fullName,
    email,
    musicClass,
    skillLevel,
    body.notes ? String(body.notes) : null
  ).run();
  const { results } = await c.env.DB.prepare("SELECT * FROM enrollments WHERE id = ?").bind(id).all();
  return c.json({
    success: true,
    message: "Your application has been received and is awaiting review.",
    enrollment: results[0] || { id, status: "pending" }
  });
});
app.get("/api/enrollments/all", async (c) => {
  const admin = await requireAdmin(c);
  if (admin.error) return c.json({ error: admin.error }, admin.status);
  const { results } = await c.env.DB.prepare("SELECT * FROM enrollments ORDER BY created_at DESC LIMIT 200").all();
  return c.json({ enrollments: results || [] });
});
app.get("/api/registration/regulations", async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM registration_regulations LIMIT 1"
  ).all();
  if (results.length > 0) {
    return c.json(results[0]);
  }
  return c.json({
    enrollmentFee: 0,
    composerRequestFee: 0,
    bankName: "I&M Bank",
    bankAccountNumber: "0030 7335 5161 50",
    accountName: "Murekefu Music Hub"
  });
});
app.get("/api/registration/payments/my", async (c) => {
  const user = await requireAuth(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  const type = c.req.query("type");
  let query = "SELECT * FROM payment_submissions WHERE user_id = ?";
  const params = [user.id];
  if (type) {
    query += " AND type = ?";
    params.push(type);
  }
  query += " ORDER BY submitted_at DESC";
  try {
    const { results } = await c.env.DB.prepare(query).bind(...params).all();
    return c.json(results || []);
  } catch (error) {
    console.error("[registration/payments/my]", error);
    return c.json({ error: "Unable to load payment submissions" }, 500);
  }
});
app.get("/api/support/inbox", async (c) => {
  const user = await requireAuth(c);
  if (!user) return c.json({ message: "Unauthorized" }, 401);
  const limit = parseInt(c.req.query("limit") || "100");
  const isAdmin = user.roles.includes("admin");
  let query = "SELECT * FROM support_threads";
  const params = [];
  if (!isAdmin) {
    query += " WHERE requester_user_id = ?";
    params.push(user.id);
  }
  query += " ORDER BY updated_at DESC LIMIT ?";
  params.push(limit);
  const { results } = await c.env.DB.prepare(query).bind(...params).all();
  return c.json({ threads: results });
});
app.post("/api/support/threads", async (c) => {
  const user = await requireAuth(c);
  if (!user) return c.json({ message: "Unauthorized" }, 401);
  const body = await c.req.json();
  const id = generateId();
  await c.env.DB.prepare(
    "INSERT INTO support_threads (id, requester_user_id, subject, context, status) VALUES (?, ?, ?, ?, ?)"
  ).bind(id, user.id, body.subject || "Support Request", body.context || null, "open").run();
  if (body.message) {
    const msgId = generateId();
    await c.env.DB.prepare(
      "INSERT INTO support_messages (id, thread_id, sender_user_id, sender_role, message) VALUES (?, ?, ?, ?, ?)"
    ).bind(msgId, id, user.id, "member", body.message).run();
  }
  return c.json({ success: true, threadId: id });
});
app.get("/api/support/threads/:id/messages", async (c) => {
  const user = await requireAuth(c);
  if (!user) return c.json({ message: "Unauthorized" }, 401);
  const threadId = c.req.param("id");
  const { results: threads } = await c.env.DB.prepare(
    "SELECT * FROM support_threads WHERE id = ? LIMIT 1"
  ).bind(threadId).all();
  const thread = threads[0];
  if (!thread) return c.json({ message: "That item could not be found. Please refresh and try again." }, 404);
  const isAdmin = user.roles.includes("admin");
  if (!isAdmin && thread.requester_user_id !== user.id) return c.json({ message: "Forbidden" }, 403);
  const { results: messages } = await c.env.DB.prepare(
    "SELECT * FROM support_messages WHERE thread_id = ? ORDER BY created_at ASC"
  ).bind(threadId).all();
  return c.json({ thread, messages: messages || [], admin: isAdmin, actorRole: isAdmin ? "admin" : "member" });
});
app.post("/api/support/threads/:id/messages", async (c) => {
  const user = await requireAuth(c);
  if (!user) return c.json({ message: "Unauthorized" }, 401);
  const threadId = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const message = String(body.message || "").trim();
  if (!message) return c.json({ message: "Message is required" }, 400);
  const { results: threads } = await c.env.DB.prepare(
    "SELECT * FROM support_threads WHERE id = ? LIMIT 1"
  ).bind(threadId).all();
  const thread = threads[0];
  if (!thread) return c.json({ message: "That item could not be found. Please refresh and try again." }, 404);
  const isAdmin = user.roles.includes("admin");
  if (!isAdmin && thread.requester_user_id !== user.id) return c.json({ message: "Forbidden" }, 403);
  const messageId = generateId();
  const senderRole = isAdmin ? "admin" : "member";
  await c.env.DB.prepare(
    "INSERT INTO support_messages (id, thread_id, sender_user_id, sender_role, message) VALUES (?, ?, ?, ?, ?)"
  ).bind(messageId, threadId, user.id, senderRole, message).run();
  await c.env.DB.prepare(
    "UPDATE support_threads SET updated_at = datetime('now'), is_admin_unread = ? WHERE id = ?"
  ).bind(isAdmin ? 0 : 1, threadId).run();
  const { results: saved } = await c.env.DB.prepare(
    "SELECT * FROM support_messages WHERE id = ? LIMIT 1"
  ).bind(messageId).all();
  const { results: updated } = await c.env.DB.prepare(
    "SELECT * FROM support_threads WHERE id = ? LIMIT 1"
  ).bind(threadId).all();
  return c.json({ success: true, thread: updated[0], message: saved[0], senderRole });
});
app.post("/api/support/threads/:id/read", async (c) => {
  const user = await requireAuth(c);
  if (!user) return c.json({ message: "Unauthorized" }, 401);
  const threadId = c.req.param("id");
  const { results: threads } = await c.env.DB.prepare(
    "SELECT * FROM support_threads WHERE id = ? LIMIT 1"
  ).bind(threadId).all();
  const thread = threads[0];
  if (!thread) return c.json({ message: "That item could not be found. Please refresh and try again." }, 404);
  const isAdmin = user.roles.includes("admin");
  if (!isAdmin && thread.requester_user_id !== user.id) return c.json({ message: "Forbidden" }, 403);
  if (isAdmin) {
    await c.env.DB.prepare("UPDATE support_threads SET is_admin_unread = 0 WHERE id = ?").bind(threadId).run();
  }
  const { results: updated } = await c.env.DB.prepare(
    "SELECT * FROM support_threads WHERE id = ? LIMIT 1"
  ).bind(threadId).all();
  return c.json({ success: true, thread: updated[0], admin: isAdmin, actorRole: isAdmin ? "admin" : "member" });
});
app.get("/api/support/admin/tickets", async (c) => {
  const admin = await requireAdmin(c);
  if (admin.error) return c.json({ error: admin.error }, admin.status);
  const limit = parseInt(c.req.query("limit") || "200");
  const { results } = await c.env.DB.prepare("SELECT * FROM support_threads ORDER BY updated_at DESC LIMIT ?").bind(limit).all();
  return c.json({ tickets: results });
});
app.get("/api/support/admin/threads", async (c) => {
  const admin = await requireAdmin(c);
  if (admin.error) return c.json({ error: admin.error }, admin.status);
  const limit = parseInt(c.req.query("limit") || "200");
  const state = c.req.query("state");
  let query = "SELECT * FROM support_threads";
  const params = [];
  if (state && state !== "all") {
    query += " WHERE status = ?";
    params.push(state);
  }
  query += " ORDER BY updated_at DESC LIMIT ?";
  params.push(limit);
  const { results } = await c.env.DB.prepare(query).bind(...params).all();
  return c.json({ threads: results });
});
app.get("/api/admin/bootstrap", async (c) => {
  const admin = await requireAdmin(c);
  if (admin.error) return c.json({ error: admin.error }, admin.status);
  const { results: roles } = await c.env.DB.prepare("SELECT * FROM roles").all();
  const { results: invites } = await c.env.DB.prepare("SELECT * FROM invites ORDER BY created_at DESC LIMIT 50").all();
  const { results: requests } = await c.env.DB.prepare("SELECT * FROM role_requests WHERE status = 'pending' ORDER BY requested_at DESC LIMIT 50").all();
  return c.json({ roles: roles || [], invites: invites || [], requests: requests || [], stats: { totalUsers: 0, totalCompositions: 0, totalTransactions: 0, totalRevenue: 0 } });
});
app.get("/api/admin/users", async (c) => {
  const admin = await requireAdmin(c);
  if (admin.error) return c.json({ error: admin.error }, admin.status);
  const { results } = await c.env.DB.prepare("SELECT id, email, display_name, avatar_url, is_active, created_at FROM users ORDER BY created_at DESC").all();
  const { results: userRoles } = await c.env.DB.prepare("SELECT ur.user_id, r.id AS role_id, r.name AS role_name FROM user_roles ur JOIN roles r ON r.id = ur.role_id").all();
  const roleMap = /* @__PURE__ */ new Map();
  (userRoles || []).forEach((row) => {
    if (!roleMap.has(row.user_id)) roleMap.set(row.user_id, []);
    roleMap.get(row.user_id).push(row.role_name);
  });
  return c.json({ users: (results || []).map((u) => ({ ...u, roles: roleMap.get(u.id) || ["buyer"] })), userRoles: userRoles || [] });
});
app.get("/api/admin/compositions", async (c) => {
  const admin = await requireAdmin(c);
  if (admin.error) return c.json({ error: admin.error }, admin.status);
  const { results } = await c.env.DB.prepare("SELECT * FROM compositions ORDER BY created_at DESC").all();
  return c.json(results);
});
app.get("/api/admin/transactions", async (c) => {
  const admin = await requireAdmin(c);
  if (admin.error) return c.json({ error: admin.error }, admin.status);
  const limit = parseInt(c.req.query("limit") || "50");
  const { results } = await c.env.DB.prepare("SELECT * FROM purchases ORDER BY created_at DESC LIMIT ?").bind(limit).all();
  return c.json({ transactions: results });
});
app.get("/api/admin/enrollments", async (c) => {
  const admin = await requireAdmin(c);
  if (admin.error) return c.json({ error: admin.error }, admin.status);
  const limit = parseInt(c.req.query("limit") || "100");
  const status = c.req.query("status");
  let query = "SELECT * FROM enrollments";
  const params = [];
  if (status && status !== "all") {
    query += " WHERE status = ?";
    params.push(status);
  }
  query += " ORDER BY created_at DESC LIMIT ?";
  params.push(limit);
  const { results } = await c.env.DB.prepare(query).bind(...params).all();
  return c.json({ enrollments: results });
});
app.get("/api/admin/stats", async (c) => {
  const admin = await requireAdmin(c);
  if (admin.error) return c.json({ error: admin.error }, admin.status);
  const { results: uc } = await c.env.DB.prepare("SELECT COUNT(*) as count FROM users").all();
  const { results: cc } = await c.env.DB.prepare("SELECT COUNT(*) as count FROM compositions WHERE deleted = 0").all();
  const { results: pc } = await c.env.DB.prepare("SELECT COUNT(*) as count FROM purchases").all();
  return c.json({ totalUsers: uc[0]?.count || 0, totalCompositions: cc[0]?.count || 0, totalTransactions: pc[0]?.count || 0, totalRevenue: 0 });
});
app.get("/api/admin/invites", async (c) => {
  const auth = await requireAdmin(c);
  if (auth.error) return c.json({ error: auth.error }, auth.status);
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM invites ORDER BY created_at DESC LIMIT 50"
  ).all();
  return c.json(results || []);
});
app.post("/api/admin/invites", async (c) => {
  const auth = await requireAdmin(c);
  if (auth.error) return c.json({ error: auth.error }, auth.status);
  const body = await c.req.json().catch(() => ({}));
  const email = String(body.email || "").trim().toLowerCase();
  if (!email) return c.json({ error: "Email is required" }, 400);
  const invitedBy = body.invited_by || auth.user?.id;
  if (!invitedBy) return c.json({ error: "Inviting admin could not be identified" }, 400);
  const id = crypto.randomUUID();
  try {
    await c.env.DB.prepare(
      "INSERT INTO invites (id, email, invited_by, requested_role, created_at, used) VALUES (?, ?, ?, ?, ?, 0)"
    ).bind(id, email, invitedBy, body.requested_role || "composer", (/* @__PURE__ */ new Date()).toISOString()).run();
    const { results } = await c.env.DB.prepare("SELECT * FROM invites WHERE id = ?").bind(id).all();
    return c.json(results?.[0] || { id, email, invited_by: invitedBy, requested_role: body.requested_role || "composer", used: 0 }, 201);
  } catch (err) {
    if (String(err?.message || err).toLowerCase().includes("unique")) {
      return c.json({ error: "An invite already exists for this email" }, 409);
    }
    return c.json({ error: "Failed to create invite" }, 500);
  }
});
app.delete("/api/admin/invites/:email", async (c) => {
  const auth = await requireAdmin(c);
  if (auth.error) return c.json({ error: auth.error }, auth.status);
  const email = decodeURIComponent(c.req.param("email") || "").trim().toLowerCase();
  await c.env.DB.prepare("DELETE FROM invites WHERE email = ?").bind(email).run();
  return c.json({ success: true });
});
app.get("/api/admin/composer-requests", async (c) => {
  const auth = await requireAdmin(c);
  if (auth.error) return c.json({ error: auth.error }, auth.status);
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM role_requests WHERE status = 'pending' ORDER BY requested_at DESC LIMIT 50"
  ).all();
  return c.json({ requests: results || [] });
});
app.post("/api/admin/role-requests/:userId/accept", async (c) => {
  const admin = await requireAdmin(c);
  if (admin.error) return c.json({ error: admin.error }, admin.status);
  const userId = c.req.param("userId");
  const body = await c.req.json().catch(() => ({}));
  const requestedRole = body.requestedRole || "composer";
  if (!["learner", "composer"].includes(requestedRole)) return c.json({ error: "Unsupported role" }, 400);
  if (!await assignRole(c, userId, requestedRole)) return c.json({ error: "Role not configured" }, 500);
  await c.env.DB.prepare("UPDATE role_requests SET status = 'approved' WHERE user_id = ? AND requested_role = ? AND status = 'pending'").bind(userId, requestedRole).run();
  return c.json({ success: true });
});
app.post("/api/admin/role-requests/:userId/reject", async (c) => {
  const admin = await requireAdmin(c);
  if (admin.error) return c.json({ error: admin.error }, admin.status);
  const userId = c.req.param("userId");
  await c.env.DB.prepare("UPDATE role_requests SET status = 'rejected' WHERE user_id = ? AND status = 'pending'").bind(userId).run();
  return c.json({ success: true });
});
app.post("/api/admin/users/:id/promote-composer", async (c) => {
  const admin = await requireAdmin(c);
  if (admin.error) return c.json({ error: admin.error }, admin.status);
  const userId = c.req.param("id");
  await assignRole(c, userId, "composer");
  return c.json({ success: true });
});
app.post("/api/admin/users/:id/promote-admin", async (c) => {
  const admin = await requireAdmin(c);
  if (admin.error) return c.json({ error: admin.error }, admin.status);
  const userId = c.req.param("id");
  await assignRole(c, userId, "admin");
  return c.json({ success: true });
});
app.post("/api/admin/users/:id/demote-composer", async (c) => {
  const admin = await requireAdmin(c);
  if (admin.error) return c.json({ error: admin.error }, admin.status);
  const userId = c.req.param("id");
  await removeRole(c, userId, "composer");
  return c.json({ success: true });
});
app.post("/api/admin/users/:id/demote-admin", async (c) => {
  const admin = await requireAdmin(c);
  if (admin.error) return c.json({ error: admin.error }, admin.status);
  const userId = c.req.param("id");
  if (userId === admin.id) return c.json({ error: "You cannot remove your own admin role" }, 400);
  await removeRole(c, userId, "admin");
  return c.json({ success: true });
});
app.post("/api/admin/users/:id/roles", async (c) => {
  const admin = await requireAdmin(c);
  if (admin.error) return c.json({ error: admin.error }, admin.status);
  const userId = c.req.param("id");
  const body = await c.req.json();
  const roleName = String(body.role || "").trim().toLowerCase();
  if (!ASSIGNABLE_ROLES.has(roleName)) return c.json({ error: "Unsupported role" }, 400);
  if (!await assignRole(c, userId, roleName)) return c.json({ error: "Role not configured" }, 500);
  return c.json({ success: true, roles: await getUserRoles(c, userId) });
});
app.delete("/api/admin/users/:id/roles/:role", async (c) => {
  const admin = await requireAdmin(c);
  if (admin.error) return c.json({ error: admin.error }, admin.status);
  const userId = c.req.param("id");
  const roleName = String(c.req.param("role") || "").trim().toLowerCase();
  if (userId === admin.id && roleName === "admin") return c.json({ error: "You cannot remove your own admin role" }, 400);
  if (!await removeRole(c, userId, roleName)) return c.json({ error: "Unsupported role" }, 400);
  return c.json({ success: true, roles: await getUserRoles(c, userId) });
});
app.post("/api/admin/users/:id/suspend", async (c) => {
  const admin = await requireAdmin(c);
  if (admin.error) return c.json({ error: admin.error }, admin.status);
  const userId = c.req.param("id");
  await c.env.DB.prepare("UPDATE users SET is_active = 0 WHERE id = ?").bind(userId).run();
  return c.json({ success: true });
});
app.post("/api/admin/users/:id/unsuspend", async (c) => {
  const admin = await requireAdmin(c);
  if (admin.error) return c.json({ error: admin.error }, admin.status);
  const userId = c.req.param("id");
  await c.env.DB.prepare("UPDATE users SET is_active = 1 WHERE id = ?").bind(userId).run();
  return c.json({ success: true });
});
app.delete("/api/admin/users/:id", async (c) => {
  const admin = await requireAdmin(c);
  if (admin.error) return c.json({ error: admin.error }, admin.status);
  const userId = c.req.param("id");
  await c.env.DB.prepare("DELETE FROM user_roles WHERE user_id = ?").bind(userId).run();
  await c.env.DB.prepare("DELETE FROM users WHERE id = ?").bind(userId).run();
  return c.json({ success: true });
});
var UPLOAD_BUCKETS = /* @__PURE__ */ new Set(["compositions", "thumbnails", "avatars", "arrangements"]);
app.post("/api/upload/work", async (c) => {
  const user = await requireAuth(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  try {
    const contentType = c.req.header("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return c.json({ error: "Invalid content type" }, 400);
    }
    const formData = await c.req.formData();
    const type = formData.get("type") || "composition";
    const result = await storeUpload(
      c,
      user,
      formData.get("file"),
      type === "arrangement" ? "arrangements" : "compositions"
    );
    if (result.error) return c.json({ error: result.error }, result.status || 400);
    return c.json({ success: true, ...result });
  } catch (err) {
    return c.json({ error: "Upload failed: " + err.message }, 500);
  }
});
app.post("/api/upload/community", async (c) => {
  const user = await requireAuth(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  return c.json({ success: true, url: "", path: "" });
});
app.post("/api/upload/thumbnails", async (c) => {
  const user = await requireAuth(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  try {
    const contentType = c.req.header("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return c.json({ error: "Invalid content type" }, 400);
    }
    const formData = await c.req.formData();
    const file = formData.get("file");
    if (!file) {
      return c.json({ error: "No file provided" }, 400);
    }
    const result = await storeUpload(c, user, file, "thumbnails");
    if (result.error) return c.json({ error: result.error }, result.status || 400);
    return c.json({ success: true, ...result });
  } catch (err) {
    return c.json({ error: "Upload failed: " + err.message }, 500);
  }
});
app.post("/upload/:bucket", async (c) => {
  const bucket = c.req.param("bucket");
  if (!UPLOAD_BUCKETS.has(bucket)) return c.json({ error: "Invalid bucket" }, 400);
  return handleUpload(c, bucket);
});
app.post("/api/upload/:bucket", async (c) => {
  const bucket = c.req.param("bucket");
  if (!UPLOAD_BUCKETS.has(bucket)) return c.json({ error: "Invalid bucket" }, 400);
  return handleUpload(c, bucket);
});
var MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const CHUNK = 32768;
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}
function extensionFor(file) {
  const fromName = (file.name || "").split(".").pop();
  if (fromName && fromName.length <= 5) return fromName.toLowerCase();
  return (file.type || "application/octet-stream").split("/")[1] || "bin";
}
async function storeUpload(c, user, file, bucketLabel) {
  if (!file) return { error: "No file provided", status: 400 };
  if (typeof file.size === "number" && file.size > MAX_UPLOAD_BYTES) {
    return {
      error: `File too large (max ${Math.floor(MAX_UPLOAD_BYTES / 1024 / 1024)} MB)`,
      status: 400
    };
  }
  const ext = extensionFor(file);
  const key = `${user.id}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
  const fileId = generateId();
  const contentType = file.type || "application/octet-stream";
  const arrayBuffer = await file.arrayBuffer();
  await c.env.DB.prepare(
    "INSERT INTO files (id, user_id, file_name, file_type, file_size, bucket) VALUES (?, ?, ?, ?, ?, ?)"
  ).bind(fileId, user.id, key, contentType, file.size ?? arrayBuffer.byteLength, bucketLabel).run();
  if (c.env.STORAGE) {
    try {
      await c.env.STORAGE.put(key, arrayBuffer, {
        httpMetadata: { contentType }
      });
      return {
        url: `/api/media/thumbnail/${encodeURIComponent(key)}`,
        fileId,
        fileName: key,
        storage: "r2"
      };
    } catch (err) {
      console.error("[upload] R2 put failed, falling back to inline:", err && err.message);
    }
  }
  const dataUrl = `data:${contentType};base64,${arrayBufferToBase64(arrayBuffer)}`;
  return { url: dataUrl, fileId, fileName: key, storage: "inline" };
}
async function handleUpload(c, bucket) {
  const user = await requireAuth(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  try {
    const contentType = c.req.header("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return c.json({ error: "Invalid content type" }, 400);
    }
    const formData = await c.req.formData();
    const result = await storeUpload(c, user, formData.get("file"), bucket);
    if (result.error) return c.json({ error: result.error }, result.status || 400);
    return c.json({ success: true, ...result });
  } catch (err) {
    return c.json({ error: "Upload failed: " + err.message }, 500);
  }
}
var MEDIA_SELECT = `
  SELECT id, title, thumbnail_r2_key
  FROM compositions
  WHERE is_published = 1 AND deleted = 0
    AND thumbnail_r2_key IS NOT NULL AND thumbnail_r2_key != ''
`;
function toMediaItems(rows) {
  return rows.map((r) => ({
    id: r.id,
    photographer: "Mureke Fumusi Hub",
    width: null,
    height: null,
    alt: r.title,
    url: null,
    src: {
      large2x: null,
      large: `/api/media/thumbnail/${encodeURIComponent(r.thumbnail_r2_key)}`,
      landscape: null,
      medium: null
    }
  }));
}
app.get("/api/media/landing-images", async (c) => {
  const limit = Math.min(parseInt(c.req.query("perPage") || "12", 10) || 12, 50);
  try {
    const { results } = await c.env.DB.prepare(`${MEDIA_SELECT} ORDER BY created_at DESC LIMIT ?`).bind(limit).all();
    return c.json({ source: "compositions", items: toMediaItems(results || []) });
  } catch (err) {
    console.error("[media] landing-images failed:", err && err.message);
    return c.json({ source: "compositions", items: [], warning: "media_unavailable" });
  }
});
app.get("/api/media/composition-background", async (c) => {
  const title = c.req.query("title") || "";
  try {
    let rows = [];
    if (title) {
      const match2 = await c.env.DB.prepare(`${MEDIA_SELECT} AND title LIKE ? ORDER BY created_at DESC LIMIT 1`).bind(`%${title}%`).all();
      rows = match2.results || [];
    }
    if (rows.length === 0) {
      const any = await c.env.DB.prepare(`${MEDIA_SELECT} ORDER BY created_at DESC LIMIT 1`).all();
      rows = any.results || [];
    }
    return c.json({ source: "compositions", items: toMediaItems(rows) });
  } catch (err) {
    console.error("[media] composition-background failed:", err && err.message);
    return c.json({ source: "compositions", items: [], warning: "media_unavailable" });
  }
});
app.get("/api/media/thumbnail/*", async (c) => {
  const bucket = c.env.STORAGE;
  if (!bucket) return c.json({ error: "storage_not_configured" }, 404);
  const prefix = "/api/media/thumbnail/";
  const pathname = new URL(c.req.url).pathname;
  let key = pathname.startsWith(prefix) ? pathname.slice(prefix.length) : "";
  if (!key) {
    const wildcard = c.req.param("*") || "";
    key = wildcard;
  }
  key = decodeURIComponent(key).replace(/^\/+/, "");
  if (!key) return c.json({ error: "missing_key" }, 400);
  if (key.includes("..")) return c.json({ error: "invalid_key" }, 400);
  try {
    const object = await bucket.get(key);
    if (!object) return c.json({ error: "not_found" }, 404);
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("etag", object.etag);
    headers.set("Cache-Control", "public, max-age=31536000, immutable");
    return new Response(object.body, { status: 200, headers });
  } catch (err) {
    console.error("[media] thumbnail fetch failed:", err && err.message);
    return c.json({ error: "thumbnail_unavailable" }, 500);
  }
});
app.get("/api/admin/payment-submissions", async (c) => {
  const admin = await requireAdmin(c);
  if (admin.error) return c.json({ error: admin.error }, admin.status);
  const limit = parseInt(c.req.query("limit") || "200");
  const { results } = await c.env.DB.prepare("SELECT * FROM payment_submissions ORDER BY submitted_at DESC LIMIT ?").bind(limit).all();
  return c.json(results || []);
});
app.get("/api/admin/purchases", async (c) => {
  const admin = await requireAdmin(c);
  if (admin.error) return c.json({ error: admin.error }, admin.status);
  const limit = parseInt(c.req.query("limit") || "200");
  const { results } = await c.env.DB.prepare("SELECT * FROM purchases ORDER BY created_at DESC LIMIT ?").bind(limit).all();
  return c.json(results || []);
});
app.post("/api/admin/reports", async (c) => {
  const user = await requireAuth(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  const body = await c.req.json();
  const id = generateId();
  await c.env.DB.prepare(
    "INSERT INTO reports (id, reported_by, composition_id, reason, details, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).bind(id, body.reported_by, body.composition_id, body.reason, body.details || null, "pending", (/* @__PURE__ */ new Date()).toISOString()).run();
  return c.json({ id, success: true });
});
app.get("/api/admin/reports", async (c) => {
  const admin = await requireAdmin(c);
  if (admin.error) return c.json({ error: admin.error }, admin.status);
  const status = c.req.query("status");
  let query = "SELECT * FROM reports";
  const params = [];
  if (status && status !== "all") {
    query += " WHERE status = ?";
    params.push(status);
  }
  query += " ORDER BY created_at DESC LIMIT 200";
  const { results } = await c.env.DB.prepare(query).bind(...params).all();
  return c.json(results || []);
});
app.patch("/api/admin/reports/:id", async (c) => {
  const admin = await requireAdmin(c);
  if (admin.error) return c.json({ error: admin.error }, admin.status);
  const reportId = c.req.param("id");
  const body = await c.req.json();
  const updates = [];
  const params = [];
  if (body.admin_notes !== void 0) {
    updates.push("admin_notes = ?");
    params.push(body.admin_notes);
  }
  if (body.status !== void 0) {
    updates.push("status = ?");
    params.push(body.status);
  }
  if (updates.length > 0) {
    updates.push("resolved_at = ?");
    params.push((/* @__PURE__ */ new Date()).toISOString());
    params.push(reportId);
    await c.env.DB.prepare(`UPDATE reports SET ${updates.join(", ")} WHERE id = ?`).bind(...params).run();
  }
  if (body.resolve_composition) {
    const { results } = await c.env.DB.prepare("SELECT composition_id FROM reports WHERE id = ?").bind(reportId).all();
    if (results[0]?.composition_id) {
      await c.env.DB.prepare("UPDATE compositions SET deleted = 1 WHERE id = ?").bind(results[0].composition_id).run();
    }
  }
  return c.json({ success: true });
});
app.get("/api/health", (c) => c.json({ ok: true, service: "murekefu-music-hub", backend: "d1" }));
app.get("/health", (c) => c.json({ ok: true, service: "murekefu-music-hub", backend: "d1" }));
async function getGoogleAccessToken(serviceAccount) {
  const { client_email, private_key } = serviceAccount;
  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1e3);
  const claim = {
    iss: client_email,
    scope: "https://www.googleapis.com/auth/webmasters https://www.googleapis.com/auth/indexing",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600
  };
  const encodedHeader = base64url(JSON.stringify(header));
  const encodedClaim = base64url(JSON.stringify(claim));
  const signingInput = `${encodedHeader}.${encodedClaim}`;
  const keyData = atob(private_key.replace(/-----(BEGIN|END) PRIVATE KEY-----/g, "").replace(/\n/g, ""));
  const keyArray = new Uint8Array(keyData.length);
  for (let i = 0; i < keyData.length; i++) {
    keyArray[i] = keyData.charCodeAt(i);
  }
  const key = await crypto.subtle.importKey(
    "pkcs8",
    keyArray.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(signingInput));
  const jwt = `${signingInput}.${base64url(String.fromCharCode(...new Uint8Array(sig)))}`;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`
  });
  const data = await res.json();
  return data.access_token;
}
app.post("/api/seo/submit-url", async (c) => {
  const admin = await requireAdmin(c);
  if (admin.error) return c.json({ error: admin.error }, admin.status);
  const body = await c.req.json();
  const url = body.url;
  if (!url) return c.json({ error: "URL required" }, 400);
  try {
    const serviceAccount = JSON.parse(c.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    const accessToken = await getGoogleAccessToken(serviceAccount);
    const res = await fetch("https://indexing.googleapis.com/v3/urlNotifications:publish", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ url, type: "URL_UPDATED" })
    });
    if (!res.ok) {
      const err = await res.json();
      return c.json({ error: "Indexing failed", details: err }, 400);
    }
    return c.json({ success: true, url });
  } catch (err) {
    return c.json({ error: err.message }, 500);
  }
});
app.post("/api/checkout/submit", async (c) => {
  const user = await requireAuth(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  let payload;
  try {
    payload = await c.req.json();
  } catch {
    payload = {};
  }
  const mpesaCode = String(payload.mpesaCode || "").trim();
  const items = Array.isArray(payload.items) ? payload.items : [];
  if (!mpesaCode) return c.json({ error: "mpesaCode is required" }, 400);
  if (!items.length) return c.json({ error: "No items provided" }, 400);
  const ids = [...new Set(items.map((i) => i && i.composition_id).filter(Boolean))];
  if (!ids.length) return c.json({ error: "No composition ids provided" }, 400);
  const placeholders = ids.map(() => "?").join(",");
  const { results: comps } = await c.env.DB.prepare(
    `SELECT id, title, price, price_currency, is_published, deleted
       FROM compositions WHERE id IN (${placeholders})`
  ).bind(...ids).all();
  const compMap = new Map((comps || []).map((r) => [r.id, r]));
  const unavailable = ids.filter((id) => {
    const r = compMap.get(id);
    return !r || r.deleted === 1 || r.is_published === 0;
  });
  if (unavailable.length) {
    return c.json({ error: "Not found or not published", composition_ids: unavailable }, 400);
  }
  const { results: existing } = await c.env.DB.prepare(
    `SELECT composition_id, status FROM purchases
       WHERE buyer_id = ? AND composition_id IN (${placeholders}) AND status IN ('pending','completed')`
  ).bind(user.id, ...ids).all();
  const owned = /* @__PURE__ */ new Set();
  const pending = /* @__PURE__ */ new Set();
  for (const row of existing || []) {
    if (row.status === "completed") owned.add(row.composition_id);
    else pending.add(row.composition_id);
  }
  const toInsert = ids.filter((id) => !owned.has(id) && !pending.has(id));
  if (!toInsert.length) {
    return c.json({
      success: true,
      checkoutBatchId: null,
      totalAmount: 0,
      submitted: [],
      skipped: { alreadyPurchased: [...owned], alreadyPending: [...pending] }
    });
  }
  const batchId = crypto.randomUUID();
  const currency = "KES";
  const submitted = [];
  let total = 0;
  for (const compId of toInsert) {
    const comp = compMap.get(compId);
    const amount = Number(comp.price || 0);
    total += amount;
    const id = crypto.randomUUID();
    const paymentRef = `${batchId}:${id}`;
    await c.env.DB.prepare(
      `INSERT INTO purchases (id, buyer_id, composition_id, price_paid, payment_ref, status, created_at)
         VALUES (?, ?, ?, ?, ?, 'pending', datetime('now'))`
    ).bind(id, user.id, compId, amount, paymentRef).run();
    submitted.push({ id, composition_id: compId, amount, status: "pending" });
  }
  return c.json({
    success: true,
    checkoutBatchId: batchId,
    totalAmount: total,
    currency,
    mpesa: {
      businessName: "Mureke Fumusi Hub",
      businessNumber: null,
      accountNo: null,
      paymentUrl: null,
      instructions: "Send the total to the published M-Pesa number, then enter the confirmation code on the checkout page."
    },
    submitted,
    skipped: { alreadyPurchased: [...owned], alreadyPending: [...pending] }
  });
});
app.get("/api/checkout/status", async (c) => {
  const user = await requireAuth(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  const { results } = await c.env.DB.prepare(
    `SELECT p.id, p.composition_id, p.price_paid, p.payment_ref, p.status, p.created_at,
              c.title, c.price_currency
       FROM purchases p
       LEFT JOIN compositions c ON c.id = p.composition_id
       WHERE p.buyer_id = ?
       ORDER BY p.created_at DESC
       LIMIT 100`
  ).bind(user.id).all();
  return c.json(results || []);
});
app.post("/api/payhero/initiate", async (c) => {
  const user = await requireAuth(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  let payload;
  try {
    payload = await c.req.json();
  } catch {
    payload = {};
  }
  const items = Array.isArray(payload.items) ? payload.items : [];
  const phone = String(payload.phone || "").trim();
  if (!items.length) return c.json({ error: "No items provided" }, 400);
  if (!phone) return c.json({ error: "Phone number is required" }, 400);
  const phoneClean = phone.replace(/[\s-]/g, "");
  if (!/^0[17]\d{8}$/.test(phoneClean)) {
    return c.json({ error: "Invalid Kenyan phone number. Use format 07XX XXX XXX" }, 400);
  }
  const ids = [...new Set(items.map((i) => i && i.composition_id).filter(Boolean))];
  if (!ids.length) return c.json({ error: "No composition ids provided" }, 400);
  const placeholders = ids.map(() => "?").join(",");
  const { results: comps } = await c.env.DB.prepare(
    `SELECT id, title, price, is_published, deleted
       FROM compositions WHERE id IN (${placeholders})`
  ).bind(...ids).all();
  const compMap = new Map((comps || []).map((r) => [r.id, r]));
  const unavailable = ids.filter((id) => {
    const r = compMap.get(id);
    return !r || r.deleted === 1 || r.is_published === 0;
  });
  if (unavailable.length) {
    return c.json({ error: "Not found or not published", composition_ids: unavailable }, 400);
  }
  const { results: existing } = await c.env.DB.prepare(
    `SELECT composition_id, status FROM purchases
       WHERE buyer_id = ? AND composition_id IN (${placeholders}) AND status IN ('pending','completed')`
  ).bind(user.id, ...ids).all();
  const owned = /* @__PURE__ */ new Set();
  const pending = /* @__PURE__ */ new Set();
  for (const row of existing || []) {
    if (row.status === "completed") owned.add(row.composition_id);
    else pending.add(row.composition_id);
  }
  const toInsert = ids.filter((id) => !owned.has(id) && !pending.has(id));
  if (!toInsert.length) {
    return c.json({
      success: true,
      payheroReference: null,
      totalAmount: 0,
      submitted: [],
      skipped: { alreadyPurchased: [...owned], alreadyPending: [...pending] }
    });
  }
  const total = toInsert.reduce((sum, id) => sum + Number(compMap.get(id).price || 0), 0);
  const batchId = crypto.randomUUID();
  const submitted = [];
  for (const compId of toInsert) {
    const comp = compMap.get(compId);
    const amount = Number(comp.price || 0);
    const id = crypto.randomUUID();
    const paymentRef = `${batchId}:${id}`;
    await c.env.DB.prepare(
      `INSERT INTO purchases (id, buyer_id, composition_id, price_paid, payment_ref, status, created_at)
         VALUES (?, ?, ?, ?, ?, 'pending', datetime('now'))`
    ).bind(id, user.id, compId, amount, paymentRef).run();
    submitted.push({ id, composition_id: compId, amount, status: "pending" });
  }
  const username = c.env.PAYHERO_USERNAME;
  const password = c.env.PAYHERO_PASSWORD;
  if (!username || !password) {
    return c.json({ error: "PayHero not configured" }, 500);
  }
  const authHeader = "Basic " + btoa(`${username}:${password}`);
  try {
    const payheroRes = await fetch("https://api.payhero.co.ke/api/v1/payments", {
      method: "POST",
      headers: {
        "Authorization": authHeader,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        amount: total,
        phone: phoneClean,
        reference: batchId,
        description: `Murekefu Music Hub - ${toInsert.length} item(s)`,
        callback_url: "https://murekefumusichub.fredrickmakori102.workers.dev/api/payhero/callback"
      })
    });
    if (!payheroRes.ok) {
      const errBody = await payheroRes.text().catch(() => "");
      console.error("[payhero] initiation failed:", payheroRes.status, errBody);
      return c.json({ error: "Payment initiation failed. Please try again." }, 400);
    }
    const payheroData = await payheroRes.json();
    return c.json({
      success: true,
      payheroReference: payheroData.reference || batchId,
      checkoutBatchId: batchId,
      totalAmount: total,
      currency: "KES",
      phone: phoneClean,
      submitted,
      skipped: { alreadyPurchased: [...owned], alreadyPending: [...pending] }
    });
  } catch (err) {
    console.error("[payhero] error:", err);
    return c.json({ error: "Payment service unavailable. Please try again." }, 503);
  }
});
app.get("/api/payhero/status", async (c) => {
  const user = await requireAuth(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  const reference = c.req.query("reference");
  if (!reference) return c.json({ error: "Reference is required" }, 400);
  const username = c.env.PAYHERO_USERNAME;
  const password = c.env.PAYHERO_PASSWORD;
  if (!username || !password) {
    return c.json({ error: "PayHero not configured" }, 500);
  }
  const authHeader = "Basic " + btoa(`${username}:${password}`);
  try {
    const res = await fetch(`https://api.payhero.co.ke/api/v1/payments/${encodeURIComponent(reference)}`, {
      headers: { "Authorization": authHeader }
    });
    if (!res.ok) {
      return c.json({ error: "Failed to check payment status" }, 400);
    }
    const data = await res.json();
    return c.json(data);
  } catch (err) {
    console.error("[payhero] status error:", err);
    return c.json({ error: "Payment service unavailable" }, 503);
  }
});
app.post("/api/payhero/callback", async (c) => {
  let payload;
  try {
    payload = await c.req.json();
  } catch {
    payload = {};
  }
  const reference = payload.reference || payload.Reference;
  const status = payload.status || payload.Status;
  if (!reference) return c.json({ error: "Reference required" }, 400);
  if (status === "success" || status === "Success" || status === "completed") {
    await c.env.DB.prepare(`UPDATE purchases SET status = 'completed' WHERE payment_ref LIKE ?`).bind(`${reference}%`).run();
  } else if (status === "failed" || status === "Failed") {
    await c.env.DB.prepare(`UPDATE purchases SET status = 'rejected' WHERE payment_ref LIKE ?`).bind(`${reference}%`).run();
  }
  return c.json({ success: true });
});
app.put("/api/purchases/preferences", async (c) => {
  const user = await requireAuth(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  let payload;
  try {
    payload = await c.req.json();
  } catch {
    payload = {};
  }
  const categoryId = payload.category_id;
  const weight = Number(payload.weight);
  if (categoryId === void 0 || categoryId === null) {
    return c.json({ error: "category_id is required" }, 400);
  }
  if (!Number.isFinite(weight)) return c.json({ error: "weight must be a number" }, 400);
  const { results: existing } = await c.env.DB.prepare("SELECT id FROM buyer_preferences WHERE user_id = ? AND category_id = ?").bind(user.id, categoryId).all();
  if (existing && existing.length) {
    await c.env.DB.prepare("UPDATE buyer_preferences SET weight = ? WHERE id = ?").bind(weight, existing[0].id).run();
  } else {
    await c.env.DB.prepare("INSERT INTO buyer_preferences (id, user_id, category_id, weight) VALUES (?, ?, ?, ?)").bind(crypto.randomUUID(), user.id, categoryId, weight).run();
  }
  return c.json({ success: true, category_id: categoryId, weight });
});
app.get("/api/purchases/preferences", async (c) => {
  const user = await requireAuth(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  const { results } = await c.env.DB.prepare("SELECT * FROM buyer_preferences WHERE user_id = ?").bind(user.id).all();
  return c.json(results || []);
});
app.post("/api/registration/payments/submit", async (c) => {
  const user = await requireAuth(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  let payload;
  try {
    payload = await c.req.json();
  } catch {
    payload = {};
  }
  const type = String(payload.type || "").trim();
  const paymentRef = String(payload.payment_ref || payload.paymentRef || "").trim();
  const amount = Number(payload.amount);
  const mpesaCode = String(payload.mpesa_code || payload.mpesaCode || "").trim();
  if (!type) return c.json({ error: "type is required" }, 400);
  if (!paymentRef) return c.json({ error: "payment_ref is required" }, 400);
  if (!Number.isFinite(amount) || amount <= 0) return c.json({ error: "amount must be greater than 0" }, 400);
  if (!mpesaCode) return c.json({ error: "mpesa_code is required" }, 400);
  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    `INSERT INTO payment_submissions
         (id, user_id, type, payment_ref, amount, mpesa_code, status, submitted_at)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', datetime('now'))`
  ).bind(id, user.id, type, paymentRef, amount, mpesaCode).run();
  const { results: regs } = await c.env.DB.prepare("SELECT * FROM registration_regulations LIMIT 1").all();
  return c.json({
    success: true,
    message: "Payment submitted for review.",
    submission: { id, type, payment_ref: paymentRef, amount, mpesa_code: mpesaCode, status: "pending" },
    regulations: regs && regs[0] ? regs[0] : null
  });
});
app.post("/api/request-role/accept-invite", async (c) => {
  const user = await requireAuth(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  let payload;
  try {
    payload = await c.req.json();
  } catch {
    payload = {};
  }
  const requestedRole = String(payload.requestedRole || "composer").trim();
  if (!["composer", "admin"].includes(requestedRole)) {
    return c.json({ error: "Invalid requestedRole" }, 400);
  }
  const { results: invites } = await c.env.DB.prepare("SELECT * FROM invites WHERE email = ? AND used = 0 ORDER BY created_at DESC LIMIT 1").bind(user.email).all();
  if (!invites || !invites.length) {
    return c.json({ available: false, requestedRole, accepted: false, message: "No invite available" });
  }
  const invite = invites[0];
  const claim = await c.env.DB.prepare("UPDATE invites SET used = 1, used_by = ?, used_at = datetime('now') WHERE id = ? AND used = 0").bind(user.id, invite.id).run();
  if (!claim.meta || claim.meta.changes !== 1) {
    return c.json({ available: false, requestedRole, accepted: false, message: "Invite already used" });
  }
  const roleId = requestedRole === "admin" ? "role_admin" : `role_${requestedRole}`;
  await c.env.DB.prepare("INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)").bind(user.id, roleId).run();
  await c.env.DB.prepare(
    `INSERT INTO role_requests (id, user_id, requested_role, status, requested_at)
       VALUES (?, ?, ?, 'approved', datetime('now'))`
  ).bind(crypto.randomUUID(), user.id, requestedRole).run();
  return c.json({
    available: true,
    requestedRole,
    canAccept: false,
    accepted: true,
    message: `Invite accepted. You now have the ${requestedRole} role.`,
    invite: { id: invite.id, email: invite.email, used: true, usedBy: user.id, usedAt: (/* @__PURE__ */ new Date()).toISOString() }
  });
});
app.get("/sitemap.xml", async (c) => {
  const baseUrl = "https://murekefumusichub.fredrickmakori102.workers.dev";
  const { results: compositions } = await c.env.DB.prepare(
    "SELECT id FROM compositions WHERE deleted = 0 AND is_published = 1 ORDER BY created_at DESC LIMIT 1000"
  ).all();
  const { results: arrangements } = await c.env.DB.prepare(
    "SELECT id FROM arrangements WHERE deleted = 0 AND is_published = 1 ORDER BY created_at DESC LIMIT 1000"
  ).all();
  const staticPages = [
    { url: "/", priority: "1.0", changefreq: "daily" },
    { url: "/marketplace", priority: "0.9", changefreq: "daily" },
    { url: "/my-compositions", priority: "0.8", changefreq: "weekly" },
    { url: "/my-arrangements", priority: "0.8", changefreq: "weekly" },
    { url: "/enroll", priority: "0.7", changefreq: "weekly" },
    { url: "/help", priority: "0.6", changefreq: "monthly" },
    { url: "/about", priority: "0.5", changefreq: "monthly" },
    { url: "/contact", priority: "0.5", changefreq: "monthly" },
    { url: "/privacy-policy", priority: "0.3", changefreq: "monthly" }
  ];
  let urlEntries = staticPages.map((p) => `
  <url>
    <loc>${baseUrl}${p.url}</loc>
    <lastmod>${(/* @__PURE__ */ new Date()).toISOString().split("T")[0]}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`).join("\n");
  if (compositions) {
    compositions.forEach((comp) => {
      urlEntries += `
  <url>
    <loc>${baseUrl}/marketplace/${comp.id}</loc>
    <lastmod>${(/* @__PURE__ */ new Date()).toISOString().split("T")[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`;
    });
  }
  if (arrangements) {
    arrangements.forEach((arr) => {
      urlEntries += `
  <url>
    <loc>${baseUrl}/my-arrangements/${arr.id}</loc>
    <lastmod>${(/* @__PURE__ */ new Date()).toISOString().split("T")[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>`;
    });
  }
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries}
</urlset>`, {
    status: 200,
    headers: { "Content-Type": "application/xml" }
  });
});
app.get("/robots.txt", (c) => {
  return new Response(`User-agent: *
Allow: /
Disallow: /api/
Disallow: /admin/
Disallow: /auth/

Sitemap: https://murekefumusichub.fredrickmakori102.workers.dev/sitemap.xml`, {
    status: 200,
    headers: { "Content-Type": "text/plain" }
  });
});
app.get("/favicon.ico", (c) => {
  return new Response("", { status: 204, headers: { "Content-Type": "image/x-icon" } });
});
app.get("/", async (c) => {
  try {
    const url = new URL(c.req.url);
    url.searchParams.set("_v", Date.now().toString());
    const freshReq = new Request(url, { headers: c.req.headers, method: c.req.method });
    return await c.env.ASSETS.fetch(freshReq);
  } catch {
    return new Response('<!doctype html><html><body><div id="root"></div></body></html>', { status: 500 });
  }
});
app.get("/admin", async (c) => {
  try {
    return await c.env.ASSETS.fetch(new Request("http://placeholder/index.html"));
  } catch {
    return new Response('<!doctype html><html><body><div id="root"></div></body></html>', { status: 500 });
  }
});
app.get("/auth/callback", async (c) => {
  try {
    return await c.env.ASSETS.fetch(new Request("http://placeholder/index.html"));
  } catch {
    return new Response('<!doctype html><html><body><div id="root"></div></body></html>', { status: 500 });
  }
});
var SPA_HTML_HEADERS = {
  "Content-Type": "text/html; charset=UTF-8",
  // No-cache: the SPA shell must never be served from a stale edge cache, or a
  // fixed client-side route keeps 404ing after the route is added.
  "Cache-Control": "no-cache, no-store, must-revalidate",
  Pragma: "no-cache",
  Expires: "0"
};
var EMPTY_SPA = '<!doctype html><html><body><div id="root"></div></body></html>';
async function serveSpa(c) {
  try {
    const res = await c.env.ASSETS.fetch(new Request("http://placeholder/index.html"));
    if (res.status === 200) {
      return new Response(res.body, { status: 200, headers: SPA_HTML_HEADERS });
    }
  } catch {
  }
  return new Response(EMPTY_SPA, { status: 200, headers: SPA_HTML_HEADERS });
}
app.get("*", async (c) => {
  if (c.req.path.startsWith("/api/")) return c.notFound();
  try {
    const asset = await c.env.ASSETS.fetch(c.req.raw);
    if (asset.status === 200) {
      const h = new Headers(asset.headers);
      h.set("Cache-Control", "public, max-age=31536000, immutable");
      return new Response(asset.body, { status: 200, headers: h });
    }
  } catch {
  }
  return serveSpa(c);
});
var worker_default = { fetch: app.fetch };
export {
  worker_default as default
};
