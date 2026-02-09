"use client";

import { useState, useEffect, useCallback } from "react";
import { Modal, ModalContent, ModalHeader, ModalBody } from "@heroui/modal";
import { Spinner } from "@heroui/spinner";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Divider } from "@heroui/divider";
import { Chip } from "@heroui/chip";
import { Tabs, Tab } from "@heroui/tabs";
import { Button } from "@heroui/button";
import { Textarea } from "@heroui/input";

import {
  BusinessAnalysis,
  FunctionalAnalysis,
  FDDEnrichment,
} from "@/domain/entities/FileAnalysis";
import { fileAnalysisRepository } from "@/infrastructure/repositories/FirebaseFileAnalysisRepository";

interface FileComment {
  id: string;
  comment: string;
  createdAt: number;
}

interface FileAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  projectId: string;
  migrationId: string;
  fileId: string;
  fileName: string;
}

export function FileAnalysisModal({
  isOpen,
  onClose,
  userId,
  projectId,
  migrationId,
  fileId,
  fileName,
}: FileAnalysisModalProps) {
  const [loading, setLoading] = useState(false);
  const [businessAnalysis, setBusinessAnalysis] = useState<
    BusinessAnalysis | undefined
  >();
  const [functionalAnalysis, setFunctionalAnalysis] = useState<
    FunctionalAnalysis | undefined
  >();
  const [fddEnrichment, setFddEnrichment] = useState<
    FDDEnrichment | undefined
  >();

  // Comments state
  const [comments, setComments] = useState<FileComment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [isAddingComment, setIsAddingComment] = useState(false);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(
    null,
  );

  // Subscribe to comments
  useEffect(() => {
    if (!isOpen || !fileId) return;

    const unsubscribe = fileAnalysisRepository.subscribeComments(
      projectId,
      migrationId,
      fileId,
      (updatedComments) => {
        setComments(updatedComments);
      },
      (error) => {
        console.error("Error subscribing to comments:", error);
      },
    );

    return () => {
      unsubscribe();
    };
  }, [isOpen, fileId, projectId, migrationId]);

  const handleAddComment = useCallback(async () => {
    if (!newComment.trim()) return;

    setIsAddingComment(true);
    try {
      await fileAnalysisRepository.addComment(
        projectId,
        migrationId,
        fileId,
        newComment.trim(),
      );
      setNewComment("");
    } catch (error) {
      console.error("Error adding comment:", error);
    } finally {
      setIsAddingComment(false);
    }
  }, [newComment, projectId, migrationId, fileId]);

  const handleDeleteComment = useCallback(
    async (commentId: string) => {
      setDeletingCommentId(commentId);
      try {
        await fileAnalysisRepository.deleteComment(
          projectId,
          migrationId,
          fileId,
          commentId,
        );
      } catch (error) {
        console.error("Error deleting comment:", error);
      } finally {
        setDeletingCommentId(null);
      }
    },
    [projectId, migrationId, fileId],
  );

  useEffect(() => {
    if (!isOpen || !fileId) return;

    const fetchAnalyses = async () => {
      setLoading(true);
      try {
        const result = await fileAnalysisRepository.getFileWithAnalyses(
          projectId,
          migrationId,
          fileId,
        );

        if (result) {
          setBusinessAnalysis(result.businessAnalysis);
          setFunctionalAnalysis(result.functionalAnalysis);
          setFddEnrichment(result.file.fddEnrichment);
        }
      } catch (error) {
        console.error("Error fetching file analyses:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalyses();
  }, [isOpen, fileId, userId, projectId, migrationId]);

  return (
    <Modal
      classNames={{
        backdrop: "bg-black/50 backdrop-blur-sm",
      }}
      isOpen={isOpen}
      scrollBehavior="inside"
      size="5xl"
      onClose={onClose}
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <h2 className="text-xl font-bold">File Analysis</h2>
          <p className="text-sm font-normal text-default-500">{fileName}</p>
        </ModalHeader>
        <ModalBody className="pb-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner color="primary" />
            </div>
          ) : (
            <Tabs
              aria-label="Analysis tabs"
              color="primary"
              variant="underlined"
            >
              <Tab key="business" title="Business Analysis">
                {businessAnalysis ? (
                  <div className="space-y-4 py-4">
                    {/* Summary and Key Metrics */}
                    <Card>
                      <CardHeader>
                        <h3 className="text-lg font-semibold">Overview</h3>
                      </CardHeader>
                      <Divider />
                      <CardBody className="space-y-4">
                        {businessAnalysis.businessSummary && (
                          <div>
                            <p className="text-sm font-medium text-default-600 mb-1">
                              Summary
                            </p>
                            <p className="text-default-700">
                              {businessAnalysis.businessSummary}
                            </p>
                          </div>
                        )}
                        {businessAnalysis.analysisNotes && (
                          <div>
                            <p className="text-sm font-medium text-default-600 mb-1">
                              Analysis Notes
                            </p>
                            <p className="text-default-700">
                              {businessAnalysis.analysisNotes}
                            </p>
                          </div>
                        )}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {businessAnalysis.businessComplexity && (
                            <div>
                              <p className="text-xs text-default-400">
                                Complexity
                              </p>
                              <Chip
                                color={
                                  businessAnalysis.businessComplexity === "low"
                                    ? "success"
                                    : businessAnalysis.businessComplexity ===
                                        "medium"
                                      ? "warning"
                                      : "danger"
                                }
                                size="sm"
                                variant="flat"
                              >
                                {businessAnalysis.businessComplexity}
                              </Chip>
                            </div>
                          )}
                          {businessAnalysis.businessCriticality && (
                            <div>
                              <p className="text-xs text-default-400">
                                Criticality
                              </p>
                              <Chip
                                color={
                                  businessAnalysis.businessCriticality === "low"
                                    ? "success"
                                    : businessAnalysis.businessCriticality ===
                                        "medium"
                                      ? "warning"
                                      : "danger"
                                }
                                size="sm"
                                variant="flat"
                              >
                                {businessAnalysis.businessCriticality}
                              </Chip>
                            </div>
                          )}
                          {businessAnalysis.modernizationImpact && (
                            <div>
                              <p className="text-xs text-default-400">
                                Modernization Impact
                              </p>
                              <Chip
                                color={
                                  businessAnalysis.modernizationImpact === "low"
                                    ? "success"
                                    : businessAnalysis.modernizationImpact ===
                                        "medium"
                                      ? "warning"
                                      : "danger"
                                }
                                size="sm"
                                variant="flat"
                              >
                                {businessAnalysis.modernizationImpact}
                              </Chip>
                            </div>
                          )}
                          {businessAnalysis.confidence !== undefined && (
                            <div>
                              <p className="text-xs text-default-400">
                                Confidence
                              </p>
                              <p className="font-medium">
                                {(businessAnalysis.confidence * 100).toFixed(0)}
                                %
                              </p>
                            </div>
                          )}
                        </div>
                      </CardBody>
                    </Card>

                    {/* Business Rules */}
                    {businessAnalysis.businessRules &&
                      businessAnalysis.businessRules.length > 0 && (
                        <Card>
                          <CardHeader>
                            <h3 className="text-lg font-semibold">
                              Business Rules
                            </h3>
                          </CardHeader>
                          <Divider />
                          <CardBody>
                            <ul className="list-disc list-inside space-y-2">
                              {businessAnalysis.businessRules.map(
                                (rule, index) => (
                                  <li key={index} className="text-default-700">
                                    {rule}
                                  </li>
                                ),
                              )}
                            </ul>
                          </CardBody>
                        </Card>
                      )}

                    {/* Business Entities */}
                    {businessAnalysis.businessEntities &&
                      businessAnalysis.businessEntities.length > 0 && (
                        <Card>
                          <CardHeader>
                            <h3 className="text-lg font-semibold">
                              Business Entities
                            </h3>
                          </CardHeader>
                          <Divider />
                          <CardBody>
                            <div className="flex flex-wrap gap-2">
                              {businessAnalysis.businessEntities.map(
                                (entity, index) => (
                                  <Chip
                                    key={index}
                                    color="primary"
                                    size="sm"
                                    variant="flat"
                                  >
                                    {entity}
                                  </Chip>
                                ),
                              )}
                            </div>
                          </CardBody>
                        </Card>
                      )}

                    {/* Business Workflows */}
                    {businessAnalysis.businessWorkflows &&
                      businessAnalysis.businessWorkflows.length > 0 && (
                        <Card>
                          <CardHeader>
                            <h3 className="text-lg font-semibold">
                              Business Workflows
                            </h3>
                          </CardHeader>
                          <Divider />
                          <CardBody>
                            <ul className="list-disc list-inside space-y-2">
                              {businessAnalysis.businessWorkflows.map(
                                (workflow, index) => (
                                  <li key={index} className="text-default-700">
                                    {workflow}
                                  </li>
                                ),
                              )}
                            </ul>
                          </CardBody>
                        </Card>
                      )}

                    {/* Business Dependencies */}
                    {businessAnalysis.businessDependencies &&
                      businessAnalysis.businessDependencies.length > 0 && (
                        <Card>
                          <CardHeader>
                            <h3 className="text-lg font-semibold">
                              Business Dependencies
                            </h3>
                          </CardHeader>
                          <Divider />
                          <CardBody>
                            <ul className="list-disc list-inside space-y-2">
                              {businessAnalysis.businessDependencies.map(
                                (dep, index) => (
                                  <li key={index} className="text-default-700">
                                    {dep}
                                  </li>
                                ),
                              )}
                            </ul>
                          </CardBody>
                        </Card>
                      )}

                    {/* Data Transformations */}
                    {businessAnalysis.dataTransformations &&
                      businessAnalysis.dataTransformations.length > 0 && (
                        <Card>
                          <CardHeader>
                            <h3 className="text-lg font-semibold">
                              Data Transformations
                            </h3>
                          </CardHeader>
                          <Divider />
                          <CardBody>
                            <ul className="list-disc list-inside space-y-2">
                              {businessAnalysis.dataTransformations.map(
                                (transform, index) => (
                                  <li key={index} className="text-default-700">
                                    {transform}
                                  </li>
                                ),
                              )}
                            </ul>
                          </CardBody>
                        </Card>
                      )}

                    {/* Error Handling */}
                    {businessAnalysis.errorHandling &&
                      businessAnalysis.errorHandling.length > 0 && (
                        <Card>
                          <CardHeader>
                            <h3 className="text-lg font-semibold">
                              Error Handling
                            </h3>
                          </CardHeader>
                          <Divider />
                          <CardBody>
                            <ul className="list-disc list-inside space-y-2">
                              {businessAnalysis.errorHandling.map(
                                (error, index) => (
                                  <li key={index} className="text-default-700">
                                    {error}
                                  </li>
                                ),
                              )}
                            </ul>
                          </CardBody>
                        </Card>
                      )}

                    {/* Business Constants */}
                    {businessAnalysis.extractedConstants?.businessConstants &&
                      businessAnalysis.extractedConstants.businessConstants
                        .length > 0 && (
                        <Card>
                          <CardHeader>
                            <h3 className="text-lg font-semibold">
                              Business Constants
                            </h3>
                          </CardHeader>
                          <Divider />
                          <CardBody>
                            <div className="flex flex-wrap gap-2">
                              {businessAnalysis.extractedConstants.businessConstants.map(
                                (constant, index) => (
                                  <Chip
                                    key={index}
                                    size="sm"
                                    variant="bordered"
                                  >
                                    {constant}
                                  </Chip>
                                ),
                              )}
                            </div>
                          </CardBody>
                        </Card>
                      )}
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-12">
                    <p className="text-default-400">
                      No business analysis available
                    </p>
                  </div>
                )}
              </Tab>

              <Tab key="functional" title="Functional Analysis">
                {functionalAnalysis ? (
                  <div className="space-y-4 py-4">
                    {/* Summary and Key Metrics */}
                    <Card>
                      <CardHeader>
                        <h3 className="text-lg font-semibold">Overview</h3>
                      </CardHeader>
                      <Divider />
                      <CardBody className="space-y-4">
                        {functionalAnalysis.functionalSummary && (
                          <div>
                            <p className="text-sm font-medium text-default-600 mb-1">
                              Summary
                            </p>
                            <p className="text-default-700">
                              {functionalAnalysis.functionalSummary}
                            </p>
                          </div>
                        )}
                        {functionalAnalysis.analysisNotes && (
                          <div>
                            <p className="text-sm font-medium text-default-600 mb-1">
                              Analysis Notes
                            </p>
                            <p className="text-default-700">
                              {functionalAnalysis.analysisNotes}
                            </p>
                          </div>
                        )}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {functionalAnalysis.linesOfCode !== undefined && (
                            <div>
                              <p className="text-xs text-default-400">
                                Lines of Code
                              </p>
                              <p className="font-medium text-lg">
                                {functionalAnalysis.linesOfCode}
                              </p>
                            </div>
                          )}
                          {functionalAnalysis.cyclomaticComplexity && (
                            <div>
                              <p className="text-xs text-default-400">
                                Complexity
                              </p>
                              <Chip
                                color={
                                  functionalAnalysis.cyclomaticComplexity ===
                                  "low"
                                    ? "success"
                                    : functionalAnalysis.cyclomaticComplexity ===
                                        "medium"
                                      ? "warning"
                                      : "danger"
                                }
                                size="sm"
                                variant="flat"
                              >
                                {functionalAnalysis.cyclomaticComplexity}
                              </Chip>
                            </div>
                          )}
                          {functionalAnalysis.maintainability && (
                            <div>
                              <p className="text-xs text-default-400">
                                Maintainability
                              </p>
                              <Chip
                                color={
                                  functionalAnalysis.maintainability === "low"
                                    ? "danger"
                                    : functionalAnalysis.maintainability ===
                                        "medium"
                                      ? "warning"
                                      : "success"
                                }
                                size="sm"
                                variant="flat"
                              >
                                {functionalAnalysis.maintainability}
                              </Chip>
                            </div>
                          )}
                          {functionalAnalysis.testability && (
                            <div>
                              <p className="text-xs text-default-400">
                                Testability
                              </p>
                              <Chip
                                color={
                                  functionalAnalysis.testability === "low"
                                    ? "danger"
                                    : functionalAnalysis.testability ===
                                        "medium"
                                      ? "warning"
                                      : "success"
                                }
                                size="sm"
                                variant="flat"
                              >
                                {functionalAnalysis.testability}
                              </Chip>
                            </div>
                          )}
                          {functionalAnalysis.confidence !== undefined && (
                            <div>
                              <p className="text-xs text-default-400">
                                Confidence
                              </p>
                              <p className="font-medium">
                                {(functionalAnalysis.confidence * 100).toFixed(
                                  0,
                                )}
                                %
                              </p>
                            </div>
                          )}
                        </div>
                      </CardBody>
                    </Card>

                    {/* Control Flow */}
                    {functionalAnalysis.controlFlow &&
                      functionalAnalysis.controlFlow.length > 0 && (
                        <Card>
                          <CardHeader>
                            <h3 className="text-lg font-semibold">
                              Control Flow
                            </h3>
                          </CardHeader>
                          <Divider />
                          <CardBody>
                            <ul className="list-disc list-inside space-y-2">
                              {functionalAnalysis.controlFlow.map(
                                (flow, index) => (
                                  <li key={index} className="text-default-700">
                                    {flow}
                                  </li>
                                ),
                              )}
                            </ul>
                          </CardBody>
                        </Card>
                      )}

                    {/* I/O Operations */}
                    {functionalAnalysis.ioOperations &&
                      functionalAnalysis.ioOperations.length > 0 && (
                        <Card>
                          <CardHeader>
                            <h3 className="text-lg font-semibold">
                              I/O Operations
                            </h3>
                          </CardHeader>
                          <Divider />
                          <CardBody>
                            <ul className="list-disc list-inside space-y-2">
                              {functionalAnalysis.ioOperations.map(
                                (io, index) => (
                                  <li key={index} className="text-default-700">
                                    {io}
                                  </li>
                                ),
                              )}
                            </ul>
                          </CardBody>
                        </Card>
                      )}

                    {/* External Dependencies */}
                    {functionalAnalysis.externalDependencies &&
                      functionalAnalysis.externalDependencies.length > 0 && (
                        <Card>
                          <CardHeader>
                            <h3 className="text-lg font-semibold">
                              External Dependencies
                            </h3>
                          </CardHeader>
                          <Divider />
                          <CardBody>
                            <div className="flex flex-wrap gap-2">
                              {functionalAnalysis.externalDependencies.map(
                                (dep, index) => (
                                  <Chip
                                    key={index}
                                    color="primary"
                                    size="sm"
                                    variant="flat"
                                  >
                                    {dep}
                                  </Chip>
                                ),
                              )}
                            </div>
                          </CardBody>
                        </Card>
                      )}

                    {/* Technical Debt */}
                    {functionalAnalysis.technicalDebt &&
                      functionalAnalysis.technicalDebt.length > 0 && (
                        <Card>
                          <CardHeader>
                            <h3 className="text-lg font-semibold">
                              Technical Debt
                            </h3>
                          </CardHeader>
                          <Divider />
                          <CardBody>
                            <ul className="list-disc list-inside space-y-2">
                              {functionalAnalysis.technicalDebt.map(
                                (debt, index) => (
                                  <li key={index} className="text-default-700">
                                    {debt}
                                  </li>
                                ),
                              )}
                            </ul>
                          </CardBody>
                        </Card>
                      )}
                    {functionalAnalysis.functions &&
                      functionalAnalysis.functions.length > 0 && (
                        <Card>
                          <CardHeader>
                            <h3 className="text-lg font-semibold">Functions</h3>
                          </CardHeader>
                          <Divider />
                          <CardBody>
                            <div className="space-y-3">
                              {functionalAnalysis.functions.map(
                                (func, index) => (
                                  <div
                                    key={index}
                                    className="border-l-2 border-primary pl-3"
                                  >
                                    <h4 className="font-mono font-semibold text-sm">
                                      {func.name}
                                      {func.signature && (
                                        <span className="text-default-400">
                                          {func.signature}
                                        </span>
                                      )}
                                    </h4>
                                    {func.description && (
                                      <p className="text-sm text-default-600 mt-1">
                                        {func.description}
                                      </p>
                                    )}
                                    {func.parameters &&
                                      func.parameters.length > 0 && (
                                        <div className="mt-2">
                                          <p className="text-xs text-default-400">
                                            Parameters:
                                          </p>
                                          <div className="flex flex-wrap gap-1 mt-1">
                                            {func.parameters.map((param, i) => (
                                              <Chip
                                                key={i}
                                                size="sm"
                                                variant="flat"
                                              >
                                                {param}
                                              </Chip>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    {func.returnType && (
                                      <p className="text-xs text-default-400 mt-1">
                                        Returns:{" "}
                                        <span className="font-mono">
                                          {func.returnType}
                                        </span>
                                      </p>
                                    )}
                                  </div>
                                ),
                              )}
                            </div>
                          </CardBody>
                        </Card>
                      )}

                    {functionalAnalysis.classes &&
                      functionalAnalysis.classes.length > 0 && (
                        <Card>
                          <CardHeader>
                            <h3 className="text-lg font-semibold">Classes</h3>
                          </CardHeader>
                          <Divider />
                          <CardBody>
                            <div className="space-y-3">
                              {functionalAnalysis.classes.map((cls, index) => (
                                <div
                                  key={index}
                                  className="border-l-2 border-secondary pl-3"
                                >
                                  <h4 className="font-mono font-semibold text-sm">
                                    {cls.name}
                                  </h4>
                                  {cls.description && (
                                    <p className="text-sm text-default-600 mt-1">
                                      {cls.description}
                                    </p>
                                  )}
                                  {cls.methods && cls.methods.length > 0 && (
                                    <div className="mt-2">
                                      <p className="text-xs text-default-400">
                                        Methods:
                                      </p>
                                      <div className="flex flex-wrap gap-1 mt-1">
                                        {cls.methods.map((method, i) => (
                                          <Chip
                                            key={i}
                                            color="secondary"
                                            size="sm"
                                            variant="flat"
                                          >
                                            {method}
                                          </Chip>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  {cls.properties &&
                                    cls.properties.length > 0 && (
                                      <div className="mt-2">
                                        <p className="text-xs text-default-400">
                                          Properties:
                                        </p>
                                        <div className="flex flex-wrap gap-1 mt-1">
                                          {cls.properties.map((prop, i) => (
                                            <Chip
                                              key={i}
                                              size="sm"
                                              variant="flat"
                                            >
                                              {prop}
                                            </Chip>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                </div>
                              ))}
                            </div>
                          </CardBody>
                        </Card>
                      )}

                    {functionalAnalysis.imports &&
                      functionalAnalysis.imports.length > 0 && (
                        <Card>
                          <CardHeader>
                            <h3 className="text-lg font-semibold">Imports</h3>
                          </CardHeader>
                          <Divider />
                          <CardBody>
                            <div className="flex flex-wrap gap-2">
                              {functionalAnalysis.imports.map((imp, index) => (
                                <Chip key={index} size="sm" variant="bordered">
                                  {imp}
                                </Chip>
                              ))}
                            </div>
                          </CardBody>
                        </Card>
                      )}

                    {functionalAnalysis.exports &&
                      functionalAnalysis.exports.length > 0 && (
                        <Card>
                          <CardHeader>
                            <h3 className="text-lg font-semibold">Exports</h3>
                          </CardHeader>
                          <Divider />
                          <CardBody>
                            <div className="flex flex-wrap gap-2">
                              {functionalAnalysis.exports.map((exp, index) => (
                                <Chip
                                  key={index}
                                  color="success"
                                  size="sm"
                                  variant="bordered"
                                >
                                  {exp}
                                </Chip>
                              ))}
                            </div>
                          </CardBody>
                        </Card>
                      )}

                    {functionalAnalysis.complexity !== undefined && (
                      <Card>
                        <CardHeader>
                          <h3 className="text-lg font-semibold">
                            Complexity Score
                          </h3>
                        </CardHeader>
                        <Divider />
                        <CardBody>
                          <div className="flex items-center gap-2">
                            <Chip
                              color={
                                functionalAnalysis.complexity < 10
                                  ? "success"
                                  : functionalAnalysis.complexity < 20
                                    ? "warning"
                                    : "danger"
                              }
                              size="lg"
                              variant="flat"
                            >
                              {functionalAnalysis.complexity}
                            </Chip>
                            <span className="text-sm text-default-500">
                              {functionalAnalysis.complexity < 10
                                ? "Low complexity"
                                : functionalAnalysis.complexity < 20
                                  ? "Moderate complexity"
                                  : "High complexity"}
                            </span>
                          </div>
                        </CardBody>
                      </Card>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-12">
                    <p className="text-default-400">
                      No functional analysis available
                    </p>
                  </div>
                )}
              </Tab>

              <Tab key="enrichment" title="FDD Enrichment">
                {fddEnrichment ? (
                  <div className="space-y-4 py-4">
                    {/* Overview */}
                    <Card>
                      <CardHeader>
                        <h3 className="text-lg font-semibold">
                          Enrichment Overview
                        </h3>
                      </CardHeader>
                      <Divider />
                      <CardBody className="space-y-4">
                        {fddEnrichment.createdAt && (
                          <div>
                            <p className="text-sm font-medium text-default-600 mb-1">
                              Enriched At
                            </p>
                            <p className="text-default-700">
                              {new Date(
                                fddEnrichment.createdAt,
                              ).toLocaleString()}
                            </p>
                          </div>
                        )}
                        {fddEnrichment.filePath && (
                          <div>
                            <p className="text-sm font-medium text-default-600 mb-1">
                              File Path
                            </p>
                            <p className="text-default-700 font-mono text-sm">
                              {fddEnrichment.filePath}
                            </p>
                          </div>
                        )}
                      </CardBody>
                    </Card>

                    {/* Enriched Sections */}
                    {fddEnrichment.enrichedSections &&
                      fddEnrichment.enrichedSections.length > 0 && (
                        <Card>
                          <CardHeader>
                            <h3 className="text-lg font-semibold">
                              Enriched Sections
                            </h3>
                          </CardHeader>
                          <Divider />
                          <CardBody>
                            <div className="flex flex-wrap gap-2">
                              {fddEnrichment.enrichedSections.map(
                                (section, index) => (
                                  <Chip
                                    key={index}
                                    color="primary"
                                    size="sm"
                                    variant="flat"
                                  >
                                    Section {section}
                                  </Chip>
                                ),
                              )}
                            </div>
                          </CardBody>
                        </Card>
                      )}

                    {/* Validation Report */}
                    {fddEnrichment.validationReport && (
                      <Card>
                        <CardHeader>
                          <h3 className="text-lg font-semibold">
                            Validation Report
                          </h3>
                        </CardHeader>
                        <Divider />
                        <CardBody className="space-y-4">
                          {fddEnrichment.validationReport
                            .totalSectionsReferencing !== undefined && (
                            <div>
                              <p className="text-sm font-medium text-default-600 mb-1">
                                Total Sections Referencing
                              </p>
                              <Chip color="success" size="lg" variant="flat">
                                {
                                  fddEnrichment.validationReport
                                    .totalSectionsReferencing
                                }
                              </Chip>
                            </div>
                          )}

                          {fddEnrichment.validationReport.existingReferences &&
                            fddEnrichment.validationReport.existingReferences
                              .length > 0 && (
                              <div>
                                <p className="text-sm font-medium text-default-600 mb-2">
                                  Existing References
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  {fddEnrichment.validationReport.existingReferences.map(
                                    (ref, index) => (
                                      <Chip
                                        key={index}
                                        color="default"
                                        size="sm"
                                        variant="bordered"
                                      >
                                        {ref}
                                      </Chip>
                                    ),
                                  )}
                                </div>
                              </div>
                            )}

                          {fddEnrichment.validationReport.addedReferences &&
                            fddEnrichment.validationReport.addedReferences
                              .length > 0 && (
                              <div>
                                <p className="text-sm font-medium text-default-600 mb-2">
                                  Added References
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  {fddEnrichment.validationReport.addedReferences.map(
                                    (ref, index) => (
                                      <Chip
                                        key={index}
                                        color="success"
                                        size="sm"
                                        variant="flat"
                                      >
                                        {ref}
                                      </Chip>
                                    ),
                                  )}
                                </div>
                              </div>
                            )}
                        </CardBody>
                      </Card>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-12">
                    <p className="text-default-400">
                      No FDD enrichment available
                    </p>
                  </div>
                )}
              </Tab>

              <Tab
                key="comments"
                title={
                  <div className="flex items-center gap-2">
                    <span>Comments</span>
                    {comments.length > 0 && (
                      <Chip color="primary" size="sm" variant="flat">
                        {comments.length}
                      </Chip>
                    )}
                  </div>
                }
              >
                <div className="space-y-4 py-4">
                  {/* Add Comment */}
                  <Card>
                    <CardHeader>
                      <h3 className="text-lg font-semibold">Add Comment</h3>
                    </CardHeader>
                    <Divider />
                    <CardBody className="space-y-3">
                      <Textarea
                        maxRows={6}
                        minRows={3}
                        placeholder="Write your comment here..."
                        value={newComment}
                        variant="bordered"
                        onValueChange={setNewComment}
                      />
                      <div className="flex justify-end">
                        <Button
                          color="primary"
                          isDisabled={!newComment.trim()}
                          isLoading={isAddingComment}
                          size="sm"
                          onPress={handleAddComment}
                        >
                          Add Comment
                        </Button>
                      </div>
                    </CardBody>
                  </Card>

                  {/* Comments List */}
                  {comments.length > 0 ? (
                    <Card>
                      <CardHeader>
                        <h3 className="text-lg font-semibold">
                          Comments ({comments.length})
                        </h3>
                      </CardHeader>
                      <Divider />
                      <CardBody className="space-y-3">
                        {comments.map((comment) => (
                          <div
                            key={comment.id}
                            className="p-3 rounded-lg border border-default-200 bg-default-50"
                          >
                            <div className="flex justify-between items-start gap-2">
                              <p className="text-default-700 whitespace-pre-wrap flex-1">
                                {comment.comment}
                              </p>
                              <Button
                                isIconOnly
                                color="danger"
                                isLoading={deletingCommentId === comment.id}
                                size="sm"
                                variant="light"
                                onPress={() => handleDeleteComment(comment.id)}
                              >
                                <svg
                                  className="h-4 w-4"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth={2}
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                              </Button>
                            </div>
                            <p className="text-xs text-default-400 mt-2">
                              {new Date(comment.createdAt).toLocaleString()}
                            </p>
                          </div>
                        ))}
                      </CardBody>
                    </Card>
                  ) : (
                    <div className="flex items-center justify-center py-8">
                      <p className="text-default-400">
                        No comments yet. Add the first one!
                      </p>
                    </div>
                  )}
                </div>
              </Tab>
            </Tabs>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
