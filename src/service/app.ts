import { ExpressConfig } from '../config';

import * as express from 'express';
import { Logger } from '@encore/log';
import { Filter, FilterPromise, PathType, Method, ControllerConfig } from '../model';
import { Injectable } from '@encore/di';
import { RouteRegistry } from './registry';

let compression = require('compression');
let cookieParser = require('cookie-parser');
let bodyParser = require('body-parser');
let session = require('express-session');

type RouteStack = {
  name: string,
  keys: string[],
  regexp: {
    fast_star: boolean,
    fast_slash: boolean
  },
  route: {
    path: string,
    methods: { [key: string]: number },
    stack: RouteStack[]
  }
};

function removeRoutes(stack: RouteStack[], toRemove: Map<PathType, Set<string>>): RouteStack[] {
  return stack.slice(0).map(x => {
    if (x.route) {
      if (x.route.stack) {
        x.route.stack = removeRoutes(x.route.stack, toRemove);
      }
      if (toRemove.has(x.route.path)) {
        let method = x.route.methods && Object.keys(x.route.methods)[0];
        if (toRemove.get(x.route.path)!.has(method)) {
          console.log(`Dropping ${method}/${x.route.path}`);
          return null;
        }
      }
    }
    return x;
  }).filter(x => !!x) as RouteStack[];
}

@Injectable({ autoCreate: { create: true, priority: 1 } })
export class AppService {
  private app: express.Application;
  private controllers = new Map<string, ControllerConfig>();

  constructor(private config: ExpressConfig) {
  }

  postConstruct() {
    this.app = express();
    this.app.use(compression());
    this.app.use(cookieParser());
    this.app.use(bodyParser.json());
    this.app.use(bodyParser.urlencoded());
    this.app.use(bodyParser.raw({ type: 'image/*' }));
    this.app.use(session(this.config.session)); // session secret

    //    import { requestContext } from '@encore/context/ext/express';
    //    .use(requestContext)

    // Enable proxy for cookies
    if (this.config.session.cookie.secure) {
      this.app.enable('trust proxy');
    }

    // Register all active
    for (let config of RouteRegistry.controllers.values()) {
      this.registerController(config);
    }

    // Listen for updates
    RouteRegistry.events.on('reload', this.registerController.bind(this));

    this.app.use(RouteRegistry.errorHandler);

    if (this.config.serve && this.config.port > 0) {
      console.log(`Listening on ${this.config.port}`);
      this.app.listen(this.config.port);
    }
  }

  unregisterController(config: ControllerConfig) {
    // Un-register
    let controllerRoutes = new Map<PathType, Set<Method>>();
    for (let { method, path } of this.controllers.get(config.path)!.handlers) {
      if (!controllerRoutes.has(path!)) {
        controllerRoutes.set(path!, new Set());
      }
      controllerRoutes.get(path!)!.add(method!);
    }

    this.app._router.stack = removeRoutes(this.app._router.stack, controllerRoutes);
  }

  registerController(config: ControllerConfig) {
    if (this.controllers.has(config.path)) {
      console.log('Unregistering', config.path);
      this.unregisterController(config);
    }
    console.log('Registering', config.path, config.handlers.length);
    for (let { method, path, filters, handler } of config.handlers) {
      this.register(method!, path!, filters!, handler);
    }
    this.controllers.set(config.path, config);
  }

  get() {
    return this.app;
  }

  private register(method: Method, pattern: PathType, filters: FilterPromise[], handler: FilterPromise) {
    let final = [...filters, handler];
    switch (method) {
      case 'get': this.app.get(pattern, ...final); break;
      case 'put': this.app.put(pattern, ...final); break;
      case 'post': this.app.post(pattern, ...final); break;
      case 'delete': this.app.delete(pattern, ...final); break;
      case 'patch': this.app.patch(pattern, ...final); break;
      case 'options': this.app.options(pattern, ...final); break;
    }
  }
}