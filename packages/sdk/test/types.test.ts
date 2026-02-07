import { describe, expect, it } from "vitest";
import type {
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
} from "../src/types/entities.js";
import type {
  ListResponse,
  PageInfo,
  BulkCreateResponse,
  BulkUpdateResponse,
  BulkDeleteResponse,
  ErrorResponse,
} from "../src/types/responses.js";

describe("Entity Types", () => {
  describe("Base", () => {
    it("should accept valid Base objects", () => {
      const base: Base = {
        id: "base123",
        title: "My Base",
        type: "database",
        is_meta: false,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      };
      expect(base.id).toBe("base123");
      expect(base.title).toBe("My Base");
    });

    it("should accept minimal Base objects", () => {
      const base: Base = {
        id: "base123",
        title: "My Base",
      };
      expect(base.id).toBe("base123");
    });
  });

  describe("Table", () => {
    it("should accept valid Table objects", () => {
      const table: Table = {
        id: "table123",
        base_id: "base123",
        title: "Users",
        table_name: "users",
        type: "table",
        enabled: true,
        order: 1,
      };
      expect(table.id).toBe("table123");
      expect(table.base_id).toBe("base123");
    });
  });

  describe("ViewType", () => {
    it("should accept valid view types", () => {
      const gridView: ViewType = "grid";
      const formView: ViewType = "form";
      const galleryView: ViewType = "gallery";
      const kanbanView: ViewType = "kanban";
      const calendarView: ViewType = "calendar";

      expect(gridView).toBe("grid");
      expect(formView).toBe("form");
      expect(galleryView).toBe("gallery");
      expect(kanbanView).toBe("kanban");
      expect(calendarView).toBe("calendar");
    });
  });

  describe("View", () => {
    it("should accept valid View objects", () => {
      const view: View = {
        id: "view123",
        title: "Grid View",
        type: "grid",
        fk_model_id: "table123",
        show: true,
        order: 1,
      };
      expect(view.id).toBe("view123");
      expect(view.type).toBe("grid");
    });
  });

  describe("ColumnType", () => {
    it("should accept text column types", () => {
      const singleLine: ColumnType = "SingleLineText";
      const longText: ColumnType = "LongText";
      expect(singleLine).toBe("SingleLineText");
      expect(longText).toBe("LongText");
    });

    it("should accept numeric column types", () => {
      const number: ColumnType = "Number";
      const decimal: ColumnType = "Decimal";
      const currency: ColumnType = "Currency";
      const percent: ColumnType = "Percent";
      expect(number).toBe("Number");
      expect(decimal).toBe("Decimal");
    });

    it("should accept date/time column types", () => {
      const date: ColumnType = "Date";
      const dateTime: ColumnType = "DateTime";
      const time: ColumnType = "Time";
      const year: ColumnType = "Year";
      expect(date).toBe("Date");
      expect(dateTime).toBe("DateTime");
    });

    it("should accept special column types", () => {
      const link: ColumnType = "LinkToAnotherRecord";
      const lookup: ColumnType = "Lookup";
      const rollup: ColumnType = "Rollup";
      const formula: ColumnType = "Formula";
      const attachment: ColumnType = "Attachment";
      expect(link).toBe("LinkToAnotherRecord");
      expect(formula).toBe("Formula");
    });
  });

  describe("Column", () => {
    it("should accept valid Column objects", () => {
      const column: Column = {
        id: "col123",
        title: "Name",
        column_name: "name",
        uidt: "SingleLineText",
        pk: false,
        pv: true,
        rqd: true,
        system: false,
        fk_model_id: "table123",
      };
      expect(column.id).toBe("col123");
      expect(column.uidt).toBe("SingleLineText");
    });
  });

  describe("ComparisonOperator", () => {
    it("should accept equality operators", () => {
      const eq: ComparisonOperator = "eq";
      const neq: ComparisonOperator = "neq";
      expect(eq).toBe("eq");
      expect(neq).toBe("neq");
    });

    it("should accept comparison operators", () => {
      const gt: ComparisonOperator = "gt";
      const lt: ComparisonOperator = "lt";
      const gte: ComparisonOperator = "gte";
      const lte: ComparisonOperator = "lte";
      expect(gt).toBe("gt");
      expect(lte).toBe("lte");
    });

    it("should accept pattern matching operators", () => {
      const like: ComparisonOperator = "like";
      const nlike: ComparisonOperator = "nlike";
      expect(like).toBe("like");
      expect(nlike).toBe("nlike");
    });

    it("should accept null/empty operators", () => {
      const empty: ComparisonOperator = "empty";
      const notempty: ComparisonOperator = "notempty";
      const nullOp: ComparisonOperator = "null";
      const notnull: ComparisonOperator = "notnull";
      expect(empty).toBe("empty");
      expect(nullOp).toBe("null");
    });

    it("should accept set operators", () => {
      const allof: ComparisonOperator = "allof";
      const anyof: ComparisonOperator = "anyof";
      const nallof: ComparisonOperator = "nallof";
      const nanyof: ComparisonOperator = "nanyof";
      expect(allof).toBe("allof");
      expect(anyof).toBe("anyof");
    });
  });

  describe("Filter", () => {
    it("should accept valid Filter objects", () => {
      const filter: Filter = {
        id: "filter123",
        fk_view_id: "view123",
        fk_column_id: "col123",
        logical_op: "and",
        comparison_op: "eq",
        value: "test",
      };
      expect(filter.id).toBe("filter123");
      expect(filter.comparison_op).toBe("eq");
    });

    it("should accept filter groups", () => {
      const filterGroup: Filter = {
        id: "filter123",
        fk_view_id: "view123",
        logical_op: "or",
        is_group: true,
      };
      expect(filterGroup.is_group).toBe(true);
      expect(filterGroup.logical_op).toBe("or");
    });

    it("should accept various value types", () => {
      const stringFilter: Filter = {
        id: "f1",
        fk_view_id: "v1",
        value: "text",
      };
      const numberFilter: Filter = {
        id: "f2",
        fk_view_id: "v1",
        value: 42,
      };
      const boolFilter: Filter = {
        id: "f3",
        fk_view_id: "v1",
        value: true,
      };
      const nullFilter: Filter = {
        id: "f4",
        fk_view_id: "v1",
        value: null,
      };

      expect(stringFilter.value).toBe("text");
      expect(numberFilter.value).toBe(42);
      expect(boolFilter.value).toBe(true);
      expect(nullFilter.value).toBe(null);
    });
  });

  describe("Sort", () => {
    it("should accept valid Sort objects", () => {
      const sort: Sort = {
        id: "sort123",
        fk_view_id: "view123",
        fk_column_id: "col123",
        direction: "asc",
        order: 1,
      };
      expect(sort.id).toBe("sort123");
      expect(sort.direction).toBe("asc");
    });

    it("should accept both sort directions", () => {
      const ascSort: Sort = {
        id: "s1",
        fk_view_id: "v1",
        fk_column_id: "c1",
        direction: "asc",
      };
      const descSort: Sort = {
        id: "s2",
        fk_view_id: "v1",
        fk_column_id: "c1",
        direction: "desc",
      };

      expect(ascSort.direction).toBe("asc");
      expect(descSort.direction).toBe("desc");
    });
  });

  describe("Row", () => {
    it("should accept valid Row objects with Id", () => {
      const row: Row = {
        Id: "row123",
        name: "John Doe",
        email: "john@example.com",
        age: 30,
      };
      expect(row.Id).toBe("row123");
      expect(row.name).toBe("John Doe");
    });

    it("should accept Row objects with numeric Id", () => {
      const row: Row = {
        Id: 123,
        name: "Jane Doe",
      };
      expect(row.Id).toBe(123);
    });

    it("should accept Row objects without Id", () => {
      const row: Row = {
        name: "New User",
        email: "new@example.com",
      };
      expect(row.name).toBe("New User");
      expect(row.Id).toBeUndefined();
    });

    it("should accept arbitrary fields", () => {
      const row: Row = {
        Id: 1,
        customField: "value",
        nestedObject: { key: "value" },
        arrayField: [1, 2, 3],
      };
      expect(row.customField).toBe("value");
      expect(row.nestedObject).toEqual({ key: "value" });
      expect(row.arrayField).toEqual([1, 2, 3]);
    });
  });
});

describe("Response Types", () => {
  describe("PageInfo", () => {
    it("should accept valid PageInfo objects", () => {
      const pageInfo: PageInfo = {
        totalRows: 100,
        page: 1,
        pageSize: 25,
        isFirstPage: true,
        isLastPage: false,
      };
      expect(pageInfo.totalRows).toBe(100);
      expect(pageInfo.page).toBe(1);
      expect(pageInfo.pageSize).toBe(25);
      expect(pageInfo.isFirstPage).toBe(true);
      expect(pageInfo.isLastPage).toBe(false);
    });

    it("should accept minimal PageInfo objects", () => {
      const pageInfo: PageInfo = {};
      expect(pageInfo.totalRows).toBeUndefined();
    });

    it("should accept partial PageInfo objects", () => {
      const pageInfo: PageInfo = {
        totalRows: 50,
        page: 2,
      };
      expect(pageInfo.totalRows).toBe(50);
      expect(pageInfo.page).toBe(2);
      expect(pageInfo.pageSize).toBeUndefined();
    });
  });

  describe("ListResponse", () => {
    it("should accept ListResponse with Base items", () => {
      const response: ListResponse<Base> = {
        list: [
          { id: "base1", title: "Base 1" },
          { id: "base2", title: "Base 2" },
        ],
        pageInfo: {
          totalRows: 2,
          page: 1,
          pageSize: 25,
          isFirstPage: true,
          isLastPage: true,
        },
      };
      expect(response.list).toHaveLength(2);
      expect(response.list[0].id).toBe("base1");
      expect(response.pageInfo.totalRows).toBe(2);
    });

    it("should accept ListResponse with Table items", () => {
      const response: ListResponse<Table> = {
        list: [
          {
            id: "table1",
            base_id: "base1",
            title: "Users",
            table_name: "users",
          },
        ],
        pageInfo: {
          totalRows: 1,
        },
      };
      expect(response.list).toHaveLength(1);
      expect(response.list[0].title).toBe("Users");
    });

    it("should accept ListResponse with Row items", () => {
      const response: ListResponse<Row> = {
        list: [
          { Id: 1, name: "Alice", email: "alice@example.com" },
          { Id: 2, name: "Bob", email: "bob@example.com" },
        ],
        pageInfo: {
          totalRows: 2,
          page: 1,
          pageSize: 25,
        },
      };
      expect(response.list).toHaveLength(2);
      expect(response.list[0].name).toBe("Alice");
      expect(response.pageInfo.totalRows).toBe(2);
    });

    it("should accept empty ListResponse", () => {
      const response: ListResponse<Row> = {
        list: [],
        pageInfo: {
          totalRows: 0,
          isFirstPage: true,
          isLastPage: true,
        },
      };
      expect(response.list).toHaveLength(0);
      expect(response.pageInfo.totalRows).toBe(0);
    });
  });

  describe("BulkCreateResponse", () => {
    it("should accept BulkCreateResponse with data", () => {
      const response: BulkCreateResponse = {
        created: 3,
        data: [
          { Id: 1, name: "Row 1" },
          { Id: 2, name: "Row 2" },
          { Id: 3, name: "Row 3" },
        ],
      };
      expect(response.created).toBe(3);
      expect(response.data).toHaveLength(3);
      expect(response.data?.[0].name).toBe("Row 1");
    });

    it("should accept BulkCreateResponse without data", () => {
      const response: BulkCreateResponse = {
        created: 5,
      };
      expect(response.created).toBe(5);
      expect(response.data).toBeUndefined();
    });

    it("should accept BulkCreateResponse with zero created", () => {
      const response: BulkCreateResponse = {
        created: 0,
        data: [],
      };
      expect(response.created).toBe(0);
      expect(response.data).toHaveLength(0);
    });
  });

  describe("BulkUpdateResponse", () => {
    it("should accept BulkUpdateResponse with data", () => {
      const response: BulkUpdateResponse = {
        updated: 2,
        data: [
          { Id: 1, name: "Updated Row 1" },
          { Id: 2, name: "Updated Row 2" },
        ],
      };
      expect(response.updated).toBe(2);
      expect(response.data).toHaveLength(2);
      expect(response.data?.[0].name).toBe("Updated Row 1");
    });

    it("should accept BulkUpdateResponse without data", () => {
      const response: BulkUpdateResponse = {
        updated: 10,
      };
      expect(response.updated).toBe(10);
      expect(response.data).toBeUndefined();
    });

    it("should accept BulkUpdateResponse with zero updated", () => {
      const response: BulkUpdateResponse = {
        updated: 0,
      };
      expect(response.updated).toBe(0);
    });
  });

  describe("BulkDeleteResponse", () => {
    it("should accept BulkDeleteResponse", () => {
      const response: BulkDeleteResponse = {
        deleted: 5,
      };
      expect(response.deleted).toBe(5);
    });

    it("should accept BulkDeleteResponse with zero deleted", () => {
      const response: BulkDeleteResponse = {
        deleted: 0,
      };
      expect(response.deleted).toBe(0);
    });
  });

  describe("ErrorResponse", () => {
    it("should accept ErrorResponse with msg field", () => {
      const error: ErrorResponse = {
        msg: "Something went wrong",
      };
      expect(error.msg).toBe("Something went wrong");
    });

    it("should accept ErrorResponse with message field", () => {
      const error: ErrorResponse = {
        message: "Invalid request",
      };
      expect(error.message).toBe("Invalid request");
    });

    it("should accept ErrorResponse with error field", () => {
      const error: ErrorResponse = {
        error: "Not found",
      };
      expect(error.error).toBe("Not found");
    });

    it("should accept ErrorResponse with multiple fields", () => {
      const error: ErrorResponse = {
        msg: "Error occurred",
        message: "Detailed message",
        error: "Error code",
      };
      expect(error.msg).toBe("Error occurred");
      expect(error.message).toBe("Detailed message");
      expect(error.error).toBe("Error code");
    });

    it("should accept empty ErrorResponse", () => {
      const error: ErrorResponse = {};
      expect(error.msg).toBeUndefined();
      expect(error.message).toBeUndefined();
      expect(error.error).toBeUndefined();
    });
  });
});
