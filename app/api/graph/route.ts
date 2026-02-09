import { NextRequest, NextResponse } from "next/server";
import neo4j from "neo4j-driver";

const getNeo4jDriver = () => {
  const uri = process.env.NEO4J_URI || "bolt://localhost:7687";
  const user = process.env.NEO4J_USERNAME || process.env.NEO4J_USER || "neo4j";
  const password = process.env.NEO4J_PASSWORD || "";
  return neo4j.driver(uri, neo4j.auth.basic(user, password));
};

export interface GraphNodeData {
  id: string;
  label: string;
  type: "task" | "epic";
  category?: string;
  priority?: string;
  cleanArchitectureArea?: string;
  description?: string;
}

export interface GraphEdgeData {
  id: string;
  source: string;
  target: string;
  type: string;
  weight?: number;
}

export interface GraphData {
  nodes: GraphNodeData[];
  edges: GraphEdgeData[];
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");

  if (!projectId) {
    return NextResponse.json(
      { error: "projectId query parameter is required" },
      { status: 400 }
    );
  }

  const driver = getNeo4jDriver();
  const session = driver.session({ database: process.env.NEO4J_DATABASE || "neo4j" });

  try {
    console.log("[Graph API] Fetching graph data for project:", projectId);

    // Fetch all tasks and epics for the project
    const nodesResult = await session.run(
      `
      MATCH (n)
      WHERE n.projectId = $projectId AND (n:Task OR n:Epic)
      RETURN n, labels(n) as labels
      `,
      { projectId }
    );

    const nodes: GraphNodeData[] = nodesResult.records.map((record) => {
      const node = record.get("n").properties;
      const labels = record.get("labels") as string[];
      const isEpic = labels.includes("Epic");

      return {
        id: node.id,
        label: node.title || node.id,
        type: isEpic ? "epic" : "task",
        category: node.category,
        priority: node.priority,
        cleanArchitectureArea: node.cleanArchitectureArea,
        description: node.description,
      };
    });

    console.log(`[Graph API] Found ${nodes.length} nodes`);

    // Fetch all relationships for the project
    const edgesResult = await session.run(
      `
      MATCH (a)-[r]->(b)
      WHERE a.projectId = $projectId AND b.projectId = $projectId
      RETURN a.id as source, b.id as target, type(r) as type, r.weight as weight
      `,
      { projectId }
    );

    const edges: GraphEdgeData[] = edgesResult.records.map((record, index) => ({
      id: `edge-${index}`,
      source: record.get("source"),
      target: record.get("target"),
      type: record.get("type"),
      weight: record.get("weight")?.toNumber?.() || record.get("weight") || 1.0,
    }));

    console.log(`[Graph API] Found ${edges.length} edges`);

    return NextResponse.json({
      nodes,
      edges,
      nodeCount: nodes.length,
      edgeCount: edges.length,
    });
  } catch (error) {
    console.error("[Graph API] Error fetching graph data:", error);
    return NextResponse.json(
      { error: "Failed to fetch graph data" },
      { status: 500 }
    );
  } finally {
    await session.close();
    await driver.close();
  }
}
