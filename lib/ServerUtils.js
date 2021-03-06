const _ = require('lodash');
/**
 * Server-related utilities
 */
class ServerUtils {
  /**
   * HTTP status codes for common responses
   * @type {Object} StatusCodes
   * @property {Object} Success Success status codes
   * @property {Number} Success.post 201 (Created)
   * @property {Number} Success.get 200 (OK)
   * @property {Number} Success.put 200 (OK)
   * @property {Number} Success.patch 200 (OK)
   * @property {Number} Success.delete 204 (No Content)
   * @property {Object} Error Error status codes
   * @property {Number} Error.User 400 (Bad Request)
   * @property {Number} Error.Authenticate 401 (Unauthorized)
   * @property {Number} Error.Authorise 403 (Forbidden)
   * @property {Number} Error.Missing 404 (Not Found)
   */
  static get StatusCodes() {
    return {
      Success: {
        Default: 200,
        NoContent: 204,
        post: 201,
        get: 200,
        put: 200,
        patch: 200,
        delete: 204
      },
      Error: {
        Default: 500,
        User: 400,
        Missing: 404,
        Authenticate: 401,
        Authorise: 403
      }
    };
  }
  /**
   * Middleware for handling 404 errors on the API router
   * @param {ClientRequest} req
   * @param {ServerResponse} res
   * @param {Function} next
   */
  static apiNotFoundHandler(req, res, next) {
    const e = new Error(this.t('error.routenotfound', { method: req.method, url: req.originalUrl }));
    e.statusCode = ServerUtils.StatusCodes.Error.Missing;
    return next(e);
  }
  /**
   * Generic error handling middleware for the API router
   * @param {Error} error
   * @param {ClientRequest} req
   * @param {ServerResponse} res
   * @param {Function} next
   */
  static apiGenericErrorHandler(error, req, res, next) {
    if(error instanceof Error) {
      this.log('error', this.getConfig('logStackOnError') ? error.stack : error.toString());
    } else {
      this.log('error', error);
    }
    if(!error.statusCode) ServerUtils.StatusCodes.Error.Default;
    res.status(error.statusCode || 500).json({ message: error.message });
  }
  /**
   * Middleware for handling 404 errors on the root router
   * @param {ClientRequest} req
   * @param {ServerResponse} res
   */
  static rootNotFoundHandler(req, res) {
    res.status(ServerUtils.StatusCodes.Error.Missing).end();
  }
  /**
   * Generic error handling middleware for the root router
   * @param {Error} error
   * @param {ClientRequest} req
   * @param {ServerResponse} res
   * @param {Function} next
   */
  static rootGenericErrorHandler(error, req, res, next) {
    if(error instanceof Error) {
      this.log('error', this.getConfig('logStackOnError') ? error.stack : error.toString());
    } else {
      this.log('error', error);
    }
    res.sendStatus(error.statusCode || 500);
  }
  /**
   * Handler for returning an API map
   * @param {Router} topRouter
   * @return {Function} Middleware function
   */
  static mapHandler(topRouter) {
    return (req, res) => {
      const map = topRouter.flattenRouters()
        .sort((a,b) => a.route.localeCompare(b.route))
        .reduce((m,r) => {
          const key = `${getRelativeRoute(topRouter, r)}endpoints`;
          const endpoints = getEndpoints(r);
          return endpoints.length ? { ...m, [key]: endpoints } : m;
        }, {});

      res.json(map);
    };
  }
  /**
   * Adds extra properties to the request object to allow for easy existence
   * checking of common request objects
   * @param {ClientRequest} req
   * @param {ServerResponse} res
   * @param {Function} next
   * @example
   * "IMPORTANT NOTE: body data is completely ignored for GET requests, any code
   * requiring it should switch to use POST."
   *
   * let req = { 'params': { 'foo':'bar' }, 'query': {}, 'body': {} };
   * req.hasParams // true
   * req.hasQuery // false
   * req.hasBody // false
   */
  static addExistenceProps(req, res, next) {
    if(req.method === 'GET') {
      req.body = {};
    }
    const storeVal = (key, exists) => req[`has${_.capitalize(key)}`] = exists;
    ['body', 'params', 'query'].forEach(attr => {
      if(!req[attr]) {
        return storeVal(attr, true);
      }
      const entries = Object.entries(req[attr]);
      let deleted = 0;
      if(entries.length === 0) {
        return storeVal(attr, false);
      }
      entries.forEach(([key, val]) => {
        if(val === undefined || val === null) {
          delete req[attr][key];
          deleted++;
        }
      });
      storeVal(attr, deleted < entries.length);
    });
    next();
  }
}
/** @ignore */ function getEndpoints(r) {
  return r.routes.map(route => {
    return {
      url: `${r.url}${route.route}`,
      accepted_methods: Object.keys(route.handlers)
    };
  });
}
/** @ignore */ function getRelativeRoute(relFrom, relTo) {
  if(relFrom === relTo) {
    return `${relFrom.route}_`;
  }
  let route = '';
  for(let r = relTo; r !== relFrom; r = r.parentRouter) route = `${r.route}_${route}`;
  return route;
}

module.exports = ServerUtils;
