export interface SDDSubsection {
  number: string;
  title: string;
  description: string;
  viewpointRef?: string;
}

export interface SDDSection {
  number: string;
  title: string;
  description: string;
  ieeeSection: string;
  documentLink?: string;
  subsections: SDDSubsection[];
}

export interface SDDTableOfContents {
  title: string;
  version: string;
  standard: string;
  sections: SDDSection[];
  createdAt: number;
  updatedAt: number;
}
