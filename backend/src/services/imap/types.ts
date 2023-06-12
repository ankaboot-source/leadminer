export interface FlatTree {
  label: string;
  path: string;
  attribs?: string[];
  parent?: FlatTree;
  total?: number;
  cumulativeTotal?: number;
  children?: FlatTree[];
}
