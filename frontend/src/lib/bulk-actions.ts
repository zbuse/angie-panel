export async function runSequentially<T>(
  values: T[],
  action: (value: T) => Promise<unknown>,
): Promise<{ failed: Array<{ value: T; error: unknown }> }> {
  const failed: Array<{ value: T; error: unknown }> = []
  for (const value of values) {
    try {
      await action(value)
    } catch (error) {
      failed.push({ value, error })
    }
  }
  return { failed }
}
