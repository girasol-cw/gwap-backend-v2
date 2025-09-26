import { TokenLiriumService } from '../src/services/token-lirium.service';
import { TokenLiriumDto } from '../src/dto/token.dto';
import * as jwt from 'jsonwebtoken';
import * as fs from 'node:fs';
import * as path from 'node:path';

// Mock de jsonwebtoken
jest.mock('jsonwebtoken');
const mockedJwt = jwt as jest.Mocked<typeof jwt>;

// Mock de fs
jest.mock('node:fs');
const mockedFs = fs as jest.Mocked<typeof fs>;

// Mock de path
jest.mock('node:path');
const mockedPath = path as jest.Mocked<typeof path>;

describe('TokenLiriumService', () => {
  let service: TokenLiriumService;
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Reset environment variables
    process.env = { ...originalEnv };
    
    // Mock console methods to avoid noise in tests
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    // Restore environment variables
    process.env = originalEnv;
  });

  describe('Constructor', () => {
    it('should throw error when LIRIUM_API_KEY is not provided', () => {
      // Arrange
      delete process.env.LIRIUM_API_KEY;

      // Act & Assert
      expect(() => new TokenLiriumService()).toThrow('LIRIUM_API_KEY is required.');
    });

    it('should throw error when LIRIUM_API_KEY is empty', () => {
      // Arrange
      process.env.LIRIUM_API_KEY = '   ';

      // Act & Assert
      expect(() => new TokenLiriumService()).toThrow('LIRIUM_API_KEY is required.');
    });

    it('should throw error when no private key source is provided', () => {
      // Arrange
      process.env.LIRIUM_API_KEY = 'test-api-key';
      delete process.env.LIRIUM_PRIVATE_KEY_B64;
      delete process.env.LIRIUM_PRIVATE_KEY_PATH;
      delete process.env.LIRIUM_PRIVATE_KEY;

      // Act & Assert
      expect(() => new TokenLiriumService()).toThrow(
        'Provide one of: LIRIUM_PRIVATE_KEY_B64 (preferred), LIRIUM_PRIVATE_KEY_PATH, or LIRIUM_PRIVATE_KEY.'
      );
    });

    it('should initialize successfully with LIRIUM_PRIVATE_KEY_B64', () => {
      // Arrange
      process.env.LIRIUM_API_KEY = 'test-api-key';
      process.env.LIRIUM_PRIVATE_KEY_B64 = Buffer.from('-----BEGIN PRIVATE KEY-----\ntest-key\n-----END PRIVATE KEY-----').toString('base64');

      // Act
      expect(() => new TokenLiriumService()).not.toThrow();
    });

    it('should initialize successfully with LIRIUM_PRIVATE_KEY_PATH', () => {
      // Arrange
      process.env.LIRIUM_API_KEY = 'test-api-key';
      process.env.LIRIUM_PRIVATE_KEY_PATH = '/path/to/key.pem';
      mockedPath.isAbsolute.mockReturnValue(true);
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue('-----BEGIN PRIVATE KEY-----\ntest-key\n-----END PRIVATE KEY-----');

      // Act
      expect(() => new TokenLiriumService()).not.toThrow();
    });

    it('should initialize successfully with LIRIUM_PRIVATE_KEY', () => {
      // Arrange
      process.env.LIRIUM_API_KEY = 'test-api-key';
      process.env.LIRIUM_PRIVATE_KEY = '-----BEGIN PRIVATE KEY-----\\ntest-key\\n-----END PRIVATE KEY-----';

      // Act
      expect(() => new TokenLiriumService()).not.toThrow();
    });

    it('should throw error when private key file does not exist', () => {
      // Arrange
      process.env.LIRIUM_API_KEY = 'test-api-key';
      process.env.LIRIUM_PRIVATE_KEY_PATH = '/nonexistent/path.pem';
      mockedPath.isAbsolute.mockReturnValue(true);
      mockedFs.existsSync.mockReturnValue(false);

      // Act & Assert
      expect(() => new TokenLiriumService()).toThrow('Lirium private key file not found at: /nonexistent/path.pem');
    });
  });

  describe('getToken', () => {
    beforeEach(() => {
      // Setup default environment for getToken tests
      process.env.LIRIUM_API_KEY = 'test-api-key';
      process.env.LIRIUM_PRIVATE_KEY_B64 = Buffer.from('-----BEGIN PRIVATE KEY-----\ntest-key\n-----END PRIVATE KEY-----').toString('base64');
    });

    it('should return cached token when not expired', async () => {
      // Arrange
      const service = new TokenLiriumService();
      const mockToken = 'cached-token';
      
      // Mock the first call to jwt.sign
      (mockedJwt.sign as jest.Mock).mockReturnValueOnce(mockToken);
      
      // Get token first time
      await service.getToken();
      
      // Act - get token second time (should use cache)
      const result = await service.getToken();

      // Assert
      expect(result).toEqual({ token: mockToken });
      expect(mockedJwt.sign).toHaveBeenCalledTimes(1); // Should only be called once
    });

    it('should generate new token when expired', async () => {
      // Arrange
      const service = new TokenLiriumService();
      const firstToken = 'first-token';
      const secondToken = 'second-token';
      
      (mockedJwt.sign as jest.Mock)
        .mockReturnValueOnce(firstToken)
        .mockReturnValueOnce(secondToken);

      // Get first token
      await service.getToken();
      
      // Mock time to be after expiration (840 seconds)
      const originalDateNow = Date.now;
      Date.now = jest.fn(() => originalDateNow() + 850 * 1000);

      // Act - get token after expiration
      const result = await service.getToken();

      // Assert
      expect(result).toEqual({ token: secondToken });
      expect(mockedJwt.sign).toHaveBeenCalledTimes(2);

      // Restore Date.now
      Date.now = originalDateNow;
    });

    it('should generate new token when no cached token exists', async () => {
      // Arrange
      const service = new TokenLiriumService();
      const mockToken = 'new-token';
      (mockedJwt.sign as jest.Mock).mockReturnValue(mockToken);

      // Act
      const result = await service.getToken();

      // Assert
      expect(result).toEqual({ token: mockToken });
      expect(mockedJwt.sign).toHaveBeenCalledWith(
        {
          iss: 'test-api-key',
          iat: expect.any(Number),
        },
        '-----BEGIN PRIVATE KEY-----\ntest-key\n-----END PRIVATE KEY-----',
        { algorithm: 'RS512' }
      );
    });

    it('should throw error when jwt.sign fails', async () => {
      // Arrange
      const service = new TokenLiriumService();
      const jwtError = new Error('JWT signing failed');
      (mockedJwt.sign as jest.Mock).mockImplementation(() => {
        throw jwtError;
      });

      // Act & Assert
      await expect(service.getToken()).rejects.toThrow('Failed to sign Lirium JWT (RS512): JWT signing failed');
    });

    it('should throw error with unknown error message when jwt.sign fails with non-Error', async () => {
      // Arrange
      const service = new TokenLiriumService();
      (mockedJwt.sign as jest.Mock).mockImplementation(() => {
        throw 'String error';
      });

      // Act & Assert
      await expect(service.getToken()).rejects.toThrow('Failed to sign Lirium JWT (RS512): Unknown error');
    });
  });

  describe('resolvePrivateKeyPem', () => {
    beforeEach(() => {
      process.env.LIRIUM_API_KEY = 'test-api-key';
    });

    it('should decode base64 private key', () => {
      // Arrange
      const privateKey = '-----BEGIN PRIVATE KEY-----\ntest-key\n-----END PRIVATE KEY-----';
      const base64Key = Buffer.from(privateKey).toString('base64');
      process.env.LIRIUM_PRIVATE_KEY_B64 = base64Key;

      // Act
      const service = new TokenLiriumService();

      // Assert
      expect(service).toBeDefined();
    });

    it('should read private key from file path (absolute)', () => {
      // Arrange
      const privateKey = '-----BEGIN PRIVATE KEY-----\ntest-key\n-----END PRIVATE KEY-----';
      const keyPath = '/absolute/path/key.pem';
      process.env.LIRIUM_PRIVATE_KEY_PATH = keyPath;
      
      mockedPath.isAbsolute.mockReturnValue(true);
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(privateKey);

      // Act
      const service = new TokenLiriumService();

      // Assert
      expect(mockedPath.isAbsolute).toHaveBeenCalledWith(keyPath);
      expect(mockedFs.existsSync).toHaveBeenCalledWith(keyPath);
      expect(mockedFs.readFileSync).toHaveBeenCalledWith(keyPath, 'utf8');
    });

    it('should read private key from file path (relative)', () => {
      // Arrange
      const privateKey = '-----BEGIN PRIVATE KEY-----\ntest-key\n-----END PRIVATE KEY-----';
      const keyPath = 'relative/path/key.pem';
      const absolutePath = '/project/root/relative/path/key.pem';
      process.env.LIRIUM_PRIVATE_KEY_PATH = keyPath;
      
      mockedPath.isAbsolute.mockReturnValue(false);
      mockedPath.resolve.mockReturnValue(absolutePath);
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(privateKey);

      // Act
      const service = new TokenLiriumService();

      // Assert
      expect(mockedPath.isAbsolute).toHaveBeenCalledWith(keyPath);
      expect(mockedPath.resolve).toHaveBeenCalledWith(process.cwd(), keyPath);
      expect(mockedFs.existsSync).toHaveBeenCalledWith(absolutePath);
      expect(mockedFs.readFileSync).toHaveBeenCalledWith(absolutePath, 'utf8');
    });

    it('should handle raw private key with escaped newlines', () => {
      // Arrange
      const privateKey = '-----BEGIN PRIVATE KEY-----\\ntest-key\\n-----END PRIVATE KEY-----';
      process.env.LIRIUM_PRIVATE_KEY = privateKey;

      // Act
      const service = new TokenLiriumService();

      // Assert
      expect(service).toBeDefined();
    });

    it('should trim whitespace from base64 decoded key', () => {
      // Arrange
      const privateKey = '-----BEGIN PRIVATE KEY-----\ntest-key\n-----END PRIVATE KEY-----';
      const base64Key = Buffer.from(`  ${privateKey}  `).toString('base64');
      process.env.LIRIUM_PRIVATE_KEY_B64 = base64Key;

      // Act
      const service = new TokenLiriumService();

      // Assert
      expect(service).toBeDefined();
    });

    it('should trim whitespace from file content', () => {
      // Arrange
      const privateKey = '-----BEGIN PRIVATE KEY-----\ntest-key\n-----END PRIVATE KEY-----';
      const keyPath = '/path/key.pem';
      process.env.LIRIUM_PRIVATE_KEY_PATH = keyPath;
      
      mockedPath.isAbsolute.mockReturnValue(true);
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(`  ${privateKey}  `);

      // Act
      const service = new TokenLiriumService();

      // Assert
      expect(service).toBeDefined();
    });

    it('should trim whitespace from raw key', () => {
      // Arrange
      const privateKey = '-----BEGIN PRIVATE KEY-----\\ntest-key\\n-----END PRIVATE KEY-----';
      process.env.LIRIUM_PRIVATE_KEY = `  ${privateKey}  `;

      // Act
      const service = new TokenLiriumService();

      // Assert
      expect(service).toBeDefined();
    });

    it('should throw error when base64 key is empty after trim', () => {
      // Arrange
      process.env.LIRIUM_PRIVATE_KEY_B64 = '   ';

      // Act & Assert
      expect(() => new TokenLiriumService()).toThrow(
        'Provide one of: LIRIUM_PRIVATE_KEY_B64 (preferred), LIRIUM_PRIVATE_KEY_PATH, or LIRIUM_PRIVATE_KEY.'
      );
    });

    it('should throw error when file path is empty after trim', () => {
      // Arrange
      process.env.LIRIUM_PRIVATE_KEY_PATH = '   ';

      // Act & Assert
      expect(() => new TokenLiriumService()).toThrow(
        'Provide one of: LIRIUM_PRIVATE_KEY_B64 (preferred), LIRIUM_PRIVATE_KEY_PATH, or LIRIUM_PRIVATE_KEY.'
      );
    });

    it('should throw error when raw key is empty after trim', () => {
      // Arrange
      process.env.LIRIUM_PRIVATE_KEY = '   ';

      // Act & Assert
      expect(() => new TokenLiriumService()).toThrow(
        'Provide one of: LIRIUM_PRIVATE_KEY_B64 (preferred), LIRIUM_PRIVATE_KEY_PATH, or LIRIUM_PRIVATE_KEY.'
      );
    });
  });
});
