export interface RequestLogDto {
  id: string;
  verb: string;
  path: string;
  body?: any;
  response_body?: any;
  error?: string;
  status_code: string;
}
