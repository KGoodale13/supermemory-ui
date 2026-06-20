export type MemoryRecord = {
  id:string; memory:string; createdAt?:string; updatedAt?:string; isLatest?:boolean;
  isForgotten?:boolean; version?:number; spaceContainerTag?:string|null;
};
export type DocumentRecord = {
  id:string; title?:string|null; summary?:string|null; status?:string; type?:string;
  documentType?:string; url?:string|null; createdAt?:string; updatedAt?:string;
  content?:string|null; containerTags?:string[]; memories?: MemoryRecord[]; memoryEntries?: MemoryRecord[];
};
