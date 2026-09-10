export type ContributingSummary = {
  hasContributing: boolean;
  repoUrl: string;
  defaultBranch: string;
  hasCodeOfConduct: boolean;
  path?: string;
  htmlUrl?: string;
  summary?: {
    intro: string;
    sections: { heading: string; excerpt: string }[];
    headingCount: number;
  };
};
