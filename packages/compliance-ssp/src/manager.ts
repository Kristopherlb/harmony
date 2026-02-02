import { SSPControlSection } from '@golden/schema-registry';

// Mock storage for now
const mockStorage = new Map<string, SSPControlSection[]>(); // profileId -> sections

export class SSPManager {
    /**
     * Retrieves the current SSP for a given profile.
     */
    static async getSSP(profileId: string): Promise<SSPControlSection[]> {
        return mockStorage.get(profileId) || [];
    }

    /**
     * Saves or updates the SSP for a given profile.
     */
    static async saveSSP(profileId: string, sections: SSPControlSection[]): Promise<void> {
        mockStorage.set(profileId, sections);
    }

    /**
     * Updates a specific section with a human override.
     */
    static async saveSectionOverride(
        profileId: string,
        controlId: string,
        overrideNarrative: string,
        editor: string
    ): Promise<void> {
        const currentSSP = await this.getSSP(profileId);
        const sectionIndex = currentSSP.findIndex(s => s.controlId === controlId);

        if (sectionIndex === -1) {
            throw new Error(`Control ${controlId} not found in SSP for profile ${profileId}`);
        }

        const section = currentSSP[sectionIndex];
        if (!section.source.humanOverride) {
            section.source.humanOverride = {
                narrative: overrideNarrative,
                editedBy: editor,
                editedAt: new Date().toISOString()
            };
        } else {
            section.source.humanOverride.narrative = overrideNarrative;
            section.source.humanOverride.editedBy = editor;
            section.source.humanOverride.editedAt = new Date().toISOString();
        }

        // In a real DB, we would do a partial update here
        mockStorage.set(profileId, currentSSP);
    }
}
