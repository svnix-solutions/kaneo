import type getCandidate from "./get-candidate";
import type getCandidateFields from "./get-candidate-fields";
import type getCandidateTasks from "./get-candidate-tasks";

export type Candidate = Awaited<ReturnType<typeof getCandidate>>;
export type CandidateField = Awaited<
  ReturnType<typeof getCandidateFields>
>[number];
export type CandidateTask = Awaited<
  ReturnType<typeof getCandidateTasks>
>[number];
