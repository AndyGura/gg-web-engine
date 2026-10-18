/**
 * Copies the keys given in `keys` (skipping `undefined` ones) onto `options`: what each built-in
 * controller's `setKeys` does before telling its bindings. Not exported from the package
 */
export function assignKeys<T extends object>(options: T, keys: Partial<T>): void {
  for (const name of Object.keys(keys) as (keyof T)[]) {
    if (keys[name] !== undefined) {
      options[name] = keys[name] as T[keyof T];
    }
  }
}
