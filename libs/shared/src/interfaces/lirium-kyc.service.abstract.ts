import { LiriumFileDto } from "../dto/lirium-file.dto";

export abstract class LiriumKycServiceAbstract {
    public abstract uploadKyc(file: LiriumFileDto, companyId: string): Promise<void>;
}