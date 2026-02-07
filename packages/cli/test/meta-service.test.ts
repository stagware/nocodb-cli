import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MetaService } from '../src/services/meta-service.js';
import { NocoClient } from '@nocodb/sdk';
import type {
  Base,
  Table,
  View,
  Column,
  Filter,
  Sort,
  ListResponse,
} from '@nocodb/sdk';

describe('MetaService', () => {
  let metaService: MetaService;
  let mockClient: NocoClient;

  beforeEach(() => {
    // Create a mock NocoClient
    mockClient = {
      request: vi.fn(),
    } as unknown as NocoClient;

    // Create MetaService instance
    metaService = new MetaService(mockClient);
  });

  // ============================================================================
  // Base Operations Tests
  // ============================================================================

  describe('Base Operations', () => {
    it('should list bases', async () => {
      const mockResponse: ListResponse<Base> = {
        list: [
          { id: 'base1', title: 'Base 1' },
          { id: 'base2', title: 'Base 2' },
        ],
        pageInfo: { totalRows: 2 },
      };

      vi.mocked(mockClient.request).mockResolvedValue(mockResponse);

      const result = await metaService.listBases();

      expect(result).toEqual(mockResponse);
      expect(mockClient.request).toHaveBeenCalledWith('GET', '/api/v2/meta/bases');
    });

    it('should create a base', async () => {
      const baseData: Partial<Base> = { title: 'New Base' };
      const mockResponse: Base = { id: 'base123', title: 'New Base' };

      vi.mocked(mockClient.request).mockResolvedValue(mockResponse);

      const result = await metaService.createBase(baseData);

      expect(result).toEqual(mockResponse);
      expect(mockClient.request).toHaveBeenCalledWith('POST', '/api/v2/meta/bases', { body: baseData });
    });

    it('should get a base by ID', async () => {
      const mockResponse: Base = { id: 'base123', title: 'My Base' };

      vi.mocked(mockClient.request).mockResolvedValue(mockResponse);

      const result = await metaService.getBase('base123');

      expect(result).toEqual(mockResponse);
      expect(mockClient.request).toHaveBeenCalledWith('GET', '/api/v2/meta/bases/base123');
    });

    it('should get base info', async () => {
      const mockResponse: Base = { id: 'base123', title: 'My Base' };

      vi.mocked(mockClient.request).mockResolvedValue(mockResponse);

      const result = await metaService.getBaseInfo('base123');

      expect(result).toEqual(mockResponse);
      expect(mockClient.request).toHaveBeenCalledWith('GET', '/api/v2/meta/bases/base123/info');
    });

    it('should update a base', async () => {
      const updateData: Partial<Base> = { title: 'Updated Base' };
      const mockResponse: Base = { id: 'base123', title: 'Updated Base' };

      vi.mocked(mockClient.request).mockResolvedValue(mockResponse);

      const result = await metaService.updateBase('base123', updateData);

      expect(result).toEqual(mockResponse);
      expect(mockClient.request).toHaveBeenCalledWith('PATCH', '/api/v2/meta/bases/base123', { body: updateData });
    });

    it('should delete a base', async () => {
      vi.mocked(mockClient.request).mockResolvedValue(undefined);

      await metaService.deleteBase('base123');

      expect(mockClient.request).toHaveBeenCalledWith('DELETE', '/api/v2/meta/bases/base123');
    });
  });

  // ============================================================================
  // Table Operations Tests
  // ============================================================================

  describe('Table Operations', () => {
    it('should list tables', async () => {
      const mockResponse: ListResponse<Table> = {
        list: [
          { id: 'tbl1', base_id: 'base123', title: 'Table 1', table_name: 'table1' },
          { id: 'tbl2', base_id: 'base123', title: 'Table 2', table_name: 'table2' },
        ],
        pageInfo: { totalRows: 2 },
      };

      vi.mocked(mockClient.request).mockResolvedValue(mockResponse);

      const result = await metaService.listTables('base123');

      expect(result).toEqual(mockResponse);
      expect(mockClient.request).toHaveBeenCalledWith('GET', '/api/v2/meta/bases/base123/tables');
    });

    it('should create a table', async () => {
      const tableData: Partial<Table> = { title: 'New Table', table_name: 'new_table' };
      const mockResponse: Table = {
        id: 'tbl123',
        base_id: 'base123',
        title: 'New Table',
        table_name: 'new_table',
      };

      vi.mocked(mockClient.request).mockResolvedValue(mockResponse);

      const result = await metaService.createTable('base123', tableData);

      expect(result).toEqual(mockResponse);
      expect(mockClient.request).toHaveBeenCalledWith('POST', '/api/v2/meta/bases/base123/tables', { body: tableData });
    });

    it('should get a table by ID', async () => {
      const mockResponse: Table = {
        id: 'tbl123',
        base_id: 'base123',
        title: 'My Table',
        table_name: 'my_table',
      };

      vi.mocked(mockClient.request).mockResolvedValue(mockResponse);

      const result = await metaService.getTable('tbl123');

      expect(result).toEqual(mockResponse);
      expect(mockClient.request).toHaveBeenCalledWith('GET', '/api/v2/meta/tables/tbl123');
    });

    it('should update a table', async () => {
      const updateData: Partial<Table> = { title: 'Updated Table' };
      const mockResponse: Table = {
        id: 'tbl123',
        base_id: 'base123',
        title: 'Updated Table',
        table_name: 'my_table',
      };

      vi.mocked(mockClient.request).mockResolvedValue(mockResponse);

      const result = await metaService.updateTable('tbl123', updateData);

      expect(result).toEqual(mockResponse);
      expect(mockClient.request).toHaveBeenCalledWith('PATCH', '/api/v2/meta/tables/tbl123', { body: updateData });
    });

    it('should delete a table', async () => {
      vi.mocked(mockClient.request).mockResolvedValue(undefined);

      await metaService.deleteTable('tbl123');

      expect(mockClient.request).toHaveBeenCalledWith('DELETE', '/api/v2/meta/tables/tbl123');
    });
  });

  // ============================================================================
  // View Operations Tests
  // ============================================================================

  describe('View Operations', () => {
    it('should list views', async () => {
      const mockResponse: ListResponse<View> = {
        list: [
          { id: 'view1', title: 'View 1', type: 'grid', fk_model_id: 'tbl123' },
          { id: 'view2', title: 'View 2', type: 'form', fk_model_id: 'tbl123' },
        ],
        pageInfo: { totalRows: 2 },
      };

      vi.mocked(mockClient.request).mockResolvedValue(mockResponse);

      const result = await metaService.listViews('tbl123');

      expect(result).toEqual(mockResponse);
      expect(mockClient.request).toHaveBeenCalledWith('GET', '/api/v2/meta/tables/tbl123/views');
    });

    it('should create a view', async () => {
      const viewData: Partial<View> = { title: 'New View', type: 'grid' };
      const mockResponse: View = {
        id: 'view123',
        title: 'New View',
        type: 'grid',
        fk_model_id: 'tbl123',
      };

      vi.mocked(mockClient.request).mockResolvedValue(mockResponse);

      const result = await metaService.createView('tbl123', viewData);

      expect(result).toEqual(mockResponse);
      expect(mockClient.request).toHaveBeenCalledWith('POST', '/api/v1/db/meta/tables/tbl123/grids', { body: viewData });
    });

    it('should create a form view with explicit type', async () => {
      const viewData: Partial<View> = { title: 'My Form' };
      const mockResponse: View = {
        id: 'view456',
        title: 'My Form',
        type: 'form',
        fk_model_id: 'tbl123',
      };

      vi.mocked(mockClient.request).mockResolvedValue(mockResponse);

      const result = await metaService.createView('tbl123', viewData, 'form');

      expect(result).toEqual(mockResponse);
      expect(mockClient.request).toHaveBeenCalledWith('POST', '/api/v1/db/meta/tables/tbl123/forms', { body: viewData });
    });

    it('should get a view by ID via list-and-filter', async () => {
      const mockView: View = {
        id: 'view123',
        title: 'My View',
        type: 'grid',
        fk_model_id: 'tbl123',
      };
      const mockListResponse = { list: [mockView], pageInfo: {} };

      vi.mocked(mockClient.request).mockResolvedValue(mockListResponse);

      const result = await metaService.getView('tbl123', 'view123');

      expect(result).toEqual(mockView);
      expect(mockClient.request).toHaveBeenCalledWith('GET', '/api/v2/meta/tables/tbl123/views');
    });

    it('should throw when view not found', async () => {
      const mockListResponse = { list: [{ id: 'other', title: 'Other', type: 'grid', fk_model_id: 'tbl123' }], pageInfo: {} };

      vi.mocked(mockClient.request).mockResolvedValue(mockListResponse);

      await expect(metaService.getView('tbl123', 'nonexistent')).rejects.toThrow("View 'nonexistent' not found");
    });

    it('should update a view', async () => {
      const updateData: Partial<View> = { title: 'Updated View' };
      const mockResponse: View = {
        id: 'view123',
        title: 'Updated View',
        type: 'grid',
        fk_model_id: 'tbl123',
      };

      vi.mocked(mockClient.request).mockResolvedValue(mockResponse);

      const result = await metaService.updateView('view123', updateData);

      expect(result).toEqual(mockResponse);
      expect(mockClient.request).toHaveBeenCalledWith('PATCH', '/api/v2/meta/views/view123', { body: updateData });
    });

    it('should delete a view', async () => {
      vi.mocked(mockClient.request).mockResolvedValue(undefined);

      await metaService.deleteView('view123');

      expect(mockClient.request).toHaveBeenCalledWith('DELETE', '/api/v2/meta/views/view123');
    });
  });

  // ============================================================================
  // Column Operations Tests
  // ============================================================================

  describe('Column Operations', () => {
    it('should list columns', async () => {
      const mockResponse: ListResponse<Column> = {
        list: [
          {
            id: 'col1',
            title: 'Name',
            column_name: 'name',
            uidt: 'SingleLineText',
            fk_model_id: 'tbl123',
          },
          {
            id: 'col2',
            title: 'Age',
            column_name: 'age',
            uidt: 'Number',
            fk_model_id: 'tbl123',
          },
        ],
        pageInfo: { totalRows: 2 },
      };

      vi.mocked(mockClient.request).mockResolvedValue(mockResponse);

      const result = await metaService.listColumns('tbl123');

      expect(result).toEqual(mockResponse);
      expect(mockClient.request).toHaveBeenCalledWith('GET', '/api/v2/meta/tables/tbl123/columns');
    });

    it('should create a column', async () => {
      const columnData: Partial<Column> = {
        title: 'Email',
        column_name: 'email',
        uidt: 'Email',
      };
      const mockResponse: Column = {
        id: 'col123',
        title: 'Email',
        column_name: 'email',
        uidt: 'Email',
        fk_model_id: 'tbl123',
      };

      vi.mocked(mockClient.request).mockResolvedValue(mockResponse);

      const result = await metaService.createColumn('tbl123', columnData);

      expect(result).toEqual(mockResponse);
      expect(mockClient.request).toHaveBeenCalledWith('POST', '/api/v2/meta/tables/tbl123/columns', { body: columnData });
    });

    it('should get a column by ID', async () => {
      const mockResponse: Column = {
        id: 'col123',
        title: 'Email',
        column_name: 'email',
        uidt: 'Email',
        fk_model_id: 'tbl123',
      };

      vi.mocked(mockClient.request).mockResolvedValue(mockResponse);

      const result = await metaService.getColumn('col123');

      expect(result).toEqual(mockResponse);
      expect(mockClient.request).toHaveBeenCalledWith('GET', '/api/v2/meta/columns/col123');
    });

    it('should update a column', async () => {
      const updateData: Partial<Column> = { title: 'Email Address' };
      const mockResponse: Column = {
        id: 'col123',
        title: 'Email Address',
        column_name: 'email',
        uidt: 'Email',
        fk_model_id: 'tbl123',
      };

      vi.mocked(mockClient.request).mockResolvedValue(mockResponse);

      const result = await metaService.updateColumn('col123', updateData);

      expect(result).toEqual(mockResponse);
      expect(mockClient.request).toHaveBeenCalledWith('PATCH', '/api/v2/meta/columns/col123', { body: updateData });
    });

    it('should delete a column', async () => {
      vi.mocked(mockClient.request).mockResolvedValue(undefined);

      await metaService.deleteColumn('col123');

      expect(mockClient.request).toHaveBeenCalledWith('DELETE', '/api/v2/meta/columns/col123');
    });
  });

  // ============================================================================
  // Filter Operations Tests
  // ============================================================================

  describe('Filter Operations', () => {
    it('should list view filters', async () => {
      const mockResponse: ListResponse<Filter> = {
        list: [
          {
            id: 'flt1',
            fk_view_id: 'view123',
            fk_column_id: 'col123',
            comparison_op: 'eq',
            value: 'active',
          },
          {
            id: 'flt2',
            fk_view_id: 'view123',
            fk_column_id: 'col456',
            comparison_op: 'gt',
            value: 100,
          },
        ],
        pageInfo: { totalRows: 2 },
      };

      vi.mocked(mockClient.request).mockResolvedValue(mockResponse);

      const result = await metaService.listViewFilters('view123');

      expect(result).toEqual(mockResponse);
      expect(mockClient.request).toHaveBeenCalledWith('GET', '/api/v2/meta/views/view123/filters');
    });

    it('should create a view filter', async () => {
      const filterData: Partial<Filter> = {
        fk_column_id: 'col123',
        comparison_op: 'eq',
        value: 'active',
      };
      const mockResponse: Filter = {
        id: 'flt123',
        fk_view_id: 'view123',
        fk_column_id: 'col123',
        comparison_op: 'eq',
        value: 'active',
      };

      vi.mocked(mockClient.request).mockResolvedValue(mockResponse);

      const result = await metaService.createViewFilter('view123', filterData);

      expect(result).toEqual(mockResponse);
      expect(mockClient.request).toHaveBeenCalledWith('POST', '/api/v2/meta/views/view123/filters', { body: filterData });
    });

    it('should get a filter by ID', async () => {
      const mockResponse: Filter = {
        id: 'flt123',
        fk_view_id: 'view123',
        fk_column_id: 'col123',
        comparison_op: 'eq',
        value: 'active',
      };

      vi.mocked(mockClient.request).mockResolvedValue(mockResponse);

      const result = await metaService.getFilter('flt123');

      expect(result).toEqual(mockResponse);
      expect(mockClient.request).toHaveBeenCalledWith('GET', '/api/v2/meta/filters/flt123');
    });

    it('should update a filter', async () => {
      const updateData: Partial<Filter> = { value: 'inactive' };
      const mockResponse: Filter = {
        id: 'flt123',
        fk_view_id: 'view123',
        fk_column_id: 'col123',
        comparison_op: 'eq',
        value: 'inactive',
      };

      vi.mocked(mockClient.request).mockResolvedValue(mockResponse);

      const result = await metaService.updateFilter('flt123', updateData);

      expect(result).toEqual(mockResponse);
      expect(mockClient.request).toHaveBeenCalledWith('PATCH', '/api/v2/meta/filters/flt123', { body: updateData });
    });

    it('should delete a filter', async () => {
      vi.mocked(mockClient.request).mockResolvedValue(undefined);

      await metaService.deleteFilter('flt123');

      expect(mockClient.request).toHaveBeenCalledWith('DELETE', '/api/v2/meta/filters/flt123');
    });
  });

  // ============================================================================
  // Sort Operations Tests
  // ============================================================================

  describe('Sort Operations', () => {
    it('should list view sorts', async () => {
      const mockResponse: ListResponse<Sort> = {
        list: [
          {
            id: 'srt1',
            fk_view_id: 'view123',
            fk_column_id: 'col123',
            direction: 'asc',
          },
          {
            id: 'srt2',
            fk_view_id: 'view123',
            fk_column_id: 'col456',
            direction: 'desc',
          },
        ],
        pageInfo: { totalRows: 2 },
      };

      vi.mocked(mockClient.request).mockResolvedValue(mockResponse);

      const result = await metaService.listViewSorts('view123');

      expect(result).toEqual(mockResponse);
      expect(mockClient.request).toHaveBeenCalledWith('GET', '/api/v2/meta/views/view123/sorts');
    });

    it('should create a view sort', async () => {
      const sortData: Partial<Sort> = {
        fk_column_id: 'col123',
        direction: 'asc',
      };
      const mockResponse: Sort = {
        id: 'srt123',
        fk_view_id: 'view123',
        fk_column_id: 'col123',
        direction: 'asc',
      };

      vi.mocked(mockClient.request).mockResolvedValue(mockResponse);

      const result = await metaService.createViewSort('view123', sortData);

      expect(result).toEqual(mockResponse);
      expect(mockClient.request).toHaveBeenCalledWith('POST', '/api/v2/meta/views/view123/sorts', { body: sortData });
    });

    it('should get a sort by ID', async () => {
      const mockResponse: Sort = {
        id: 'srt123',
        fk_view_id: 'view123',
        fk_column_id: 'col123',
        direction: 'asc',
      };

      vi.mocked(mockClient.request).mockResolvedValue(mockResponse);

      const result = await metaService.getSort('srt123');

      expect(result).toEqual(mockResponse);
      expect(mockClient.request).toHaveBeenCalledWith('GET', '/api/v2/meta/sorts/srt123');
    });

    it('should update a sort', async () => {
      const updateData: Partial<Sort> = { direction: 'desc' };
      const mockResponse: Sort = {
        id: 'srt123',
        fk_view_id: 'view123',
        fk_column_id: 'col123',
        direction: 'desc',
      };

      vi.mocked(mockClient.request).mockResolvedValue(mockResponse);

      const result = await metaService.updateSort('srt123', updateData);

      expect(result).toEqual(mockResponse);
      expect(mockClient.request).toHaveBeenCalledWith('PATCH', '/api/v2/meta/sorts/srt123', { body: updateData });
    });

    it('should delete a sort', async () => {
      vi.mocked(mockClient.request).mockResolvedValue(undefined);

      await metaService.deleteSort('srt123');

      expect(mockClient.request).toHaveBeenCalledWith('DELETE', '/api/v2/meta/sorts/srt123');
    });
  });

  // ============================================================================
  // Swagger Operations Tests
  // ============================================================================

  describe('Swagger Operations', () => {
    it('should get base swagger', async () => {
      const mockResponse = {
        openapi: '3.0.0',
        paths: {},
      };

      vi.mocked(mockClient.request).mockResolvedValue(mockResponse);

      const result = await metaService.getBaseSwagger('base123');

      expect(result).toEqual(mockResponse);
      expect(mockClient.request).toHaveBeenCalledWith('GET', '/api/v2/meta/bases/base123/swagger.json');
    });
  });
});
