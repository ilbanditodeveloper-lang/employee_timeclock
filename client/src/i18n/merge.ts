type PlainObject = Record<string, unknown>;

export function mergeDeep<T extends PlainObject>(target: T, ...sources: PlainObject[]): T {
  const output = { ...target } as PlainObject;
  for (const source of sources) {
    for (const key of Object.keys(source)) {
      const srcVal = source[key];
      const tgtVal = output[key];
      if (
        srcVal &&
        typeof srcVal === "object" &&
        !Array.isArray(srcVal) &&
        tgtVal &&
        typeof tgtVal === "object" &&
        !Array.isArray(tgtVal)
      ) {
        output[key] = mergeDeep(tgtVal as PlainObject, srcVal as PlainObject);
      } else {
        output[key] = srcVal;
      }
    }
  }
  return output as T;
}
