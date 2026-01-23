export interface TechItem {
  name: string;
  extensions: string[];
}

export interface TechStackAnalysis {
  languages: TechItem[];
  frameworks: TechItem[];
  databases: TechItem[];
  buildTools: TechItem[];
  packageManagers: TechItem[];
  testingFrameworks: TechItem[];
  tools: TechItem[];
  summary: string;
}
