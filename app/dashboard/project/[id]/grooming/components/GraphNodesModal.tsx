"use client";

import { useState, useMemo } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@heroui/modal";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import { Tabs, Tab } from "@heroui/tabs";

export interface GraphNode {
  id: string;
  title: string;
  type: "task" | "epic";
  category?: string;
  priority?: string;
  relevanceScore?: number;
  relationships: {
    type: string;
    targetId: string;
    targetTitle: string;
    targetType: "task" | "epic";
  }[];
}

interface GraphNodesModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodes: GraphNode[];
}

// Color mappings
const getRelationshipStrokeColor = (type: string): string => {
  switch (type) {
    case "DEPENDS_ON":
      return "#f5a524"; // warning
    case "BLOCKS":
      return "#f31260"; // danger
    case "RELATED_TO":
      return "#006FEE"; // primary
    case "PART_OF_EPIC":
      return "#9353d3"; // secondary
    case "SIMILAR_TO":
      return "#17c964"; // success
    default:
      return "#a1a1aa"; // default
  }
};

const getRelationshipLabel = (type: string): string => {
  switch (type) {
    case "DEPENDS_ON":
      return "Depends on";
    case "BLOCKS":
      return "Blocks";
    case "RELATED_TO":
      return "Related to";
    case "PART_OF_EPIC":
      return "Part of";
    case "SIMILAR_TO":
      return "Similar to";
    default:
      return type;
  }
};

const getNodeColor = (type: "task" | "epic", isMain: boolean): string => {
  if (isMain) {
    return type === "epic" ? "#9353d3" : "#006FEE";
  }
  return type === "epic" ? "#e4d4f4" : "#cce3fd";
};

const getNodeStroke = (type: "task" | "epic", isMain: boolean): string => {
  if (isMain) {
    return type === "epic" ? "#7828c8" : "#004493";
  }
  return type === "epic" ? "#9353d3" : "#006FEE";
};

interface DiagramNode {
  id: string;
  title: string;
  type: "task" | "epic";
  x: number;
  y: number;
  isMain: boolean;
  relevanceScore?: number;
}

interface DiagramEdge {
  from: string;
  to: string;
  type: string;
  label: string;
}

// Graph Diagram Component
function GraphDiagram({ nodes }: { nodes: GraphNode[] }) {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  const { diagramNodes, diagramEdges } = useMemo(() => {
    const diagramNodes: DiagramNode[] = [];
    const diagramEdges: DiagramEdge[] = [];
    const nodeMap = new Map<string, DiagramNode>();

    const WIDTH = 700;
    const HEIGHT = 400;
    const CENTER_X = WIDTH / 2;
    const CENTER_Y = HEIGHT / 2;
    const RADIUS = 150;

    // Add main nodes in a circle
    nodes.forEach((node, index) => {
      const angle = (2 * Math.PI * index) / nodes.length - Math.PI / 2;
      const x = CENTER_X + RADIUS * Math.cos(angle);
      const y = CENTER_Y + RADIUS * Math.sin(angle);

      const diagramNode: DiagramNode = {
        id: node.id,
        title: node.title,
        type: node.type,
        x,
        y,
        isMain: true,
        relevanceScore: node.relevanceScore,
      };

      diagramNodes.push(diagramNode);
      nodeMap.set(node.id, diagramNode);
    });

    // Add related nodes and edges
    const relatedNodePositions = new Map<string, { x: number; y: number }>();
    let relatedIndex = 0;

    nodes.forEach((node) => {
      node.relationships.forEach((rel) => {
        // Add edge
        diagramEdges.push({
          from: node.id,
          to: rel.targetId,
          type: rel.type,
          label: getRelationshipLabel(rel.type),
        });

        // Add related node if not already added
        if (!nodeMap.has(rel.targetId) && !relatedNodePositions.has(rel.targetId)) {
          const mainNode = nodeMap.get(node.id);
          if (mainNode) {
            // Position related nodes around the outer edge
            const outerRadius = RADIUS + 80;
            const baseAngle = Math.atan2(mainNode.y - CENTER_Y, mainNode.x - CENTER_X);
            const offsetAngle = (relatedIndex % 3 - 1) * 0.4;
            const angle = baseAngle + offsetAngle;

            const x = CENTER_X + outerRadius * Math.cos(angle);
            const y = CENTER_Y + outerRadius * Math.sin(angle);

            relatedNodePositions.set(rel.targetId, { x, y });

            diagramNodes.push({
              id: rel.targetId,
              title: rel.targetTitle,
              type: rel.targetType,
              x,
              y,
              isMain: false,
            });

            relatedIndex++;
          }
        }
      });
    });

    return { diagramNodes, diagramEdges };
  }, [nodes]);

  if (diagramNodes.length === 0) {
    return (
      <div className="text-center py-8 text-default-500">
        No nodes to display
      </div>
    );
  }

  // Find node by id
  const getNodeById = (id: string) => diagramNodes.find((n) => n.id === id);

  return (
    <div className="relative w-full overflow-hidden rounded-lg bg-default-100 dark:bg-default-50/10">
      <svg
        viewBox="0 0 700 400"
        className="w-full h-[400px]"
        style={{ minHeight: "400px" }}
      >
        {/* Define arrow markers */}
        <defs>
          {["DEPENDS_ON", "BLOCKS", "RELATED_TO", "PART_OF_EPIC", "SIMILAR_TO", "default"].map(
            (type) => (
              <marker
                key={type}
                id={`arrow-${type}`}
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path
                  d="M 0 0 L 10 5 L 0 10 z"
                  fill={getRelationshipStrokeColor(type)}
                />
              </marker>
            )
          )}
        </defs>

        {/* Draw edges */}
        {diagramEdges.map((edge, index) => {
          const fromNode = getNodeById(edge.from);
          const toNode = getNodeById(edge.to);

          if (!fromNode || !toNode) return null;

          // Calculate edge points (from node edge to node edge)
          const dx = toNode.x - fromNode.x;
          const dy = toNode.y - fromNode.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const nodeRadius = 40;

          const startX = fromNode.x + (dx / dist) * nodeRadius;
          const startY = fromNode.y + (dy / dist) * nodeRadius;
          const endX = toNode.x - (dx / dist) * (nodeRadius + 8);
          const endY = toNode.y - (dy / dist) * (nodeRadius + 8);

          const isHighlighted =
            hoveredNode === edge.from ||
            hoveredNode === edge.to ||
            selectedNode === edge.from ||
            selectedNode === edge.to;

          return (
            <g key={`edge-${index}`}>
              <line
                x1={startX}
                y1={startY}
                x2={endX}
                y2={endY}
                stroke={getRelationshipStrokeColor(edge.type)}
                strokeWidth={isHighlighted ? 3 : 2}
                strokeOpacity={isHighlighted ? 1 : 0.6}
                markerEnd={`url(#arrow-${edge.type})`}
              />
              {/* Edge label */}
              <text
                x={(startX + endX) / 2}
                y={(startY + endY) / 2 - 8}
                textAnchor="middle"
                className="text-[10px] fill-default-500"
                style={{ pointerEvents: "none" }}
              >
                {edge.label}
              </text>
            </g>
          );
        })}

        {/* Draw nodes */}
        {diagramNodes.map((node) => {
          const isHighlighted = hoveredNode === node.id || selectedNode === node.id;
          const truncatedTitle =
            node.title.length > 25 ? node.title.substring(0, 22) + "..." : node.title;

          return (
            <g
              key={node.id}
              onMouseEnter={() => setHoveredNode(node.id)}
              onMouseLeave={() => setHoveredNode(null)}
              onClick={() => setSelectedNode(selectedNode === node.id ? null : node.id)}
              style={{ cursor: "pointer" }}
            >
              {/* Node circle */}
              <circle
                cx={node.x}
                cy={node.y}
                r={isHighlighted ? 45 : 40}
                fill={getNodeColor(node.type, node.isMain)}
                stroke={getNodeStroke(node.type, node.isMain)}
                strokeWidth={isHighlighted ? 3 : 2}
                className="transition-all duration-200"
              />

              {/* Node icon */}
              {node.type === "task" ? (
                <path
                  d={`M${node.x - 8} ${node.y - 15} h16 v4 h-16 z M${node.x - 8} ${node.y - 7} h16 v4 h-16 z M${node.x - 8} ${node.y + 1} h10 v4 h-10 z`}
                  fill={node.isMain ? "white" : getNodeStroke(node.type, node.isMain)}
                />
              ) : (
                <path
                  d={`M${node.x} ${node.y - 12} l12 8 l-12 8 l-12 -8 z`}
                  fill="none"
                  stroke={node.isMain ? "white" : getNodeStroke(node.type, node.isMain)}
                  strokeWidth={2}
                />
              )}

              {/* Node label */}
              <text
                x={node.x}
                y={node.y + 55}
                textAnchor="middle"
                className="text-xs fill-default-700 font-medium"
                style={{ pointerEvents: "none" }}
              >
                {truncatedTitle}
              </text>

              {/* Relevance score badge */}
              {node.relevanceScore !== undefined && node.isMain && (
                <>
                  <circle
                    cx={node.x + 30}
                    cy={node.y - 30}
                    r={14}
                    fill="#17c964"
                  />
                  <text
                    x={node.x + 30}
                    y={node.y - 26}
                    textAnchor="middle"
                    className="text-[10px] fill-white font-bold"
                    style={{ pointerEvents: "none" }}
                  >
                    {(node.relevanceScore * 100).toFixed(0)}%
                  </text>
                </>
              )}
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="absolute bottom-2 left-2 bg-background/90 rounded-lg p-2 text-xs">
        <div className="flex flex-wrap gap-2">
          <div className="flex items-center gap-1">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: "#006FEE" }}
            />
            <span>Main Task</span>
          </div>
          <div className="flex items-center gap-1">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: "#cce3fd", border: "1px solid #006FEE" }}
            />
            <span>Related Task</span>
          </div>
          <div className="flex items-center gap-1">
            <div
              className="w-3 h-0.5"
              style={{ backgroundColor: "#17c964" }}
            />
            <span>Similar</span>
          </div>
        </div>
      </div>

      {/* Selected node details */}
      {selectedNode && (
        <div className="absolute top-2 right-2 bg-background/95 rounded-lg p-3 max-w-[200px] shadow-lg border border-default-200">
          {(() => {
            const node = diagramNodes.find((n) => n.id === selectedNode);
            if (!node) return null;
            return (
              <>
                <p className="font-medium text-sm mb-1">{node.title}</p>
                <div className="flex gap-1 flex-wrap">
                  <Chip size="sm" variant="flat" color={node.type === "epic" ? "secondary" : "primary"}>
                    {node.type}
                  </Chip>
                  {node.relevanceScore !== undefined && (
                    <Chip size="sm" variant="flat" color="success">
                      {(node.relevanceScore * 100).toFixed(0)}% match
                    </Chip>
                  )}
                </div>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}

// List view component
function ListView({ nodes }: { nodes: GraphNode[] }) {
  return (
    <div className="space-y-3">
      {nodes.map((node, index) => (
        <div
          key={node.id}
          className="p-3 rounded-lg bg-default-50 border border-default-200"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-medium text-sm truncate">{node.title}</span>
                {node.relevanceScore !== undefined && (
                  <Chip size="sm" variant="flat" color="success">
                    {(node.relevanceScore * 100).toFixed(0)}%
                  </Chip>
                )}
              </div>

              <div className="flex flex-wrap gap-1 mb-2">
                <Chip
                  size="sm"
                  variant="flat"
                  color={node.type === "epic" ? "secondary" : "primary"}
                >
                  {node.type}
                </Chip>
                {node.category && (
                  <Chip size="sm" variant="bordered">
                    {node.category}
                  </Chip>
                )}
                {node.priority && (
                  <Chip size="sm" variant="bordered">
                    {node.priority}
                  </Chip>
                )}
              </div>

              {node.relationships.length > 0 && (
                <div className="text-xs text-default-500 space-y-1">
                  {node.relationships.slice(0, 3).map((rel, relIndex) => (
                    <div key={relIndex} className="flex items-center gap-1">
                      <span
                        className="inline-block w-2 h-2 rounded-full"
                        style={{ backgroundColor: getRelationshipStrokeColor(rel.type) }}
                      />
                      <span>{getRelationshipLabel(rel.type)}:</span>
                      <span className="truncate">{rel.targetTitle}</span>
                    </div>
                  ))}
                  {node.relationships.length > 3 && (
                    <span className="text-default-400">
                      +{node.relationships.length - 3} more
                    </span>
                  )}
                </div>
              )}
            </div>
            <span className="text-default-400 text-xs">#{index + 1}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function GraphNodesModal({ isOpen, onClose, nodes }: GraphNodesModalProps) {
  const [viewMode, setViewMode] = useState<"diagram" | "list">("diagram");

  if (nodes.length === 0) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} size="lg">
        <ModalContent>
          <ModalHeader className="flex items-center gap-2">
            <svg
              className="w-5 h-5 text-primary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
            Graph Context
          </ModalHeader>
          <ModalBody>
            <div className="text-center py-8 text-default-500">
              <svg
                className="w-12 h-12 mx-auto mb-4 text-default-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
              <p>No graph nodes found for this query.</p>
              <p className="text-sm mt-2">
                Graph relationships will appear here when similar tasks are found.
              </p>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button color="primary" variant="light" onPress={onClose}>
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="4xl" scrollBehavior="inside">
      <ModalContent>
        <ModalHeader className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg
              className="w-5 h-5 text-primary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
            Graph Context
            <Chip size="sm" variant="flat" color="primary">
              {nodes.length} node{nodes.length !== 1 ? "s" : ""}
            </Chip>
          </div>
        </ModalHeader>
        <ModalBody>
          <Tabs
            selectedKey={viewMode}
            onSelectionChange={(key) => setViewMode(key as "diagram" | "list")}
            size="sm"
            className="mb-4"
          >
            <Tab
              key="diagram"
              title={
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  Diagram
                </div>
              }
            />
            <Tab
              key="list"
              title={
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                  List
                </div>
              }
            />
          </Tabs>

          {viewMode === "diagram" ? (
            <GraphDiagram nodes={nodes} />
          ) : (
            <ListView nodes={nodes} />
          )}
        </ModalBody>
        <ModalFooter>
          <Button color="primary" variant="light" onPress={onClose}>
            Close
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
