export type DocumentRecord = {
  id:string; title?:string|null; summary?:string|null; status?:string; type?:string;
  documentType?:string; url?:string|null; createdAt?:string; updatedAt?:string;
  containerTags?:string[]; memories?: unknown[]; memoryEntries?: unknown[];
};
export type SearchResult = { id?:string; memory?:string; chunk?:string; similarity?:number; updatedAt?:string; metadata?:Record<string,unknown> };
