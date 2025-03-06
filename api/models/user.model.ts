export interface User {
  id: number;
  email: string;
  password: string;
  created_at: Date;
}

export interface AuthenticatedRequest extends Request {
  user?: User;
}