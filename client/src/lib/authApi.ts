/** Empty credentials — auth via httpOnly session cookie after login. */
export const emptyCreds = {} as { username?: string; password?: string };

export function employeeQueryInput(employeeId: number) {
  return { ...emptyCreds, employeeId };
}
