import { NextRequest, NextResponse } from "next/server";

import { getRagRepository } from "@/infrastructure/repositories/FirebaseRAGRepository";
import { graphRAGRepository } from "@/infrastructure/repositories/Neo4jGraphRAGRepository";
import { TaskNode, EpicNode, TaskRelationship } from "@/domain/repositories/GraphRAGRepository";

/**
 * Detect dependency relationships from task content
 * Returns detected dependencies that reference other task IDs or titles
 */
interface DetectedDependency {
  type: "DEPENDS_ON" | "BLOCKS";
  targetReference: string; // Could be a task ID or partial title
}

function detectDependencies(content: string, taskMetadata?: { dependsOn?: string[]; blocks?: string[] }): DetectedDependency[] {
  const dependencies: DetectedDependency[] = [];

  // Check explicit metadata first (from task creation UI)
  if (taskMetadata?.dependsOn) {
    for (const dep of taskMetadata.dependsOn) {
      dependencies.push({ type: "DEPENDS_ON", targetReference: dep });
    }
  }

  if (taskMetadata?.blocks) {
    for (const block of taskMetadata.blocks) {
      dependencies.push({ type: "BLOCKS", targetReference: block });
    }
  }

  // Pattern matching for natural language dependency detection
  // DEPENDS_ON patterns
  const dependsOnPatterns = [
    /depends on ["`']?([^"`'\n.]+)["`']?/gi,
    /requires ["`']?([^"`'\n.]+)["`']?/gi,
    /after ["`']?([^"`'\n.]+)["`']? is (done|completed|finished)/gi,
    /needs ["`']?([^"`'\n.]+)["`']? first/gi,
    /blocked by ["`']?([^"`'\n.]+)["`']?/gi,
    /waiting for ["`']?([^"`'\n.]+)["`']?/gi,
    /prerequisite:?\s*["`']?([^"`'\n.]+)["`']?/gi,
  ];

  for (const pattern of dependsOnPatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const reference = match[1].trim();
      if (reference.length > 3 && reference.length < 100) {
        dependencies.push({ type: "DEPENDS_ON", targetReference: reference });
      }
    }
  }

  // BLOCKS patterns
  const blocksPatterns = [
    /blocks ["`']?([^"`'\n.]+)["`']?/gi,
    /is required for ["`']?([^"`'\n.]+)["`']?/gi,
    /must be done before ["`']?([^"`'\n.]+)["`']?/gi,
    /prerequisite for ["`']?([^"`'\n.]+)["`']?/gi,
  ];

  for (const pattern of blocksPatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const reference = match[1].trim();
      if (reference.length > 3 && reference.length < 100) {
        dependencies.push({ type: "BLOCKS", targetReference: reference });
      }
    }
  }

  return dependencies;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const corpusName = searchParams.get("corpusName");
    const listCorpora = searchParams.get("listCorpora");

    // List all corpora if requested
    if (listCorpora === "true") {
      console.log("[RAG API] Listing all corpora");
      const corpora = await getRagRepository().listCorpora();
      return NextResponse.json({ corpora, count: corpora.length });
    }

    // Otherwise, get specific corpus info
    if (!corpusName) {
      return NextResponse.json(
        { error: "corpusName query parameter is required (or use listCorpora=true)" },
        { status: 400 },
      );
    }

    console.log("Fetching RAG data for corpus:", corpusName);

    // Fetch corpus info and documents in parallel
    const [corpus, documents] = await Promise.all([
      getRagRepository().getCorpus(corpusName),
      getRagRepository().listDocuments(corpusName),
    ]);

    console.log("Corpus fetched:", corpus);
    console.log("Documents count:", documents.length);
    console.log("Documents sample:", documents.slice(0, 2));

    return NextResponse.json({
      corpus,
      documents,
      count: documents.length,
    });
  } catch (error) {
    console.error("RAG Files API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch RAG files" },
      { status: 500 },
    );
  }
}

// POST - Create or get corpus, or upload document
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === "getOrCreateCorpus") {
      const { corpusDisplayName } = body;

      if (!corpusDisplayName) {
        return NextResponse.json(
          { error: "corpusDisplayName is required" },
          { status: 400 },
        );
      }

      console.log("[RAG API] Getting or creating corpus:", corpusDisplayName);
      const corpus = await getRagRepository().getOrCreateCorpus(corpusDisplayName);

      if (!corpus) {
        return NextResponse.json(
          { error: "Failed to get or create corpus" },
          { status: 500 },
        );
      }

      return NextResponse.json({ corpus });
    }

    if (action === "uploadDocument") {
      const { corpusName, displayName, content, taskMetadata, epicMetadata, projectId } = body;

      if (!corpusName || !displayName || !content) {
        return NextResponse.json(
          { error: "corpusName, displayName, and content are required" },
          { status: 400 },
        );
      }

      console.log(
        "[RAG API] Uploading document:",
        displayName,
        "to corpus:",
        corpusName,
      );

      // Upload to Pinecone (vector store)
      const document = await getRagRepository().uploadDocument(
        corpusName,
        displayName,
        content,
      );

      if (!document) {
        return NextResponse.json(
          { error: "Failed to upload document" },
          { status: 500 },
        );
      }

      // If task metadata is provided, also store in Neo4j for graph relationships
      if (taskMetadata && projectId) {
        try {
          console.log("[RAG API] ========== NEO4J TASK STORAGE ==========");
          console.log("[RAG API] Task ID:", displayName);
          console.log("[RAG API] Project ID:", projectId);
          console.log("[RAG API] Task metadata:", JSON.stringify(taskMetadata, null, 2));

          const taskNode: TaskNode = {
            id: displayName,
            title: taskMetadata.title || displayName,
            description: taskMetadata.description || "",
            category: taskMetadata.category || "backend",
            priority: taskMetadata.priority || "medium",
            cleanArchitectureArea: taskMetadata.cleanArchitectureArea || "infrastructure",
            projectId: projectId,
            epicId: taskMetadata.epicId,
            createdAt: new Date().toISOString(),
          };

          console.log("[RAG API] TaskNode to store:", JSON.stringify(taskNode, null, 2));

          const success = await graphRAGRepository.upsertTask(taskNode);

          if (success) {
            console.log("[RAG API] Task stored in Neo4j successfully:", displayName);
          } else {
            console.log("[RAG API] Failed to store task in Neo4j:", displayName);
          }

          // If task belongs to an epic, create the relationship
          if (taskMetadata.epicId) {
            console.log("[RAG API] Linking task to epic:", taskMetadata.epicId);
            const linkSuccess = await graphRAGRepository.linkTaskToEpic(displayName, taskMetadata.epicId, projectId);
            if (linkSuccess) {
              console.log("[RAG API] Task linked to epic successfully");
            } else {
              console.log("[RAG API] Failed to link task to epic");
            }
          }

          // Auto-create SIMILAR_TO relationships by searching for similar tasks
          console.log("[RAG API] Searching for similar tasks to create relationships...");
          try {
            const similarTasks = await getRagRepository().searchFiles(content, corpusName);
            console.log(`[RAG API] Found ${similarTasks.length} similar tasks from Pinecone`);

            // Create SIMILAR_TO relationships for tasks with high similarity (> 0.7)
            // Skip the current task itself
            const SIMILARITY_THRESHOLD = 0.7;
            let relationshipsCreated = 0;

            for (const similar of similarTasks) {
              // Skip if it's the same task or below threshold
              if (similar.id === displayName || similar.relevanceScore < SIMILARITY_THRESHOLD) {
                continue;
              }

              console.log(`[RAG API] Creating SIMILAR_TO relationship: ${displayName} -> ${similar.id} (score: ${similar.relevanceScore.toFixed(2)})`);

              const relSuccess = await graphRAGRepository.createTaskRelationship(
                displayName,
                similar.id,
                "SIMILAR_TO",
                projectId,
                similar.relevanceScore
              );

              if (relSuccess) {
                relationshipsCreated++;
                // Also create reverse relationship
                await graphRAGRepository.createTaskRelationship(
                  similar.id,
                  displayName,
                  "SIMILAR_TO",
                  projectId,
                  similar.relevanceScore
                );
              }
            }

            console.log(`[RAG API] Created ${relationshipsCreated} SIMILAR_TO relationships`);
          } catch (similarError) {
            console.error("[RAG API] Error creating similar task relationships:", similarError);
            // Continue - main task storage was successful
          }

          // Auto-detect and create DEPENDS_ON and BLOCKS relationships
          console.log("[RAG API] Detecting dependency relationships...");
          try {
            const detectedDeps = detectDependencies(content, taskMetadata);
            console.log(`[RAG API] Detected ${detectedDeps.length} potential dependencies`);

            let depsCreated = 0;
            for (const dep of detectedDeps) {
              console.log(`[RAG API] Processing ${dep.type} -> "${dep.targetReference}"`);

              // Check if the reference is an explicit task ID (e.g., "task-abc123" format)
              const isExplicitTaskId = dep.targetReference.startsWith("task-");

              if (isExplicitTaskId) {
                // Direct relationship creation with explicit task ID
                console.log(`[RAG API] Creating direct relationship with task ID: ${dep.targetReference}`);

                const relSuccess = await graphRAGRepository.createTaskRelationship(
                  displayName,
                  dep.targetReference,
                  dep.type,
                  projectId,
                  1.0 // Full weight for explicit dependencies
                );

                if (relSuccess) {
                  depsCreated++;
                  console.log(`[RAG API] Created ${dep.type} relationship: ${displayName} -> ${dep.targetReference}`);
                } else {
                  console.log(`[RAG API] Failed to create relationship (target task may not exist in Neo4j): ${dep.targetReference}`);
                }
              } else {
                // Search for matching tasks in Pinecone by the reference (natural language detection)
                const matchingTasks = await getRagRepository().searchFiles(dep.targetReference, corpusName);

                // Find the best match (highest score, not the current task)
                const bestMatch = matchingTasks.find(
                  t => t.id !== displayName && t.relevanceScore > 0.6
                );

                if (bestMatch) {
                  console.log(`[RAG API] Found matching task: ${bestMatch.id} (score: ${bestMatch.relevanceScore.toFixed(2)})`);

                  const relSuccess = await graphRAGRepository.createTaskRelationship(
                    displayName,
                    bestMatch.id,
                    dep.type,
                    projectId,
                    bestMatch.relevanceScore
                  );

                  if (relSuccess) {
                    depsCreated++;
                    console.log(`[RAG API] Created ${dep.type} relationship: ${displayName} -> ${bestMatch.id}`);
                  }
                } else {
                  console.log(`[RAG API] No matching task found for: "${dep.targetReference}"`);
                }
              }
            }

            console.log(`[RAG API] Created ${depsCreated} dependency relationships`);
          } catch (depError) {
            console.error("[RAG API] Error creating dependency relationships:", depError);
            // Continue - main task storage was successful
          }

          console.log("[RAG API] ========== NEO4J TASK STORAGE END ==========");
        } catch (neo4jError) {
          console.error("[RAG API] ========== NEO4J TASK STORAGE ERROR ==========");
          console.error("[RAG API] Error storing task in Neo4j:", neo4jError);
          console.error("[RAG API] ========== NEO4J TASK STORAGE ERROR END ==========");
          // Continue - Pinecone upload was successful
        }
      }

      // If epic metadata is provided, store in Neo4j
      if (epicMetadata && projectId) {
        try {
          console.log("[RAG API] ========== NEO4J EPIC STORAGE ==========");
          console.log("[RAG API] Epic ID:", displayName);
          console.log("[RAG API] Project ID:", projectId);
          console.log("[RAG API] Epic metadata:", JSON.stringify(epicMetadata, null, 2));

          const epicNode: EpicNode = {
            id: displayName,
            title: epicMetadata.title || displayName,
            description: epicMetadata.description || "",
            priority: epicMetadata.priority || "medium",
            projectId: projectId,
            createdAt: new Date().toISOString(),
          };

          console.log("[RAG API] EpicNode to store:", JSON.stringify(epicNode, null, 2));

          const success = await graphRAGRepository.upsertEpic(epicNode);

          if (success) {
            console.log("[RAG API] Epic stored in Neo4j successfully:", displayName);
          } else {
            console.log("[RAG API] Failed to store epic in Neo4j:", displayName);
          }

          console.log("[RAG API] ========== NEO4J EPIC STORAGE END ==========");
        } catch (neo4jError) {
          console.error("[RAG API] ========== NEO4J EPIC STORAGE ERROR ==========");
          console.error("[RAG API] Error storing epic in Neo4j:", neo4jError);
          console.error("[RAG API] ========== NEO4J EPIC STORAGE ERROR END ==========");
          // Continue - Pinecone upload was successful
        }
      }

      return NextResponse.json({ document });
    }

    // Create a relationship between tasks
    if (action === "createRelationship") {
      const { sourceTaskId, targetTaskId, relationshipType, projectId, weight } = body;

      if (!sourceTaskId || !targetTaskId || !relationshipType || !projectId) {
        return NextResponse.json(
          { error: "sourceTaskId, targetTaskId, relationshipType, and projectId are required" },
          { status: 400 },
        );
      }

      const validTypes = ["DEPENDS_ON", "BLOCKS", "RELATED_TO", "SIMILAR_TO"];
      if (!validTypes.includes(relationshipType)) {
        return NextResponse.json(
          { error: `Invalid relationshipType. Must be one of: ${validTypes.join(", ")}` },
          { status: 400 },
        );
      }

      console.log(`[RAG API] Creating ${relationshipType} relationship: ${sourceTaskId} -> ${targetTaskId}`);

      const success = await graphRAGRepository.createTaskRelationship(
        sourceTaskId,
        targetTaskId,
        relationshipType as TaskRelationship["type"],
        projectId,
        weight || 1.0
      );

      if (!success) {
        return NextResponse.json(
          { error: "Failed to create relationship" },
          { status: 500 },
        );
      }

      return NextResponse.json({ success: true, relationship: { sourceTaskId, targetTaskId, relationshipType } });
    }

    // Delete a relationship between tasks
    if (action === "deleteRelationship") {
      const { sourceTaskId, targetTaskId, relationshipType, projectId } = body;

      if (!sourceTaskId || !targetTaskId || !relationshipType || !projectId) {
        return NextResponse.json(
          { error: "sourceTaskId, targetTaskId, relationshipType, and projectId are required" },
          { status: 400 },
        );
      }

      console.log(`[RAG API] Deleting ${relationshipType} relationship: ${sourceTaskId} -> ${targetTaskId}`);

      const success = await graphRAGRepository.deleteRelationship(
        sourceTaskId,
        targetTaskId,
        relationshipType,
        projectId
      );

      if (!success) {
        return NextResponse.json(
          { error: "Failed to delete relationship" },
          { status: 500 },
        );
      }

      return NextResponse.json({ success: true });
    }

    // Update an existing task in both Pinecone and Neo4j
    if (action === "updateTask") {
      const { corpusName, taskId, projectId, updates } = body;

      if (!corpusName || !taskId || !projectId) {
        return NextResponse.json(
          { error: "corpusName, taskId, and projectId are required" },
          { status: 400 },
        );
      }

      console.log("[RAG API] ========== UPDATE TASK ==========");
      console.log("[RAG API] Task ID:", taskId);
      console.log("[RAG API] Project ID:", projectId);
      console.log("[RAG API] Updates:", JSON.stringify(updates, null, 2));

      const displayName = taskId.startsWith("task-") ? taskId : `task-${taskId}`;

      // Update in Pinecone - we need to re-upload with new content
      if (updates.title || updates.description) {
        try {
          // Build new content for the task
          const taskContent = [
            updates.title ? `Task: ${updates.title}` : "",
            updates.description ? `Description: ${updates.description}` : "",
            updates.category ? `Category: ${updates.category}` : "",
            updates.priority ? `Priority: ${updates.priority}` : "",
            updates.cleanArchitectureArea ? `Architecture Layer: ${updates.cleanArchitectureArea}` : "",
          ]
            .filter(Boolean)
            .join("\n\n");

          // Delete old document and upload new one
          await getRagRepository().deleteDocumentByDisplayName(corpusName, displayName);
          const document = await getRagRepository().uploadDocument(corpusName, displayName, taskContent);

          if (document) {
            console.log("[RAG API] Updated task in Pinecone:", displayName);
          } else {
            console.log("[RAG API] Failed to update task in Pinecone");
          }
        } catch (pineconeError) {
          console.error("[RAG API] Error updating task in Pinecone:", pineconeError);
          // Continue - try to update Neo4j
        }
      }

      // Update in Neo4j
      try {
        const taskNode: TaskNode = {
          id: displayName,
          title: updates.title || "",
          description: updates.description || "",
          category: updates.category || "backend",
          priority: updates.priority || "medium",
          cleanArchitectureArea: updates.cleanArchitectureArea || "infrastructure",
          projectId: projectId,
          epicId: updates.epicId,
          createdAt: new Date().toISOString(),
        };

        const success = await graphRAGRepository.upsertTask(taskNode);

        if (success) {
          console.log("[RAG API] Updated task in Neo4j:", displayName);
        } else {
          console.log("[RAG API] Failed to update task in Neo4j");
        }

        // Handle dependency updates
        if (updates.dependencies && Array.isArray(updates.dependencies)) {
          console.log("[RAG API] Updating dependencies:", updates.dependencies);

          // For now, create new DEPENDS_ON relationships for each dependency
          // In a full implementation, we'd want to diff and remove old ones
          for (const dep of updates.dependencies) {
            // Try to find matching task
            const matchingTasks = await getRagRepository().searchFiles(dep, corpusName);
            const bestMatch = matchingTasks.find(
              t => t.id !== displayName && t.relevanceScore > 0.5
            );

            if (bestMatch) {
              await graphRAGRepository.createTaskRelationship(
                displayName,
                bestMatch.id,
                "DEPENDS_ON",
                projectId,
                bestMatch.relevanceScore
              );
              console.log(`[RAG API] Created DEPENDS_ON: ${displayName} -> ${bestMatch.id}`);
            } else if (dep.startsWith("task-")) {
              // It's already a task ID format, try direct relationship
              await graphRAGRepository.createTaskRelationship(
                displayName,
                dep,
                "DEPENDS_ON",
                projectId,
                1.0
              );
              console.log(`[RAG API] Created DEPENDS_ON: ${displayName} -> ${dep}`);
            }
          }
        }
      } catch (neo4jError) {
        console.error("[RAG API] Error updating task in Neo4j:", neo4jError);
      }

      console.log("[RAG API] ========== UPDATE TASK END ==========");

      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      {
        error:
          "Invalid action. Supported actions: getOrCreateCorpus, uploadDocument, createRelationship, deleteRelationship, updateTask",
      },
      { status: 400 },
    );
  } catch (error) {
    console.error("RAG Files API POST error:", error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 },
    );
  }
}

// DELETE - Delete a document or corpus
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const corpusName = searchParams.get("corpusName");
    const displayName = searchParams.get("displayName");
    const deleteCorpus = searchParams.get("deleteCorpus");

    // Delete entire corpus
    if (deleteCorpus === "true" && corpusName) {
      console.log("[RAG API] Deleting corpus:", corpusName);
      const success = await getRagRepository().deleteCorpus(corpusName);

      if (!success) {
        return NextResponse.json(
          { error: "Failed to delete corpus" },
          { status: 500 },
        );
      }

      return NextResponse.json({ success: true });
    }

    // Delete document from corpus
    if (!corpusName || !displayName) {
      return NextResponse.json(
        { error: "corpusName and displayName query parameters are required (or use deleteCorpus=true)" },
        { status: 400 },
      );
    }

    console.log(
      "[RAG API] Deleting document:",
      displayName,
      "from corpus:",
      corpusName,
    );
    const success = await getRagRepository().deleteDocumentByDisplayName(
      corpusName,
      displayName,
    );

    if (!success) {
      return NextResponse.json(
        { error: "Failed to delete document" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("RAG Files API DELETE error:", error);
    return NextResponse.json(
      { error: "Failed to delete document" },
      { status: 500 },
    );
  }
}
