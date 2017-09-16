import { Controller, Get } from '../src';
import { MockService } from './mock';
import { Injectable, DependencyRegistry } from '@encore2/di';

// const papaparse = require('papaparse');
// import * as papaparse from 'papaparse';


@Controller('/simple')
export class Simple {

  constructor(private service: MockService) {
  }

  @Get('/name')
  async doIt() {
    return this.service.fetch().first.repeat(1);
  }

  @Get('/names')
  async doIts() {
    return [this.service.fetch().first.repeat(1), 'roger', 'sam'];
  }

  @Get('/ages')
  async ages() {
    return 'woah';
    //    throw new Error('aah');
  }

  @Get('/age2')
  async age2() {
    return (this.service.fetch().middle! as any).toUpperCase();
  }

  @Get('/age3')
  async age3() {
    return 'hi';
  }
}
