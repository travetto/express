import { Controller, Get } from '../src';
import { MockService } from './mock';

@Controller('/simple')
export class Simple {

  constructor(private service: MockService) {
  }

  @Get('/name')
  async doIt() {
    const user = await this.service.fetch();
    return `/simple/name => ${user.first.toLowerCase()}`;
  }

  @Get('/nameAngry')
  async doItAngry() {
    const user = await this.service.fetch();
    return user.first.toUpperCase();
  }

  @Get('/name2')
  async doIt2() {
    const user = await this.service.fetch2();
    return user.last;
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