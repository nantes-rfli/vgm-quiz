// API response/DTO types aligned with current MSW fixtures
export interface Question {
  id: string;
  title: string;
  choices: string[];
}

export interface StartResponse {
  token: string;
  question: Question;
}

export interface NextResponse {
  token: string;
  question: Question;
  finished?: boolean;
}
