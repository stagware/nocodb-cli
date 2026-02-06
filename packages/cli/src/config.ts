import Conf from "conf";

export type ConfigData = {
  baseUrl?: string;
  baseId?: string;
  headers?: Record<string, string>;
};

export function createConfig(cwd?: string): Conf<ConfigData> {
  const configCwd = cwd ?? process.env.NOCO_CONFIG_DIR;
  return new Conf<ConfigData>({ projectName: "nocodb", cwd: configCwd });
}

export function getHeaders(config: Conf<ConfigData>): Record<string, string> {
  return { ...(config.get("headers") ?? {}) };
}

export function setHeader(config: Conf<ConfigData>, name: string, value: string): void {
  const headers = getHeaders(config);
  headers[name] = value;
  config.set("headers", headers);
}

export function deleteHeader(config: Conf<ConfigData>, name: string): void {
  const headers = getHeaders(config);
  delete headers[name];
  config.set("headers", headers);
}
