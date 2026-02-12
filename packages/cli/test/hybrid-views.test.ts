import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Command } from 'commander';
import { registerViewsCommands } from '../src/commands/meta-crud/views';

describe('Views Command (Hybrid Strategy)', () => {
    let program: Command;
    let mockMetaService: any;
    let mockConfigManager: any;
    let mockContainer: any;

    beforeEach(() => {
        program = new Command();
        program.exitOverride(); // Prevent process.exit

        // Suppress console output during tests
        // vi.spyOn(console, 'log').mockImplementation(() => { });
        // vi.spyOn(console, 'error').mockImplementation(() => { });

        mockMetaService = {
            createGridView: vi.fn().mockResolvedValue({ id: 'v1', title: 'Grid' }),
            createFormView: vi.fn().mockResolvedValue({ id: 'v1', title: 'Form' }),
            createGalleryView: vi.fn().mockResolvedValue({ id: 'v1', title: 'Gallery' }),
            createKanbanView: vi.fn().mockResolvedValue({ id: 'v1', title: 'Kanban' }),
            createViewV3: vi.fn().mockResolvedValue({ id: 'v1', title: 'V3 View' }),
        };

        mockConfigManager = {
            getEffectiveConfig: vi.fn().mockReturnValue({ workspace: { baseId: 'env-base-id' } }),
        };

        mockContainer = {
            get: vi.fn((key: string) => {
                if (key === 'metaService') return () => mockMetaService;
                if (key === 'configManager') return mockConfigManager;
                if (key === 'createClient') return () => ({});
                return null;
            }),
        };

        registerViewsCommands(program, mockContainer as any);
    });

    it('should call v2 createGridView by default', async () => {
        await program.parseAsync(['node', 'test', 'views', 'create', 'tbl_1', '-d', '{}']);
        expect(mockMetaService.createGridView).toHaveBeenCalledWith('tbl_1', expect.anything());
        expect(mockMetaService.createViewV3).not.toHaveBeenCalled();
    });

    it('should call v2 createFormView when type is form', async () => {
        await program.parseAsync(['node', 'test', 'views', 'create', 'tbl_1', '--type', 'form', '-d', '{}']);
        expect(mockMetaService.createFormView).toHaveBeenCalled();
        expect(mockMetaService.createViewV3).not.toHaveBeenCalled();
    });

    it('should call v3 createViewV3 when type is calendar', async () => {
        // calendar type triggers v3 logic
        await program.parseAsync(['node', 'test', 'views', 'create', 'tbl_1', '--type', 'calendar', '-d', '{}']);
        expect(mockMetaService.createViewV3).toHaveBeenCalledWith(
            'env-base-id', // from config
            'tbl_1',
            expect.objectContaining({ type: 'calendar' })
        );
    });

    it('should call v3 createViewV3 when --api-version v3 is passed', async () => {
        await program.parseAsync(['node', 'test', 'views', 'create', 'tbl_1', '--api-version', 'v3', '-d', '{}']);
        // default type is grid
        expect(mockMetaService.createViewV3).toHaveBeenCalledWith(
            'env-base-id',
            'tbl_1',
            expect.objectContaining({ type: 'grid' })
        );
    });

    it('should use --base-id flag over config', async () => {
        await program.parseAsync(['node', 'test', 'views', 'create', 'tbl_1', '--type', 'calendar', '--base-id', 'flag-base-id', '-d', '{}']);
        expect(mockMetaService.createViewV3).toHaveBeenCalledWith(
            'flag-base-id',
            'tbl_1',
            expect.objectContaining({ type: 'calendar' })
        );
    });

    it('should log error for invalid view type', async () => {
        const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => { }) as any);
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

        await program.parseAsync(['node', 'test', 'views', 'create', 'tbl_1', '--type', 'invalid_type', '-d', '{}']);

        expect(consoleSpy).toHaveBeenCalledWith(expect.stringMatching(/Unsupported view type 'invalid_type'/));
        expect(exitSpy).toHaveBeenCalledWith(1);

        exitSpy.mockRestore();
        consoleSpy.mockRestore();
    });

    it('should log error for invalid api version', async () => {
        const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => { }) as any);
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

        await program.parseAsync(['node', 'test', 'views', 'create', 'tbl_1', '--api-version', 'v99', '-d', '{}']);

        expect(consoleSpy).toHaveBeenCalledWith(expect.stringMatching(/Unsupported API version 'v99'/));
        expect(exitSpy).toHaveBeenCalledWith(1);

        exitSpy.mockRestore();
        consoleSpy.mockRestore();
    });
});
