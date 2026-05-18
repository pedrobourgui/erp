import { HttpException, HttpStatus, BadRequestException, NotFoundException } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

// ─── Mock Express objects ────────────────────────────────────────────────────

function createMockArgumentsHost(url = '/api/v1/test') {
  const mockResponse = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  const mockRequest = {
    url,
  };

  return {
    switchToHttp: () => ({
      getResponse: () => mockResponse,
      getRequest: () => mockRequest,
    }),
    _response: mockResponse,
    _request: mockRequest,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
  });

  it('should handle HttpException with string response', () => {
    const host = createMockArgumentsHost();
    const exception = new HttpException('Not allowed', HttpStatus.FORBIDDEN);

    filter.catch(exception, host as any);

    expect(host._response.status).toHaveBeenCalledWith(403);
    expect(host._response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        statusCode: 403,
        message: 'Not allowed',
        timestamp: expect.any(String),
        path: '/api/v1/test',
      }),
    );
  });

  it('should handle HttpException with object response', () => {
    const host = createMockArgumentsHost();
    const exception = new BadRequestException({
      message: 'Validation failed',
      errors: { name: ['required'] },
    });

    filter.catch(exception, host as any);

    expect(host._response.status).toHaveBeenCalledWith(400);
    expect(host._response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        statusCode: 400,
        message: 'Validation failed',
        errors: { name: ['required'] },
      }),
    );
  });

  it('should handle NotFoundException', () => {
    const host = createMockArgumentsHost('/api/v1/products/123');
    const exception = new NotFoundException('Product not found');

    filter.catch(exception, host as any);

    expect(host._response.status).toHaveBeenCalledWith(404);
    expect(host._response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        statusCode: 404,
        path: '/api/v1/products/123',
      }),
    );
  });

  it('should handle non-HttpException Error with 500 status', () => {
    const host = createMockArgumentsHost();
    const exception = new Error('Something broke');

    filter.catch(exception, host as any);

    expect(host._response.status).toHaveBeenCalledWith(500);
    expect(host._response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        statusCode: 500,
        message: 'Something broke',
      }),
    );
  });

  it('should handle unknown exception type with 500 status and default message', () => {
    const host = createMockArgumentsHost();
    const exception = 'string error';

    filter.catch(exception, host as any);

    expect(host._response.status).toHaveBeenCalledWith(500);
    expect(host._response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        statusCode: 500,
        message: 'Internal server error',
      }),
    );
  });

  it('should include timestamp in ISO format', () => {
    const host = createMockArgumentsHost();
    const exception = new BadRequestException('test');

    filter.catch(exception, host as any);

    const body = host._response.json.mock.calls[0][0];
    expect(() => new Date(body.timestamp).toISOString()).not.toThrow();
  });

  it('should include the request path', () => {
    const host = createMockArgumentsHost('/api/v1/orders?status=PENDING');
    const exception = new BadRequestException('bad');

    filter.catch(exception, host as any);

    const body = host._response.json.mock.calls[0][0];
    expect(body.path).toBe('/api/v1/orders?status=PENDING');
  });
});
