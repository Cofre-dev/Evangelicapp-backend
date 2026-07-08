import { SuperAdminService } from './super-admin.service';
export declare class SuperAdminController {
    private readonly superAdminService;
    constructor(superAdminService: SuperAdminService);
    getDashboard(): Promise<import("./super-admin.service").DashboardResponse>;
}
