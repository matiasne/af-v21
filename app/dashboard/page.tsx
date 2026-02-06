"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@heroui/button";
import { Card, CardBody } from "@heroui/card";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
} from "@heroui/modal";
import { Input } from "@heroui/input";
import { Spinner } from "@heroui/spinner";

import { useAuth } from "@/infrastructure/context/AuthContext";
import { useProjects } from "@/infrastructure/hooks/useProjects";
import { Project } from "@/domain/entities/Project";
import { ProjectCard } from "./components/ProjectCard";
import Threads from "@/components/Threads";

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const { projects, loading, createProject, updateProject, deleteProject } =
    useProjects();
  const router = useRouter();

  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const {
    isOpen: isEditOpen,
    onOpen: onEditOpen,
    onOpenChange: onEditOpenChange,
  } = useDisclosure();
  const {
    isOpen: isDeleteOpen,
    onOpen: onDeleteOpen,
    onOpenChange: onDeleteOpenChange,
  } = useDisclosure();

  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [projectGithubUrl, setProjectGithubUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [projectToEdit, setProjectToEdit] = useState<Project | null>(null);

  if (authLoading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!user) {
    router.push("/login");

    return null;
  }

  const resetForm = () => {
    setProjectName("");
    setProjectDescription("");
    setProjectGithubUrl("");
  };

  const handleCreateProject = async (onClose: () => void) => {
    if (!projectName.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const projectData: {
        name: string;
        description: string;
        githubUrl?: string;
      } = {
        name: projectName.trim(),
        description: projectDescription.trim(),
      };

      if (projectGithubUrl.trim()) {
        projectData.githubUrl = projectGithubUrl.trim();
      }

      const id = await createProject(projectData);

      if (id) {
        resetForm();
        onClose();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditClick = (project: Project) => {
    setProjectToEdit(project);
    setProjectName(project.name);
    setProjectDescription(project.description);
    setProjectGithubUrl(project.githubUrl || "");
    onEditOpen();
  };

  const handleUpdateProject = async (onClose: () => void) => {
    if (!projectToEdit?.id || !projectName.trim()) return;

    setIsSubmitting(true);
    try {
      const updateData: {
        name: string;
        description: string;
        githubUrl?: string;
      } = {
        name: projectName.trim(),
        description: projectDescription.trim(),
      };

      if (projectGithubUrl.trim()) {
        updateData.githubUrl = projectGithubUrl.trim();
      }

      const success = await updateProject(projectToEdit.id, updateData);

      if (success) {
        resetForm();
        setProjectToEdit(null);
        onClose();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClick = (project: Project) => {
    setProjectToDelete(project);
    onDeleteOpen();
  };

  const handleConfirmDelete = async (onClose: () => void) => {
    if (!projectToDelete?.id) return;

    setIsSubmitting(true);
    await deleteProject(projectToDelete.id);
    setIsSubmitting(false);
    setProjectToDelete(null);
    onClose();
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="relative min-h-screen pt-16">
      <Threads
        color={[0.5, 0.3, 1]}
        amplitude={1.5}
        distance={0.2}
        enableMouseInteraction
        className="fixed inset-0 -z-10"
      />
      <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex justify-between items-center mb-8">
          <Button color="primary" onPress={onOpen}>
            New Project
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center items-center min-h-[40vh]">
            <Spinner size="lg" />
          </div>
        ) : projects.length === 0 ? (
          <Card className="p-8">
            <CardBody className="text-center">
              <p className="text-default-500 mb-4">
                You don&apos;t have any projects yet.
              </p>
              <Button color="primary" onPress={onOpen}>
                Create your first project
              </Button>
            </CardBody>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project, index) => (
              <ProjectCard
                key={project.id}
                project={project}
                onEditClick={handleEditClick}
                onDeleteClick={handleDeleteClick}
                formatDate={formatDate}
                index={index}
              />
            ))}
          </div>
        )}

        <Modal
          isOpen={isOpen}
          onOpenChange={(open) => {
            if (!open) resetForm();
            onOpenChange();
          }}
        >
          <ModalContent>
            {(onClose) => (
              <>
                <ModalHeader>Create New Project</ModalHeader>
                <ModalBody>
                  <Input
                    label="Project Name"
                    placeholder="Enter project name"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    onKeyDown={(e) => {
                      if (
                        e.key === "Enter" &&
                        projectName.trim() &&
                        !isSubmitting
                      ) {
                        handleCreateProject(onClose);
                      }
                    }}
                    isRequired
                  />
                  <Input
                    label="Description"
                    placeholder="Enter project description (optional)"
                    value={projectDescription}
                    onChange={(e) => setProjectDescription(e.target.value)}
                    onKeyDown={(e) => {
                      if (
                        e.key === "Enter" &&
                        projectName.trim() &&
                        !isSubmitting
                      ) {
                        handleCreateProject(onClose);
                      }
                    }}
                  />
                </ModalBody>
                <ModalFooter>
                  <Button variant="flat" onPress={onClose}>
                    Cancel
                  </Button>
                  <Button
                    color="primary"
                    isLoading={isSubmitting}
                    isDisabled={!projectName.trim()}
                    onPress={() => handleCreateProject(onClose)}
                  >
                    Create
                  </Button>
                </ModalFooter>
              </>
            )}
          </ModalContent>
        </Modal>

        <Modal
          isOpen={isEditOpen}
          onOpenChange={(open) => {
            if (!open) {
              resetForm();
              setProjectToEdit(null);
            }
            onEditOpenChange();
          }}
        >
          <ModalContent>
            {(onClose) => (
              <>
                <ModalHeader>Edit Project</ModalHeader>
                <ModalBody>
                  <Input
                    label="Project Name"
                    placeholder="Enter project name"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    onKeyDown={(e) => {
                      if (
                        e.key === "Enter" &&
                        projectName.trim() &&
                        !isSubmitting
                      ) {
                        handleUpdateProject(onClose);
                      }
                    }}
                    isRequired
                  />
                  <Input
                    label="Description"
                    placeholder="Enter project description (optional)"
                    value={projectDescription}
                    onChange={(e) => setProjectDescription(e.target.value)}
                    onKeyDown={(e) => {
                      if (
                        e.key === "Enter" &&
                        projectName.trim() &&
                        !isSubmitting
                      ) {
                        handleUpdateProject(onClose);
                      }
                    }}
                  />
                  <Input
                    label="GitHub URL"
                    placeholder="https://github.com/user/repo"
                    value={projectGithubUrl}
                    onChange={(e) => setProjectGithubUrl(e.target.value)}
                    onKeyDown={(e) => {
                      if (
                        e.key === "Enter" &&
                        projectName.trim() &&
                        !isSubmitting
                      ) {
                        handleUpdateProject(onClose);
                      }
                    }}
                    type="url"
                  />
                </ModalBody>
                <ModalFooter>
                  <Button variant="flat" onPress={onClose}>
                    Cancel
                  </Button>
                  <Button
                    color="primary"
                    isLoading={isSubmitting}
                    isDisabled={!projectName.trim()}
                    onPress={() => handleUpdateProject(onClose)}
                  >
                    Save Changes
                  </Button>
                </ModalFooter>
              </>
            )}
          </ModalContent>
        </Modal>

        <Modal isOpen={isDeleteOpen} onOpenChange={onDeleteOpenChange}>
          <ModalContent>
            {(onClose) => (
              <>
                <ModalHeader>Delete Project</ModalHeader>
                <ModalBody>
                  <p>
                    Are you sure you want to delete{" "}
                    <strong>{projectToDelete?.name}</strong>? This action cannot
                    be undone.
                  </p>
                </ModalBody>
                <ModalFooter>
                  <Button variant="flat" onPress={onClose}>
                    Cancel
                  </Button>
                  <Button
                    color="danger"
                    onPress={() => handleConfirmDelete(onClose)}
                    isLoading={isSubmitting}
                  >
                    Delete
                  </Button>
                </ModalFooter>
              </>
            )}
          </ModalContent>
        </Modal>
      </div>
    </div>
  );
}
