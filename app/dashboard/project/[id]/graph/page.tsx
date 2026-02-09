"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@heroui/button";
import { Spinner } from "@heroui/spinner";
import { Chip } from "@heroui/chip";
import { Card, CardBody } from "@heroui/card";
import { Tooltip } from "@heroui/tooltip";
import Graph from "graphology";
import { SigmaContainer, useRegisterEvents, useSigma } from "@react-sigma/core";
import "@react-sigma/core/lib/style.css";

// Types for graph data (mirrors the API response types)
interface GraphNodeData {
  id: string;
  label: string;
  type: "task" | "epic";
  category?: string;
  priority?: string;
  cleanArchitectureArea?: string;
  description?: string;
}

interface GraphEdgeData {
  id: string;
  source: string;
  target: string;
  type: string;
  weight?: number;
}

// Relationship type colors
const RELATIONSHIP_COLORS: Record<string, string> = {
  SIMILAR_TO: "#3b82f6", // blue
  DEPENDS_ON: "#f59e0b", // amber
  BLOCKS: "#ef4444", // red
  RELATED_TO: "#8b5cf6", // purple
  PART_OF_EPIC: "#10b981", // green
};

// Category colors for nodes
const CATEGORY_COLORS: Record<string, string> = {
  frontend: "#3b82f6", // blue
  backend: "#10b981", // green
  database: "#f59e0b", // amber
  infrastructure: "#8b5cf6", // purple
  devops: "#ef4444", // red
  testing: "#06b6d4", // cyan
  documentation: "#64748b", // slate
  epic: "#ec4899", // pink
};

// Priority colors
const PRIORITY_COLORS: Record<string, string> = {
  high: "#ef4444",
  medium: "#f59e0b",
  low: "#10b981",
};

interface GraphEventsProps {
  onNodeClick: (nodeId: string) => void;
  onNodeHover: (nodeId: string | null) => void;
}

function GraphEvents({ onNodeClick, onNodeHover }: GraphEventsProps) {
  const registerEvents = useRegisterEvents();
  const sigma = useSigma();

  useEffect(() => {
    registerEvents({
      clickNode: (event) => {
        onNodeClick(event.node);
      },
      enterNode: (event) => {
        onNodeHover(event.node);
        // Highlight connected nodes
        const graph = sigma.getGraph();
        const neighbors = graph.neighbors(event.node);

        graph.forEachNode((node) => {
          if (node === event.node || neighbors.includes(node)) {
            graph.setNodeAttribute(node, "highlighted", true);
          } else {
            graph.setNodeAttribute(node, "highlighted", false);
          }
        });

        sigma.refresh();
      },
      leaveNode: () => {
        onNodeHover(null);
        // Reset highlighting
        const graph = sigma.getGraph();
        graph.forEachNode((node) => {
          graph.setNodeAttribute(node, "highlighted", true);
        });
        sigma.refresh();
      },
    });
  }, [registerEvents, sigma, onNodeClick, onNodeHover]);

  return null;
}

export default function GraphPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nodes, setNodes] = useState<GraphNodeData[]>([]);
  const [edges, setEdges] = useState<GraphEdgeData[]>([]);
  const [selectedNode, setSelectedNode] = useState<GraphNodeData | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [isContainerReady, setIsContainerReady] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Wait for container to be mounted and have dimensions
  useEffect(() => {
    const checkContainer = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          setIsContainerReady(true);
          return true;
        }
      }
      return false;
    };

    // Check immediately
    if (checkContainer()) return;

    // If not ready, use ResizeObserver
    const observer = new ResizeObserver(() => {
      if (checkContainer()) {
        observer.disconnect();
      }
    });

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    // Also check after a small delay as fallback
    const timeout = setTimeout(() => {
      checkContainer();
    }, 100);

    return () => {
      observer.disconnect();
      clearTimeout(timeout);
    };
  }, [isLoading, nodes]);

  // Fetch graph data
  useEffect(() => {
    const fetchGraphData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/graph?projectId=${projectId}`);
        if (!response.ok) {
          throw new Error("Failed to fetch graph data");
        }

        const data = await response.json();
        setNodes(data.nodes || []);
        setEdges(data.edges || []);
      } catch (err) {
        console.error("Error fetching graph data:", err);
        setError("Failed to load graph data");
      } finally {
        setIsLoading(false);
      }
    };

    if (projectId) {
      fetchGraphData();
    }
  }, [projectId]);

  // Create the graphology graph
  const graph = useMemo(() => {
    const g = new Graph();

    if (nodes.length === 0) return g;

    // Calculate positions in a circular layout
    const angleStep = (2 * Math.PI) / nodes.length;
    const radius = 100;

    nodes.forEach((node, index) => {
      const angle = index * angleStep;
      const x = radius * Math.cos(angle);
      const y = radius * Math.sin(angle);

      const color = node.type === "epic"
        ? CATEGORY_COLORS.epic
        : CATEGORY_COLORS[node.category || "backend"] || "#64748b";

      g.addNode(node.id, {
        x,
        y,
        size: node.type === "epic" ? 15 : 10,
        label: node.label,
        color,
        highlighted: true,
        nodeType: node.type, // renamed from 'type' to avoid conflict with Sigma's node program type
        category: node.category,
        priority: node.priority,
        cleanArchitectureArea: node.cleanArchitectureArea,
        description: node.description,
      });
    });

    edges.forEach((edge) => {
      // Only add edge if both source and target nodes exist
      if (g.hasNode(edge.source) && g.hasNode(edge.target)) {
        const edgeColor = RELATIONSHIP_COLORS[edge.type] || "#94a3b8";

        g.addEdge(edge.source, edge.target, {
          size: Math.max(1, (edge.weight || 1) * 2),
          color: edgeColor,
          type: "arrow",
          label: edge.type,
        });
      }
    });

    return g;
  }, [nodes, edges]);

  const handleNodeClick = useCallback((nodeId: string) => {
    const nodeData = nodes.find((n) => n.id === nodeId);
    setSelectedNode(nodeData || null);
  }, [nodes]);

  const handleNodeHover = useCallback((nodeId: string | null) => {
    setHoveredNode(nodeId);
  }, []);

  // Get relationship counts by type
  const relationshipCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    edges.forEach((edge) => {
      counts[edge.type] = (counts[edge.type] || 0) + 1;
    });
    return counts;
  }, [edges]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Spinner size="lg" />
          <p className="mt-4 text-default-500">Loading graph data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-danger">{error}</p>
          <Button className="mt-4" onPress={() => router.back()}>
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  if (nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="mb-4">
            <svg
              className="w-16 h-16 mx-auto text-default-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-default-700 mb-2">
            No Graph Data Yet
          </h2>
          <p className="text-default-500 mb-4">
            Start a grooming session to create tasks and see their relationships here.
          </p>
          <Button color="primary" onPress={() => router.push(`/dashboard/project/${projectId}/grooming`)}>
            Go to Grooming
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col bg-default-50 dark:bg-default-900 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-default-200 bg-white dark:bg-default-800">
        <div className="flex items-center gap-4">
          <Button
            isIconOnly
            variant="light"
            onPress={() => router.back()}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Button>
          <div>
            <h1 className="text-xl font-semibold text-default-800">
              Task Relationship Graph
            </h1>
            <p className="text-sm text-default-500">
              {nodes.length} nodes, {edges.length} relationships
            </p>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-default-500">Relationships:</span>
            {Object.entries(relationshipCounts).map(([type, count]) => (
              <Tooltip key={type} content={`${count} ${type} relationships`}>
                <Chip
                  size="sm"
                  variant="flat"
                  style={{
                    backgroundColor: `${RELATIONSHIP_COLORS[type]}20`,
                    color: RELATIONSHIP_COLORS[type],
                  }}
                >
                  {type.replace(/_/g, " ")} ({count})
                </Chip>
              </Tooltip>
            ))}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex min-h-0">
        {/* Graph container */}
        <div
          ref={containerRef}
          className="flex-1 relative min-w-0"
          style={{ minHeight: "400px" }}
        >
          {isContainerReady && nodes.length > 0 ? (
            <SigmaContainer
              graph={graph}
              style={{ height: "100%", width: "100%", position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
              settings={{
                allowInvalidContainer: true,
                nodeProgramClasses: {},
                defaultNodeType: "circle",
                defaultEdgeType: "arrow",
                labelDensity: 0.07,
                labelGridCellSize: 60,
                labelRenderedSizeThreshold: 5,
                labelFont: "Inter, sans-serif",
                zIndex: true,
                renderEdgeLabels: true,
                edgeLabelSize: 10,
                edgeLabelFont: "Inter, sans-serif",
              }}
            >
              <GraphEvents
                onNodeClick={handleNodeClick}
                onNodeHover={handleNodeHover}
              />
            </SigmaContainer>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <Spinner size="lg" />
            </div>
          )}

          {/* Hovered node tooltip */}
          {hoveredNode && (
            <div className="absolute top-4 left-4 pointer-events-none z-10">
              <Card className="shadow-lg">
                <CardBody className="p-3">
                  <p className="font-medium text-sm">
                    {nodes.find((n) => n.id === hoveredNode)?.label}
                  </p>
                </CardBody>
              </Card>
            </div>
          )}
        </div>

        {/* Selected node details panel */}
        {selectedNode && (
          <div className="w-80 border-l border-default-200 bg-white dark:bg-default-800 overflow-y-auto">
            <div className="p-4">
              <div className="flex items-start justify-between mb-4">
                <h2 className="text-lg font-semibold text-default-800">
                  Node Details
                </h2>
                <Button
                  isIconOnly
                  size="sm"
                  variant="light"
                  onPress={() => setSelectedNode(null)}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </Button>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-sm text-default-500 mb-1">Title</p>
                  <p className="font-medium text-default-800">{selectedNode.label}</p>
                </div>

                <div>
                  <p className="text-sm text-default-500 mb-1">Type</p>
                  <Chip
                    size="sm"
                    color={selectedNode.type === "epic" ? "secondary" : "primary"}
                    variant="flat"
                  >
                    {selectedNode.type}
                  </Chip>
                </div>

                {selectedNode.category && (
                  <div>
                    <p className="text-sm text-default-500 mb-1">Category</p>
                    <Chip
                      size="sm"
                      variant="flat"
                      style={{
                        backgroundColor: `${CATEGORY_COLORS[selectedNode.category]}20`,
                        color: CATEGORY_COLORS[selectedNode.category],
                      }}
                    >
                      {selectedNode.category}
                    </Chip>
                  </div>
                )}

                {selectedNode.priority && (
                  <div>
                    <p className="text-sm text-default-500 mb-1">Priority</p>
                    <Chip
                      size="sm"
                      variant="flat"
                      style={{
                        backgroundColor: `${PRIORITY_COLORS[selectedNode.priority]}20`,
                        color: PRIORITY_COLORS[selectedNode.priority],
                      }}
                    >
                      {selectedNode.priority}
                    </Chip>
                  </div>
                )}

                {selectedNode.cleanArchitectureArea && (
                  <div>
                    <p className="text-sm text-default-500 mb-1">Architecture Area</p>
                    <p className="text-sm text-default-700">{selectedNode.cleanArchitectureArea}</p>
                  </div>
                )}

                {selectedNode.description && (
                  <div>
                    <p className="text-sm text-default-500 mb-1">Description</p>
                    <p className="text-sm text-default-700 line-clamp-4">
                      {selectedNode.description}
                    </p>
                  </div>
                )}

                {/* Show relationships for this node */}
                <div>
                  <p className="text-sm text-default-500 mb-2">Relationships</p>
                  <div className="space-y-2">
                    {edges
                      .filter((e) => e.source === selectedNode.id || e.target === selectedNode.id)
                      .map((edge) => {
                        const isSource = edge.source === selectedNode.id;
                        const otherNodeId = isSource ? edge.target : edge.source;
                        const otherNode = nodes.find((n) => n.id === otherNodeId);

                        return (
                          <div
                            key={edge.id}
                            className="flex items-center gap-2 text-sm p-2 rounded-lg bg-default-100 cursor-pointer hover:bg-default-200"
                            onClick={() => {
                              if (otherNode) {
                                setSelectedNode(otherNode);
                              }
                            }}
                          >
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: RELATIONSHIP_COLORS[edge.type] }}
                            />
                            <span className="text-default-500">
                              {isSource ? edge.type.replace(/_/g, " ") : `is ${edge.type.replace(/_/g, " ")} by`}
                            </span>
                            <span className="font-medium text-default-700 truncate flex-1">
                              {otherNode?.label || otherNodeId}
                            </span>
                          </div>
                        );
                      })}
                    {edges.filter((e) => e.source === selectedNode.id || e.target === selectedNode.id).length === 0 && (
                      <p className="text-sm text-default-400">No relationships</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Category legend */}
      <div className="px-6 py-3 border-t border-default-200 bg-white dark:bg-default-800">
        <div className="flex items-center gap-4 overflow-x-auto">
          <span className="text-xs text-default-500 whitespace-nowrap">Node Categories:</span>
          {Object.entries(CATEGORY_COLORS).map(([category, color]) => (
            <div key={category} className="flex items-center gap-1">
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className="text-xs text-default-600 capitalize whitespace-nowrap">
                {category}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
