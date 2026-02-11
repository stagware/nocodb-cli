import type { NocoClient } from '../index.js';
import { BaseV3, ViewV3, WorkspaceV3 } from './types.js';

export class MetaApiV3 {
    constructor(private client: NocoClient) { }

    async listWorkspaces(): Promise<{ list: WorkspaceV3[] }> {
        return this.client.request('GET', '/api/v3/meta/workspaces');
    }

    async listBases(workspaceId: string): Promise<{ list: BaseV3[] }> {
        return this.client.request('GET', `/api/v3/meta/workspaces/${workspaceId}/bases`);
    }

    async createView(
        baseId: string,
        tableId: string,
        view: Partial<ViewV3> & { type: string; title: string }
    ): Promise<ViewV3> {
        return this.client.request('POST', `/api/v3/meta/bases/${baseId}/tables/${tableId}/views`, { body: view });
    }
}
