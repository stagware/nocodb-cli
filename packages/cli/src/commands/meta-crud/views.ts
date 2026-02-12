/**
 * Views command handlers for view management operations.
 * 
 * @module commands/meta-crud/views
 */

import { Command } from "commander";
import type { Container } from "../../container.js";
import type { MetaService } from "../../services/meta-service.js";
import type { ConfigManager } from "../../config/manager.js";
import type { ViewType } from "@stagware/nocodb-sdk";
import { parseJsonInput } from "../../utils/parsing.js";
import { addOutputOptions, addJsonInputOptions } from "../helpers.js";
import {
  printResult, handleError, resolveServices,
  type OutputOptions, type JsonInputOptions,
} from "../../utils/command-utils.js";

const VALID_VIEW_TYPES = ['grid', 'form', 'gallery', 'kanban', 'calendar'] as const;
type ValidViewType = typeof VALID_VIEW_TYPES[number];

const VALID_API_VERSIONS = ['v2', 'v3'] as const;
type ValidApiVersion = typeof VALID_API_VERSIONS[number];

export function registerViewsCommands(program: Command, container: Container): void {
  const viewsCmd = program.command("views").description("Manage views")
    .addHelpText("after", `
Examples:
  $ nocodb views list tbl_xyz
  $ nocodb views get vw_abc
  $ nocodb views create tbl_xyz -d '{"title":"My Grid"}' --type grid
  $ nocodb views update vw_abc -d '{"title":"Renamed"}'
  $ nocodb views delete vw_abc
  $ nocodb views config get vw_abc --view-type form
  $ nocodb views config update vw_abc --view-type form -d '{"heading":"My Form"}'
  $ nocodb views columns list vw_abc
`);

  // List views command
  addOutputOptions(viewsCmd.command("list").argument("tableId", "Table id")).action(
    async (tableId: string, options: OutputOptions) => {
      try {
        const { client } = resolveServices(container);
        const metaService = container.get<Function>("metaService")(client) as MetaService;

        const result = await metaService.listViews(tableId);
        printResult(result, options);
      } catch (err) {
        handleError(err);
      }
    }
  );

  // Get view command
  addOutputOptions(viewsCmd.command("get").argument("tableId", "Table id").argument("viewId", "View id")).action(
    async (tableId: string, viewId: string, options: OutputOptions) => {
      try {
        const { client } = resolveServices(container);
        const metaService = container.get<Function>("metaService")(client) as MetaService;

        const result = await metaService.getView(tableId, viewId);
        printResult(result, options);
      } catch (err) {
        handleError(err);
      }
    }
  );

  // Create view command — dispatches to v2 type-specific endpoints
  addOutputOptions(addJsonInputOptions(
    viewsCmd.command("create").argument("tableId", "Table id")
      .option("--type <type>", "View type: grid, form, gallery, kanban, calendar (default: grid)")
      .option("--base-id <baseId>", "Base ID (required for v3)")
      .option("--api-version <version>", "API Version (v2 or v3)", "v2")
  )).action(
    async (tableId: string, options: JsonInputOptions & OutputOptions & { type?: string; baseId?: string; apiVersion: string }) => {
      try {
        const { client } = resolveServices(container);
        const metaService = container.get<Function>("metaService")(client) as MetaService;
        const configManager = container.get<ConfigManager>("configManager");

        const body = await parseJsonInput(options.data, options.dataFile);

        // Validate API Version
        if (!VALID_API_VERSIONS.includes(options.apiVersion as any)) {
          throw new Error(`Unsupported API version '${options.apiVersion}'. Supported versions: ${VALID_API_VERSIONS.join(', ')}`);
        }

        // Validate and normalize view type
        const rawType = options.type || 'grid';
        if (!VALID_VIEW_TYPES.includes(rawType as any)) {
          throw new Error(`Unsupported view type '${rawType}'. Supported types: ${VALID_VIEW_TYPES.join(', ')}`);
        }
        const viewType = rawType as ValidViewType;
        const isV3 = options.apiVersion === 'v3' || viewType === 'calendar';

        let result;

        if (isV3) {
          // Resolve Base ID: Flag > Config > Env (Env is already in Config)
          const effectiveConfig = configManager.getEffectiveConfig();
          const baseId = options.baseId || effectiveConfig.workspace?.baseId;

          if (!baseId) {
            throw new Error("Base ID is required for v3 view creation. Provide it via --base-id, config, or environment variable.");
          }

          // v3 Unified Creation
          result = await metaService.createViewV3(baseId, tableId, {
            ...body as any,
            type: viewType,
            title: (body as any).title || `${viewType} view`
          });

        } else {
          // v2 Legacy Creation
          switch (viewType) {
            case 'form':
              result = await metaService.createFormView(tableId, body as any);
              break;
            case 'gallery':
              result = await metaService.createGalleryView(tableId, body as any);
              break;
            case 'kanban':
              result = await metaService.createKanbanView(tableId, body as any);
              break;
            case 'grid':
              result = await metaService.createGridView(tableId, body as any);
              break;
            default:
              throw new Error(`Unsupported view type '${viewType}'. Use: grid, form, gallery, kanban`);
          }
        }
        printResult(result, options);
      } catch (err) {
        handleError(err);
      }
    }
  );

  // Update view command
  addOutputOptions(addJsonInputOptions(viewsCmd.command("update").argument("viewId", "View id"))).action(
    async (viewId: string, options: JsonInputOptions & OutputOptions) => {
      try {
        const { client } = resolveServices(container);
        const metaService = container.get<Function>("metaService")(client) as MetaService;

        const body = await parseJsonInput(options.data, options.dataFile);
        const result = await metaService.updateView(viewId, body as any);
        printResult(result, options);
      } catch (err) {
        handleError(err);
      }
    }
  );

  // Delete view command
  addOutputOptions(viewsCmd.command("delete").argument("viewId", "View id")).action(
    async (viewId: string, options: OutputOptions) => {
      try {
        const { client } = resolveServices(container);
        const metaService = container.get<Function>("metaService")(client) as MetaService;

        const result = await metaService.deleteView(viewId);
        printResult(result, options);
      } catch (err) {
        handleError(err);
      }
    }
  );

  // ── View Config subcommands ─────────────────────────────────────

  const configCmd = viewsCmd.command("config").description("Manage view-type-specific configuration");

  // Get view config
  addOutputOptions(
    configCmd
      .command("get")
      .argument("viewId", "View id")
      .requiredOption("--view-type <type>", "View type: form, gallery, kanban")
  ).action(
    async (viewId: string, options: OutputOptions & { viewType: string }) => {
      try {
        const { client } = resolveServices(container);
        const metaService = container.get<Function>("metaService")(client) as MetaService;

        let result;
        switch (options.viewType) {
          case 'form':
            result = await metaService.getFormView(viewId);
            break;
          case 'gallery':
            result = await metaService.getGalleryView(viewId);
            break;
          case 'kanban':
            result = await metaService.getKanbanView(viewId);
            break;
          default:
            throw new Error(`Unsupported view type '${options.viewType}' for config get. Use: form, gallery, kanban (grid has no read endpoint; use 'config update' to set grid properties)`);
        }
        printResult(result, options);
      } catch (err) {
        handleError(err);
      }
    }
  );

  // Update view config
  addOutputOptions(
    addJsonInputOptions(
      configCmd
        .command("update")
        .argument("viewId", "View id")
        .requiredOption("--view-type <type>", "View type: grid, form, gallery, kanban")
    )
  ).action(
    async (viewId: string, options: JsonInputOptions & OutputOptions & { viewType: string }) => {
      try {
        const { client } = resolveServices(container);
        const metaService = container.get<Function>("metaService")(client) as MetaService;

        const body = await parseJsonInput(options.data, options.dataFile);
        let result;
        switch (options.viewType) {
          case 'grid':
            result = await metaService.updateGridView(viewId, body as any);
            break;
          case 'form':
            result = await metaService.updateFormView(viewId, body as any);
            break;
          case 'gallery':
            result = await metaService.updateGalleryView(viewId, body as any);
            break;
          case 'kanban':
            result = await metaService.updateKanbanView(viewId, body as any);
            break;
          default:
            throw new Error(`Unsupported view type '${options.viewType}'. Use: grid, form, gallery, kanban`);
        }
        printResult(result, options);
      } catch (err) {
        handleError(err);
      }
    }
  );

  // ── View Columns subcommand ─────────────────────────────────────

  const columnsCmd = viewsCmd.command("columns").description("Manage view column settings");

  // List view columns
  addOutputOptions(
    columnsCmd
      .command("list")
      .argument("viewId", "View id")
  ).action(
    async (viewId: string, options: OutputOptions) => {
      try {
        const { client } = resolveServices(container);
        const metaService = container.get<Function>("metaService")(client) as MetaService;

        const result = await metaService.listViewColumns(viewId);
        printResult(result, options);
      } catch (err) {
        handleError(err);
      }
    }
  );
}
