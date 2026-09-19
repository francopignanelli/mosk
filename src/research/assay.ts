export const ASSAY_MODEL = 'huang-luo-2024@5d7c08a9' as const;
export const ASSAY_PROTOCOLS = [
  'conditioning',
  'retention',
  'extinction-10m',
  'extinction-2h',
  'extinction-control',
  'feedback-control',
  'feedback-intact',
] as const;
export const ASSAY_BOUTS: Record<(typeof ASSAY_PROTOCOLS)[number], number> = {
  conditioning: 41,
  retention: 51,
  'extinction-10m': 38,
  'extinction-2h': 38,
  'extinction-control': 25,
  'feedback-control': 21,
  'feedback-intact': 21,
};
export interface AssayCheckpoint {
  version: 1;
  model: typeof ASSAY_MODEL;
  odorSet: 'attractive' | 'repulsive';
  protocol: (typeof ASSAY_PROTOCOLS)[number];
  cursor: number;
}
/** A deterministic replay checkpoint, never unvalidated arbitrary neural state. */
export function isAssayCheckpoint(value: unknown): value is AssayCheckpoint {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  if (Object.getPrototypeOf(v) !== Object.prototype && Object.getPrototypeOf(v) !== null)
    return false;
  return checkFields(v);
}
function checkFields(v: Record<string, unknown>): boolean {
  const allowed = ['version', 'model', 'odorSet', 'protocol', 'cursor'];
  return (
    Object.keys(v).length === allowed.length &&
    Object.keys(v).every((key) => allowed.includes(key)) &&
    v.version === 1 &&
    v.model === ASSAY_MODEL &&
    ['attractive', 'repulsive'].includes(v.odorSet as string) &&
    ASSAY_PROTOCOLS.includes(v.protocol as AssayCheckpoint['protocol']) &&
    Number.isSafeInteger(v.cursor) &&
    (v.cursor as number) >= 0 &&
    (v.cursor as number) <= ASSAY_BOUTS[v.protocol as AssayCheckpoint['protocol']]
  );
}
