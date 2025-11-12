import { BadRequestException, Injectable } from "@nestjs/common";
import { LiriumKycServiceAbstract } from "../interfaces/lirium-kyc.service.abstract";
import { HttpWrapperConfig, HttpWrapperService } from "./http-wrapper.service";
import { LiriumFileDto, LiriumFileType } from "../dto/lirium-file.dto";
import { DatabaseService } from "./database.service";
import FormData from 'form-data';

@Injectable()
export class LiriumKycService extends LiriumKycServiceAbstract {

    private readonly URL_KYC = '/customers/{0}/documents';
    constructor(private readonly httpService: HttpWrapperService, private readonly databaseService: DatabaseService) {
        super();
    }

    public async uploadKyc(file: LiriumFileDto): Promise<void> {
        file.validateFileProperties();
        const userId = await this.getUserByAccountId(file.user_id);
        if (!userId) {
            throw new BadRequestException(`User with account id ${file.user_id} not found`);
        }

        const formData = new FormData();
        formData.append('file', file.file.buffer, {
            contentType: file.file.mimetype,
            filename: file.file_name || file.file.originalname,
        });
        formData.append('file_type', file.file_type);
        formData.append('document_type', file.document_type);
        formData.append('file_name', file.file_name);
        const formDataHeaders = formData.getHeaders();

        const configRequest: HttpWrapperConfig = {
            baseURL: process.env.LIRIUM_API_URL,
            headers: {
                ...formDataHeaders, // This includes Content-Type with boundary
            }
        };

        await this.httpService.post(this.URL_KYC.replace('{0}', userId), formData, configRequest);
    }

    private async getUserByAccountId(accountId: string): Promise<string> {
        const result = await this.databaseService.pool.query<string[]>(
            'SELECT user_id FROM users WHERE girasol_account_id = $1',
            [accountId],
        );
        return result.rows[0]?.user_id;
    }
}