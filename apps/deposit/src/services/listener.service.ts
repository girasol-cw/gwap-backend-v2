import { DatabaseService } from 'libs/shared/src/services/database.service';
import { LiriumRequestServiceAbstract } from 'libs/shared';

export class ListenerService {
  constructor(
    private readonly liriumService: LiriumRequestServiceAbstract,
    private readonly dbService: DatabaseService,
  ) {}

  private readonly SQL = {
    getCustomers: 'SELECT user_id FROM Users ',
    updateBalance: 'UPDATE customers SET balance = ? WHERE customer_id = ?',
  };

  //TODO have to get all the customers from the database and call the liriumService.getCustomerAccount for each one
  async listen() {
    this.process();
    const customerAccount = await this.liriumService.getCustomerAccount('123');
    return customerAccount;
  }

  private async process() {
    const customers = await this.getCustomers();
    for (const customer of customers) {
      const customerAccount =
        await this.liriumService.getCustomerAccount(customer);
      if (customerAccount.accounts && customerAccount.accounts.length > 0) {
        for (const account of customerAccount.accounts) {
          const balance = account.amount;
          await this.dbService.pool.query(this.SQL.updateBalance, [
            balance,
            customer,
          ]);
        }
      }
    }
  }
  
  private async getCustomers(): Promise<string[]> {
    return await this.dbService.pool.query<string[]>(this.SQL.getCustomers, [])
      .rows;
  }
}
