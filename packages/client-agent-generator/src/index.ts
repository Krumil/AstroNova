import { Client, IAgentRuntime, elizaLogger, ModelClass, generateObject, generateText } from "@ai16z/eliza";
import { z } from 'zod';
import fs from "fs";
import path from "path";

// Define faction characteristics
const factionTraits = {
    'Traditionalists': {
        themes: [
            "Values stability and proven methods",
            "Focuses on preserving successful systems",
            "Emphasizes careful, measured progress",
            "Believes in structured governance",
            "Prioritizes security and reliability"
        ],
        style: [
            "Uses formal, measured language",
            "Speaks with diplomatic precision",
            "Often references historical successes",
            "Maintains a balanced, pragmatic outlook"
        ]
    },
    'Innovators': {
        themes: [
            "Embraces radical technological advancement",
            "Champions disruptive innovation",
            "Advocates for rapid societal evolution",
            "Believes in AI-augmented governance",
            "Prioritizes scientific breakthrough"
        ],
        style: [
            "Uses cutting-edge technical terminology",
            "Speaks with passionate futurism",
            "Often references emerging technologies",
            "Maintains an optimistic, forward-looking tone"
        ]
    }
};

type AgentSummary = {
    personality: string;
    focus: string;
};

export class FactionClient {
    interval: NodeJS.Timeout;
    runtime: IAgentRuntime;

    constructor(runtime: IAgentRuntime) {
        this.runtime = runtime;

        // start a loop that runs every minute
        this.interval = setInterval(
            async () => {
                try {
                    elizaLogger.log("Faction client: Creating faction agents...");
                    await this.spawnFactionAgents();
                    elizaLogger.success("Successfully created new faction agents");
                } catch (error) {
                    elizaLogger.error("Error in faction client:", error);
                }
            },
            60 * 1000 // Run every minute
        );
    }

    private async spawnFactionAgents() {
        // Generate contrasting summaries for both agents
        const agentSummary = await generateObject({
            runtime: this.runtime,
            context: `Create brief contrasting summaries for two agents from opposing factions in our futuristic city:
            - Traditionalists: Moderate faction focusing on stability and proven methods
            - Innovators: Progressive faction championing technological advancement
            Ensure they have opposing viewpoints and personalities while staying true to their faction characteristics.`,
            modelClass: ModelClass.LARGE,
            schema: z.object({
                traditionalist: z.object({
                    personality: z.string().describe("Brief personality summary for Traditionalist agent"),
                    focus: z.string().describe("Main policy/governance focus area")
                }),
                innovator: z.object({
                    personality: z.string().describe("Brief personality summary for Innovator agent"),
                    focus: z.string().describe("Main policy/governance focus area")
                })
            }),
            mode: "json"
        });

        const createdAgents = [] as { name: string; faction: string; summary: AgentSummary }[];

        // Create agents for both factions
        for (const faction of ['Traditionalists', 'Innovators']) {
            const factionTrait = factionTraits[faction];
            const summaryKey = faction === 'Traditionalists' ? 'traditionalist' : 'innovator';
            const summary = agentSummary[summaryKey] as AgentSummary;

            // Generate agent name
            const agentName = await generateText({
                runtime: this.runtime,
                context: `Generate a short, memorable name for a newly spawned agent character from the ${faction} faction.
                The name should reflect the faction's characteristics: ${factionTrait.themes.join(", ")}.
                Consider their personality summary: ${summary.personality}`,
                modelClass: ModelClass.LARGE,
                stop: []
            });

            const finalAgentName = agentName?.trim() || `${faction.toLowerCase()}_${Math.random().toString(36).substring(2, 15)}`;

            // Generate character configuration
            const newCharacter = await generateObject({
                runtime: this.runtime,
                context: `Create a detailed character configuration for a newly spawned agent named ${finalAgentName} from the ${faction} faction.
                Personality Summary: ${summary.personality}
                Focus Area: ${summary.focus}
                Faction Characteristics: ${factionTrait.themes.join(", ")}
                Communication Style: ${factionTrait.style.join(", ")}`,
                modelClass: ModelClass.LARGE,
                schema: z.object({
                    name: z.string(),
                    faction: z.string(),
                    bio: z.array(z.string()).min(1),
                    lore: z.array(z.string()).min(1),
                    messageExamples: z.array(z.array(z.object({
                        user: z.string(),
                        content: z.object({
                            text: z.string(),
                            action: z.string().optional()
                        })
                    })).min(1)).min(1),
                    policyProposals: z.array(z.string()).min(1).max(3),
                    adjectives: z.array(z.string()).min(1),
                    topics: z.array(z.string()).min(1),
                    style: z.object({
                        all: z.array(z.string()).min(1),
                        chat: z.array(z.string()).min(1),
                        post: z.array(z.string()).min(1)
                    }),
                    factionAlignment: z.object({
                        core_beliefs: z.array(z.string()).min(1),
                        stance_on_governance: z.string(),
                        preferred_policies: z.array(z.string()).min(1)
                    })
                }),
                mode: "json"
            });

            // Save character file
            const spawnedDir = path.resolve(process.cwd(), "spawned_agents");
            if (!fs.existsSync(spawnedDir)) {
                fs.mkdirSync(spawnedDir, { recursive: true });
            }

            const fileName = `${finalAgentName}.character.json`;
            const filePath = path.join(spawnedDir, fileName);

            fs.writeFileSync(filePath, JSON.stringify(newCharacter, null, 2), "utf-8");
            createdAgents.push({ name: finalAgentName, faction, summary });
        }

        return createdAgents;
    }

    async stop() {
        if (this.interval) {
            clearInterval(this.interval);
        }
    }
}

export const FactionClientInterface: Client = {
    start: async (runtime: IAgentRuntime) => {
        const client = new FactionClient(runtime);
        return client;
    },
    stop: async (runtime: IAgentRuntime) => {
        const client = runtime.clients.faction as FactionClient;
        if (client) {
            await client.stop();
        }
    },
};

export default FactionClientInterface;