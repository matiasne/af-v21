import neo4j, { Driver, Session } from "neo4j-driver";
import {
  GraphRAGRepository,
  TaskNode,
  EpicNode,
  TaskRelationship,
  GraphSearchResult,
} from "@/domain/repositories/GraphRAGRepository";

export class Neo4jGraphRAGRepository implements GraphRAGRepository {
  private driver: Driver;

  constructor() {
    const uri = process.env.NEO4J_URI || "bolt://localhost:7687";
    // Support both NEO4J_USERNAME (Aura) and NEO4J_USER naming conventions
    const user = process.env.NEO4J_USERNAME || process.env.NEO4J_USER || "neo4j";
    const password = process.env.NEO4J_PASSWORD || "";
    const database = process.env.NEO4J_DATABASE || "neo4j";

    if (!password) {
      console.warn("[Neo4j GraphRAG] NEO4J_PASSWORD not set, connection may fail");
    }

    console.log(`[Neo4j GraphRAG] Connecting to ${uri} as ${user} (database: ${database})`);
    this.driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
  }

  private getSession(): Session {
    const database = process.env.NEO4J_DATABASE || "neo4j";
    return this.driver.session({ database });
  }

  async healthCheck(): Promise<boolean> {
    const session = this.getSession();
    try {
      await session.run("RETURN 1");
      console.log("[Neo4j GraphRAG] Connection healthy");
      return true;
    } catch (error) {
      console.error("[Neo4j GraphRAG] Health check failed:", error);
      return false;
    } finally {
      await session.close();
    }
  }

  async upsertTask(task: TaskNode): Promise<boolean> {
    const session = this.getSession();
    try {
      console.log(`[Neo4j GraphRAG] Upserting task: ${task.id}`);

      await session.run(
        `
        MERGE (t:Task {id: $id, projectId: $projectId})
        SET t.title = $title,
            t.description = $description,
            t.category = $category,
            t.priority = $priority,
            t.cleanArchitectureArea = $cleanArchitectureArea,
            t.epicId = $epicId,
            t.createdAt = $createdAt,
            t.updatedAt = datetime()
        RETURN t
        `,
        {
          id: task.id,
          projectId: task.projectId,
          title: task.title,
          description: task.description,
          category: task.category,
          priority: task.priority,
          cleanArchitectureArea: task.cleanArchitectureArea,
          epicId: task.epicId || null,
          createdAt: task.createdAt,
        }
      );

      console.log(`[Neo4j GraphRAG] Task upserted successfully: ${task.id}`);
      return true;
    } catch (error) {
      console.error("[Neo4j GraphRAG] Error upserting task:", error);
      return false;
    } finally {
      await session.close();
    }
  }

  async upsertEpic(epic: EpicNode): Promise<boolean> {
    const session = this.getSession();
    try {
      console.log(`[Neo4j GraphRAG] Upserting epic: ${epic.id}`);

      await session.run(
        `
        MERGE (e:Epic {id: $id, projectId: $projectId})
        SET e.title = $title,
            e.description = $description,
            e.priority = $priority,
            e.createdAt = $createdAt,
            e.updatedAt = datetime()
        RETURN e
        `,
        {
          id: epic.id,
          projectId: epic.projectId,
          title: epic.title,
          description: epic.description,
          priority: epic.priority,
          createdAt: epic.createdAt,
        }
      );

      console.log(`[Neo4j GraphRAG] Epic upserted successfully: ${epic.id}`);
      return true;
    } catch (error) {
      console.error("[Neo4j GraphRAG] Error upserting epic:", error);
      return false;
    } finally {
      await session.close();
    }
  }

  async createTaskRelationship(
    sourceTaskId: string,
    targetTaskId: string,
    relationshipType: TaskRelationship["type"],
    projectId: string,
    weight?: number
  ): Promise<boolean> {
    const session = this.getSession();
    try {
      console.log(
        `[Neo4j GraphRAG] Creating relationship: ${sourceTaskId} -[${relationshipType}]-> ${targetTaskId}`
      );

      // Create relationship based on type
      const query = `
        MATCH (source:Task {id: $sourceId, projectId: $projectId})
        MATCH (target:Task {id: $targetId, projectId: $projectId})
        MERGE (source)-[r:${relationshipType}]->(target)
        SET r.weight = $weight,
            r.createdAt = datetime()
        RETURN r
      `;

      await session.run(query, {
        sourceId: sourceTaskId,
        targetId: targetTaskId,
        projectId,
        weight: weight || 1.0,
      });

      console.log(`[Neo4j GraphRAG] Relationship created successfully`);
      return true;
    } catch (error) {
      console.error("[Neo4j GraphRAG] Error creating relationship:", error);
      return false;
    } finally {
      await session.close();
    }
  }

  async linkTaskToEpic(taskId: string, epicId: string, projectId: string): Promise<boolean> {
    const session = this.getSession();
    try {
      console.log(`[Neo4j GraphRAG] Linking task ${taskId} to epic ${epicId}`);

      await session.run(
        `
        MATCH (t:Task {id: $taskId, projectId: $projectId})
        MATCH (e:Epic {id: $epicId, projectId: $projectId})
        MERGE (t)-[r:PART_OF_EPIC]->(e)
        SET r.createdAt = datetime()
        RETURN r
        `,
        { taskId, epicId, projectId }
      );

      console.log(`[Neo4j GraphRAG] Task linked to epic successfully`);
      return true;
    } catch (error) {
      console.error("[Neo4j GraphRAG] Error linking task to epic:", error);
      return false;
    } finally {
      await session.close();
    }
  }

  async getTaskWithRelationships(
    taskId: string,
    projectId: string
  ): Promise<GraphSearchResult | null> {
    const session = this.getSession();
    try {
      console.log(`[Neo4j GraphRAG] Getting task with relationships: ${taskId}`);

      const result = await session.run(
        `
        MATCH (t:Task {id: $taskId, projectId: $projectId})
        OPTIONAL MATCH (t)-[r]->(related)
        OPTIONAL MATCH (t)<-[r2]-(incoming)
        RETURN t,
               collect(DISTINCT {type: type(r), node: related, direction: 'outgoing'}) as outRels,
               collect(DISTINCT {type: type(r2), node: incoming, direction: 'incoming'}) as inRels
        `,
        { taskId, projectId }
      );

      if (result.records.length === 0) {
        console.log(`[Neo4j GraphRAG] Task not found: ${taskId}`);
        return null;
      }

      const record = result.records[0];
      const taskNode = record.get("t").properties;
      const outRels = record.get("outRels") || [];
      const inRels = record.get("inRels") || [];

      const relationships: GraphSearchResult["relationships"] = [];
      const allRels = [...outRels, ...inRels];

      for (const rel of allRels) {
        if (rel.node && rel.type) {
          const nodeProps = rel.node.properties;
          const isEpic = rel.node.labels?.includes("Epic");

          relationships.push({
            type: rel.type,
            relatedTask: !isEpic
              ? {
                  id: nodeProps.id,
                  title: nodeProps.title,
                  description: nodeProps.description,
                  category: nodeProps.category,
                  priority: nodeProps.priority,
                  cleanArchitectureArea: nodeProps.cleanArchitectureArea,
                  projectId: nodeProps.projectId,
                  epicId: nodeProps.epicId,
                  createdAt: nodeProps.createdAt,
                }
              : null,
            relatedEpic: isEpic
              ? {
                  id: nodeProps.id,
                  title: nodeProps.title,
                  description: nodeProps.description,
                  priority: nodeProps.priority,
                  projectId: nodeProps.projectId,
                  createdAt: nodeProps.createdAt,
                }
              : null,
          });
        }
      }

      // Generate context summary
      const contextParts: string[] = [];
      const epicRels = relationships.filter((r) => r.type === "PART_OF_EPIC" && r.relatedEpic);
      const dependsOn = relationships.filter((r) => r.type === "DEPENDS_ON" && r.relatedTask);
      const blocks = relationships.filter((r) => r.type === "BLOCKS" && r.relatedTask);
      const relatedTo = relationships.filter((r) => r.type === "RELATED_TO" && r.relatedTask);
      const similarTo = relationships.filter((r) => r.type === "SIMILAR_TO" && r.relatedTask);

      if (epicRels.length > 0) {
        contextParts.push(
          `Part of epic: "${epicRels[0].relatedEpic?.title}"`
        );
      }
      if (dependsOn.length > 0) {
        contextParts.push(
          `Depends on: ${dependsOn.map((r) => `"${r.relatedTask?.title}"`).join(", ")}`
        );
      }
      if (blocks.length > 0) {
        contextParts.push(
          `Blocks: ${blocks.map((r) => `"${r.relatedTask?.title}"`).join(", ")}`
        );
      }
      if (relatedTo.length > 0) {
        contextParts.push(
          `Related to: ${relatedTo.map((r) => `"${r.relatedTask?.title}"`).join(", ")}`
        );
      }
      if (similarTo.length > 0) {
        contextParts.push(
          `Similar to: ${similarTo.map((r) => `"${r.relatedTask?.title}"`).join(", ")}`
        );
      }

      return {
        task: {
          id: taskNode.id,
          title: taskNode.title,
          description: taskNode.description,
          category: taskNode.category,
          priority: taskNode.priority,
          cleanArchitectureArea: taskNode.cleanArchitectureArea,
          projectId: taskNode.projectId,
          epicId: taskNode.epicId,
          createdAt: taskNode.createdAt,
        },
        relationships,
        contextSummary:
          contextParts.length > 0
            ? contextParts.join(". ")
            : "No relationships found for this task.",
      };
    } catch (error) {
      console.error("[Neo4j GraphRAG] Error getting task with relationships:", error);
      return null;
    } finally {
      await session.close();
    }
  }

  async findRelatedTasks(
    taskId: string,
    projectId: string,
    depth: number = 2
  ): Promise<TaskNode[]> {
    const session = this.getSession();
    try {
      console.log(`[Neo4j GraphRAG] Finding related tasks for: ${taskId} (depth: ${depth})`);

      const result = await session.run(
        `
        MATCH (t:Task {id: $taskId, projectId: $projectId})
        MATCH (t)-[*1..${depth}]-(related:Task {projectId: $projectId})
        WHERE related.id <> $taskId
        RETURN DISTINCT related
        LIMIT 20
        `,
        { taskId, projectId }
      );

      const tasks: TaskNode[] = result.records.map((record) => {
        const props = record.get("related").properties;
        return {
          id: props.id,
          title: props.title,
          description: props.description,
          category: props.category,
          priority: props.priority,
          cleanArchitectureArea: props.cleanArchitectureArea,
          projectId: props.projectId,
          epicId: props.epicId,
          createdAt: props.createdAt,
        };
      });

      console.log(`[Neo4j GraphRAG] Found ${tasks.length} related tasks`);
      return tasks;
    } catch (error) {
      console.error("[Neo4j GraphRAG] Error finding related tasks:", error);
      return [];
    } finally {
      await session.close();
    }
  }

  async findTasksInSameEpic(taskId: string, projectId: string): Promise<TaskNode[]> {
    const session = this.getSession();
    try {
      console.log(`[Neo4j GraphRAG] Finding tasks in same epic as: ${taskId}`);

      const result = await session.run(
        `
        MATCH (t:Task {id: $taskId, projectId: $projectId})-[:PART_OF_EPIC]->(e:Epic)
        MATCH (sibling:Task {projectId: $projectId})-[:PART_OF_EPIC]->(e)
        WHERE sibling.id <> $taskId
        RETURN DISTINCT sibling
        `,
        { taskId, projectId }
      );

      const tasks: TaskNode[] = result.records.map((record) => {
        const props = record.get("sibling").properties;
        return {
          id: props.id,
          title: props.title,
          description: props.description,
          category: props.category,
          priority: props.priority,
          cleanArchitectureArea: props.cleanArchitectureArea,
          projectId: props.projectId,
          epicId: props.epicId,
          createdAt: props.createdAt,
        };
      });

      console.log(`[Neo4j GraphRAG] Found ${tasks.length} tasks in same epic`);
      return tasks;
    } catch (error) {
      console.error("[Neo4j GraphRAG] Error finding tasks in same epic:", error);
      return [];
    } finally {
      await session.close();
    }
  }

  async enrichWithGraphContext(
    taskIds: string[],
    projectId: string
  ): Promise<Map<string, GraphSearchResult>> {
    console.log(
      `[Neo4j GraphRAG] Enriching ${taskIds.length} tasks with graph context`
    );

    const results = new Map<string, GraphSearchResult>();

    // Fetch all tasks in parallel
    const promises = taskIds.map((taskId) =>
      this.getTaskWithRelationships(taskId, projectId)
    );

    const graphResults = await Promise.all(promises);

    for (let i = 0; i < taskIds.length; i++) {
      const result = graphResults[i];
      if (result) {
        results.set(taskIds[i], result);
      }
    }

    console.log(`[Neo4j GraphRAG] Enriched ${results.size} tasks with graph context`);
    return results;
  }

  async deleteRelationship(
    sourceTaskId: string,
    targetTaskId: string,
    relationshipType: string,
    projectId: string
  ): Promise<boolean> {
    const session = this.getSession();
    try {
      console.log(
        `[Neo4j GraphRAG] Deleting relationship: ${sourceTaskId} -[${relationshipType}]-> ${targetTaskId}`
      );

      const query = `
        MATCH (source:Task {id: $sourceId, projectId: $projectId})
              -[r:${relationshipType}]->
              (target:Task {id: $targetId, projectId: $projectId})
        DELETE r
        RETURN count(r) as deleted
      `;

      const result = await session.run(query, {
        sourceId: sourceTaskId,
        targetId: targetTaskId,
        projectId,
      });

      const deleted = result.records[0]?.get("deleted")?.toNumber() || 0;
      console.log(`[Neo4j GraphRAG] Deleted ${deleted} relationship(s)`);
      return deleted > 0;
    } catch (error) {
      console.error("[Neo4j GraphRAG] Error deleting relationship:", error);
      return false;
    } finally {
      await session.close();
    }
  }

  async deleteTask(taskId: string, projectId: string): Promise<boolean> {
    const session = this.getSession();
    try {
      console.log(`[Neo4j GraphRAG] Deleting task: ${taskId}`);

      await session.run(
        `
        MATCH (t:Task {id: $taskId, projectId: $projectId})
        DETACH DELETE t
        `,
        { taskId, projectId }
      );

      console.log(`[Neo4j GraphRAG] Task deleted successfully`);
      return true;
    } catch (error) {
      console.error("[Neo4j GraphRAG] Error deleting task:", error);
      return false;
    } finally {
      await session.close();
    }
  }

  async deleteEpic(epicId: string, projectId: string): Promise<boolean> {
    const session = this.getSession();
    try {
      console.log(`[Neo4j GraphRAG] Deleting epic: ${epicId}`);

      await session.run(
        `
        MATCH (e:Epic {id: $epicId, projectId: $projectId})
        DETACH DELETE e
        `,
        { epicId, projectId }
      );

      console.log(`[Neo4j GraphRAG] Epic deleted successfully`);
      return true;
    } catch (error) {
      console.error("[Neo4j GraphRAG] Error deleting epic:", error);
      return false;
    } finally {
      await session.close();
    }
  }

  async deleteProject(projectId: string): Promise<boolean> {
    const session = this.getSession();
    try {
      console.log(`[Neo4j GraphRAG] Deleting all nodes for project: ${projectId}`);

      await session.run(
        `
        MATCH (n {projectId: $projectId})
        DETACH DELETE n
        `,
        { projectId }
      );

      console.log(`[Neo4j GraphRAG] Project nodes deleted successfully`);
      return true;
    } catch (error) {
      console.error("[Neo4j GraphRAG] Error deleting project:", error);
      return false;
    } finally {
      await session.close();
    }
  }

  async close(): Promise<void> {
    await this.driver.close();
  }
}

// Export singleton instance
export const graphRAGRepository = new Neo4jGraphRAGRepository();
