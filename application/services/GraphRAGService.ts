import { RAGSearchResult } from "@/domain/repositories/RAGRepository";
import {
  TaskNode,
  EpicNode,
  GraphSearchResult,
} from "@/domain/repositories/GraphRAGRepository";
import { getRagRepository } from "@/infrastructure/repositories/PineconeRAGRepository";
import { graphRAGRepository } from "@/infrastructure/repositories/Neo4jGraphRAGRepository";

export interface EnrichedRAGResult extends RAGSearchResult {
  taskId?: string;
  graphContext?: GraphSearchResult;
  relatedTasks?: TaskNode[];
}

export interface GraphRAGSearchOptions {
  includeGraphContext?: boolean;
  includeRelatedTasks?: boolean;
  relationshipDepth?: number;
  topK?: number;
}

const DEFAULT_OPTIONS: GraphRAGSearchOptions = {
  includeGraphContext: true,
  includeRelatedTasks: true,
  relationshipDepth: 2,
  topK: 5,
};

/**
 * GraphRAG Service
 *
 * This service combines vector search (Pinecone) with graph relationships (Neo4j)
 * to provide enhanced context when searching for similar tasks.
 *
 * Flow:
 * 1. Search Pinecone for semantically similar tasks
 * 2. For each result, query Neo4j to get relationship information
 * 3. Return enriched results with both similarity scores and relationship context
 */
export class GraphRAGService {
  /**
   * Search for similar tasks and enrich with graph context
   */
  async search(
    query: string,
    storeName: string,
    projectId: string,
    options: GraphRAGSearchOptions = {},
  ): Promise<EnrichedRAGResult[]> {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    console.log("[GraphRAG Service] ========== SEARCH START ==========");
    console.log("[GraphRAG Service] Query:", query);
    console.log("[GraphRAG Service] Store:", storeName);
    console.log("[GraphRAG Service] Project:", projectId);
    console.log("[GraphRAG Service] Options:", opts);

    try {
      // Step 1: Vector search in Pinecone
      console.log("[GraphRAG Service] Step 1: Performing vector search...");
      const vectorResults = await getRagRepository().searchFiles(
        query,
        storeName,
      );

      if (vectorResults.length === 0) {
        console.log("[GraphRAG Service] No vector results found");
        console.log("[GraphRAG Service] ========== SEARCH END ==========");

        return [];
      }

      console.log(
        `[GraphRAG Service] Found ${vectorResults.length} vector results`,
      );

      // Step 2: Use document ID from Pinecone to query Neo4j for graph context
      const enrichedResults: EnrichedRAGResult[] = [];

      for (const result of vectorResults) {
        const enrichedResult: EnrichedRAGResult = {
          ...result,
        };

        // Use the document ID from Pinecone (format: task-{taskId})
        // This is the same ID used when storing in Neo4j
        const documentId = result.id;

        console.log(
          `[GraphRAG Service] Document ID from Pinecone: ${documentId}`,
        );

        if (documentId) {
          enrichedResult.taskId = documentId;

          // Step 3: Get graph context for each task
          if (opts.includeGraphContext) {
            console.log(
              `[GraphRAG Service] Getting graph context for task: ${documentId}`,
            );
            const graphContext =
              await graphRAGRepository.getTaskWithRelationships(
                documentId,
                projectId,
              );

            if (graphContext) {
              enrichedResult.graphContext = graphContext;
              console.log(
                `[GraphRAG Service] Graph context: ${graphContext.contextSummary}`,
              );
            } else {
              console.log(
                `[GraphRAG Service] No graph context found for: ${documentId}`,
              );
            }
          }

          // Step 4: Get related tasks
          if (opts.includeRelatedTasks) {
            console.log(
              `[GraphRAG Service] Finding related tasks for: ${documentId}`,
            );
            const relatedTasks = await graphRAGRepository.findRelatedTasks(
              documentId,
              projectId,
              opts.relationshipDepth,
            );

            if (relatedTasks.length > 0) {
              enrichedResult.relatedTasks = relatedTasks;
              console.log(
                `[GraphRAG Service] Found ${relatedTasks.length} related tasks`,
              );
            } else {
              console.log(
                `[GraphRAG Service] No related tasks found for: ${documentId}`,
              );
            }
          }
        } else {
          console.log(
            `[GraphRAG Service] No document ID found, skipping Neo4j lookup`,
          );
        }

        enrichedResults.push(enrichedResult);
      }

      console.log(
        `[GraphRAG Service] Returning ${enrichedResults.length} enriched results`,
      );
      console.log("[GraphRAG Service] ========== SEARCH END ==========");

      return enrichedResults;
    } catch (error) {
      console.error("[GraphRAG Service] Search error:", error);
      console.log(
        "[GraphRAG Service] ========== SEARCH END (ERROR) ==========",
      );
      throw error;
    }
  }

  /**
   * Format enriched results for LLM context
   */
  formatForLLMContext(results: EnrichedRAGResult[]): string {
    if (results.length === 0) {
      return "";
    }

    const sections: string[] = [];

    sections.push(
      "SIMILAR EXISTING TASKS/CONTEXT FOUND IN PROJECT (from GraphRAG search):",
    );
    sections.push("---");

    results.forEach((result, index) => {
      const relevancePercent = (result.relevanceScore * 100).toFixed(1);

      sections.push(`[Result ${index + 1}] (relevance: ${relevancePercent}%)`);
      sections.push(result.content);

      // Add graph context if available
      if (result.graphContext) {
        sections.push(
          `\nGraph Relationships: ${result.graphContext.contextSummary}`,
        );
      }

      // Add related tasks if available
      if (result.relatedTasks && result.relatedTasks.length > 0) {
        sections.push(`\nRelated Tasks:`);
        result.relatedTasks.slice(0, 3).forEach((task) => {
          sections.push(
            `  - ${task.title} (${task.category}, ${task.priority})`,
          );
        });
      }

      sections.push("");
    });

    sections.push("---");
    sections.push("");
    sections.push(
      "IMPORTANT: Review the above search results to check if similar tasks already exist in the project. If you find existing tasks that are similar to what the user is asking for:",
    );
    sections.push(
      "1. Mention to the user that similar tasks may already exist",
    );
    sections.push(
      "2. Explain what you found and how it relates to their request",
    );
    sections.push(
      "3. Consider the graph relationships - if a task has dependencies or is part of an epic, mention this context",
    );
    sections.push(
      "4. Only suggest NEW tasks that are genuinely different from existing ones",
    );
    sections.push(
      "5. If the user's request is already covered by existing tasks, let them know instead of creating duplicates",
    );

    return sections.join("\n");
  }

  /**
   * Store a task in both Pinecone and Neo4j
   */
  async upsertTask(
    task: TaskNode,
    corpusName: string,
    content: string,
  ): Promise<boolean> {
    console.log(`[GraphRAG Service] Upserting task: ${task.id}`);

    try {
      // Store in Pinecone for vector search
      const pineconeResult = await getRagRepository().uploadDocument(
        corpusName,
        task.id,
        content,
      );

      if (!pineconeResult) {
        console.error("[GraphRAG Service] Failed to store in Pinecone");

        return false;
      }

      // Store in Neo4j for graph relationships
      const neo4jResult = await graphRAGRepository.upsertTask(task);

      if (!neo4jResult) {
        console.error("[GraphRAG Service] Failed to store in Neo4j");
        // Continue anyway - Pinecone storage succeeded
      }

      console.log(`[GraphRAG Service] Task upserted successfully: ${task.id}`);

      return true;
    } catch (error) {
      console.error("[GraphRAG Service] Error upserting task:", error);

      return false;
    }
  }

  /**
   * Store an epic in Neo4j
   */
  async upsertEpic(epic: EpicNode): Promise<boolean> {
    return graphRAGRepository.upsertEpic(epic);
  }

  /**
   * Link a task to an epic
   */
  async linkTaskToEpic(
    taskId: string,
    epicId: string,
    projectId: string,
  ): Promise<boolean> {
    return graphRAGRepository.linkTaskToEpic(taskId, epicId, projectId);
  }

  /**
   * Create a relationship between tasks
   */
  async createTaskRelationship(
    sourceTaskId: string,
    targetTaskId: string,
    relationshipType: "DEPENDS_ON" | "BLOCKS" | "RELATED_TO" | "SIMILAR_TO",
    projectId: string,
    weight?: number,
  ): Promise<boolean> {
    return graphRAGRepository.createTaskRelationship(
      sourceTaskId,
      targetTaskId,
      relationshipType,
      projectId,
      weight,
    );
  }

  /**
   * Delete a task from both Pinecone and Neo4j
   */
  async deleteTask(
    taskId: string,
    corpusName: string,
    projectId: string,
  ): Promise<boolean> {
    console.log(`[GraphRAG Service] Deleting task: ${taskId}`);

    try {
      // Delete from Pinecone
      await getRagRepository().deleteDocumentByDisplayName(corpusName, taskId);

      // Delete from Neo4j
      await graphRAGRepository.deleteTask(taskId, projectId);

      console.log(`[GraphRAG Service] Task deleted successfully: ${taskId}`);

      return true;
    } catch (error) {
      console.error("[GraphRAG Service] Error deleting task:", error);

      return false;
    }
  }

  /**
   * Health check for both services
   */
  async healthCheck(): Promise<{ pinecone: boolean; neo4j: boolean }> {
    const neo4jHealth = await graphRAGRepository.healthCheck();

    // Pinecone doesn't have a dedicated health check,
    // so we assume it's healthy if it was initialized
    return {
      pinecone: true,
      neo4j: neo4jHealth,
    };
  }
}

// Export singleton instance
export const graphRAGService = new GraphRAGService();
