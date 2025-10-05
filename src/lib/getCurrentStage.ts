// src/lib/getCurrentStage.ts
export function getCurrentStage(vote: {
  stage1_start: string;
  stage1_end: string;
  stage2_start: string;
  stage2_end: string;
  stage3_start: string;
  stage3_end: string;
}) {
  const now = new Date();

  if (now >= new Date(vote.stage1_start) && now <= new Date(vote.stage1_end)) {
    return 1;
  } else if (now >= new Date(vote.stage2_start) && now <= new Date(vote.stage2_end)) {
    return 2;
  } else if (now >= new Date(vote.stage3_start) && now <= new Date(vote.stage3_end)) {
    return 3;
  }
  return null; // stage not active (before 1 or after 3)
}