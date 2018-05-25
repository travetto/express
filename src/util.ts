import { Request, Response, NextFunction } from 'express';
import {
  RouteStack, PathType, ControllerConfig, Method,
  Renderable, RequestHandler, FilterPromise, Filter
} from './model';

export class RouteUtil {

  static canAccept(req: Request, mime: string) {
    return (req.headers['accept'] || '').indexOf(mime) >= 0;
  }

  static removeRoutes(stack: RouteStack[], toRemove: Map<PathType, Set<string>>): RouteStack[] {
    return stack.slice(0).map(x => {
      if (x.route) {
        if (x.route.stack) {
          x.route.stack = RouteUtil.removeRoutes(x.route.stack, toRemove);
        }
        if (toRemove.has(x.route.path)) {
          const method = x.route.methods && Object.keys(x.route.methods)[0];
          if (toRemove.get(x.route.path)!.has(method)) {
            console.debug(`Dropping ${method}/${x.route.path}`);
            return null;
          }
        }
      }
      return x;
    }).filter(x => !!x) as RouteStack[];
  }

  static removeAllRoutes(stack: RouteStack[], config: ControllerConfig) {
    // Un-register
    const controllerRoutes = new Map<PathType, Set<Method>>();
    for (const { method, path } of config.handlers) {
      if (!controllerRoutes.has(path!)) {
        controllerRoutes.set(path!, new Set());
      }
      controllerRoutes.get(path!)!.add(method!);
    }
    return RouteUtil.removeRoutes(stack, controllerRoutes);
  }

  static buildPath(base: string, path: PathType | undefined): PathType {
    if (typeof path === 'string') {
      return (base + path).replace(/\/+/, '/').replace(/(.)\/$/, '$1');
    } else if (!!path) {
      return new RegExp(`^${base.replace(/\//g, '\\/')}${path.source}$`, path.flags);
    } else {
      return base;
    }
  }

  static async render(res: Response, out: any) {
    if (out && out.render) {
      out = (out as Renderable).render(res);
      if (out && out.then) {
        await out;
      }
    } else if (typeof out === 'string') {
      res.send(out);
    } else {
      res.json(out);
    }
  }

  static async outputHandler(handler: RequestHandler, req: Request, res: Response, out: any) {
    if (!res.headersSent && out) {
      if (handler.headers) {
        for (const [h, v] of Object.entries(handler.headers)) {
          if (typeof v === 'string') {
            res.setHeader(h, v);
          } else {
            res.setHeader(h, (v as () => string)());
          }
        }
      }

      await RouteUtil.render(res, out);
    }

    console.info(`Request`, {
      meta: {
        method: req.method,
        path: req.path,
        query: req.query,
        params: req.params,
        statusCode: res.statusCode
      }
    });

    res.end();
  }

  static async errorHandler(error: any, req: Request, res: Response, next?: NextFunction) {

    const status = error.status || error.statusCode || 500;

    console.error(`Request`, {
      meta: {
        method: req.method,
        path: req.path,
        query: req.query,
        params: req.params,
        statusCode: status
      }
    });

    console.info(error);

    // Generally send the error directly to the output
    if (!res.headersSent) {
      res.status(status);
      await RouteUtil.render(res, error);
    }

    res.end();
  }

  static asyncHandler(filter: FilterPromise, handler?: Filter): FilterPromise {
    return async (req: Request, res: Response, next?: NextFunction) => {
      try {
        const out = await filter(req, res, next);
        handler ? handler(req, res, out) : (next && next());
      } catch (error) {
        await RouteUtil.errorHandler(error, req, res, next);
      }
    };
  }

  static toPromise<T>(fn: (...args: any[]) => (T | Promise<T>)): (...args: any[]) => Promise<T> {
    if (fn.constructor.name !== 'AsyncFunction') { // If std function
      return (...args: any[]) => new Promise<T>((resolve, reject) => {
        try {
          resolve(fn.apply(null, args));
        } catch (e) {
          reject(e);
        }
      });
    } else {
      return fn as (...args: any[]) => Promise<T>;
    }
  }
}