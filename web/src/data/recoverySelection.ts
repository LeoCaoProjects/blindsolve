const selectionKey = "blindsolve-selected-recovery-v1";

export function selectedRecovery() {
  try {
    return sessionStorage.getItem(selectionKey);
  } catch {
    return null;
  }
}

export function setSelectedRecovery(id: string | null) {
  if (id) sessionStorage.setItem(selectionKey, id);
  else sessionStorage.removeItem(selectionKey);
}
