export const DEFAULT_FLY_NAME = 'MOSK';
export const MAX_FLY_NAME_LENGTH = 32;

/** Names are observer labels and must never affect the simulation's random stream. */
export function normalizeFlyName(value: string): string {
  const name = value.trim();
  if (!name || Array.from(name).length > MAX_FLY_NAME_LENGTH || /\p{Cc}/u.test(name))
    throw new Error('Choose a name with 1–32 characters and no control characters.');
  return name;
}

export function flyNameError(value: string): string {
  try {
    normalizeFlyName(value);
    return '';
  } catch (error) {
    return (error as Error).message;
  }
}
