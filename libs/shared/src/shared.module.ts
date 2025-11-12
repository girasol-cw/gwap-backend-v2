import { Global, Module, Provider } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import {
  TokenLiriumServiceAbstract,
  TokenLiriumService,
} from './services/token-lirium.service';
import {
  LiriumRequestService,
} from './services/lirium-request.service';
import { HttpWrapperService } from './services/http-wrapper.service';
import { DatabaseService } from './services/database.service';
import { LiriumRequestServiceAbstract } from './interfaces/lirium-request.service.abstract';
import { LiriumKycService } from './services/lirium-kyc.service';
import { LiriumKycServiceAbstract } from './interfaces/lirium-kyc.service.abstract';

const tokenLiriumProvider: Provider = {
  provide: TokenLiriumServiceAbstract,
  useClass: TokenLiriumService,
};

const liriumRequestProvider: Provider = {
  provide: LiriumRequestServiceAbstract,
  useClass: LiriumRequestService,
};

const liriumKycProvider: Provider = {
  provide: LiriumKycServiceAbstract,
  useClass: LiriumKycService,
};

@Global()
@Module({
  imports: [HttpModule],
  providers: [liriumRequestProvider, tokenLiriumProvider, HttpWrapperService, DatabaseService, liriumKycProvider],
  exports: [liriumRequestProvider, tokenLiriumProvider, HttpWrapperService, DatabaseService, liriumKycProvider],
})
export class SharedModule {}
