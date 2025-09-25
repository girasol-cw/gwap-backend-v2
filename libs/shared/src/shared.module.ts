import { Global, Module, Provider } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import {
  TokenLiriumServiceAbstract,
  TokenLiriumService,
} from './services/token-lirium.service';
import {
  LiriumRequestServiceAbstract,
  LiriumRequestService,
} from './services/lirium-request.service';
import { HttpWrapperService } from './services/http-wrapper.service';

const tokenLiriumProvider: Provider = {
  provide: TokenLiriumServiceAbstract,
  useClass: TokenLiriumService,
};

const liriumRequestProvider: Provider = {
  provide: LiriumRequestServiceAbstract,
  useClass: LiriumRequestService,
};

@Global()
@Module({
  imports: [HttpModule],
  providers: [liriumRequestProvider, tokenLiriumProvider, HttpWrapperService],
  exports: [liriumRequestProvider, tokenLiriumProvider, HttpWrapperService],
})
export class SharedModule {}
