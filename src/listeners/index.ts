let initialized = false;

export async function initializeListeners(): Promise<void> {
  if (initialized) {
    return;
  }

  await Promise.all([import("./mouse"), import("./keyboard")]);

  initialized = true;
}
