import { registerBasesCommands } from "./meta-crud/bases.js";
import { registerTablesCommands } from "./meta-crud/tables.js";
import { registerViewsCommands } from "./meta-crud/views.js";
import { registerFiltersCommands } from "./meta-crud/filters.js";
import { registerSortsCommands } from "./meta-crud/sorts.js";
import { registerColumnsCommands } from "./meta-crud/columns.js";
import type { Command } from "commander";
import type { Container } from "../container.js";

/**
 * Registers all meta CRUD commands with the CLI program
 * @param program - Commander program instance
 * @param container - Dependency injection container
 */
export function registerMetaCrudCommands(program: Command, container: Container): void {
  registerBasesCommands(program, container);
  registerTablesCommands(program, container);
  registerViewsCommands(program, container);
  registerFiltersCommands(program, container);
  registerSortsCommands(program, container);
  registerColumnsCommands(program, container);
}
