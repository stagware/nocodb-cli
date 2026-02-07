import { describe, it, expect } from 'vitest';
import type {
  // Entity types
  Base,
  Table,
  View,
  ViewType,
  Column,
  ColumnType,
  Filter,
  ComparisonOperator,
  Sort,
  Row,
  // Response types
  ListResponse,
  PageInfo,
  BulkCreateResponse,
  BulkUpdateResponse,
  BulkDeleteResponse,
  ErrorResponse,
  // Client types
  ClientOptions,
  RequestOptions,
  RetryOptions,
  HeadersMap,
  // Ref types
  BaseRef,
  TableRef,
  ViewRef,
  FilterRef,
  SortRef,
  ColumnRef,
} from '../src/index.js';

/**
 * Test suite to verify all TypeScript types are properly exported
 * and can be used in type annotations.
 */
describe('Type Exports', () => {
  it('should allow using entity types in type annotations', () => {
    // This test verifies that types compile correctly
    const base: Base = {
      id: 'base_123',
      title: 'Test Base',
    };
    
    const table: Table = {
      id: 'tbl_123',
      base_id: 'base_123',
      title: 'Test Table',
      table_name: 'test_table',
    };
    
    const view: View = {
      id: 'view_123',
      title: 'Test View',
      type: 'grid',
      fk_model_id: 'tbl_123',
    };
    
    const column: Column = {
      id: 'col_123',
      title: 'Test Column',
      column_name: 'test_column',
      uidt: 'SingleLineText',
      fk_model_id: 'tbl_123',
    };
    
    const filter: Filter = {
      id: 'flt_123',
      fk_view_id: 'view_123',
      fk_column_id: 'col_123',
      comparison_op: 'eq',
      value: 'test',
    };
    
    const sort: Sort = {
      id: 'srt_123',
      fk_view_id: 'view_123',
      fk_column_id: 'col_123',
      direction: 'asc',
    };
    
    const row: Row = {
      Id: 1,
      test_column: 'test value',
    };
    
    // Verify objects are defined
    expect(base).toBeDefined();
    expect(table).toBeDefined();
    expect(view).toBeDefined();
    expect(column).toBeDefined();
    expect(filter).toBeDefined();
    expect(sort).toBeDefined();
    expect(row).toBeDefined();
  });

  it('should allow using response types in type annotations', () => {
    const listResponse: ListResponse<Table> = {
      list: [],
      pageInfo: {
        totalRows: 0,
        page: 1,
        pageSize: 25,
        isFirstPage: true,
        isLastPage: true,
      },
    };
    
    const bulkCreateResponse: BulkCreateResponse = {
      created: 5,
      data: [],
    };
    
    const bulkUpdateResponse: BulkUpdateResponse = {
      updated: 3,
      data: [],
    };
    
    const bulkDeleteResponse: BulkDeleteResponse = {
      deleted: 2,
    };
    
    const errorResponse: ErrorResponse = {
      message: 'Error occurred',
    };
    
    expect(listResponse).toBeDefined();
    expect(bulkCreateResponse).toBeDefined();
    expect(bulkUpdateResponse).toBeDefined();
    expect(bulkDeleteResponse).toBeDefined();
    expect(errorResponse).toBeDefined();
  });

  it('should allow using union types', () => {
    const viewType: ViewType = 'grid';
    const columnType: ColumnType = 'SingleLineText';
    const comparisonOp: ComparisonOperator = 'eq';
    
    expect(viewType).toBe('grid');
    expect(columnType).toBe('SingleLineText');
    expect(comparisonOp).toBe('eq');
  });

  it('should allow using client configuration types', () => {
    const clientOptions: ClientOptions = {
      baseUrl: 'https://api.example.com',
      headers: {
        'xc-token': 'test-token',
      },
      timeoutMs: 30000,
      retry: {
        retry: 3,
        retryDelay: 1000,
        retryStatusCodes: [408, 429, 500, 502, 503, 504],
      },
    };
    
    const requestOptions: RequestOptions = {
      headers: {
        'Content-Type': 'application/json',
      },
      query: {
        limit: 25,
        offset: 0,
      },
      body: { test: 'data' },
    };
    
    const retryOptions: RetryOptions = {
      retry: 3,
      retryDelay: 1000,
    };
    
    const headers: HeadersMap = {
      'Authorization': 'Bearer token',
    };
    
    expect(clientOptions).toBeDefined();
    expect(requestOptions).toBeDefined();
    expect(retryOptions).toBeDefined();
    expect(headers).toBeDefined();
  });

  it('should allow using ref types', () => {
    const baseRef: BaseRef = {
      id: 'base_123',
      title: 'Test Base',
    };
    
    const tableRef: TableRef = {
      id: 'tbl_123',
      title: 'Test Table',
    };
    
    const viewRef: ViewRef = {
      id: 'view_123',
      title: 'Test View',
    };
    
    const filterRef: FilterRef = {
      id: 'flt_123',
    };
    
    const sortRef: SortRef = {
      id: 'srt_123',
    };
    
    const columnRef: ColumnRef = {
      id: 'col_123',
    };
    
    expect(baseRef).toBeDefined();
    expect(tableRef).toBeDefined();
    expect(viewRef).toBeDefined();
    expect(filterRef).toBeDefined();
    expect(sortRef).toBeDefined();
    expect(columnRef).toBeDefined();
  });
});
