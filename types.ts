
export interface InclusiveChange {
  id: string;
  original: string;
  inclusive: string;
}

export enum AppState {
  Initial,
  Loading,
  Comparing,
  Error,
}
