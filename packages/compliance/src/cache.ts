export interface OscalCatalog {
    uuid: string;
    metadata: any;
    groups?: any[];
    controls?: any[];
}

export interface ResolvedControlSet {
    profileId: string;
    controls: Set<string>;
}

export class ComplianceCatalogCache {
    private catalogs: Map<string, {
        data: OscalCatalog;
        loadedAt: number;
        ttl: number;
    }> = new Map();

    private resolvedProfiles: Map<string, {
        data: ResolvedControlSet;
        sourceHash: string; // Hash of catalog + profile (simplified for now)
        loadedAt: number;
        ttl: number;
    }> = new Map();

    private capabilityControlIndex: Map<string, {
        satisfies: string[];
        requires: string[];
        mappingVersion: number;
    }> = new Map();

    constructor(
        private readonly catalogTtl: number = 24 * 60 * 60 * 1000,
        private readonly profileTtl: number = 60 * 60 * 1000
    ) { }

    getCatalog(id: string): OscalCatalog | undefined {
        const entry = this.catalogs.get(id);
        if (!entry) return undefined;
        if (Date.now() - entry.loadedAt > entry.ttl) {
            this.catalogs.delete(id);
            return undefined;
        }
        return entry.data;
    }

    setCatalog(id: string, data: OscalCatalog) {
        this.catalogs.set(id, {
            data,
            loadedAt: Date.now(),
            ttl: this.catalogTtl
        });
        // Invalidate dependent profiles
        this.resolvedProfiles.clear();
    }

    getResolvedProfile(profileId: string): ResolvedControlSet | undefined {
        const entry = this.resolvedProfiles.get(profileId);
        if (!entry) return undefined;
        if (Date.now() - entry.loadedAt > entry.ttl) {
            this.resolvedProfiles.delete(profileId);
            return undefined;
        }
        return entry.data;
    }

    setResolvedProfile(profileId: string, data: ResolvedControlSet, sourceHash: string) {
        this.resolvedProfiles.set(profileId, {
            data,
            sourceHash,
            loadedAt: Date.now(),
            ttl: this.profileTtl
        });
    }

    updateCapabilityIndex(capId: string, satisfies: string[], requires: string[], mappingVersion: number) {
        this.capabilityControlIndex.set(capId, {
            satisfies,
            requires,
            mappingVersion
        });
    }
}
