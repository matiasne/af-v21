/**
 * GraphRAG Repository Interface
 *
 * This interface defines operations for storing and querying task relationships
 * in a graph database (Neo4j). It works alongside vector search (Pinecone) to provide
 * enhanced context through relationship information.
 */

export interface TaskNode {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  cleanArchitectureArea: string;
  projectId: string;
  epicId?: string;
  createdAt: string;
}

export interface EpicNode {
  id: string;
  title: string;
  description: string;
  priority: string;
  projectId: string;
  createdAt: string;
}

export interface TaskRelationship {
  type: "DEPENDS_ON" | "BLOCKS" | "RELATED_TO" | "PART_OF_EPIC" | "SIMILAR_TO";
  targetTaskId: string;
  weight?: number;
  metadata?: Record<string, string>;
}

export interface GraphSearchResult {
  task: TaskNode;
  relationships: {
    type: string;
    relatedTask: TaskNode | null;
    relatedEpic: EpicNode | null;
    weight?: number;
  }[];
  contextSummary: string;
}

export interface GraphRAGRepository {
  /**
   * Create or update a task node in the graph
   */
  upsertTask(task: TaskNode): Promise<boolean>;

  /**
   * Create or update an epic node in the graph
   */
  upsertEpic(epic: EpicNode): Promise<boolean>;

  /**
   * Create a relationship between two tasks
   */
  createTaskRelationship(
    sourceTaskId: string,
    targetTaskId: string,
    relationshipType: TaskRelationship["type"],
    projectId: string,
    weight?: number
  ): Promise<boolean>;

  /**
   * Link a task to an epic
   */
  linkTaskToEpic(taskId: string, epicId: string, projectId: string): Promise<boolean>;

  /**
   * Get a task with all its relationships
   */
  getTaskWithRelationships(taskId: string, projectId: string): Promise<GraphSearchResult | null>;

  /**
   * Find related tasks for a given task ID
   * Returns tasks that are directly connected through any relationship
   */
  findRelatedTasks(taskId: string, projectId: string, depth?: number): Promise<TaskNode[]>;

  /**
   * Find tasks in the same epic
   */
  findTasksInSameEpic(taskId: string, projectId: string): Promise<TaskNode[]>;

  /**
   * Get graph context for multiple tasks (used after vector search)
   * This enriches vector search results with relationship information
   */
  enrichWithGraphContext(
    taskIds: string[],
    projectId: string
  ): Promise<Map<string, GraphSearchResult>>;

  /**
   * Delete a specific relationship between two tasks
   */
  deleteRelationship(
    sourceTaskId: string,
    targetTaskId: string,
    relationshipType: string,
    projectId: string
  ): Promise<boolean>;

  /**
   * Delete a task and its relationships
   */
  deleteTask(taskId: string, projectId: string): Promise<boolean>;

  /**
   * Delete an epic and unlink all associated tasks
   */
  deleteEpic(epicId: string, projectId: string): Promise<boolean>;

  /**
   * Delete all nodes and relationships for a project
   */
  deleteProject(projectId: string): Promise<boolean>;

  /**
   * Check connection health
   */
  healthCheck(): Promise<boolean>;
}
