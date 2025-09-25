import { DatabaseService } from 'apps/api/src/common/database.service';
import { LiriumRequestServiceAbstract } from 'libs/shared';

export class ListenerService {
  constructor(
    private readonly liriumService: LiriumRequestServiceAbstract,
    private readonly dbService: DatabaseService,
  ) {}

  private readonly SQL ={
    getCustomers: 'SELECT user_id FROM Users ',
    updateBalance: 'UPDATE customers SET balance = ? WHERE customer_id = ?',
  }

  //TODO have to get all the customers from the database and call the liriumService.getCustomerAccount for each one
  async listen() {
    const customerAccount = await this.liriumService.getCustomerAccount('123');
    return customerAccount;
  }

  private async process() {
    const customerAccount = await this.liriumService.getCustomerAccount('123');
  }
  private async getCustomers(): Promise<string[]> {
    return ['123'];
  }
}
