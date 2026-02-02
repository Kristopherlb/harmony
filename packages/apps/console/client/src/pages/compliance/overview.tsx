import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TenantComplianceConfig } from '@golden/schema-registry';

// Mock config for demonstration
const mockConfig: TenantComplianceConfig = {
    enabled: true,
    profileId: 'fedramp-moderate',
    defaultEnforcement: 'ADVISORY',
    familyOverrides: [
        { family: 'AC', enforcement: 'BLOCKING' }
    ],
    controlOverrides: [],
    ssp: {
        autoGenerate: true,
        approvalRequiredFamilies: ['AC', 'IA'],
        stalenessCheckIntervalMinutes: 60
    }
};

export default function ComplianceOverview() {
    const [config] = useState<TenantComplianceConfig>(mockConfig);

    return (
        <div className="container mx-auto p-6 space-y-6">
            <h1 className="text-3xl font-bold">Compliance Dashboard</h1>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Profile Status</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between">
                            <span>Profile ID:</span>
                            <Badge variant="outline">{config.profileId}</Badge>
                        </div>
                        <div className="flex items-center justify-between mt-2">
                            <span>Enforcement:</span>
                            <Badge variant={config.defaultEnforcement === 'BLOCKING' ? 'destructive' : 'default'}>
                                {config.defaultEnforcement}
                            </Badge>
                        </div>
                        <div className="flex items-center justify-between mt-2">
                            <span>SSP Auto-Gen:</span>
                            <Badge variant={config.ssp.autoGenerate ? 'secondary' : 'outline'}>
                                {config.ssp.autoGenerate ? 'Enabled' : 'Disabled'}
                            </Badge>
                        </div>
                    </CardContent>
                </Card>

                {/* Placeholder for stats */}
                <Card>
                    <CardHeader><CardTitle>Controls</CardTitle></CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">128</div>
                        <div className="text-sm text-muted-foreground">Total Controls in Profile</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader><CardTitle>Stale Sections</CardTitle></CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-orange-500">3</div>
                        <div className="text-sm text-muted-foreground">Require Review</div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader><CardTitle>Enforcement Overrides</CardTitle></CardHeader>
                <CardContent>
                    {config.familyOverrides.length > 0 ? (
                        <ul className="space-y-2">
                            {config.familyOverrides.map(fam => (
                                <li key={fam.family} className="flex items-center gap-2">
                                    <span className="font-mono bg-muted px-2 py-1 rounded">{fam.family}</span>
                                    <span>Family Override:</span>
                                    <Badge>{fam.enforcement}</Badge>
                                </li>
                            ))}
                        </ul>
                    ) : <div className="text-muted-foreground">No overrides configured.</div>}
                </CardContent>
            </Card>
        </div>
    );
}
