import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

import { BadRequestException } from '@nestjs/common';

import { File } from 'multer';

export enum LiriumFileType {
    ID_BACK = 'id_back',
    ID_FRONT = 'id_front',
    PROOF_OF_ADDRESS = 'proof_of_address',
    SELFIE = 'selfie',
}

export class LiriumFileDto {
    @IsNotEmpty({ message: 'User ID is required to upload KYC' })
    @IsString()
    user_id: string;

    @IsNotEmpty({ message: 'File is required to upload KYC' })
    file: File;

    @IsNotEmpty({ message: 'File type is required to upload KYC' })
    @IsString()
    file_type: string;

    @IsNotEmpty({ message: 'Document type is required to upload KYC' })
    @IsEnum(LiriumFileType, { 
        message: `Document type must be one of: ${Object.values(LiriumFileType).join(', ')}` 
    })
    document_type: LiriumFileType;

    @IsNotEmpty({ message: 'File name is required to upload KYC' })
    @IsString()
    file_name: string;

    // Validación adicional del archivo
    validateFileProperties(): void {
        if (!this.file.buffer || this.file.buffer.length === 0) {
            throw new BadRequestException('File buffer is empty');
        }

        // Validar tipos MIME permitidos (opcional)
        const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
        if (!allowedMimeTypes.includes(this.file.mimetype)) {
            throw new BadRequestException(
                `File type ${this.file.mimetype} is not allowed. Allowed types: ${allowedMimeTypes.join(', ')}`
            );
        }
    }
}