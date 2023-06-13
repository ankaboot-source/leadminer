export interface FlatTree {
  label: string;
  path: string;
  attribs?: string[];
  parent?: FlatTree;
  total?: number;
  cumulativeTotal?: number;
  children?: FlatTree[];
}

export interface EmailMessage {
  header: any;
  body?: string;
  seqNumber: number;
  isLast: boolean;
  userId: string;
  userEmail: string;
  folderName: string;
  userIdentifier: string;
  miningId: string;
}
