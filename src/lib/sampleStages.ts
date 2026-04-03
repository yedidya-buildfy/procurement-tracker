export const SAMPLE_STAGES = [
  { id: 0, name: 'הוזמן', bg: 'bg-slate-100', text: 'text-slate-700', activeBg: 'bg-slate-500' },
  { id: 1, name: 'נשלח לסוכן', bg: 'bg-blue-100', text: 'text-blue-700', activeBg: 'bg-blue-500' },
  { id: 2, name: 'הגיע לסוכן', bg: 'bg-amber-100', text: 'text-amber-700', activeBg: 'bg-amber-500' },
  { id: 3, name: 'נשלח אלינו', bg: 'bg-purple-100', text: 'text-purple-700', activeBg: 'bg-purple-500' },
  { id: 4, name: 'הגיע', bg: 'bg-green-100', text: 'text-green-700', activeBg: 'bg-green-500' },
] as const;

export function getStageName(stageId: number | undefined | null): string {
  if (stageId == null) return 'לא הוזמן';
  return SAMPLE_STAGES[stageId]?.name || 'לא ידוע';
}

export function getStageStyle(stageId: number | undefined | null) {
  if (stageId == null) return { bg: 'bg-gray-100', text: 'text-gray-500' };
  const stage = SAMPLE_STAGES[stageId];
  if (!stage) return { bg: 'bg-gray-100', text: 'text-gray-500' };
  return { bg: stage.bg, text: stage.text };
}
