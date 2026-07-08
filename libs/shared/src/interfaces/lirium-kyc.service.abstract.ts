import { LiriumFileDto } from "../dto/lirium-file.dto";

export type LiriumKycUploadResponse = {
    status: number;
    data: unknown;
};

export abstract class LiriumKycServiceAbstract {
    public abstract uploadKyc(
        file: LiriumFileDto,
        companyId: string,
    ): Promise<LiriumKycUploadResponse>;
}
