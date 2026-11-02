import type { Workspace } from "./domain";
export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function preferNewerWorkspace(current: Workspace, incoming: Workspace) {
  return incoming.revision >= current.revision ? incoming : current;
}
