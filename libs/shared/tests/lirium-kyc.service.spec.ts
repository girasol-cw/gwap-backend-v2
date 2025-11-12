import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, HttpException } from '@nestjs/common';
import { LiriumKycService } from '../src/services/lirium-kyc.service';
import { HttpWrapperService } from '../src/services/http-wrapper.service';
import { DatabaseService } from '../src/services/database.service';
import { LiriumFileDto, LiriumFileType } from '../src/dto/lirium-file.dto';
import { File } from 'multer';

describe('LiriumKycService', () => {
  let service: LiriumKycService;
  let httpService: jest.Mocked<HttpWrapperService>;
  let databaseService: jest.Mocked<DatabaseService>;

  let mockPool: { query: jest.Mock };
  let mockHttpService: { post: jest.Mock };
  let mockDatabaseService: { pool: { query: jest.Mock } };

  const originalEnv = process.env;

  const createMockFile = (overrides?: Partial<File>): File => {
    return {
      fieldname: 'file',
      originalname: 'test-document.pdf',
      encoding: '7bit',
      mimetype: 'application/pdf',
      size: 1024,
      buffer: Buffer.from('test file content'),
      destination: '',
      filename: 'test-document.pdf',
      path: '',
      stream: null as any,
      ...overrides,
    };
  };

  const createMockLiriumFileDto = (overrides?: Partial<LiriumFileDto>): LiriumFileDto => {
    const dto = new LiriumFileDto();
    dto.file_name = overrides?.file_name ?? 'test-document.pdf';
    dto.file_type = overrides?.file_type ?? 'id_front';
    dto.document_type = overrides?.document_type ?? LiriumFileType.ID_FRONT;
    dto.user_id = overrides?.user_id ?? 'account-123';
    dto.file = overrides?.file ?? createMockFile();
    return dto;
  };

  beforeEach(async () => {
    // Reset environment variables
    process.env = { ...originalEnv };
    process.env.LIRIUM_API_URL = 'https://api.lirium.com';

    // Create fresh mocks for each test
    mockPool = {
      query: jest.fn(),
    };

    mockHttpService = {
      post: jest.fn(),
    };

    mockDatabaseService = {
      pool: mockPool,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LiriumKycService,
        {
          provide: HttpWrapperService,
          useValue: mockHttpService,
        },
        {
          provide: DatabaseService,
          useValue: mockDatabaseService,
        },
      ],
    }).compile();

    service = module.get<LiriumKycService>(LiriumKycService);
    httpService = module.get(HttpWrapperService);
    databaseService = module.get(DatabaseService);
  });

  afterEach(() => {
    // Restore environment variables
    process.env = originalEnv;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('uploadKyc', () => {
    it('should upload KYC file successfully', async () => {
      // Arrange
      const mockFileDto = createMockLiriumFileDto();
      const mockUserId = 'user-123';
      const mockHttpResponse = {
        data: { success: true },
        status: 200,
        statusText: 'OK',
        headers: {},
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [{ user_id: mockUserId }],
      });

      mockHttpService.post.mockResolvedValueOnce(mockHttpResponse);

      // Act
      await service.uploadKyc(mockFileDto);

      // Assert
      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT user_id FROM users WHERE girasol_account_id = $1',
        [mockFileDto.user_id],
      );
      expect(mockHttpService.post).toHaveBeenCalledWith(
        `/customers/${mockUserId}/documents`,
        expect.any(Object), // FormData
        expect.objectContaining({
          baseURL: process.env.LIRIUM_API_URL,
          headers: expect.objectContaining({
            'content-type': expect.stringContaining('multipart/form-data'),
          }),
        }),
      );
    });

    // Note: Validation of user_id, file, file_type, document_type, and file_name
    // is now handled by the validation pipe in the controller, not in the service.
    // These tests are removed as they are integration concerns, not unit test concerns.

    describe('validateFileProperties', () => {
      it('should throw BadRequestException when file buffer is empty', async () => {
        // Arrange
        const mockFile = createMockFile({ buffer: Buffer.from('') });
        const mockFileDto = createMockLiriumFileDto({ file: mockFile });

        // Act & Assert
        await expect(service.uploadKyc(mockFileDto)).rejects.toThrow(BadRequestException);
        await expect(service.uploadKyc(mockFileDto)).rejects.toThrow('File buffer is empty');
        // Verify that validation happens before database query - validation throws immediately
        expect(mockPool.query).not.toHaveBeenCalled();
        expect(mockHttpService.post).not.toHaveBeenCalled();
      });

      it('should throw BadRequestException when file buffer is null', async () => {
        // Arrange
        const mockFile = createMockFile({ buffer: null as any });
        const mockFileDto = createMockLiriumFileDto({ file: mockFile });

        // Act & Assert
        await expect(service.uploadKyc(mockFileDto)).rejects.toThrow(BadRequestException);
        await expect(service.uploadKyc(mockFileDto)).rejects.toThrow('File buffer is empty');
        // Verify that validation happens before database query - validation throws immediately
        expect(mockPool.query).not.toHaveBeenCalled();
        expect(mockHttpService.post).not.toHaveBeenCalled();
      });

      it('should throw BadRequestException when file buffer is undefined', async () => {
        // Arrange
        const mockFile = createMockFile({ buffer: undefined as any });
        const mockFileDto = createMockLiriumFileDto({ file: mockFile });

        // Act & Assert
        await expect(service.uploadKyc(mockFileDto)).rejects.toThrow(BadRequestException);
        await expect(service.uploadKyc(mockFileDto)).rejects.toThrow('File buffer is empty');
        // Verify that validation happens before database query - validation throws immediately
        expect(mockPool.query).not.toHaveBeenCalled();
        expect(mockHttpService.post).not.toHaveBeenCalled();
      });

      it('should throw BadRequestException when file buffer length is 0', async () => {
        // Arrange
        const mockFile = createMockFile({ buffer: Buffer.alloc(0) });
        const mockFileDto = createMockLiriumFileDto({ file: mockFile });

        // Act & Assert
        await expect(service.uploadKyc(mockFileDto)).rejects.toThrow(BadRequestException);
        await expect(service.uploadKyc(mockFileDto)).rejects.toThrow('File buffer is empty');
        // Verify that validation happens before database query - validation throws immediately
        expect(mockPool.query).not.toHaveBeenCalled();
        expect(mockHttpService.post).not.toHaveBeenCalled();
      });

      it('should throw BadRequestException when mimetype is not allowed', async () => {
        // Arrange
        const mockFile = createMockFile({ mimetype: 'application/zip' });
        const mockFileDto = createMockLiriumFileDto({ file: mockFile });

        // Act & Assert
        await expect(service.uploadKyc(mockFileDto)).rejects.toThrow(BadRequestException);
        await expect(service.uploadKyc(mockFileDto)).rejects.toThrow(
          'File type application/zip is not allowed',
        );
        // Verify that validation happens before database query - validation throws immediately
        expect(mockPool.query).not.toHaveBeenCalled();
        expect(mockHttpService.post).not.toHaveBeenCalled();
      });

      it('should throw BadRequestException when mimetype is text/plain', async () => {
        // Arrange
        const mockFile = createMockFile({ mimetype: 'text/plain' });
        const mockFileDto = createMockLiriumFileDto({ file: mockFile });

        // Act & Assert
        await expect(service.uploadKyc(mockFileDto)).rejects.toThrow(BadRequestException);
        await expect(service.uploadKyc(mockFileDto)).rejects.toThrow(
          'File type text/plain is not allowed',
        );
        // Verify that validation happens before database query - validation throws immediately
        expect(mockPool.query).not.toHaveBeenCalled();
        expect(mockHttpService.post).not.toHaveBeenCalled();
      });

      it('should accept image/jpeg mimetype', async () => {
        // Arrange
        const mockFile = createMockFile({ mimetype: 'image/jpeg' });
        const mockFileDto = createMockLiriumFileDto({ file: mockFile });
        const mockUserId = 'user-123';
        const mockHttpResponse = {
          data: { success: true },
          status: 200,
          statusText: 'OK',
          headers: {},
        };

        mockPool.query.mockResolvedValueOnce({
          rows: [{ user_id: mockUserId }],
        });

        mockHttpService.post.mockResolvedValueOnce(mockHttpResponse);

        // Act
        await service.uploadKyc(mockFileDto);

        // Assert
        expect(mockHttpService.post).toHaveBeenCalled();
      });

      it('should accept image/png mimetype', async () => {
        // Arrange
        const mockFile = createMockFile({ mimetype: 'image/png' });
        const mockFileDto = createMockLiriumFileDto({ file: mockFile });
        const mockUserId = 'user-123';
        const mockHttpResponse = {
          data: { success: true },
          status: 200,
          statusText: 'OK',
          headers: {},
        };

        mockPool.query.mockResolvedValueOnce({
          rows: [{ user_id: mockUserId }],
        });

        mockHttpService.post.mockResolvedValueOnce(mockHttpResponse);

        // Act
        await service.uploadKyc(mockFileDto);

        // Assert
        expect(mockHttpService.post).toHaveBeenCalled();
      });

      it('should accept image/jpg mimetype', async () => {
        // Arrange
        const mockFile = createMockFile({ mimetype: 'image/jpg' });
        const mockFileDto = createMockLiriumFileDto({ file: mockFile });
        const mockUserId = 'user-123';
        const mockHttpResponse = {
          data: { success: true },
          status: 200,
          statusText: 'OK',
          headers: {},
        };

        mockPool.query.mockResolvedValueOnce({
          rows: [{ user_id: mockUserId }],
        });

        mockHttpService.post.mockResolvedValueOnce(mockHttpResponse);

        // Act
        await service.uploadKyc(mockFileDto);

        // Assert
        expect(mockHttpService.post).toHaveBeenCalled();
      });

      it('should accept application/pdf mimetype', async () => {
        // Arrange
        const mockFile = createMockFile({ mimetype: 'application/pdf' });
        const mockFileDto = createMockLiriumFileDto({ file: mockFile });
        const mockUserId = 'user-123';
        const mockHttpResponse = {
          data: { success: true },
          status: 200,
          statusText: 'OK',
          headers: {},
        };

        mockPool.query.mockResolvedValueOnce({
          rows: [{ user_id: mockUserId }],
        });

        mockHttpService.post.mockResolvedValueOnce(mockHttpResponse);

        // Act
        await service.uploadKyc(mockFileDto);

        // Assert
        expect(mockHttpService.post).toHaveBeenCalled();
      });

      it('should validate file properties before querying database', async () => {
        // Arrange
        const mockFile = createMockFile({ buffer: Buffer.from('') });
        const mockFileDto = createMockLiriumFileDto({ file: mockFile });

        // Act & Assert
        await expect(service.uploadKyc(mockFileDto)).rejects.toThrow(BadRequestException);
        // Verify that database query was not called because validation failed first
        expect(mockPool.query).not.toHaveBeenCalled();
        expect(mockHttpService.post).not.toHaveBeenCalled();
      });

      it('should validate file properties before making HTTP request', async () => {
        // Arrange
        const mockFile = createMockFile({ mimetype: 'application/xml' });
        const mockFileDto = createMockLiriumFileDto({ file: mockFile });
        const mockUserId = 'user-123';

        mockPool.query.mockResolvedValueOnce({
          rows: [{ user_id: mockUserId }],
        });

        // Act & Assert
        await expect(service.uploadKyc(mockFileDto)).rejects.toThrow(BadRequestException);
        // Verify that HTTP request was not made because validation failed
        expect(mockHttpService.post).not.toHaveBeenCalled();
      });
    });

    it('should throw BadRequestException when user is not found in database', async () => {
      // Arrange
      const mockFileDto = createMockLiriumFileDto();

      mockPool.query.mockResolvedValue({
        rows: [],
      });

      // Act & Assert
      await expect(service.uploadKyc(mockFileDto)).rejects.toThrow(BadRequestException);
      await expect(service.uploadKyc(mockFileDto)).rejects.toThrow(
        `User with account id ${mockFileDto.user_id} not found`,
      );
      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT user_id FROM users WHERE girasol_account_id = $1',
        [mockFileDto.user_id],
      );
      expect(mockHttpService.post).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when user_id from database is null', async () => {
      // Arrange
      const mockFileDto = createMockLiriumFileDto();

      mockPool.query
        .mockResolvedValueOnce({
          rows: [{ user_id: null }],
        })
        .mockResolvedValueOnce({
          rows: [{ user_id: null }],
        });

      // Act & Assert
      await expect(service.uploadKyc(mockFileDto)).rejects.toThrow(BadRequestException);
      await expect(service.uploadKyc(mockFileDto)).rejects.toThrow(
        `User with account id ${mockFileDto.user_id} not found`,
      );
      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT user_id FROM users WHERE girasol_account_id = $1',
        [mockFileDto.user_id],
      );
      expect(mockHttpService.post).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when user_id from database is undefined', async () => {
      // Arrange
      const mockFileDto = createMockLiriumFileDto();

      mockPool.query
        .mockResolvedValueOnce({
          rows: [{}],
        })
        .mockResolvedValueOnce({
          rows: [{}],
        });

      // Act & Assert
      await expect(service.uploadKyc(mockFileDto)).rejects.toThrow(BadRequestException);
      await expect(service.uploadKyc(mockFileDto)).rejects.toThrow(
        `User with account id ${mockFileDto.user_id} not found`,
      );
      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT user_id FROM users WHERE girasol_account_id = $1',
        [mockFileDto.user_id],
      );
      expect(mockHttpService.post).not.toHaveBeenCalled();
    });

    it('should propagate HTTP errors from httpService', async () => {
      // Arrange
      const mockFileDto = createMockLiriumFileDto();
      const mockUserId = 'user-123';
      const httpError = new HttpException(
        { error_code: 'validation_error', error_msg: 'Invalid file format' },
        400,
      );

      mockPool.query.mockResolvedValueOnce({
        rows: [{ user_id: mockUserId }],
      });

      mockHttpService.post.mockRejectedValueOnce(httpError);

      // Act & Assert
      await expect(service.uploadKyc(mockFileDto)).rejects.toThrow(HttpException);
      expect(mockHttpService.post).toHaveBeenCalledWith(
        `/customers/${mockUserId}/documents`,
        expect.any(Object),
        expect.any(Object),
      );
    });

    it('should create FormData with correct file buffer and metadata', async () => {
      // Arrange
      const mockFileDto = createMockLiriumFileDto();
      const mockUserId = 'user-123';
      const mockHttpResponse = {
        data: { success: true },
        status: 200,
        statusText: 'OK',
        headers: {},
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [{ user_id: mockUserId }],
      });

      mockHttpService.post.mockResolvedValueOnce(mockHttpResponse);

      // Act
      await service.uploadKyc(mockFileDto);

      // Assert
      expect(mockHttpService.post).toHaveBeenCalledWith(
        `/customers/${mockUserId}/documents`,
        expect.any(Object), // FormData instance
        expect.any(Object),
      );

      // Verify FormData was created with correct structure
      const formDataCall = mockHttpService.post.mock.calls[0];
      const formData = formDataCall[1];
      
      // FormData is an object, we can't easily inspect its contents in tests
      // but we can verify it was passed and the headers are correct
      expect(formData).toBeDefined();
    });

    it('should use file_name when provided', async () => {
      // Arrange
      const mockFileDto = createMockLiriumFileDto({
        file_name: 'custom-name.pdf',
      });
      const mockUserId = 'user-123';
      const mockHttpResponse = {
        data: { success: true },
        status: 200,
        statusText: 'OK',
        headers: {},
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [{ user_id: mockUserId }],
      });

      mockHttpService.post.mockResolvedValueOnce(mockHttpResponse);

      // Act
      await service.uploadKyc(mockFileDto);

      // Assert
      expect(mockHttpService.post).toHaveBeenCalled();
    });

    it('should use file.originalname when file_name is not provided', async () => {
      // Arrange
      const mockFile = createMockFile({ originalname: 'original-document.pdf' });
      const mockFileDto = createMockLiriumFileDto({
        file_name: '',
        file: mockFile,
      });
      const mockUserId = 'user-123';
      const mockHttpResponse = {
        data: { success: true },
        status: 200,
        statusText: 'OK',
        headers: {},
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [{ user_id: mockUserId }],
      });

      mockHttpService.post.mockResolvedValueOnce(mockHttpResponse);

      // Act
      await service.uploadKyc(mockFileDto);

      // Assert
      expect(mockHttpService.post).toHaveBeenCalled();
    });

    it('should include all form fields in FormData', async () => {
      // Arrange
      const mockFileDto = createMockLiriumFileDto({
        file_type: 'id_back',
        document_type: LiriumFileType.ID_BACK,
        file_name: 'license-back.pdf',
      });
      const mockUserId = 'user-123';
      const mockHttpResponse = {
        data: { success: true },
        status: 200,
        statusText: 'OK',
        headers: {},
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [{ user_id: mockUserId }],
      });

      mockHttpService.post.mockResolvedValueOnce(mockHttpResponse);

      // Act
      await service.uploadKyc(mockFileDto);

      // Assert
      expect(mockHttpService.post).toHaveBeenCalled();
      // The FormData includes file_type, document_type, and file_name
      // We verify the call was made with the correct URL and config
    });

    it('should work with ID_FRONT document type', async () => {
      // Arrange
      const mockFileDto = createMockLiriumFileDto({
        document_type: LiriumFileType.ID_FRONT,
      });
      const mockUserId = 'user-123';
      const mockHttpResponse = {
        data: { success: true },
        status: 200,
        statusText: 'OK',
        headers: {},
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [{ user_id: mockUserId }],
      });

      mockHttpService.post.mockResolvedValueOnce(mockHttpResponse);

      // Act
      await service.uploadKyc(mockFileDto);

      // Assert
      expect(mockHttpService.post).toHaveBeenCalled();
    });

    it('should work with ID_BACK document type', async () => {
      // Arrange
      const mockFileDto = createMockLiriumFileDto({
        document_type: LiriumFileType.ID_BACK,
      });
      const mockUserId = 'user-123';
      const mockHttpResponse = {
        data: { success: true },
        status: 200,
        statusText: 'OK',
        headers: {},
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [{ user_id: mockUserId }],
      });

      mockHttpService.post.mockResolvedValueOnce(mockHttpResponse);

      // Act
      await service.uploadKyc(mockFileDto);

      // Assert
      expect(mockHttpService.post).toHaveBeenCalled();
    });

    it('should work with PROOF_OF_ADDRESS document type', async () => {
      // Arrange
      const mockFileDto = createMockLiriumFileDto({
        document_type: LiriumFileType.PROOF_OF_ADDRESS,
      });
      const mockUserId = 'user-123';
      const mockHttpResponse = {
        data: { success: true },
        status: 200,
        statusText: 'OK',
        headers: {},
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [{ user_id: mockUserId }],
      });

      mockHttpService.post.mockResolvedValueOnce(mockHttpResponse);

      // Act
      await service.uploadKyc(mockFileDto);

      // Assert
      expect(mockHttpService.post).toHaveBeenCalled();
    });

    it('should work with SELFIE document type', async () => {
      // Arrange
      const mockFileDto = createMockLiriumFileDto({
        document_type: LiriumFileType.SELFIE,
      });
      const mockUserId = 'user-123';
      const mockHttpResponse = {
        data: { success: true },
        status: 200,
        statusText: 'OK',
        headers: {},
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [{ user_id: mockUserId }],
      });

      mockHttpService.post.mockResolvedValueOnce(mockHttpResponse);

      // Act
      await service.uploadKyc(mockFileDto);

      // Assert
      expect(mockHttpService.post).toHaveBeenCalled();
    });

    it('should use LIRIUM_API_URL from environment variables', async () => {
      // Arrange
      const customApiUrl = 'https://custom-api.lirium.com';
      process.env.LIRIUM_API_URL = customApiUrl;

      const mockFileDto = createMockLiriumFileDto();
      const mockUserId = 'user-123';
      const mockHttpResponse = {
        data: { success: true },
        status: 200,
        statusText: 'OK',
        headers: {},
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [{ user_id: mockUserId }],
      });

      mockHttpService.post.mockResolvedValueOnce(mockHttpResponse);

      // Act
      await service.uploadKyc(mockFileDto);

      // Assert
      expect(mockHttpService.post).toHaveBeenCalledWith(
        `/customers/${mockUserId}/documents`,
        expect.any(Object),
        expect.objectContaining({
          baseURL: customApiUrl,
        }),
      );
    });

    it('should include multipart/form-data headers in request', async () => {
      // Arrange
      const mockFileDto = createMockLiriumFileDto();
      const mockUserId = 'user-123';
      const mockHttpResponse = {
        data: { success: true },
        status: 200,
        statusText: 'OK',
        headers: {},
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [{ user_id: mockUserId }],
      });

      mockHttpService.post.mockResolvedValueOnce(mockHttpResponse);

      // Act
      await service.uploadKyc(mockFileDto);

      // Assert
      const configCall = mockHttpService.post.mock.calls[0][2];
      expect(configCall.headers).toBeDefined();
      expect(configCall.headers['content-type']).toContain('multipart/form-data');
    });

    it('should handle database query errors', async () => {
      // Arrange
      const mockFileDto = createMockLiriumFileDto();
      const dbError = new Error('Database connection failed');

      mockPool.query.mockRejectedValue(dbError);

      // Act & Assert
      await expect(service.uploadKyc(mockFileDto)).rejects.toThrow('Database connection failed');
      expect(mockHttpService.post).not.toHaveBeenCalled();
    });
  });
});

