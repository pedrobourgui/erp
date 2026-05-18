import {
  buildPaginatedResponse,
  buildPrismaOrderBy,
  paginationSchema,
} from './pagination';

describe('pagination utilities', () => {
  // ─── buildPaginatedResponse ─────────────────────────────────────────
  describe('buildPaginatedResponse', () => {
    it('should build response with correct meta for single page', () => {
      const data = [{ id: '1' }, { id: '2' }];
      const result = buildPaginatedResponse(data, 2, { page: 1, limit: 20, sortOrder: 'desc' });

      expect(result).toEqual({
        success: true,
        data,
        meta: {
          total: 2,
          page: 1,
          limit: 20,
          totalPages: 1,
          hasMore: false,
        },
      });
    });

    it('should calculate totalPages correctly', () => {
      const result = buildPaginatedResponse([], 55, { page: 1, limit: 20, sortOrder: 'desc' });

      expect(result.meta.totalPages).toBe(3); // ceil(55/20) = 3
    });

    it('should set hasMore to true when not on last page', () => {
      const result = buildPaginatedResponse([], 55, { page: 1, limit: 20, sortOrder: 'desc' });

      expect(result.meta.hasMore).toBe(true);
    });

    it('should set hasMore to false when on last page', () => {
      const result = buildPaginatedResponse([], 55, { page: 3, limit: 20, sortOrder: 'desc' });

      expect(result.meta.hasMore).toBe(false);
    });

    it('should handle empty results', () => {
      const result = buildPaginatedResponse([], 0, { page: 1, limit: 20, sortOrder: 'desc' });

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
      expect(result.meta.totalPages).toBe(0);
      expect(result.meta.hasMore).toBe(false);
    });

    it('should handle total equal to limit', () => {
      const result = buildPaginatedResponse([], 20, { page: 1, limit: 20, sortOrder: 'desc' });

      expect(result.meta.totalPages).toBe(1);
      expect(result.meta.hasMore).toBe(false);
    });

    it('should include success: true', () => {
      const result = buildPaginatedResponse([], 0, { page: 1, limit: 20, sortOrder: 'desc' });

      expect(result.success).toBe(true);
    });
  });

  // ─── buildPrismaOrderBy ────────────────────────────────────────────
  describe('buildPrismaOrderBy', () => {
    it('should return { createdAt: sortOrder } when no sortBy is given', () => {
      expect(buildPrismaOrderBy()).toEqual({ createdAt: 'desc' });
    });

    it('should return default desc when only sortBy is given', () => {
      expect(buildPrismaOrderBy('name')).toEqual({ name: 'desc' });
    });

    it('should use the provided sortOrder', () => {
      expect(buildPrismaOrderBy('name', 'asc')).toEqual({ name: 'asc' });
    });

    it('should default createdAt with explicit sortOrder', () => {
      expect(buildPrismaOrderBy(undefined, 'asc')).toEqual({ createdAt: 'asc' });
    });
  });

  // ─── paginationSchema ─────────────────────────────────────────────
  describe('paginationSchema', () => {
    it('should parse valid pagination params', () => {
      const result = paginationSchema.parse({ page: '2', limit: '50' });

      expect(result.page).toBe(2);
      expect(result.limit).toBe(50);
    });

    it('should apply defaults', () => {
      const result = paginationSchema.parse({});

      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.sortOrder).toBe('desc');
    });

    it('should reject page < 1', () => {
      expect(() => paginationSchema.parse({ page: '0' })).toThrow();
    });

    it('should reject limit > 100', () => {
      expect(() => paginationSchema.parse({ limit: '101' })).toThrow();
    });

    it('should accept sortOrder asc or desc', () => {
      expect(paginationSchema.parse({ sortOrder: 'asc' }).sortOrder).toBe('asc');
      expect(paginationSchema.parse({ sortOrder: 'desc' }).sortOrder).toBe('desc');
    });

    it('should reject invalid sortOrder', () => {
      expect(() => paginationSchema.parse({ sortOrder: 'random' })).toThrow();
    });

    it('should accept optional search param', () => {
      const result = paginationSchema.parse({ search: 'widget' });
      expect(result.search).toBe('widget');
    });
  });
});
