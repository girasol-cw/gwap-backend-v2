import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { TokenLiriumServiceAbstract } from './token-lirium.service';
import { LiriumErrorDto } from '../dto/lirium-error.dto';
import { DatabaseService } from './database.service';
import { RequestLogDto } from '../dto/request-log.dto';


export interface HttpWrapperConfig {
  baseURL?: string;
  timeout?: number;
  headers?: Record<string, string>;
}

export interface HttpWrapperResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: any;
}

export interface HttpWrapperErrorResponse {
  error: LiriumErrorDto;
  status: number;
  statusText: string;
  headers: any;
}

export type HttpWrapperResult<T = any> =
  | HttpWrapperResponse<T>
  | HttpWrapperErrorResponse;

@Injectable()
export class HttpWrapperService {
  private readonly logger = new Logger(HttpWrapperService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly tokenService: TokenLiriumServiceAbstract,
    private readonly databaseService: DatabaseService,
  ) {}

  /**
   * Performs a GET request with automatic token
   */
  async get<T = any>(
    url: string,
    config?: HttpWrapperConfig,
  ): Promise<HttpWrapperResponse<T>> {
    const requestConfig = await this.buildRequestConfig('GET', url, config);
    const requestId = this.generateRequestId();

    try {
      this.logger.log(`GET ${url}`);
      const response: AxiosResponse<T> = await firstValueFrom(
        this.httpService.get<T>(url, requestConfig),
      );

      const formattedResponse = this.formatResponse(response);
    
      await this.saveRequest({
        id: requestId,
        verb: 'GET',
        path: url,
        body: null,
        response_body: formattedResponse.data,
        error: "{}",
        status_code: formattedResponse.status.toString(),
      });

      return formattedResponse;
    } catch (error) {
      this.logger.error(`GET ${url} failed:`, error.message);
      const errorHandle= this.handleLiriumError(error, 'GET', url);
      // Guardar la petición con error
      await this.saveRequest({
        id: requestId,
        verb: 'GET',
        path: url,
        body: null,
        response_body: null,
        error: JSON.stringify(errorHandle),
        status_code: error.response?.status?.toString() || '500',
      });

      throw errorHandle;
    }
  }

  async post<T = any>(
    url: string,
    data?: any,
    config?: HttpWrapperConfig,
  ): Promise<HttpWrapperResponse<T>> {
    const requestConfig = await this.buildRequestConfig('POST', url, config);
    const requestId = this.generateRequestId();

    try {
      this.logger.log(`POST ${url}`);
      const response: AxiosResponse<T> = await firstValueFrom(
        this.httpService.post<T>(url, data, requestConfig),
      );

      const formattedResponse = this.formatResponse(response);
      
      // Guardar la petición exitosa
      await this.saveRequest({
        id: requestId,
        verb: 'POST',
        path: url,
        body: data,
        response_body: formattedResponse.data,
        error: "{}",
        status_code: formattedResponse.status.toString(),
      });

      return formattedResponse;
    } catch (error) {
      this.logger.error(`POST ${url} failed:`, error.message);
      const errorHandle= this.handleLiriumError(error, 'POST', url);
      // Guardar la petición con error
      await this.saveRequest({
        id: requestId,
        verb: 'POST',
        path: url,
        body: data,
        response_body: null,
        error: JSON.stringify(errorHandle),
        status_code: error.response?.status?.toString() || '500',
      });

      throw errorHandle;
    }
  }



  private async buildRequestConfig(
    method: string,
    url: string,
    config?: HttpWrapperConfig,
  ): Promise<AxiosRequestConfig> {
    try {
      // Get the token
      const tokenResponse = await this.tokenService.getToken();
      const token = tokenResponse.token;

      // Build default headers
      const defaultHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      };

      // Combine default headers with provided ones
      const headers = {
        ...defaultHeaders,
        ...(config?.headers || {}),
      };

      // Build Axios configuration
      const axiosConfig: AxiosRequestConfig = {
        method,
        url,
        headers,
        timeout: config?.timeout || 30000, // 30 seconds default
        ...(config?.baseURL && { baseURL: config.baseURL }),
      };

      return axiosConfig;
    } catch (error) {
      // this.logger.error('Error building request config:', error.message);
      throw new Error(
        `Failed to build request configuration: ${error.message}`,
      );
    }
  }

  /**
   * Formats Axios response to our format
   */
  private formatResponse<T>(
    response: AxiosResponse<T>,
  ): HttpWrapperResponse<T> {
    return {
      data: response.data,
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    };
  }

  /**
   * Utility method for making requests with custom configuration
   */
  async request<T = any>(
    config: AxiosRequestConfig & HttpWrapperConfig,
  ): Promise<HttpWrapperResponse<T>> {
    const requestId = this.generateRequestId();

    try {
      // Get the token
      const tokenResponse = await this.tokenService.getToken();
      const token = tokenResponse.token;

      // Add token to headers
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(config.headers || {}),
      };

      const requestConfig: AxiosRequestConfig = {
        ...config,
        headers,
      };

      // this.logger.log(`${config.method?.toUpperCase()} ${config.url}`);
      const response: AxiosResponse<T> = await firstValueFrom(
        this.httpService.request<T>(requestConfig),
      );

      const formattedResponse = this.formatResponse(response);
      
      // Guardar la petición exitosa
      await this.saveRequest({
        id: requestId,
        verb: config.method?.toUpperCase() || 'UNKNOWN',
        path: config.url || '',
        body: config.data,
        response_body: formattedResponse.data,
        error: "",
        status_code: formattedResponse.status.toString(),
      });

      return formattedResponse;
    } catch (error) {
      this.logger.error(
        `Request ${config.method} ${config.url} failed:`,
        error.message,
      );
      
      // Guardar la petición con error
      await this.saveRequest({
        id: requestId,
        verb: config.method?.toUpperCase() || 'UNKNOWN',
        path: config.url || '',
        body: config.data,
        response_body: null,
        error: JSON.stringify(error),
        status_code: error.response?.status?.toString() || '500',
      });

      throw error;
    }
  }

  /**
   * Handles Lirium API errors and returns structured error response
   */
  private handleLiriumError(
    error: any,
    method: string,
    url: string,
  ): HttpWrapperErrorResponse {
    this.logger.error(`${method} ${url} failed:`, error.message);

    // Check if it's an Axios error with response data
    if (error instanceof AxiosError && error.response?.data) {
      const responseData = error.response.data;

      // Check if the response has Lirium error format
      if (responseData.error_code && responseData.error_msg) {
        const liriumError: LiriumErrorDto = {
          error_code: responseData.error_code,
          error_msg: responseData.error_msg,
          request_id: responseData.request_id || 'unknown',
        };

        return {
          error: liriumError,
          status: error.response.status,
          statusText: error.response.statusText,
          headers: error.response.headers,
        };
      }
    }

    // If it's not a Lirium error format, create a generic error
    const genericError: LiriumErrorDto = {
      error_code: 'internal_error',
      error_msg: error.message || 'Unknown error occurred',
      request_id: 'unknown',
    };

    return {
      error: genericError,
      status: error.response?.status || 500,
      statusText: error.response?.statusText || 'Internal Server Error',
      headers: error.response?.headers || {},
    };
  }

  /**
   * Generates a unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Saves request data to database
   */
  private async saveRequest(request: RequestLogDto): Promise<void> {
    try {
      await this.databaseService.pool.query(
        'INSERT INTO requests (id, verb, path, body, response_body, error, status_code) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [
          request.id,
          request.verb,
          request.path,
          request.body ? JSON.stringify(request.body) : null,
          request.response_body ? JSON.stringify(request.response_body) : null,
          request.error,
          request.status_code,
        ],
      );
    } catch (error) {
      this.logger.error('Error saving request to database:', error.message);
      // No lanzamos el error para no interrumpir el flujo principal
    }
  }
}
