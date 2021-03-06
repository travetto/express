import { Response } from 'express';
import * as stream from 'stream';

import { Renderable } from './renderable';

export class StringResponse implements Renderable {
  constructor(public content: string, private status: number = 200) {
  }

  render(res: Response): void {
    res.status(this.status);
    res.send(this.content);
  }

  toStream(): NodeJS.ReadableStream {
    const out = new stream.Readable();
    (out as any)._read = function noop() { }; // redundant? see update below
    out.push(this.content);
    out.push(null);
    return out;
  }
}